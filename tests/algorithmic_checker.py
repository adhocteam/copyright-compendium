"""
Algorithmic text comparison engine.

Compares text from PDF and HTML sources using a character-level approach
on space-stripped text to find genuine content differences (not just
spacing/joining artifacts from PDF extraction).

Strategy:
1. Strip all whitespace from both texts for a character-level diff
2. Find differences using SequenceMatcher on character sequences
3. Map the character differences back to the original text for context
4. Classify each difference by severity
"""

import re
from difflib import SequenceMatcher

from tests.severity import Discrepancy, classify_discrepancy
from tests.text_extractor import get_chapter_texts


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _find_nearby_section(text: str, position: int) -> str:
    """Find the nearest section number before a given position in text."""
    section_re = re.compile(r"\b(\d{3,4}(?:\.\d+)?(?:\([A-Za-z0-9]+\))*)\b")
    prefix = text[: min(position, len(text))]
    matches = list(section_re.finditer(prefix))
    if matches:
        return matches[-1].group(1)
    return "unknown"


def _strip_whitespace(text: str) -> tuple[str, list[int]]:
    """Strip all whitespace from text, returning stripped text and index map.

    The index map maps each position in the stripped text back to its
    position in the original text, so we can extract context snippets.
    """
    stripped = []
    index_map = []
    for i, ch in enumerate(text):
        if not ch.isspace():
            stripped.append(ch)
            index_map.append(i)
    return "".join(stripped), index_map


def _get_context(text: str, start: int, end: int, context: int = 40) -> str:
    """Extract a context snippet from text around positions [start, end].

    Adds `context` characters on each side for readability.
    """
    ctx_start = max(0, start - context)
    ctx_end = min(len(text), end + context)
    snippet = text[ctx_start:ctx_end]
    # Clean up whitespace for display
    snippet = re.sub(r"\s+", " ", snippet).strip()
    return snippet


# ---------------------------------------------------------------------------
# Comparison
# ---------------------------------------------------------------------------

# Minimum diff size to report (skip tiny 1-2 char diffs that are often
# just punctuation or case artifacts)
_MIN_DIFF_SIZE = 1


def compare_chapter(chapter_id: str) -> list[Discrepancy]:
    """Compare PDF and HTML text for a chapter and return discrepancies.

    Uses character-level comparison on space-stripped text to find
    genuine content differences while ignoring whitespace artifacts.

    Args:
        chapter_id: Chapter identifier (e.g. 'ch200').

    Returns:
        List of classified Discrepancy objects.
    """
    html_text, pdf_text = get_chapter_texts(chapter_id)

    # Strip whitespace and build index maps
    pdf_stripped, pdf_map = _strip_whitespace(pdf_text)
    html_stripped, html_map = _strip_whitespace(html_text)

    # Character-level matching
    matcher = SequenceMatcher(None, pdf_stripped, html_stripped, autojunk=False)
    discrepancies: list[Discrepancy] = []

    for op, i1, i2, j1, j2 in matcher.get_opcodes():
        if op == "equal":
            continue

        diff_len = max(i2 - i1, j2 - j1)
        if diff_len < _MIN_DIFF_SIZE:
            continue

        # Map back to original positions
        if i1 < len(pdf_map) and i2 > 0:
            pdf_orig_start = pdf_map[i1] if i1 < len(pdf_map) else len(pdf_text)
            pdf_orig_end = pdf_map[min(i2 - 1, len(pdf_map) - 1)] + 1
            pdf_snippet = _get_context(pdf_text, pdf_orig_start, pdf_orig_end)
            location = _find_nearby_section(pdf_text, pdf_orig_start)
        else:
            pdf_snippet = ""
            location = "unknown"

        if j1 < len(html_map) and j2 > 0:
            html_orig_start = html_map[j1] if j1 < len(html_map) else len(html_text)
            html_orig_end = html_map[min(j2 - 1, len(html_map) - 1)] + 1
            html_snippet = _get_context(html_text, html_orig_start, html_orig_end)
        else:
            html_snippet = ""

        # Get the actual character diff for classification
        pdf_chars = pdf_stripped[i1:i2]
        html_chars = html_stripped[j1:j2]

        if op == "replace":
            desc = f"Text differs: '{pdf_chars[:50]}' → '{html_chars[:50]}'"
        elif op == "delete":
            desc = f"Text in PDF missing from HTML: '{pdf_chars[:80]}'"
        elif op == "insert":
            desc = f"Text in HTML not in PDF: '{html_chars[:80]}'"
        else:
            desc = f"Unexpected operation: {op}"

        discrepancy = classify_discrepancy(
            pdf_snippet=pdf_snippet,
            html_snippet=html_snippet,
            chapter=chapter_id,
            location=location,
            description=desc,
            pdf_diff=pdf_chars,
            html_diff=html_chars,
        )
        discrepancies.append(discrepancy)

    return discrepancies


def compare_chapters(chapter_ids: list[str]) -> dict[str, list[Discrepancy]]:
    """Compare multiple chapters and return results keyed by chapter ID.

    Args:
        chapter_ids: List of chapter identifiers.

    Returns:
        Dict mapping chapter_id → list of Discrepancy objects.
    """
    results = {}
    for chapter_id in chapter_ids:
        try:
            results[chapter_id] = compare_chapter(chapter_id)
        except (FileNotFoundError, KeyError) as e:
            print(f"WARNING: Skipping {chapter_id}: {e}")
            results[chapter_id] = []
    return results
