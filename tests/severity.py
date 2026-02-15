"""
Severity classification for text discrepancies.

Classifies each discrepancy as HIGH, MEDIUM, or LOW based on the
likelihood that the difference is a PDF extraction artifact rather
than a genuine content error.
"""

import re
from dataclasses import dataclass
from enum import Enum


class Severity(Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"

    def __str__(self) -> str:
        return self.value


@dataclass
class Discrepancy:
    """A single text discrepancy between PDF and HTML."""

    severity: Severity
    chapter: str
    location: str  # nearest section number or page reference
    pdf_text: str
    html_text: str
    description: str
    source: str = "algorithmic"  # 'algorithmic' or 'llm'


# ---------------------------------------------------------------------------
# Classification patterns
# ---------------------------------------------------------------------------

# Patterns that indicate LOW severity (PDF extraction artifacts)
_WHITESPACE_ONLY_RE = re.compile(r"^[\s\-]+$")

_PDF_HEADER_WORDS = {
    "compendium",
    "copyright",
    "office",
    "practices",
    "third",
    "edition",
}

# Case-only change pattern (e.g. "NO." → "No.")
_CASE_ONLY_RE = re.compile(r"^[A-Za-z.]+$")

# Punctuation-only diff (just periods, commas, semicolons at boundaries)
_PUNCT_ONLY_RE = re.compile(r"^[.,;:!?\s]*$")

# Section/page number pattern
_SECTION_NUM_RE = re.compile(r"\d+\.\d+(\([A-Za-z0-9]+\))*")

# Hyphenation at line break: word fragments
_HYPHEN_FRAG_RE = re.compile(r"^[a-z]+$")

# TOC-like content: dense sequences of section numbers and titles
# e.g. "201 What This Chapter Covers 202 Purposes and Advantages..."
_TOC_PATTERN_RE = re.compile(r"(\d{3,4}(?:\.\d+)?\s+[A-Z][a-z]+\s+){3,}")

# Space-stripped TOC: "201WhatThisChapterCovers202PurposesandAdvantages..."
# Matches when we see 3+ occurrences of a section number followed by title words
_TOC_STRIPPED_RE = re.compile(r"(\d{3,4}(?:\.\d+)?[A-Z][a-z]+){3,}")

# Section delimiter: short diff that's just a period + section number
# e.g. ".202", ".206", ". 204.3"
_SECTION_DELIM_RE = re.compile(r"^\.?\s*\d{3,4}(?:\.\d+)?\s*\.?$")


def _is_whitespace_only_diff(pdf_snippet: str, html_snippet: str) -> bool:
    """Check if the difference is only whitespace/hyphenation/word-joining.

    This catches the most common PDF extraction artifact: words that get
    joined or split at line boundaries (e.g., 'ofthe' vs 'of the',
    'pra ctices' vs 'practices').
    """
    # Strip ALL whitespace and compare
    pdf_clean = re.sub(r"\s+", "", pdf_snippet)
    html_clean = re.sub(r"\s+", "", html_snippet)
    return pdf_clean == html_clean


def _is_case_only_diff(pdf_snippet: str, html_snippet: str) -> bool:
    """Check if the difference is case-only (e.g. NO. → No.)."""
    return pdf_snippet.lower() == html_snippet.lower()


def _is_pdf_header_footer(text: str) -> bool:
    """Check if text matches PDF header/footer content."""
    words = set(text.lower().split())
    # If most words are header words, it's a header
    if len(words) > 0 and len(words & _PDF_HEADER_WORDS) / len(words) > 0.5:
        return True
    # Footer pattern
    if re.match(r"chapter\s+\d+\s*:\s*\d+\s+\d{2}/\d{2}/\d{4}", text, re.I):
        return True
    return False


def _is_punctuation_only(pdf_snippet: str, html_snippet: str) -> bool:
    """Check if the diff is only trailing/leading punctuation."""
    # Compare without punctuation at boundaries
    pdf_stripped = pdf_snippet.rstrip(".,;:!? ")
    html_stripped = html_snippet.rstrip(".,;:!? ")
    return pdf_stripped == html_stripped and pdf_snippet != html_snippet


def _has_changed_numbers(pdf_snippet: str, html_snippet: str) -> bool:
    """Check if section numbers or references have changed."""
    pdf_nums = set(_SECTION_NUM_RE.findall(pdf_snippet))
    html_nums = set(_SECTION_NUM_RE.findall(html_snippet))
    if pdf_nums != html_nums and (pdf_nums or html_nums):
        return True
    # Also check for simple number changes
    pdf_digits = re.findall(r"\d+", pdf_snippet)
    html_digits = re.findall(r"\d+", html_snippet)
    return pdf_digits != html_digits


def _is_substantial_text_change(pdf_snippet: str, html_snippet: str) -> bool:
    """Check if this represents a substantial content change."""
    # Length difference > 50% suggests missing/added content
    if len(pdf_snippet) == 0 or len(html_snippet) == 0:
        return True
    ratio = min(len(pdf_snippet), len(html_snippet)) / max(
        len(pdf_snippet), len(html_snippet)
    )
    return ratio < 0.5


def classify_discrepancy(
    pdf_snippet: str,
    html_snippet: str,
    chapter: str = "",
    location: str = "",
    description: str = "",
    pdf_diff: str = "",
    html_diff: str = "",
) -> Discrepancy:
    """Classify a discrepancy and return a Discrepancy object.

    Args:
        pdf_snippet: Context text from PDF around the discrepancy.
        html_snippet: Context text from HTML around the discrepancy.
        chapter: Chapter identifier.
        location: Nearest section number.
        description: Description of the difference.
        pdf_diff: Raw character-level diff from PDF (space-stripped).
        html_diff: Raw character-level diff from HTML (space-stripped).

    Classification rules (in priority order):
    1. Whitespace/hyphenation only → LOW
    2. PDF header/footer content → LOW
    3. Case-only change → LOW
    4. Punctuation-only change → MEDIUM
    4a. TOC content → LOW
    4b. Section delimiters → MEDIUM
    5. Changed numbers/section references → HIGH
    6. Substantial text addition/deletion → HIGH
    7. Default → MEDIUM
    """
    # Rule 1: Whitespace only
    if _is_whitespace_only_diff(pdf_snippet, html_snippet):
        return Discrepancy(
            severity=Severity.LOW,
            chapter=chapter,
            location=location,
            pdf_text=pdf_snippet,
            html_text=html_snippet,
            description=description or "Whitespace/hyphenation difference only",
        )

    # Rule 2: PDF header/footer
    if _is_pdf_header_footer(pdf_snippet) or _is_pdf_header_footer(html_snippet):
        return Discrepancy(
            severity=Severity.LOW,
            chapter=chapter,
            location=location,
            pdf_text=pdf_snippet,
            html_text=html_snippet,
            description=description or "PDF header/footer artifact",
        )

    # Rule 3: Case-only
    if _is_case_only_diff(pdf_snippet, html_snippet):
        return Discrepancy(
            severity=Severity.LOW,
            chapter=chapter,
            location=location,
            pdf_text=pdf_snippet,
            html_text=html_snippet,
            description=description or "Case-only difference (e.g. NO. → No.)",
        )

    # Rule 4: Punctuation-only
    if _is_punctuation_only(pdf_snippet, html_snippet):
        return Discrepancy(
            severity=Severity.MEDIUM,
            chapter=chapter,
            location=location,
            pdf_text=pdf_snippet,
            html_text=html_snippet,
            description=description or "Punctuation difference",
        )

    # Rule 4a: TOC-like content (dense section number listing)
    # Use raw diff if available, otherwise fall back to snippets
    check_pdf = pdf_diff or pdf_snippet
    check_html = html_diff or html_snippet

    def _is_toc(text: str) -> bool:
        return bool(_TOC_PATTERN_RE.search(text) or _TOC_STRIPPED_RE.search(text))

    if not check_html.strip() and _is_toc(check_pdf):
        return Discrepancy(
            severity=Severity.LOW,
            chapter=chapter,
            location=location,
            pdf_text=pdf_snippet,
            html_text=html_snippet,
            description=description or "PDF table of contents content not in HTML",
        )
    if not check_pdf.strip() and _is_toc(check_html):
        return Discrepancy(
            severity=Severity.LOW,
            chapter=chapter,
            location=location,
            pdf_text=pdf_snippet,
            html_text=html_snippet,
            description=description or "HTML table of contents content not in PDF",
        )

    # Rule 4b: Section number delimiter (e.g. ".202", ".206")
    # Check raw diffs for short section-number-only patterns
    pdf_d = pdf_diff.strip() if pdf_diff else ""
    html_d = html_diff.strip() if html_diff else ""
    if (pdf_d and _SECTION_DELIM_RE.match(pdf_d)) or \
       (html_d and _SECTION_DELIM_RE.match(html_d)):
        return Discrepancy(
            severity=Severity.MEDIUM,
            chapter=chapter,
            location=location,
            pdf_text=pdf_snippet,
            html_text=html_snippet,
            description=description or "Section number delimiter difference",
        )

    # Rule 5: Changed numbers/section references
    if _has_changed_numbers(pdf_snippet, html_snippet):
        return Discrepancy(
            severity=Severity.HIGH,
            chapter=chapter,
            location=location,
            pdf_text=pdf_snippet,
            html_text=html_snippet,
            description=description
            or "Changed section number or numeric reference",
        )

    # Rule 6: Substantial text change
    if _is_substantial_text_change(pdf_snippet, html_snippet):
        return Discrepancy(
            severity=Severity.HIGH,
            chapter=chapter,
            location=location,
            pdf_text=pdf_snippet,
            html_text=html_snippet,
            description=description or "Substantial text addition or deletion",
        )

    # Rule 7: Default
    return Discrepancy(
        severity=Severity.MEDIUM,
        chapter=chapter,
        location=location,
        pdf_text=pdf_snippet,
        html_text=html_snippet,
        description=description or "Text difference",
    )
