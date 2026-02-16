"""
Text extraction and normalization for PDF text and HTML source files.

Provides a common normalization pipeline so that both sources can be
compared on an equal footing, removing artifacts that are inherent to
PDF extraction and HTML conversion.
"""

import os
import re
import unicodedata

from bs4 import BeautifulSoup

from tests.conftest import HTML_SOURCE_DIR, PDF_TEXT_DIR, CHAPTER_MAP


# ---------------------------------------------------------------------------
# Normalization
# ---------------------------------------------------------------------------

# PDF header pattern: "C O M P E N D I U M  O F  U .S. C O P Y R I G H T ..."
_PDF_HEADER_RE = re.compile(
    r"C\s*O\s*M\s*P\s*E\s*N\s*D\s*I\s*U\s*M\s+O\s*F\s+U\s*\.?\s*S\s*\.?"
    r"\s+C\s*O\s*P\s*Y\s*R\s*I\s*G\s*H\s*T\s+O\s*F\s*F\s*I\s*C\s*E"
    r"\s+P\s*R\s*A\s*C\s*T\s*I\s*C\s*E\s*S\s*,?\s*Third\s+Edition",
    re.IGNORECASE,
)

# Short header variant: "C O M P E N D I U M : Chapter 200"
_PDF_SHORT_HEADER_RE = re.compile(
    r"C\s*O\s*M\s*P\s*E\s*N\s*D\s*I\s*U\s*M\s*:\s*Chapter\s+\d+",
    re.IGNORECASE,
)

# PDF footer / page header pattern: "Chapter 200 : 3 01/28/2021"
# Also matches: "Introduction : 1 01/28/2021", "Chapter 2 00 : 1 01/28/2021"
# General form: <AnyTitle> : <PageNum> <MM/DD/YYYY>
_PDF_FOOTER_RE = re.compile(
    r"[\w\s]{3,40}?\s*:\s*\d+\s+\d{2}/\d{2}/\d{4}", re.IGNORECASE
)

# TOC dot-leaders + page numbers: "What This Chapter Covers ... 3"
# Also matches section entries like "201.3 Who May File ... 5"
# Handles spaced dots: ".... .... ..... 3"
_TOC_DOTS_RE = re.compile(r"[.\s]{6,}\d+")

# TOC block: sequences of dots (possibly with spaces) followed by content
# This removes leftover dot-leader runs even without trailing page numbers
_TOC_DOT_RUNS_RE = re.compile(r"\.{3,}[\s.]*")

# Overview title pattern in PDF: "Overview of the Registration Process"
# These appear as a chapter title in the header/TOC area
_PDF_OVERVIEW_RE = re.compile(
    r"Overview\s+of\s*(?:the\s+)?\w[\w\s]*?(?=\d{3}\s)", re.IGNORECASE
)

# Bullet markers from PDF
_BULLET_RE = re.compile(r"[•·▪▸►]\s*")

# PDF line-break word fragments: e.g. "pra ctices" → "practices"
# Matches a lowercase letter sequence, a space, then lowercase letters where
# the combined form is a real word fragment (heuristic: 2-4 + 3+ chars)
_WORD_FRAGMENT_RE = re.compile(r"\b([a-z]{2,4})\s([a-z]{3,})\b")

# Multiple whitespace
_MULTI_WS_RE = re.compile(r"\s+")

# HTML/XML tags embedded in PDF text (e.g. <ahref="..."> , </a>)
_XML_TAG_RE = re.compile(r"<[^>]+>")


def normalize_unicode(text: str) -> str:
    """Normalize Unicode characters to ASCII-friendly equivalents."""
    # Curly quotes → straight
    replacements = {
        "\u2018": "'",  # '
        "\u2019": "'",  # '
        "\u201c": '"',  # "
        "\u201d": '"',  # "
        "\u2014": "--",  # em-dash
        "\u2013": "-",  # en-dash
        "\u00a0": " ",  # non-breaking space
        "\u2026": "...",  # ellipsis
        "\u00ad": "",  # soft hyphen
    }
    for orig, repl in replacements.items():
        text = text.replace(orig, repl)
    # Normalize remaining to NFC
    text = unicodedata.normalize("NFC", text)
    return text


def _fix_word_fragments(text: str) -> str:
    """Rejoin words that were split by PDF line breaks.

    PDF extraction often produces fragments like 'pra ctices', 'circum stances',
    'appli cant'. This heuristic rejoins them when the combined form looks
    like a single word (lowercase + lowercase with no intervening punctuation).
    """
    # Iteratively fix fragments (some texts have multiple)
    for _ in range(3):
        new_text = _WORD_FRAGMENT_RE.sub(r"\1\2", text)
        if new_text == text:
            break
        text = new_text
    return text


