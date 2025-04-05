COMPARE docs

## How to Use:

1. Install Libraries: Make sure you have PyMuPDF, BeautifulSoup4, lxml, and pandas installed (pip install PyMuPDF beautifulsoup4 lxml pandas).

2. Prepare Files: Place your PDF files and their corresponding Gemini-generated HTML files (with the exact same base name, e.g., mydocument.pdf and mydocument.html) in a single directory.

3. Run from Terminal:
`python compare_docs.py /path/to/your/directory`

Replace /path/to/your/directory with the actual path to the directory containing your files. You can use . to specify the current directory:
python compare_docs.py .

4. Check Results: The script will process each pair found. For each pair (e.g., report.pdf and report.html), it will create a report.qa.csv file in the same directory. This CSV file will contain two columns: Type ('Missing from HTML' or 'Added to HTML') and Text (the corresponding text chunk). If no differences are found, an empty CSV with headers will be created. Log messages will be printed to the console indicating progress and any errors.

## Important Considerations & Potential Refinements:

* Normalization: The current normalization is basic. PDF extraction can sometimes introduce artifacts like unexpected hyphens or strange spacing. HTML might have non-breaking spaces (&nbsp;). You might need to add more sophisticated cleaning steps to normalize_text if you see spurious differences (e.g., explicitly replacing &nbsp;, handling hyphenation).

* Comparison Sensitivity: Comparing word lists is generally robust, but might flag differences for minor rephrasing or punctuation changes. If you need character-level precision (less common for this task), you could adapt compare_texts to work on pdf_norm and html_norm directly instead of their .split() results, but expect many more differences.

* Performance: For extremely large documents, reading the entire text into memory and running difflib might be slow or memory-intensive. However, for typical document sizes, this approach should be fine.

* Encoding: The script assumes UTF-8 encoding for HTML files. If your HTML files use a different encoding, you might need to adjust the encoding parameter in the open() call within extract_text_from_html.

* Complex HTML/PDFs: Very complex layouts, tables spanning multiple pages, or heavily stylized HTML might still pose challenges for perfect text extraction and alignment. Reviewing the .qa.csv results is crucial.