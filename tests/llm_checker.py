"""
LLM-based QA checker using the Gemini API.

Sends chapter text to an LLM for semantic comparison, parsing the
structured JSON response into Discrepancy objects.
"""

import json
import os
import time

from tests.severity import Discrepancy, Severity
from tests.text_extractor import get_chapter_texts

_PROMPT_PATH = os.path.join(os.path.dirname(__file__), "llm_prompt.txt")

# Maximum text length to send to the LLM (characters).
# Very large chapters may need to be chunked.
_MAX_CHUNK_SIZE = 200_000


def _load_prompt() -> str:
    """Load the LLM prompt template."""
    with open(_PROMPT_PATH, "r", encoding="utf-8") as f:
        return f.read()


def _parse_llm_response(
    response_text: str, chapter_id: str
) -> list[Discrepancy]:
    """Parse the LLM's JSON response into Discrepancy objects."""
    # Try to extract JSON from the response (may be wrapped in markdown)
    text = response_text.strip()
    if text.startswith("```"):
        # Strip markdown code fences
        lines = text.split("\n")
        json_lines = []
        in_block = False
        for line in lines:
            if line.strip().startswith("```"):
                in_block = not in_block
                continue
            if in_block:
                json_lines.append(line)
        text = "\n".join(json_lines)

    try:
        items = json.loads(text)
    except json.JSONDecodeError:
        # Try to find JSON array in the response
        start = text.find("[")
        end = text.rfind("]")
        if start != -1 and end != -1:
            try:
                items = json.loads(text[start : end + 1])
            except json.JSONDecodeError:
                print(f"WARNING: Could not parse LLM response for {chapter_id}")
                return []
        else:
            print(f"WARNING: No JSON array found in LLM response for {chapter_id}")
            return []

    discrepancies = []
    for item in items:
        try:
            severity_str = item.get("severity", "MEDIUM").upper()
            severity = Severity[severity_str]
        except KeyError:
            severity = Severity.MEDIUM

        discrepancies.append(
            Discrepancy(
                severity=severity,
                chapter=chapter_id,
                location=str(item.get("location", "unknown")),
                pdf_text=str(item.get("pdf_text", "")),
                html_text=str(item.get("html_text", "")),
                description=str(item.get("description", "")),
                source="llm",
            )
        )

    return discrepancies


def check_chapter_with_llm(
    chapter_id: str, delay: float = 2.0
) -> list[Discrepancy]:
    """Run LLM-based QA on a single chapter.

    Requires the GOOGLE_API_KEY environment variable to be set.

    Args:
        chapter_id: Chapter identifier (e.g. 'ch200').
        delay: Seconds to wait after API call (rate limiting).

    Returns:
        List of Discrepancy objects from the LLM analysis.
        Empty list if the API key is not set or the call fails.
    """
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        print(
            "WARNING: GOOGLE_API_KEY not set. Skipping LLM check for "
            f"{chapter_id}."
        )
        return []

    try:
        import google.generativeai as genai
    except ImportError:
        print(
            "WARNING: google-generativeai not installed. "
            "Install with: pip install google-generativeai"
        )
        return []

    genai.configure(api_key=api_key)

    html_text, pdf_text = get_chapter_texts(chapter_id)

    # Truncate if needed
    if len(pdf_text) > _MAX_CHUNK_SIZE:
        print(
            f"  NOTE: Truncating PDF text for {chapter_id} "
            f"({len(pdf_text)} → {_MAX_CHUNK_SIZE} chars)"
        )
        pdf_text = pdf_text[:_MAX_CHUNK_SIZE]
    if len(html_text) > _MAX_CHUNK_SIZE:
        print(
            f"  NOTE: Truncating HTML text for {chapter_id} "
            f"({len(html_text)} → {_MAX_CHUNK_SIZE} chars)"
        )
        html_text = html_text[:_MAX_CHUNK_SIZE]

    prompt_template = _load_prompt()
    prompt = prompt_template.format(pdf_text=pdf_text, html_text=html_text)

    try:
        model = genai.GenerativeModel("gemini-2.5-flash")
        response = model.generate_content(prompt)
        result = response.text
    except Exception as e:
        print(f"WARNING: LLM call failed for {chapter_id}: {e}")
        return []

    if delay > 0:
        time.sleep(delay)

    return _parse_llm_response(result, chapter_id)


def check_chapters_with_llm(
    chapter_ids: list[str], delay: float = 2.0
) -> dict[str, list[Discrepancy]]:
    """Run LLM-based QA on multiple chapters.

    Args:
        chapter_ids: List of chapter identifiers.
        delay: Seconds between API calls.

    Returns:
        Dict mapping chapter_id → list of Discrepancy objects.
    """
    results = {}
    for i, chapter_id in enumerate(chapter_ids):
        print(
            f"  LLM checking [{i+1}/{len(chapter_ids)}]: {chapter_id}..."
        )
        try:
            results[chapter_id] = check_chapter_with_llm(chapter_id, delay)
        except (FileNotFoundError, KeyError) as e:
            print(f"  WARNING: Skipping {chapter_id}: {e}")
            results[chapter_id] = []
    return results
