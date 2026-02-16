# Copyright Compendium Documentation

This directory contains all documentation for the Copyright Compendium project, organized and served using [MkDocs](https://www.mkdocs.org/) with the [Material theme](https://squidfunk.github.io/mkdocs-material/).

## Documentation Structure

- **Quality Assurance**: QA processes, testing methodologies, and test results
  - `qa.md` - Quality assurance overview and manual review process
  - `testing.md` - Automated content-checking QA engine documentation
  - `ui-testing.md` - Frontend testing with Vitest
  - `testing-translation.md` - Translation feature testing guide
  - `pdf-text-tests.md` - PDF to HTML text comparison test results
  - `compare-pdf-html.md` - PDF to HTML comparison methodology

- **Features**: Documentation for project features
  - `translation-feature.md` - Browser-based translation feature overview
  - `translation-implementation.md` - Technical implementation guide for translation
  - `translation-fix-summary.md` - Recent translation fixes and updates

- **Reports**: Generated reports and audits
  - `broken-links-report.md` - Link validation report
  - `audit-summary.md` - Comprehensive security and code audit results

## Viewing the Documentation

### Local Development

1. **Install dependencies:**
   ```bash
   # From the repository root
   pip install -r docs-requirements.txt
   ```

2. **Serve locally:**
   ```bash
   # Starts server at http://localhost:8000 with hot-reload
   mkdocs serve
   ```

3. **Build static site:**
   ```bash
   # Outputs to site/ directory
   mkdocs build
   ```

### Using Docker

Run the documentation in an isolated Docker container:

```bash
# From the repository root
docker build -f Dockerfile.docs -t copyright-compendium-docs .
docker run --rm -p 8000:8000 copyright-compendium-docs
```

Visit http://localhost:8000 to view the documentation.

### Using Task

If you have [Task](https://taskfile.dev/) installed:

```bash
# Serve documentation locally
task docs:serve

# Build documentation
task docs:build

# Run documentation in Docker
task docs:docker:run
```

## Configuration

The documentation is configured via `mkdocs.yml` in the repository root. Key settings:

- **Theme**: Material Design theme with search, syntax highlighting, and navigation features
- **Extensions**: Support for admonitions, code highlighting, tabs, and more
- **Navigation**: Organized by topic with expandable sections

## Writing Documentation

### Adding New Pages

1. Create a new `.md` file in the `/docs` directory
2. Add the file to the navigation in `mkdocs.yml`:
   ```yaml
   nav:
     - Section Name:
       - Page Title: filename.md
   ```

### Markdown Extensions

The documentation supports:

- **Admonitions**: `!!! note`, `!!! warning`, `!!! tip`, etc.
- **Code blocks**: With syntax highlighting and line numbers
- **Tabs**: Group related content
- **Tables**: Markdown tables with styling
- **Table of Contents**: Auto-generated from headings

Example admonition:
```markdown
!!! warning "Important"
    This is a warning message
```

### Links

- **Internal links**: Use relative paths: `[Link text](other-page.md)`
- **External links**: Use absolute URLs: `[GitHub](https://github.com)`
- **Anchors**: Link to headings: `[Section](#heading-name)`

## Building for Production

The documentation is automatically built when the Docker image is created. For static hosting:

```bash
mkdocs build
# Output is in site/
```

The `site/` directory contains a complete static website that can be hosted on any web server.

## Troubleshooting

### Port Already in Use

If port 8000 is already in use, you can specify a different port:

```bash
mkdocs serve -a localhost:8080
```

Or with Docker:
```bash
docker run --rm -p 8080:8000 copyright-compendium-docs
```

### Missing Dependencies

If you see errors about missing Python packages:

```bash
pip install -r docs-requirements.txt
```

### Build Warnings

Some warnings about missing links are expected, as they reference source code files that aren't part of the documentation. These can be safely ignored.

## Contributing

When adding new documentation:

1. Keep the main `README.md` in the repository root focused on getting started
2. Move detailed documentation into this `/docs` directory
3. Update the navigation in `mkdocs.yml`
4. Test locally with `mkdocs serve` before committing
5. Ensure all links work correctly

## Resources

- [MkDocs Documentation](https://www.mkdocs.org/)
- [Material Theme Documentation](https://squidfunk.github.io/mkdocs-material/)
- [Markdown Guide](https://www.markdownguide.org/)
