# Content-Checking QA Engine

Automated quality assurance for the Copyright Compendium web conversion. Compares HTML content on the CompendiumUI website against the original PDF source text to catch conversion errors.

## Quick Start

Tests run in a Docker container — no local Python installation needed.

```bash
# Run all chapters (results written incrementally to PDF_TEXT_TESTS.md)
task test

# Run a specific chapter
task test:chapter -- ch200

# Run LLM-based checks (requires GOOGLE_API_KEY)
task test:llm

# Run both algorithmic + LLM checks with full reports
task test:all
```

### Incremental Report & Resume

`task test` writes results to `PDF_TEXT_TESTS.md` as each chapter completes. If the process is interrupted and re-run **on the same commit**, already-tested chapters are skipped automatically. The report includes:

- Git commit hash and timestamp
- Per-chapter severity breakdown (HIGH / MEDIUM / LOW)
- Expandable HIGH severity details
- Rolling summary updated after each chapter

## How It Works

### Containerized Execution

Tests run inside a `python:3.11-slim` Docker image (see [`Dockerfile`](Dockerfile)). The project root is bind-mounted into the container at `/workspace`, giving the test runner access to:

- HTML source files in `CompendiumUI/public/`
- Pre-extracted PDF text in `copyright_compendium_pdfs/`

The `GIT_COMMIT` environment variable is passed from the host so the report captures the correct commit hash.

### Algorithmic Checker (`--algo`)

Uses character-level comparison on **space-stripped text** to find genuine content differences while ignoring whitespace artifacts from PDF extraction.

**Why space-stripped?** PDF text extraction commonly joins or splits words at line breaks (e.g., `ofthe` instead of `of the`, `pra ctices` instead of `practices`). By removing all whitespace before comparing, these artifacts become invisible — only real character-level content differences are reported.

The pipeline:

1. **Extract** text from HTML source files and pre-extracted PDF `.txt` files
2. **Normalize** both texts:
   - Unicode normalization (curly quotes → straight, em-dashes, non-breaking spaces)
   - **Strip embedded XML/HTML tags** from PDF text (e.g., `<ahref="...">`, `</a>`)
   - Remove PDF headers, footers, TOC dot-leaders, bullet markers
   - Rejoin word fragments split by PDF line breaks
   - Collapse whitespace
3. **Strip** all whitespace from both texts
4. **Diff** the stripped texts character-by-character using `difflib.SequenceMatcher`
5. **Filter** empty diffs (both sides empty after stripping are skipped)
6. **Map** each character difference back to the original text for readable context
7. **Classify** each difference as HIGH, MEDIUM, or LOW severity

### LLM Checker (`--llm`)

Uses Google Gemini API for semantic analysis. Sends both texts with a structured prompt that asks the model to identify and classify discrepancies. Requires a `GOOGLE_API_KEY` environment variable.

```bash
GOOGLE_API_KEY=your-key task test:llm
```

## Severity Classification

| Severity | Meaning | Examples |
|----------|---------|----------|
| **HIGH** | Substantive content change that may affect meaning | Changed section numbers, missing paragraphs, altered legal references |
| **MEDIUM** | Formatting difference worth noting | Section delimiters (`. 202`), punctuation changes, minor reference formatting |
| **LOW** | Expected artifact, safe to ignore | PDF headers/footers, TOC page numbers, whitespace-only differences, case-only changes |

### Classification Rules (in priority order)

1. Whitespace/hyphenation-only difference → **LOW**
2. PDF header/footer content → **LOW**
3. Case-only change (e.g., `NO.` → `No.`) → **LOW**
4. Punctuation-only change → **MEDIUM**
5. TOC content (dense section number listings) → **LOW**
6. Section number delimiter (e.g., `.202`) → **MEDIUM**
7. Changed numbers or section references → **HIGH**
8. Substantial text addition/deletion (>50% length difference) → **HIGH**
9. Default → **MEDIUM**

## CLI Reference

```bash
python -m tests.run_qa [OPTIONS]

# Check mode (at least one required)
  --algo                Run algorithmic comparison
  --llm                 Run LLM-based semantic check
  --all                 Run both checks

# Chapter selection (default: all mapped chapters)
  --chapters CH [CH...] Specific chapter IDs (e.g., ch200 ch800)
  --changed-files F [F...] Auto-detect chapters from changed HTML files

# Output
  --format {console,markdown,json,all}  Output format (default: console)
  --output-dir DIR      Directory for markdown/json reports
  --severity-filter {HIGH,MEDIUM,LOW}   Show only this severity and above
  --report PATH         Write incremental markdown report (e.g. PDF_TEXT_TESTS.md)
```

## Project Structure

```
tests/
├── Dockerfile             ← Python 3.11-slim test runner image
├── README.md              ← This file
├── requirements.txt       ← Python dependencies (beautifulsoup4, lxml, google-generativeai)
├── __init__.py            ← Package marker
├── conftest.py            ← Chapter-to-file mapping and path constants
├── text_extractor.py      ← Text extraction and normalization pipeline
├── algorithmic_checker.py ← Character-level diff engine
├── severity.py            ← Rule-based severity classification
├── llm_checker.py         ← Gemini API-based semantic checker
├── llm_prompt.txt         ← Prompt template for LLM checks
├── report.py              ← Report generators (console, markdown, JSON)
├── run_qa.py              ← CLI entry point (with incremental report support)
└── reports/               ← Generated reports (git-ignored)
```

## Adding New Chapters

The chapter mapping lives in [`conftest.py`](conftest.py). To add a new chapter:

1. Ensure the HTML source file exists in `CompendiumUI/public/` (e.g., `ch300-copyrightable-authorship-src.html`)
2. Ensure the PDF `.txt` file exists in `copyright_compendium_pdfs/` (generated by `scripts/pdf_to_text.py`)
3. Add an entry to `CHAPTER_MAP` in `conftest.py`:

```python
"ch300": {
    "html": "ch300-copyrightable-authorship-src.html",
    "txt": "ch300-copyrightable-authorship.txt",
    "title": "Copyrightable Authorship",
},
```

## CI / GitHub Actions

A [GitHub Actions workflow](../.github/workflows/qa-content-check.yml) runs automatically on pushes to `main` that change HTML source files in `CompendiumUI/public/`. It:

1. Detects which chapters were modified
2. Runs the algorithmic checker on those chapters
3. Runs the LLM checker if the `GOOGLE_API_KEY` repository secret is set
4. Uploads reports as workflow artifacts
5. Posts a summary to the GitHub Actions run

The workflow also supports manual triggering via `workflow_dispatch`.
