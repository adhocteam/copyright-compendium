# Overview

This repository contains a simple web display for the Copyright Compendium. The Compendium is available as a pdf on Copyright.org, but is difficult to navigate. It has long been a goal of the copyright community to have a navigable and searchable web version of the Compendium. Public.resource.org has the original version (2014) on its website [here](https://law.resource.org/pub/us/compendium/introduction.html), but it has not been updated.

This UI was originally built in April 2025 using Gemini 2.5 Pro Experimental, based on USWDS components and styling. In February 2026, tests, conversion scripts, and other aspects of the site were updated using a combination of GitHub Agents and Antigravity with Claude Opus 4.6 and Gemini 3.0 Pro. The frontend code has been refactored to TypeScript with comprehensive test coverage.

## Demo

Watch a short walkthrough of the Compendium Viewer in action — showing chapter navigation, side navigation, chapters menu, and search:

<p align="center">
  <video src="demo/demo.mp4" width="720" controls>
    Your browser does not support the video tag.
  </video>
</p>

> **[Try it live →](https://copyright-compendium.vercel.app/ch200-registration-process.html)**

# Technology Stack

- **Frontend**: TypeScript with Vite build system
- **UI Framework**: USWDS (U.S. Web Design System) components
- **Search**: Algolia search with autocomplete
- **Testing**: Vitest with 38 unit and integration tests
- **Type Checking**: TypeScript with strict mode enabled

# Documentation

Comprehensive documentation is available in the `/docs` directory. The documentation is automatically deployed to GitHub Pages at [https://adhocteam.github.io/copyright-compendium/](https://adhocteam.github.io/copyright-compendium/).

It can also be served locally using [MkDocs](https://www.mkdocs.org/):

```bash
# Install mkdocs and dependencies
pip install -r docs-requirements.txt

# Serve documentation locally (hot-reload on changes)
mkdocs serve

# Build documentation (outputs to site/)
mkdocs build
```

Or use Docker to serve the documentation:

```bash
# Build and run the documentation server
docker build -f Dockerfile.docs -t copyright-compendium-docs .
docker run --rm -p 8000:8000 copyright-compendium-docs
```

Or use the Task runner:

```bash
# Serve documentation locally
task docs:serve

# Build documentation
task docs:build

# Run documentation in Docker
task docs:docker:run
```

The documentation will be available at `http://localhost:8000`.

# Running Locally

The web UI lives in the `CompendiumUI/` directory. You can run it with or without Docker.

### Without Docker (Vite dev server)

Requires [Node.js](https://nodejs.org/) (v18+).

```bash
cd CompendiumUI
npm install
npm run dev
```

Vite will start a dev server (usually at `http://localhost:5173`) with hot-reload.

To build a production bundle:

```bash
npm run build    # outputs to CompendiumUI/dist/
npm run preview  # preview the production build locally
```

### With Docker

A multi-stage `Dockerfile` is included in `CompendiumUI/`. It installs dependencies, builds the Vite app, and serves the output with nginx.

```bash
# From the repository root
docker build -t copyright-compendium ./CompendiumUI
docker run --rm -p 8080:80 copyright-compendium
```

The site will be available at `http://localhost:8080`.

### Task Runner

A [`Taskfile.yml`](Taskfile.yml) is included for common workflows. Install [Task](https://taskfile.dev/) (`brew install go-task` on macOS), then run `task --list` to see all available commands:

| Command | Description |
|---------|-------------|
| `task dev` | Start Vite dev server with hot-reload |
| `task build` | Build the production bundle |
| `task typecheck` | Run TypeScript type checking |
| `task docker:run` | Build and run the Docker container on port 8080 |
| `task download-pdfs` | Download Compendium PDFs from copyright.gov |
| `task pdf-to-text` | Extract text from PDFs into `.txt` files |
| `task process-pdfs` | Convert PDFs to XHTML via Gemini API |
| `task process-pdfs-chunked` | Convert large PDFs in chunks via Gemini API |
| `task test:build` | Build the Python test-runner Docker image |
| `task test` | Run algorithmic QA checks on all chapters (in Docker) |
| `task test:chapter -- ch200` | Run QA on a specific chapter (in Docker) |
| `task test:llm` | Run LLM-based QA checks in Docker (requires `GOOGLE_API_KEY`) |
| `task test:all` | Run all QA checks with full reports (in Docker) |

# Using LLMs to convert pdf to xhtml

Individual chapters of the Compendium were downloaded using the comp_download.py script. A second script (pdf_to_text.py) was created to extract text from the pdfs into `.txt` files. To convert to xhtml, each text file was uploaded, along with the copyright_compendium/ParsingPrompt.txt, to Google Gemini 2.5 Pro Experimental. Other LLMs were tested, but Gemini produced the most accurate output and was able to handle the large input and output sizes required for the Compendium.

The pdf compendium includes in-line hyperlinks (largely to pdf source files on copyright.gov). After a number of attempts to programmatically extract and wrap these links, we reverted to uploading the pdf + prompt to the LLM and have the LLM accomplish both the extraction and conversion to xhtml. The file in ch2300-recordation.html demonstrates the results of this process. In the future, we may reprocess all files in this way to retan hyperlinks.

The `scripts` directory includes a script to process pdfs from a directory using Gemini + a parsing prompt using the Gemini API. Note that using the API often fails (e.g. for a large document), and it is necessary to process these files one at a time through the Google Studio AI interface. To use the script, you will need to use Python 3.7+, have the `google-generativeai` package installed (`pip install google-generativeai`) and your API key set up. To set up the API key:
API Key:

* Get one from Google AI Studio: https://aistudio.google.com/app/apikey

* Best Practice: Set your API key as an environment variable named GOOGLE_API_KEY. The script will automatically look for it.

* Linux/macOS: export GOOGLE_API_KEY='YOUR_API_KEY'

* Windows (Command Prompt): set GOOGLE_API_KEY=YOUR_API_KEY

* Windows (PowerShell): $env:GOOGLE_API_KEY='YOUR_API_KEY'

Here’s a quick example of how to use the script:

```bash
# Process PDFs in 'my_pdfs' directory, save output to the same directory
python process_pdfs_gemini.py --directory my_pdfs
```

```bash
# Process PDFs in 'my_pdfs', save output to a different 'output_html' directory
python process_pdfs_gemini.py --directory my_pdfs --output-dir output_html
```
## Features

### Translation (Experimental)

The Compendium viewer now includes experimental browser-based translation support for 12 languages. This feature uses the emerging Translation API for privacy-preserving, on-device translation.

**📖 See [Translation Feature](docs/translation-feature.md) for user documentation**

**🔧 See [Translation Implementation](docs/translation-implementation.md) for technical documentation**

**Key highlights:**
- On-device translation (no data sent to servers)
- 12 supported languages (Spanish, Chinese, French, German, Japanese, Korean, Russian, Arabic, Portuguese, Italian, Hindi, Vietnamese)
- Clear disclaimers about non-official translations
- Graceful fallback for unsupported browsers

**Browser Requirements:**
- Chrome 120+ (with experimental flags enabled)
- Edge Canary (with experimental flags enabled)
- More browsers coming in 2024-2025

## Quality Assurance

An automated content-checking engine compares the web HTML against original PDF text to detect conversion errors. The QA tests run inside a Docker container (via `task test`), so no local Python environment is required. See [QA documentation](docs/qa.md) and [Testing documentation](docs/testing.md) for details.

### Frontend Testing

The CompendiumUI codebase includes comprehensive unit and integration tests written in TypeScript using Vitest. Tests can be run in `task` (shown above) or `npm`:

```bash
cd CompendiumUI

# Run tests once
npm run test:run

# Run tests in watch mode
npm run test

# Run tests with UI
npm run test:ui

# Run tests with coverage report
npm run test:coverage

# Run TypeScript type checking
npm run typecheck
```

**Test Coverage:**
- 38 tests covering translation, navigation, utilities, and DOM manipulation
- All tests pass with 100% success rate
- TypeScript ensures type safety throughout the codebase

## Future Work

The current version of the Copyright Compendium web display is a proof of concept. There are several areas for improvement and additional features that could be implemented:

1. ~~Check accuracy of conversion to XML, ensuring no text was lost during the transformation process.~~ → Automated QA engine implemented in `tests/`
2. Correct structural issues in the xhtml files, for example, the hierarchy of chapter 800 has subsections that are not properly nested; this results in missing subsections from the side-nav.
2. Develop server to navigate between chapters.
3. Add links or popovers for glossary terms (which are already linked in the PDFs).
4. Properly handle and embed images from the original document.
5. Implement in-page search functionality for quick term location.
6. Develop global (AI ?) search capability with a dedicated results page.
