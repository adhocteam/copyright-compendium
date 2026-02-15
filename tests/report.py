"""
Report generator for QA discrepancy results.

Produces human-readable output in console, Markdown, and JSON formats.
"""

import json
import os
from collections import Counter

from tests.severity import Discrepancy, Severity


# ---------------------------------------------------------------------------
# ANSI color helpers
# ---------------------------------------------------------------------------

_COLORS = {
    Severity.HIGH: "\033[91m",  # Red
    Severity.MEDIUM: "\033[93m",  # Yellow
    Severity.LOW: "\033[92m",  # Green
}
_RESET = "\033[0m"
_BOLD = "\033[1m"


def _color(severity: Severity, text: str) -> str:
    return f"{_COLORS[severity]}{text}{_RESET}"


def _truncate(text: str, max_len: int = 120) -> str:
    if len(text) <= max_len:
        return text
    return text[: max_len - 3] + "..."


# ---------------------------------------------------------------------------
# Console report
# ---------------------------------------------------------------------------


def print_console_report(
    results: dict[str, list[Discrepancy]],
    severity_filter: Severity | None = None,
) -> None:
    """Print a color-coded console report.

    Args:
        results: Dict mapping chapter_id → list of Discrepancy objects.
        severity_filter: If set, only show discrepancies at or above this level.
    """
    severity_order = {Severity.HIGH: 3, Severity.MEDIUM: 2, Severity.LOW: 1}
    filter_level = severity_order.get(severity_filter, 0) if severity_filter else 0

    total_counts: Counter = Counter()
    chapters_with_issues = 0

    print(f"\n{_BOLD}{'='*80}{_RESET}")
    print(f"{_BOLD}  QA Content Check Report{_RESET}")
    print(f"{_BOLD}{'='*80}{_RESET}\n")

    for chapter_id, discrepancies in results.items():
        filtered = [
            d
            for d in discrepancies
            if severity_order[d.severity] >= filter_level
        ]
        if not filtered:
            print(f"  ✅ {chapter_id}: No issues found")
            continue

        chapters_with_issues += 1
        counts = Counter(d.severity for d in filtered)
        total_counts += counts

        summary_parts = []
        for sev in [Severity.HIGH, Severity.MEDIUM, Severity.LOW]:
            if counts[sev]:
                summary_parts.append(_color(sev, f"{counts[sev]} {sev.value}"))

        print(f"  📋 {_BOLD}{chapter_id}{_RESET}: {', '.join(summary_parts)}")

        # Show HIGH severity details inline
        high_items = [d for d in filtered if d.severity == Severity.HIGH]
        for d in high_items[:5]:  # Limit to first 5
            print(f"     {_color(Severity.HIGH, '▸ HIGH')} [{d.location}] {d.description}")
            if d.pdf_text:
                print(f"       PDF: {_truncate(d.pdf_text, 100)}")
            if d.html_text:
                print(f"       HTML: {_truncate(d.html_text, 100)}")

        if len(high_items) > 5:
            print(f"     ... and {len(high_items) - 5} more HIGH issues")

    # Summary
    print(f"\n{_BOLD}{'─'*80}{_RESET}")
    print(f"  {_BOLD}Summary:{_RESET} {len(results)} chapters checked, "
          f"{chapters_with_issues} with issues")
    for sev in [Severity.HIGH, Severity.MEDIUM, Severity.LOW]:
        if total_counts[sev]:
            print(f"    {_color(sev, f'{total_counts[sev]:4d} {sev.value}')}")
    total = sum(total_counts.values())
    print(f"    {_BOLD}{total:4d} TOTAL{_RESET}")
    print(f"{_BOLD}{'='*80}{_RESET}\n")


# ---------------------------------------------------------------------------
# Markdown report
# ---------------------------------------------------------------------------


