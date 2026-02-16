#!/usr/bin/env python3
"""
QA Content Check Runner

Main entry point for comparing CompendiumUI HTML content against
the original PDF text. Supports both algorithmic and LLM-based checks.

Usage:
    # Algorithmic check on all chapters
    python -m tests.run_qa --algo

    # LLM check on specific chapters
    python -m tests.run_qa --llm --chapters ch200 ch800

    # Both checks on chapters affected by changed files
    python -m tests.run_qa --all --changed-files CompendiumUI/public/ch200-registration-process-src.html

    # Full check with markdown report
    python -m tests.run_qa --all --format markdown --output-dir tests/reports
"""

import argparse
import os
import subprocess
import sys
from datetime import datetime, timezone

from tests.conftest import (
    REPORTS_DIR,
    get_all_chapter_ids,
    html_file_to_chapter_id,
)
from tests.severity import Severity


def _resolve_chapters(args: argparse.Namespace) -> list[str]:
    """Determine which chapters to check based on CLI arguments."""
    if args.chapters:
        return args.chapters

    if args.changed_files:
        chapter_ids = set()
        for path in args.changed_files:
            chapter_id = html_file_to_chapter_id(path)
            if chapter_id:
                chapter_ids.add(chapter_id)
            else:
                print(f"  NOTE: Could not map '{path}' to a chapter, skipping.")
        if not chapter_ids:
            print("WARNING: No chapter files detected in changed files.")
            return []
        return sorted(chapter_ids)

    return get_all_chapter_ids()


def _parse_severity(value: str) -> Severity | None:
    if value is None:
        return None
    try:
        return Severity[value.upper()]
    except KeyError:
        return None


def _get_git_commit() -> str:
    """Get the current git commit hash and subject line.

    Checks GIT_COMMIT env var first (for containers), then falls back to git.
    """
    env_commit = os.environ.get("GIT_COMMIT")
    if env_commit:
        return env_commit
    try:
        result = subprocess.run(
            ["git", "log", "-1", "--format=%H %s"],
            capture_output=True, text=True, timeout=5,
        )
        return result.stdout.strip() if result.returncode == 0 else "unknown"
    except Exception:
        return "unknown"