def normalize_text(text: str, remove_pdf_artifacts: bool = True) -> str:
    """Apply the full normalization pipeline to a text string.

    Args:
        text: Raw text to normalize.
        remove_pdf_artifacts: If True, strip known PDF headers, footers,
            and TOC dot-leaders. Set to True for PDF text; can be False
            for HTML text which won't have these.

    Returns:
        Normalized text with collapsed whitespace.
    """
    text = normalize_unicode(text)

    if remove_pdf_artifacts:
        text = _XML_TAG_RE.sub("", text)
        text = _PDF_HEADER_RE.sub("", text)
        text = _PDF_SHORT_HEADER_RE.sub("", text)
        text = _PDF_FOOTER_RE.sub("", text)
        text = _TOC_DOTS_RE.sub("", text)
        text = _TOC_DOT_RUNS_RE.sub("", text)
        text = _PDF_OVERVIEW_RE.sub("", text)
        text = _BULLET_RE.sub("", text)
        text = _fix_word_fragments(text)

    # Collapse whitespace
    text = _MULTI_WS_RE.sub(" ", text)
    return text.strip()


# ---------------------------------------------------------------------------
# HTML text extraction
# ---------------------------------------------------------------------------

# Tags whose text content we want (semantic body content)
_CONTENT_TAGS = {
    "paragraph",
    "section_title",
    "subsection_title",
    "provision_title",
    "subprovision_title",
    "item",
    "cite",
    "num",
    "note",
}

# Tags to skip entirely (structural, not text content)
_SKIP_TAGS = {"toc", "tocitem", "page", "head", "title", "style", "script"}


def extract_text_from_html(html_path: str) -> str:
    """Extract text content from an HTML source file.

    Parses the custom XHTML-style markup used in the CompendiumUI source
    files (e.g. <paragraph>, <section_title>, <cite>, etc.) and extracts
    the text content, stripping internal markup like <a>, <i>, <ref>.

    Args:
        html_path: Path to the HTML source file.

    Returns:
        Normalized text extracted from the HTML body content.
    """
    with open(html_path, "r", encoding="utf-8") as f:
        content = f.read()

    soup = BeautifulSoup(content, "html.parser")

    # Remove elements we want to skip entirely
    for tag_name in _SKIP_TAGS:
        for tag in soup.find_all(tag_name):
            tag.decompose()

    # Extract text from the body or chapter element
    body = soup.find("chapter") or soup.find("body") or soup
    text = body.get_text(separator=" ", strip=True)
    return normalize_text(text, remove_pdf_artifacts=False)


def extract_sections_from_html(html_path: str) -> list[dict]:
    """Extract text organized by section from an HTML source file.

    Returns a list of dicts with keys:
        - section_id: e.g. 'sec-201', 'subsec-202-1'
        - section_label: e.g. '201', '202.1'
        - text: normalized text content of the section
    """
    with open(html_path, "r", encoding="utf-8") as f:
        content = f.read()

    soup = BeautifulSoup(content, "html.parser")

    # Remove TOC and page markers
    for tag_name in ("toc", "tocitem", "page"):
        for tag in soup.find_all(tag_name):
            tag.decompose()

    sections = []
    for tag in soup.find_all(
        ["section", "subsection", "provision", "subprovision"]
    ):
        section_id = tag.get("id", "unknown")
        section_label = tag.get("label", "")
        text = tag.get_text(separator=" ", strip=True)
        text = normalize_text(text, remove_pdf_artifacts=False)
        if text:
            sections.append(
                {
                    "section_id": section_id,
                    "section_label": section_label,
                    "text": text,
                }
            )
    return sections


# ---------------------------------------------------------------------------
# PDF text extraction (from pre-extracted .txt files)
# ---------------------------------------------------------------------------


def extract_text_from_pdf_txt(txt_path: str) -> str:
    """Load and normalize text from a pre-extracted PDF text file.

    Args:
        txt_path: Path to the .txt file in copyright_compendium_pdfs/.

    Returns:
        Normalized text with PDF artifacts removed.
    """
    with open(txt_path, "r", encoding="utf-8") as f:
        text = f.read()
    return normalize_text(text, remove_pdf_artifacts=True)


# ---------------------------------------------------------------------------
# High-level API
# ---------------------------------------------------------------------------


def get_chapter_texts(chapter_id: str) -> tuple[str, str]:
    """Get normalized text for both HTML and PDF sources of a chapter.

    Args:
        chapter_id: Chapter identifier (e.g. 'ch200', 'glossary').

    Returns:
        Tuple of (html_text, pdf_text), both normalized.

    Raises:
        FileNotFoundError: If either source file is missing.
        KeyError: If chapter_id is not recognized.
    """
    if chapter_id not in CHAPTER_MAP:
        raise KeyError(f"Unknown chapter ID: {chapter_id!r}")

    chapter = CHAPTER_MAP[chapter_id]
    html_path = os.path.join(HTML_SOURCE_DIR, chapter["html"])
    txt_path = os.path.join(PDF_TEXT_DIR, chapter["txt"])

    if not os.path.exists(html_path):
        raise FileNotFoundError(f"HTML source not found: {html_path}")
    if not os.path.exists(txt_path):
        raise FileNotFoundError(f"PDF text not found: {txt_path}")

    html_text = extract_text_from_html(html_path)
    pdf_text = extract_text_from_pdf_txt(txt_path)

    return html_text, pdf_text
