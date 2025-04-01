import os
import sys

# --- Overview --
# This script does a good job of extracting text from Compendium pdfs. However, it does not capture hyperlinks.
# Attempts to update the script to also extract and capture links were not successful, or used libraries that did
# a worse job in accurately extracting the basic text.

# --- Configuration ---
# !!! IMPORTANT: Replace this with the actual path to your directory containing the PDF files !!!
pdf_directory = "./copyright_compendium_pdfs"
# Set to True to overwrite existing .txt files, False to skip them
overwrite_existing = False
# --- End Configuration ---

try:
    # Attempt to import the PyPDF2 library
    from PyPDF2 import PdfReader
except ImportError:
    # Provide instructions if the library isn't installed
    print("Error: PyPDF2 library not found.")
    print("Please install it by running: pip install pypdf2")
    sys.exit(1) # Exit the script if the library is missing

def extract_text_from_pdf(pdf_path):
    """
    Extracts text content from a single PDF file.

    Args:
        pdf_path (str): The full path to the PDF file.

    Returns:
        str: The extracted text content, or None if an error occurs.
    """
    try:
        # Open the PDF file in binary read mode
        with open(pdf_path, 'rb') as file:
            # Create a PDF reader object
            reader = PdfReader(file)
            # Initialize an empty string to store the text
            text_content = ""
            # Iterate through each page in the PDF
            for page in reader.pages:
                # Extract text from the current page and append it
                text_content += page.extract_text() + "\n" # Add newline between pages
            return text_content
    except Exception as e:
        # Print an error message if extraction fails for any reason
        print(f"Error processing {os.path.basename(pdf_path)}: {e}")
        return None

def process_directory(directory):
    """
    Processes all PDF files in the specified directory.

    Args:
        directory (str): The path to the directory containing PDFs.
    """
    print(f"Scanning directory: {directory}")
    # Check if the specified directory exists
    if not os.path.isdir(directory):
        print(f"Error: Directory not found: {directory}")
        return

    # Loop through all items (files and subdirectories) in the directory
    for filename in os.listdir(directory):
        # Check if the current item is a file and ends with '.pdf' (case-insensitive)
        if filename.lower().endswith(".pdf") and os.path.isfile(os.path.join(directory, filename)):
            # Construct the full path to the PDF file
            pdf_path = os.path.join(directory, filename)
            # Construct the corresponding output text file path
            txt_filename = os.path.splitext(filename)[0] + ".txt"
            txt_path = os.path.join(directory, txt_filename)

            print(f"Found PDF: {filename}")

            # Check if the output file already exists and if overwriting is disabled
            if not overwrite_existing and os.path.exists(txt_path):
                print(f"  Skipping, output file already exists: {txt_filename}")
                continue # Move to the next file

            # Extract text from the PDF
            extracted_text = extract_text_from_pdf(pdf_path)

            # If text extraction was successful
            if extracted_text is not None:
                try:
                    # Open the output text file in write mode with UTF-8 encoding
                    with open(txt_path, 'w', encoding='utf-8') as txt_file:
                        # Write the extracted text to the file
                        txt_file.write(extracted_text)
                    print(f"  Successfully extracted text to: {txt_filename}")
                except Exception as e:
                    # Print an error message if writing the file fails
                    print(f"  Error writing text file {txt_filename}: {e}")

    print("Processing complete.")

# --- Main execution ---
if __name__ == "__main__":
    # Call the main processing function when the script is run directly
    process_directory(pdf_directory)