def _discrepancy_to_md_row(d: Discrepancy) -> str:
    """Convert a Discrepancy to a Markdown table row."""
    pdf = _truncate(d.pdf_text, 80).replace("|", "\\|").replace("\n", " ")
    html = _truncate(d.html_text, 80).replace("|", "\\|").replace("\n", " ")
    desc = d.description.replace("|", "\\|").replace("\n", " ")
    return f"| {d.severity.value} | {d.location} | {pdf} | {html} | {desc} |"


def generate_markdown_report(
    results: dict[str, list[Discrepancy]],
    output_path: str,
    severity_filter: Severity | None = None,
) -> None:
    """Generate a Markdown report file.

    Args:
        results: Dict mapping chapter_id → list of Discrepancy objects.
        output_path: Path to write the Markdown file.
        severity_filter: If set, only include discrepancies at or above this level.
    """
    severity_order = {Severity.HIGH: 3, Severity.MEDIUM: 2, Severity.LOW: 1}
    filter_level = severity_order.get(severity_filter, 0) if severity_filter else 0

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

    lines: list[str] = []
    lines.append("# QA Content Check Report\n")

    # Summary table
    total_counts: Counter = Counter()
    for discrepancies in results.values():
        for d in discrepancies:
            if severity_order[d.severity] >= filter_level:
                total_counts[d.severity] += 1

    total = sum(total_counts.values())
    lines.append("## Summary\n")
    lines.append(f"- **Chapters checked:** {len(results)}")
    lines.append(f"- **Total discrepancies:** {total}")
    lines.append(f"  - 🔴 HIGH: {total_counts[Severity.HIGH]}")
    lines.append(f"  - 🟡 MEDIUM: {total_counts[Severity.MEDIUM]}")
    lines.append(f"  - 🟢 LOW: {total_counts[Severity.LOW]}")
    lines.append("")

    # Per-chapter detail
    for chapter_id, discrepancies in results.items():
        filtered = [
            d
            for d in discrepancies
            if severity_order[d.severity] >= filter_level
        ]
        # Sort by severity (HIGH first)
        filtered.sort(key=lambda d: severity_order[d.severity], reverse=True)

        lines.append(f"## {chapter_id}\n")

        if not filtered:
            lines.append("✅ No discrepancies found.\n")
            continue

        counts = Counter(d.severity for d in filtered)
        parts = []
        for sev in [Severity.HIGH, Severity.MEDIUM, Severity.LOW]:
            if counts[sev]:
                emoji = {"HIGH": "🔴", "MEDIUM": "🟡", "LOW": "🟢"}[sev.value]
                parts.append(f"{emoji} {counts[sev]} {sev.value}")
        lines.append(f"{', '.join(parts)}\n")

        lines.append(
            "| Severity | Location | PDF Text | HTML Text | Description |"
        )
        lines.append(
            "| :------- | :------- | :------- | :-------- | :---------- |"
        )
        for d in filtered:
            lines.append(_discrepancy_to_md_row(d))
        lines.append("")

    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"  Markdown report written to: {output_path}")


# ---------------------------------------------------------------------------
# JSON report
# ---------------------------------------------------------------------------


def generate_json_report(
    results: dict[str, list[Discrepancy]],
    output_path: str,
    severity_filter: Severity | None = None,
) -> None:
    """Generate a JSON report file.

    Args:
        results: Dict mapping chapter_id → list of Discrepancy objects.
        output_path: Path to write the JSON file.
        severity_filter: If set, only include discrepancies at or above this level.
    """
    severity_order = {Severity.HIGH: 3, Severity.MEDIUM: 2, Severity.LOW: 1}
    filter_level = severity_order.get(severity_filter, 0) if severity_filter else 0

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

    output = {}
    for chapter_id, discrepancies in results.items():
        filtered = [
            d
            for d in discrepancies
            if severity_order[d.severity] >= filter_level
        ]
        output[chapter_id] = [
            {
                "severity": d.severity.value,
                "location": d.location,
                "pdf_text": d.pdf_text,
                "html_text": d.html_text,
                "description": d.description,
                "source": d.source,
            }
            for d in filtered
        ]

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"  JSON report written to: {output_path}")
