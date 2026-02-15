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
import sys

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

    args = parser.parse_args()

    chapters = _resolve_chapters(args)
    if not chapters:
        print("No chapters to check.")
        return 0

    severity_filter = _parse_severity(args.severity_filter)

    print(f"Chapters to check: {', '.join(chapters)}")
    print(f"Output format: {args.format}")
    if severity_filter:
        print(f"Severity filter: {severity_filter.value}+")
    print()

    # Collect results from all sources
    all_results: dict[str, list] = {ch: [] for ch in chapters}

    # --- Algorithmic check ---
    if args.algo or args.all:
        print("Running algorithmic comparison...")
        from tests.algorithmic_checker import compare_chapters

        algo_results = compare_chapters(chapters)
        for ch, discs in algo_results.items():
            all_results[ch].extend(discs)
        algo_total = sum(len(d) for d in algo_results.values())
        print(f"  Algorithmic check found {algo_total} discrepancies.\n")

    # --- LLM check ---
    if args.llm or args.all:
        print("Running LLM-based QA check...")
        from tests.llm_checker import check_chapters_with_llm

        llm_results = check_chapters_with_llm(chapters)
        for ch, discs in llm_results.items():
            all_results[ch].extend(discs)
        llm_total = sum(len(d) for d in llm_results.values())
        print(f"  LLM check found {llm_total} discrepancies.\n")

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
        print(f"⚠️  {high_count} HIGH severity issues found.")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
