"""
Shared path constants and configuration for the QA engine.
"""
import os

# Project root: the directory containing CompendiumUI/ and copyright_compendium_pdfs/
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

# Paths to content directories
HTML_SOURCE_DIR = os.path.join(PROJECT_ROOT, "CompendiumUI", "public")
PDF_TEXT_DIR = os.path.join(PROJECT_ROOT, "copyright_compendium_pdfs")
REPORTS_DIR = os.path.join(os.path.dirname(__file__), "reports")

# All chapter identifiers with their filenames
CHAPTER_MAP = {
    "introduction": {
        "html": "introduction-src.html",
        "txt": "introduction.txt",
        "pdf": "introduction.pdf",
    },
    "ch100": {
        "html": "ch100-general-background-src.html",
        "txt": "ch100-general-background.txt",
        "pdf": "ch100-general-background.pdf",
    },
    "ch200": {
        "html": "ch200-registration-process-src.html",
        "txt": "ch200-registration-process.txt",
        "pdf": "ch200-registration-process.pdf",
    },
    "ch300": {
        "html": "ch300-copyrightable-authorship-src.html",
        "txt": "ch300-copyrightable-authorship.txt",
        "pdf": "ch300-copyrightable-authorship.pdf",
    },
    "ch400": {
        "html": "ch400-application-src.html",
        "txt": "ch400-application.txt",
        "pdf": "ch400-application.pdf",
    },
    "ch500": {
        "html": "ch500-identifying-works-src.html",
        "txt": "ch500-identifying-works.txt",
        "pdf": "ch500-identifying-works.pdf",
    },
    "ch600": {
        "html": "ch600-examination-practices-src.html",
        "txt": "ch600-examination-practices.txt",
        "pdf": "ch600-examination-practices.pdf",
    },
    "ch700": {
        "html": "ch700-literary-works-src.html",
        "txt": "ch700-literary-works.txt",
        "pdf": "ch700-literary-works.pdf",
    },
    "ch800": {
        "html": "ch800-performing-arts-src.html",
        "txt": "ch800-performing-arts.txt",
        "pdf": "ch800-performing-arts.pdf",
    },
    "ch900": {
        "html": "ch900-visual-art-src.html",
        "txt": "ch900-visual-art.txt",
        "pdf": "ch900-visual-art.pdf",
    },
    "ch1000": {
        "html": "ch1000-websites-src.html",
        "txt": "ch1000-websites.txt",
        "pdf": "ch1000-websites.pdf",
    },
    "ch1100": {
        "html": "ch1100-registration-multiple-works-src.html",
        "txt": "ch1100-registration-multiple-works.txt",
        "pdf": "ch1100-registration-multiple-works.pdf",
    },
    "ch1200": {
        "html": "ch1200-mask-works-src.html",
        "txt": "ch1200-mask-works.txt",
        "pdf": "ch1200-mask-works.pdf",
    },
    "ch1300": {
        "html": "ch1300-vessel-designs-src.html",
        "txt": "ch1300-vessel-designs.txt",
        "pdf": "ch1300-vessel-designs.pdf",
    },
    "ch1400": {
        "html": "ch1400-applications-filing-fees-src.html",
        "txt": "ch1400-applications-filing-fees.txt",
        "pdf": "ch1400-applications-filing-fees.pdf",
    },
    "ch1500": {
        "html": "ch1500-deposits-src.html",
        "txt": "ch1500-deposits.txt",
        "pdf": "ch1500-deposits.pdf",
    },
    "ch1600": {
        "html": "ch1600-preregistration-src.html",
        "txt": "ch1600-preregistration.txt",
        "pdf": "ch1600-preregistration.pdf",
    },
    "ch1700": {
        "html": "ch1700-administrative-appeals-src.html",
        "txt": "ch1700-administrative-appeals.txt",
        "pdf": "ch1700-administrative-appeals.pdf",
    },
    "ch1800": {
        "html": "ch1800-post-registration-src.html",
        "txt": "ch1800-post-registration.txt",
        "pdf": "ch1800-post-registration.pdf",
    },
    "ch1900": {
        "html": "ch1900-publication-src.html",
        "txt": "ch1900-publication.txt",
        "pdf": "ch1900-publication.pdf",
    },
    "ch2000": {
        "html": "ch2000-foreign-works-src.html",
        "txt": "ch2000-foreign-works.txt",
        "pdf": "ch2000-foreign-works.pdf",
    },
    "ch2100": {
        "html": "ch2100-renewal-registration-src.html",
        "txt": "ch2100-renewal-registration.txt",
        "pdf": "ch2100-renewal-registration.pdf",
    },
    "ch2200": {
        "html": "ch2200-notice-src.html",
        "txt": "ch2200-notice.txt",
        "pdf": "ch2200-notice.pdf",
    },
    "ch2300": {
        "html": "ch2300-recordation-src.html",
        "txt": "ch2300-recordation.txt",
        "pdf": "ch2300-recordation.pdf",
    },
    "ch2400": {
        "html": "ch2400-office-services-src.html",
        "txt": "ch2400-office-services.txt",
        "pdf": "ch2400-office-services.pdf",
    },
    "glossary": {
        "html": "glossary-src.html",
        "txt": "glossary.txt",
        "pdf": "glossary.pdf",
    },
    "table-of-authorities": {
        "html": "table-of-authorities-src.html",
        "txt": "table-of-authorities.txt",
        "pdf": "table-of-authorities.pdf",
    },
    "revision-history": {
        "html": "revision-history-src.html",
        "txt": "revision-history.txt",
        "pdf": "revision-history.pdf",
    },
}


def html_file_to_chapter_id(html_filename: str) -> str | None:
    """Map an HTML filename (or full path) to a chapter ID.

    Accepts paths like 'CompendiumUI/public/ch200-registration-process-src.html'
    or just the filename 'ch200-registration-process-src.html'.
    """
    basename = os.path.basename(html_filename)
    for chapter_id, files in CHAPTER_MAP.items():
        if files["html"] == basename:
            return chapter_id
    return None


def get_all_chapter_ids() -> list[str]:
    """Return all chapter IDs in order."""
    return list(CHAPTER_MAP.keys())
