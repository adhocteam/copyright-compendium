# Copyright Compendium Repository Instructions

## Repository Overview

This repository contains a web display for the U.S. Copyright Office's Copyright Compendium. The project converts PDF chapters from the official Compendium into navigable, searchable XHTML using AI (primarily Google Gemini 2.5 Pro Experimental). The UI is built using USWDS (U.S. Web Design System) components and styling.

**Tech Stack:**
- Frontend: TypeScript with Vite build system (v6.3.3)
- UI Framework: USWDS components
- Search: Algolia (autocomplete-js v1.19.0, algoliasearch v5.23.4)
- Testing: Vitest with happy-dom
- Deployment: Vercel
- Backend Scripts: Python 3.7+ with Google Generative AI API
- Runtime: Node.js v24.x, npm v11.x

**Repository Structure:**
- `/CompendiumUI/` - Main web application
  - `index.html` - Main entry point (Vite dev server)
  - `script.ts` - Client-side TypeScript application logic
  - `chapters.ts` - Static chapter data (titles, filenames)
  - `style.css` - USWDS-based styling
  - `public/` - Static assets including XHTML chapter files (`*-src.html`)
  - `package.json` - Node dependencies and scripts
  - `vercel.json` - Deployment configuration with URL rewrites
  - `*.test.ts` - Vitest test files
  - `vitest.config.ts` - Test configuration
- `/scripts/` - Python utilities for PDF processing
  - `process_pdfs_gemini.py` - Main PDF to XHTML converter
  - `process_pdfs_chunked.py` - Alternative chunked processing
  - `comp_download.py` - Downloads chapters from copyright.gov
  - `pdf_to_text.py` - PDF text extraction (without hyperlinks)
  - `ParsingPrompt-pdf.txt` - LLM prompt for PDF conversion
  - `ParsingPrompt.txt` - LLM prompt for text conversion
- `/copyright_compendium_pdfs/` - Source PDF files
- `/docs/` - Documentation served with MkDocs
- `/tests/` - Content QA testing scripts
- `README.md` - Project documentation
- `Taskfile.yml` - Task runner configuration
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
npm test              # Run tests in watch mode (Vitest)
npm run test:run      # Run tests once
npm run test:coverage # Run tests with coverage
npm run typecheck     # TypeScript type checking
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
export GOOGLE_API_KEY='your_api_key'

# Process PDFs in a directory
cd scripts
python process_pdfs_gemini.py --directory ../copyright_compendium_pdfs
```

## Testing and Validation

### Automated Tests
Tests use Vitest with happy-dom for DOM simulation:

```bash
cd CompendiumUI
npm test              # Watch mode
npm run test:run      # Single run
```

Test files:
- `translation.test.ts` - Translation service tests
- `layout.test.ts` - Layout and DOM structure tests
- `accessibility.test.ts` - Accessibility tests

### Content Quality
- Compare PDF source with generated XHTML
- Run QA content-checking scripts in `/tests/`
- See `docs/qa.md` for quality assurance methodology

## Commit Conventions

This project uses **Conventional Commits**. All commit messages must follow this format:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation only
- `style` - Formatting, no code change
- `refactor` - Code restructuring
- `test` - Adding/updating tests
- `chore` - Build, CI, dependencies
- `perf` - Performance improvement

**Scopes:** `ui`, `scripts`, `docs`, `tests`, `ci`, `deps`

Commits are enforced by commitlint via GitHub Actions.

## Deployment

The application is deployed on Vercel. Configuration is in `CompendiumUI/vercel.json`:
- Rewrites all chapter URLs to `index.html` for client-side routing
- No build configuration needed; Vercel auto-detects Vite

## Code Style and Conventions

- **TypeScript**: ES6+ syntax, strict mode
- **CSS**: USWDS design system patterns
- **Python**: Standard Python conventions
- **File Naming**:
  - XHTML chapters: `ch{number}-{title}-src.html` in `public/`
  - TypeScript source: camelCase
  - Python scripts: lowercase with underscores

## Key Architecture

### Client-Side Routing
The app is an SPA. `script.ts` handles:
- Chapter loading via `loadContent()` - fetches `*-src.html` files
- URL management via History API
- Side navigation generation from chapter content structure
- Glossary tooltip management

### Translation
Uses the experimental Chrome Translation API (`window.Translator`):
- `TranslationService` class manages translation state
- Translations are cached in localStorage
- Progress indicator shows batch translation status

### Navigation
- **Top nav**: USWDS accordion-based Chapters dropdown
- **Side nav**: Dynamically generated from chapter content structure
- **Search**: Algolia autocomplete integration

## Common Workflows

### Adding a New Chapter
1. Download PDF using `comp_download.py`
2. Place PDF in `copyright_compendium_pdfs/`
3. Run `process_pdfs_gemini.py` or manually via AI Studio
4. Save output to `CompendiumUI/public/`
5. Add chapter entry to `chapters.ts`

### Modifying UI Styles
1. Edit `CompendiumUI/style.css`
2. Follow USWDS design patterns
3. Test with `npm run dev`
4. Run tests: `npm run test:run`

### Versioning
- Uses `standard-version` for automated version bumps
- Changelog at `docs/CHANGELOG.md`
- Run `npm run release` to bump version

## Important: What NOT to Do

- **Never** commit `node_modules/` or `dist/` directories
- **Never** commit API keys or credentials
- **Never** modify XHTML files manually; regenerate from PDF source
- **Never** remove existing hyperlinks or formatting from XHTML
- **Never** use non-conventional commit messages

## Key Dependencies

- **@algolia/autocomplete-js** (^1.19.0): Search autocomplete UI
- **algoliasearch** (^5.23.4): Algolia search client
- **vite** (^6.3.3): Build tool and dev server
- **vitest** (^4.0.18): Test runner
- **happy-dom** (^20.6.1): DOM simulation for tests
- **standard-version** (^9.5.0): Automated versioning
- **google-generativeai**: Python package for Gemini API

## When Making Changes

1. **UI Changes**: Always test with `npm run dev` and run `npm run test:run`
2. **Style Changes**: Maintain USWDS design system consistency
3. **Script Changes**: Test with small PDF samples first
4. **Content Changes**: Verify against source PDF for accuracy
5. **Dependency Updates**: Test build, tests, and search functionality

This repository prioritizes content accuracy and web accessibility. Always verify that changes maintain the fidelity of the Copyright Compendium content while improving usability.