def _parse_existing_report(report_path: str) -> tuple[str, set[str]]:
    """Parse an existing report to find its commit and completed chapters.

    Returns:
        Tuple of (commit_string, set_of_completed_chapter_ids).
        If the file doesn't exist, returns ("", empty set).
    """
    if not os.path.exists(report_path):
        return "", set()

    with open(report_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Extract commit from "**Commit:** `<hash> <subject>`"
    commit = ""
    for line in content.splitlines():
        if line.startswith("**Commit:**"):
            # Strip markdown: **Commit:** `<value>`
            commit = line.split("`")[1] if "`" in line else ""
            break

    # Extract chapter IDs from "## <chapter_id>" headings
    completed = set()
    for line in content.splitlines():
        if line.startswith("## ") and not line.startswith("## Summary"):
            chapter_id = line[3:].strip()
            if chapter_id:
                completed.add(chapter_id)

    return commit, completed


def _write_report_header(report_path: str, chapters: list[str], commit: str) -> None:
    """Write the report header with metadata."""
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("# PDF ↔ HTML Text Comparison Results\n\n")
        f.write(f"**Commit:** `{commit}`\n\n")
        f.write(f"**Date:** {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}\n\n")
        f.write(f"**Chapters:** {len(chapters)}\n\n")
        f.write("---\n\n")


def _append_chapter_result(
    report_path: str,
    chapter_id: str,
    discs: list,
    idx: int,
    total: int,
) -> None:
    """Append a single chapter's results to the report."""
    high = sum(1 for d in discs if d.severity == Severity.HIGH)
    med = sum(1 for d in discs if d.severity == Severity.MEDIUM)
    low = sum(1 for d in discs if d.severity == Severity.LOW)

    with open(report_path, "a", encoding="utf-8") as f:
        f.write(f"## {chapter_id}\n\n")
        if not discs:
            f.write("✅ No discrepancies found.\n\n")
        else:
            f.write(f"| Severity | Count |\n|----------|-------|\n")
            f.write(f"| 🔴 HIGH | {high} |\n")
            f.write(f"| 🟡 MEDIUM | {med} |\n")
            f.write(f"| 🟢 LOW | {low} |\n")
            f.write(f"| **Total** | **{len(discs)}** |\n\n")

            # Show HIGH severity details
            highs = [d for d in discs if d.severity == Severity.HIGH]
            if highs:
                f.write("<details>\n<summary>HIGH severity details</summary>\n\n")
                for d in highs:
                    f.write(f"- **[{d.location}]** {d.description}\n")
                f.write("\n</details>\n\n")


def _write_report_summary(
    report_path: str,
    all_results: dict[str, list],
    completed: int,
    total: int,
) -> None:
    """Append/overwrite the running summary at the end of the report."""
    # Read existing content up to the summary marker
    marker = "<!-- SUMMARY -->\n"
    content = ""
    if os.path.exists(report_path):
        with open(report_path, "r", encoding="utf-8") as f:
            content = f.read()
        if marker in content:
            content = content[: content.index(marker)]

    total_high = sum(1 for discs in all_results.values() for d in discs if d.severity == Severity.HIGH)
    total_med = sum(1 for discs in all_results.values() for d in discs if d.severity == Severity.MEDIUM)
    total_low = sum(1 for discs in all_results.values() for d in discs if d.severity == Severity.LOW)
    total_all = total_high + total_med + total_low

    summary = marker
    summary += "---\n\n"
    summary += f"## Summary ({completed}/{total} chapters)\n\n"
    summary += f"| Severity | Count |\n|----------|-------|\n"
    summary += f"| 🔴 HIGH | {total_high} |\n"
    summary += f"| 🟡 MEDIUM | {total_med} |\n"
    summary += f"| 🟢 LOW | {total_low} |\n"
    summary += f"| **Total** | **{total_all}** |\n"

    with open(report_path, "w", encoding="utf-8") as f:
        f.write(content + summary)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="QA Content Check: Compare CompendiumUI HTML against PDF text.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )

    # Check mode
    mode_group = parser.add_mutually_exclusive_group(required=True)
    mode_group.add_argument(
        "--algo", action="store_true", help="Run algorithmic comparison only"
    )
    mode_group.add_argument(
        "--llm", action="store_true", help="Run LLM-based QA check only"
    )
    mode_group.add_argument(
        "--all", action="store_true", help="Run both algorithmic and LLM checks"
    )

    # Chapter selection
    parser.add_argument(
        "--chapters",
        nargs="+",
        help="Chapter identifiers to check (e.g. ch200 ch800 glossary)",
    )
    parser.add_argument(
        "--changed-files",
        nargs="+",
        help="File paths that changed; auto-detects chapters to check",
    )

    # Output options
    parser.add_argument(
        "--output-dir",
        default=REPORTS_DIR,
        help=f"Directory for report output (default: {REPORTS_DIR})",
    )
    parser.add_argument(
        "--format",
        choices=["console", "markdown", "json", "all"],
        default="console",
        help="Output format (default: console)",
    )
    parser.add_argument(
        "--severity-filter",
        choices=["LOW", "MEDIUM", "HIGH"],
        default=None,
        help="Only show results at or above this severity",
    )
    parser.add_argument(
        "--report",
        default=None,
        help="Path to write incremental markdown report (e.g. PDF_TEXT_TESTS.md)",
    )

    args = parser.parse_args()

    chapters = _resolve_chapters(args)
    if not chapters:
        print("No chapters to check.")
        return 0

    severity_filter = _parse_severity(args.severity_filter)
    report_path = args.report

    print(f"Chapters to check: {', '.join(chapters)}", flush=True)
    print(f"Output format: {args.format}", flush=True)
    if severity_filter:
        print(f"Severity filter: {severity_filter.value}+", flush=True)
    if report_path:
        print(f"Incremental report: {report_path}", flush=True)
    print(flush=True)

    # Determine which chapters to skip (same-commit resume)
    skip_chapters: set[str] = set()
    if report_path:
        commit = _get_git_commit()
        existing_commit, existing_chapters = _parse_existing_report(report_path)
        if existing_commit == commit and existing_chapters:
            skip_chapters = existing_chapters
            print(
                f"Resuming: {len(skip_chapters)} chapters already tested on this commit, "
                f"skipping: {', '.join(sorted(skip_chapters))}",
                flush=True,
            )
        else:
            # New commit or no existing report — start fresh
            _write_report_header(report_path, chapters, commit)

    # Collect results from all sources
    all_results: dict[str, list] = {ch: [] for ch in chapters}
    completed_count = len(skip_chapters & set(chapters))

    # --- Algorithmic check ---
    if args.algo or args.all:
        print("Running algorithmic comparison...", flush=True)
        from tests.algorithmic_checker import compare_chapter

        for idx, chapter_id in enumerate(chapters, 1):
            if chapter_id in skip_chapters:
                print(f"  [{idx}/{len(chapters)}] {chapter_id} — already tested, skipping", flush=True)
                continue

            print(f"  [{idx}/{len(chapters)}] Checking {chapter_id}...", flush=True)
            try:
                discs = compare_chapter(chapter_id)
                all_results[chapter_id].extend(discs)
                high = sum(1 for d in discs if d.severity == Severity.HIGH)
                med = sum(1 for d in discs if d.severity == Severity.MEDIUM)
                low = sum(1 for d in discs if d.severity == Severity.LOW)
                print(
                    f"           → {len(discs)} issues ({high} HIGH, {med} MEDIUM, {low} LOW)",
                    flush=True,
                )
            except (FileNotFoundError, KeyError) as e:
                print(f"  WARNING: Skipping {chapter_id}: {e}", flush=True)
                discs = []
                all_results[chapter_id] = discs

            completed_count += 1

            # Write incremental report
            if report_path:
                _append_chapter_result(report_path, chapter_id, all_results[chapter_id], idx, len(chapters))
                _write_report_summary(report_path, all_results, completed_count, len(chapters))

        algo_total = sum(len(d) for d in all_results.values())
        print(f"  Algorithmic check found {algo_total} discrepancies.\n", flush=True)

    # --- LLM check ---
    if args.llm or args.all:
        print("Running LLM-based QA check...", flush=True)
        from tests.llm_checker import check_chapters_with_llm

        llm_results = check_chapters_with_llm(chapters)
        for ch, discs in llm_results.items():
            all_results[ch].extend(discs)
        llm_total = sum(len(d) for d in llm_results.values())
        print(f"  LLM check found {llm_total} discrepancies.\n", flush=True)

    # --- Output ---
    from tests.report import (
        generate_json_report,
        generate_markdown_report,
        print_console_report,
    )

    if args.format in ("console", "all"):
        print_console_report(all_results, severity_filter)

    if args.format in ("markdown", "all"):
        md_path = os.path.join(args.output_dir, "qa_report.md")
        generate_markdown_report(all_results, md_path, severity_filter)

    if args.format in ("json", "all"):
        json_path = os.path.join(args.output_dir, "qa_report.json")
        generate_json_report(all_results, json_path, severity_filter)

    # Return non-zero exit code if HIGH severity issues found
    high_count = sum(
        1
        for discs in all_results.values()
        for d in discs
        if d.severity == Severity.HIGH
    )
    if high_count > 0:
        print(f"⚠️  {high_count} HIGH severity issues found.", flush=True)
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())

