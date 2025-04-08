## Quality Assurance

It is necessary to compare the output html with the original pdf to determine any discrepancies in text. A review using the same LLM identified very small, expected discrepancies (e.g. headings and footers that were intentionally removed), and noted some small spacing issues. Overall, this review indicates that the conversion was very accurate.

Prompt:
Attached is a pdf and an html document converted from this pdf. This task is to conduct a quality check on the conversion. Review the text in the original pdf document and the text content in the converted html. Produce an output table with the following columns:
Page number, PDF text, HTML text, Description of change
Each row should show any discrepancies in the text from one to the next.


----
### Results

Okay, here is the quality check comparison table based on the provided PDF OCR text and HTML content.

General Observations:

Text Accuracy: The core text content has been converted with very high accuracy.

Hyperlinks: The HTML version consistently adds hyperlinks to internal sections (e.g., #sec-201), external resources (e.g., copyright.gov, ecfr.gov), glossary terms (/compendium/glossary.html#...), and other Compendium chapters (/compendium/chXXX...). This is an enhancement in the HTML version and not a discrepancy in the text itself, but noted where the link text originates.

Reference Tags: Case citations, Federal Register citations, and Act citations are often wrapped in <ref> tags in the HTML, providing semantic structure. The text content within generally matches the PDF.

Page Numbers in TOC: Page numbers listed in the PDF Table of Contents are omitted in the HTML TOC structure, which is typical for web conversions.

Headers/Footers: Page headers ("COMPENDIUM OF US. COPYRIGHT OFFICE PRACTICES, Third Edition") and footers ("Chapter 200 : X 01/28/2021") from the PDF are consistently omitted in the main body of the HTML content, though page breaks are marked with <page label="X">.

Formatting: Basic formatting like italics (<i> or <em> often implied by <span> styling in the provided HTML snippet context) appears to be preserved correctly. List structures also seem preserved.

Minor OCR/Typo: One minor typo/spacing issue from the PDF OCR ("Section1412") was corrected in the HTML ("Section 1412"). One minor grammatical error ("may communicates") was retained. Minor spacing differences around parentheses in deposit copy references were normalized in HTML.

Discrepancy Table:

| Page number | PDF text                                                                 | HTML text                                                                                                | Description of change                                                                                                                               |
| :---------- | :----------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1           | (Multiple TOC entries like "What This Chapter Covers... 3")             | (Multiple `<tocitem>` like `<num>201</num> What This Chapter Covers`)                                     | HTML TOC entries omit the corresponding page numbers found in the PDF TOC. (Consistent change)                                                      |
| 1           | Chapter 200 : 1 01/28/2021                                               | `<page label="1"></page>` (No footer text)                                                               | Footer text from PDF is missing in HTML. (Consistent change)                                                                                      |
| 2           | COMPENDIUM OF US. COPYRIGHT OFFICE PRACTICES, Third Edition              | (No header text shown for this page segment)                                                             | Header text from PDF is missing in HTML. (Consistent change)                                                                                      |
| 2           | (Multiple TOC entries like "Cancellation... 17")                         | (Multiple `<tocitem>` like `<num>212.4</num> Cancellation`)                                               | HTML TOC entries omit the corresponding page numbers found in the PDF TOC. (Consistent change)                                                      |
| 2           | Chapter 200 : 2 01/28/2021                                               | `<page label="2"></page>` (No footer text)                                                               | Footer text from PDF is missing in HTML. (Consistent change)                                                                                      |
| 3-18        | (Header text on each page)                                               | (No header text shown for page segments)                                                                 | Header text from PDF is missing in HTML. (Consistent change)                                                                                      |
| 3-19        | (Footer text on each page, e.g., Chapter 200 : 3 01/28/2021)             | (No footer text shown, only `<page label="X">` tags)                                                     | Footer text from PDF is missing in HTML. (Consistent change)                                                                                      |
| 7           | ...see Chapter 1400, **Section1412**.                                    | ...see <a href="/compendium/ch1400-applications-filing-fees.html#sec-1412">Chapter 1400, **Section 1412**</a>. | HTML corrects minor spacing error/typo ("Section1412" -> "Section 1412") found in the PDF OCR text. Also adds hyperlink.                      |
| 9           | ...deposit **copy (ies)** to the...                                      | ...deposit <a href="/compendium/glossary.html#deposit_copy_deposit_copies">**copy(ies)**</a> to the...        | HTML normalizes spacing within "copy(ies)" compared to PDF OCR "copy (ies)". PDF source likely has "copy(ies)". Also adds hyperlink.             |
| 10          | ...deposit **copy (ies)** in person...                                   | ...deposit <a href="/compendium/glossary.html#deposit_copy_deposit_copies">**copy (ies)**</a> in person...   | HTML retains spacing in "copy (ies)" in link text here, slightly inconsistent with other instances but matching PDF OCR. Also adds hyperlink. |
| 15          | ...return the deposit **copy (ies)**.                                    | ...return the <a href="/compendium/glossary.html#deposit_copy_deposit_copies">deposit **copy (ies)**</a>.   | HTML retains spacing in "copy (ies)" in link text here, matching PDF OCR. Also adds hyperlink.                                                     |
| 16          | ...complete deposit **copy (ies)**, and the proper...                    | ...complete <a href="/compendium/glossary.html#deposit_copy_ies">deposit **copy(ies)**</a>, and the proper... | HTML normalizes spacing within "copy(ies)" compared to PDF OCR "copy (ies)". Also adds hyperlink.                                                 |
| 19          | ...the Office **may communicates** with the Applicant or may refuse... | ...the Office **may communicates** with the Applicant or may refuse...                                     | HTML retains the minor grammatical error ("may communicates") present in the PDF OCR text.                                                          |


### Chapter 800

| Page number | PDF text                                                       | HTML text                                                      | Description of change                                                       |
|-------------|----------------------------------------------------------------|----------------------------------------------------------------|-----------------------------------------------------------------------------|
| 14          | S. REP. NO. 94-473, at 52 (1975).                              | S. REP. No. 94-473, at 52 (1975).                              | "NO." changed to "No." in the Senate Report citation.                       |
| 15          | Feist Publications, Inc. v. Rural Telephone Service Co., 499 U.S. 340, 345 (1991). | Feist Publications, Inc. v. Rural Telephone Service Co., 499 U.S. 340, 345 (1991) | Period missing at the end of the case citation in HTML.                     |
| 31          | 17 U.S.C. § 303(b).                                            | 17 U.S.C. § 303(b)                                             | Period missing at the end of the U.S. Code citation in HTML.                |
| 40          | S. REP. NO. 94-473, at 54-55 (1975).                           | S. REP. No. 94-473, at 54-55 (1975).                           | "NO." changed to "No." in the Senate Report citation.                       |
| 65          | S. REP. NO. 94-473, at 52 (1975).                              | S. REP. No. 94-473, at 52 (1975).                              | "NO." changed to "No." in the Senate Report citation.                       |
| 66          | S. REP. NO. 94-473, at 52 (1975).                              | S. REP. No. 94-473, at 52 (1975).                              | "NO." changed to "No." in the Senate Report citation.                       |
| 72          | S. REP. NO. 94-473, at 52 (1975).                              | S. REP. No. 94-473, at 52 (1975).                              | "NO." changed to "No." in the Senate Report citation.                       |
| 73          | S. REP. NO. 94-473, at 52 (1975).                              | S. REP. No. 94-473, at 52 (1975).                              | "NO." changed to "No." in the Senate Report citation.                       |
| 73          | S. REP. NO. 94-473, at 52 (1975).                              | S. REP. No. 94-473, at 52 (1975).                              | "NO." changed to "No." in the Senate Report citation.                       |
| 76          | S. REP. NO. 94-473, at 54-55 (1975).                           | S. REP. No. 94-473, at 54-55 (1975).                           | "NO." changed to "No." in the Senate Report citation.                       |
| 79          | S. REP. NO. 94-473, at 52 (1975).                              | S. REP. No. 94-473, at 52 (1975).                              | "NO." changed to "No." in the Senate Report citation.                       |
| 97          | S. REP. NO. 94-473, at 54 (1975).                              | S. REP. No. 94-473, at 54 (1975).                              | "NO." changed to "No." in the Senate Report citation.                       |
| 116         | 808.10(I)(2).                                                  | 808.10(H)(2).                                                  | Section number referenced changed from 808.10(I)(2) to 808.10(H)(2).        |