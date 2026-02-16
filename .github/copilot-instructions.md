# Copyright Compendium Repository Instructions

## Repository Overview

This repository contains a web display for the U.S. Copyright Office's Copyright Compendium. The project converts PDF chapters from the official Compendium into navigable, searchable XHTML using AI (primarily Google Gemini 2.5 Pro Experimental). The UI is built using USWDS (U.S. Web Design System) components and styling.

**Tech Stack:**
- Frontend: Vanilla JavaScript with Vite build system (v6.3.3)
- UI Framework: USWDS components
- Search: Algolia (autocomplete-js v1.19.0, algoliasearch v5.23.4)
- Deployment: Vercel
- Backend Scripts: Python 3.7+ with Google Generative AI API
- Runtime: Node.js v24.x, npm v11.x

**Repository Structure:**
- `/CompendiumUI/` - Main web application
  - `index.html` - Main entry point
  - `script.js` - Client-side JavaScript (58KB)
  - `style.css` - USWDS-based styling (15KB)
  - `public/` - Static assets including XHTML chapter files
  - `package.json` - Node dependencies
  - `vercel.json` - Deployment configuration with URL rewrites
- `/scripts/` - Python utilities for PDF processing
  - `process_pdfs_gemini.py` - Main PDF to XHTML converter
  - `process_pdfs_chunked.py` - Alternative chunked processing
  - `comp_download.py` - Downloads chapters from copyright.gov
  - `pdf_to_text.py` - PDF text extraction (without hyperlinks)
  - `ParsingPrompt-pdf.txt` - LLM prompt for PDF conversion
  - `ParsingPrompt.txt` - LLM prompt for text conversion
- `/copyright_compendium_pdfs/` - Source PDF files
- `/docs/` - Documentation served with MkDocs
- `README.md` - Project documentation
- `Dockerfile.docs` - Dockerfile for serving documentation
- `mkdocs.yml` - MkDocs configuration

## Build and Development Commands

### UI Development
All UI commands must be run from the `CompendiumUI/` directory:

```bash
cd CompendiumUI
npm install           # Install dependencies (always run first)
npm run dev           # Start development server (Vite)
npm run build         # Production build (outputs to dist/)
npm run preview       # Preview production build
```

**Build Notes:**
- Build typically completes in under 1 second
- Output includes gzip size estimates
- Build creates `dist/` directory with optimized assets
- Always run `npm install` before building if `package-lock.json` has changed

### Python Scripts
Python scripts require Python 3.7+ and specific dependencies:

```bash
# Required: Install google-generativeai package
pip install google-generativeai

# Required: Set up Google API key environment variable
# Get key from: https://aistudio.google.com/app/apikey
export GOOGLE_API_KEY='your_api_key'  # Linux/macOS
# set GOOGLE_API_KEY=your_api_key     # Windows CMD
# $env:GOOGLE_API_KEY='your_api_key'  # Windows PowerShell

# Process PDFs in a directory
cd scripts
python process_pdfs_gemini.py --directory ../copyright_compendium_pdfs
python process_pdfs_gemini.py --directory ../copyright_compendium_pdfs --output-dir ../CompendiumUI/public/chapters
```

**Python Script Notes:**
- Scripts use Google Gemini 2.5 Pro Experimental model (`gemini-2.5-pro-exp-03-25`)
- Processing large PDFs may fail via API; use Google AI Studio interface as fallback
- Scripts include retry logic and skip already processed files
- Other dependencies: `requests`, `beautifulsoup4` (for comp_download.py)

## Testing and Validation

**No automated test suite exists.** Validation is manual:

1. **UI Testing:**
   - Build succeeds without errors: `npm run build`
   - Development server starts: `npm run dev`
   - Search functionality works (Algolia integration)
   - Navigation between chapters works
   - Responsive design on mobile/tablet/desktop

2. **Content Quality:**
   - Compare PDF source with generated XHTML
   - Check hyperlink preservation
   - Verify formatting (headings, lists, italics)
   - See `docs/qa.md` for quality assurance methodology

3. **Link Validation:**
   - Check `docs/broken-links-report.md` for known issues

## Deployment

The application is deployed on Vercel. Configuration is in `CompendiumUI/vercel.json`:
- Rewrites all chapter URLs to `index.html` for client-side routing
- No build configuration needed; Vercel auto-detects Vite

## Code Style and Conventions

- **JavaScript**: ES6+ syntax, no linter configured
- **CSS**: USWDS design system patterns
- **Python**: Standard Python conventions, no linter configured
- **Comments**: Minimal; code should be self-explanatory
- **File Naming**: 
  - XHTML chapters: `ch{number}-{title}.html` (e.g., `ch200-copyrightability.html`)
  - Python scripts: lowercase with underscores

## Common Workflows

### Adding a New Chapter
1. Download PDF using `comp_download.py`
2. Place PDF in `copyright_compendium_pdfs/`
3. Run `process_pdfs_gemini.py` with API or manually via AI Studio
4. Save output to `CompendiumUI/public/chapters/`
5. Update navigation in `script.js` if needed

### Modifying UI Styles
1. Edit `CompendiumUI/style.css`
2. Follow USWDS design patterns
3. Test with `npm run dev`
4. Build and verify: `npm run build && npm run preview`

### Updating Dependencies
1. Update `package.json` versions
2. Run `npm install` to update lock file
3. Test build: `npm run build`
4. Check for vulnerabilities: `npm audit`

## Known Issues and Workarounds

1. **Large PDF API Failures**: Gemini API often fails for large documents. Workaround: Upload PDF + prompt directly to Google AI Studio interface.

2. **Hyperlink Extraction**: Early text extraction scripts didn't capture PDF hyperlinks. Solution: Use LLM to extract and wrap links during conversion.

3. **Chapter Structure Issues**: Some chapters (e.g., Chapter 800) have improperly nested subsections. This affects side navigation rendering.

4. **Build Artifacts**: `dist/` directory should not be committed. Already in `.gitignore`.

5. **Node Modules**: `node_modules/` should not be committed. Already in `.gitignore`.

## Important: What NOT to Do

- **Never** commit `node_modules/` or `dist/` directories
- **Never** commit API keys or credentials
- **Never** modify XHTML files manually; regenerate from PDF source
- **Never** assume tests exist; always manually validate changes
- **Never** remove existing hyperlinks or formatting from XHTML

## Key Dependencies

- **@algolia/autocomplete-js** (^1.19.0): Search autocomplete UI
- **algoliasearch** (^5.23.4): Algolia search client
- **vite** (^6.3.3): Build tool and dev server
- **google-generativeai**: Python package for Gemini API

## When Making Changes

1. **UI Changes**: Always test with `npm run dev` before building
2. **Style Changes**: Maintain USWDS design system consistency
3. **Script Changes**: Test with small PDF samples first
4. **Content Changes**: Verify against source PDF for accuracy
5. **Dependency Updates**: Test build and search functionality

This repository prioritizes content accuracy and web accessibility. Always verify that changes maintain the fidelity of the Copyright Compendium content while improving usability.
