# Overview

This repository contains a simple web display for the Copyright Compendium. The Compendium is available as a pdf on Copyright.org, but is difficult to navigate. It has long been a goal of the copyright community to have a navigable and searchable web version of the Compendium. Public.resource.org has the original version (2014) on its website [here](https://law.resource.org/pub/us/compendium/introduction.html), but it has not been updated.

The UI was built using Gemini 2.5 Pro Experimental, based on USWDS components and styling.

# Using LLMs to convert pdf to xhtml

Individual chapters of the Compendium were downloaded using the comp_download.py script. A second script (pdf_to_text.py) was created to extract text from the pdfs into `.txt` files. To convert to xhtml, each text file was uploaded, along with the copyright_compendium/ParsingPrompt.txt, to Google Gemini 2.5 Pro Experimental. Other LLMs were tested, but Gemini produced the most accurate output and was able to handle the large input and output sizes required for the Compendium.

The pdf compendium includes in-line hyperlinks (largely to pdf source files on copyright.gov). After a number of attempts to programmatically extract and wrap these links, we reverted to uploading the pdf + prompt to the LLM and have the LLM accomplish both the extraction and conversion to xhtml. The file in ch2300-recordation.html demonstrates the results of this process. In the future, we may reprocess all files in this way to retan hyperlinks.

## Future Work

The current version of the Copyright Compendium web display is a proof of concept. There are several areas for improvement and additional features that could be implemented:

1. Check accuracy of conversion to XML, ensuring no text was lost during the transformation process.
2. Add page numbers to XML and display them in the viewer to maintain reference to the original document.
3. Parse and add links to internal citations to improve navigation between related sections.
4. Add links or popovers for glossary terms (which are already linked in the PDFs).
5. Add links to external citations to provide access to referenced materials.
6. Properly handle and embed images from the original document.
7. Implement in-page search functionality for quick term location.
8. Develop global search capability with a dedicated results page.
