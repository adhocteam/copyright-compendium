import google.generativeai as genai
import os
import time
from pathlib import Path
import sys
import argparse
import traceback
import tempfile # For temporary chunk files

# Attempt to import necessary libraries and provide clear errors if missing
try:
    from pypdf import PdfReader, PdfWriter
except ImportError:
    print("Error: pypdf library not found. Please install it: pip install pypdf")
    sys.exit(1)

try:
    from bs4 import BeautifulSoup
except ImportError:
    # BeautifulSoup is optional for basic stitching but helpful
    print("Warning: beautifulsoup4 library not found. HTML validation/cleaning will be basic.")
    print("Install it for better results: pip install beautifulsoup4")
    BeautifulSoup = None # Set to None if not available

# --- Configuration ---
MODEL_NAME = "gemini-2.5-pro-exp-03-25"
# Input/Output directories from command-line args
SCRIPT_DIR = Path(__file__).parent.resolve()
PROMPT_FILE = SCRIPT_DIR / "ParsingPrompt-pdf.txt" # Base instructions

# Chunking Strategy
CHUNK_SIZE_PAGES = 20 # Max pages per chunk
CHUNK_OVERLAP_PAGES = 1 # Number of overlapping pages

# Prompt modification for chunks
CHUNK_PROMPT_SUFFIX = """
---
NOTE: The above content is a {chunk_desc} chunk (pages {start_page}-{end_page}) of a larger PDF document ({original_filename}).
Parse *only this portion* as a clean XHTML fragment.
*   Focus on preserving text, headings, lists, and tables accurately.
*   **Crucially, DO NOT include** `<!DOCTYPE html>`, `<html>`, `<head>`, or `<body>` tags in your response unless specifically instructed otherwise (e.g., if this chunk contains the primary Table of Contents and document start). Assume the fragment will be stitched together with others later.
*   Ensure the output is only the XHTML fragment.
"""

# API Settings
API_RETRY_DELAY_SECONDS = 10 # Increased delay for potentially heavier load
API_MAX_RETRIES = 3
API_TIMEOUT_SECONDS = 600 # Timeout per chunk request

# Intelligent Stitching Parameters
STITCH_NEEDLE_CHARS = 1000 # How many chars from the start of the current chunk to check
STITCH_HAYSTACK_CHARS = 1500 # How many chars from the end of the previous chunk to search within
STITCH_MIN_OVERLAP = 50   # Minimum number of chars that must match to be considered an overlap

# --- Helper Functions (make_api_call_with_retry - adapted slightly) ---

def make_api_call_with_retry(model, *args, **kwargs):
    """Makes an API call with retries for common transient errors."""
    retries = 0
    while retries < API_MAX_RETRIES:
        try:
            # print(f"Making API call (Attempt {retries + 1})...")
            response = model.generate_content(*args, **kwargs)

            # Check for blocked responses right away (prompt blocking)
            if not response.candidates:
                 print("Warning: Prompt was potentially blocked (no candidates returned).")
                 prompt_feedback_text = "N/A"
                 try:
                     prompt_feedback_text = f"{response.prompt_feedback}"
                 except Exception: pass # Ignore if feedback isn't accessible
                 raise ValueError(f"Prompt blocked by safety settings or other issue. Feedback: {prompt_feedback_text}")

            # Check finish reason for safety *after* generation attempt
            candidate = response.candidates[0]
            finish_reason = candidate.finish_reason
            if finish_reason == "SAFETY":
                safety_ratings_text = "N/A"
                try:
                    safety_ratings_text = f"{candidate.safety_ratings}"
                except Exception: pass
                print(f"Warning: Response generation stopped due to safety concerns. Ratings: {safety_ratings_text}")
                raise ValueError(f"Response blocked by safety settings. Ratings: {safety_ratings_text}")

            # Check for MAX_TOKENS - less likely with chunks, but possible
            if finish_reason == "MAX_TOKENS":
                print("Warning: Response truncated due to MAX_TOKENS, even for a chunk. The fragment might be incomplete.")
                # We won't implement sub-chunk continuation here, proceed with truncated fragment.

            # Check if the response has the expected text part
            try:
                _ = response.text # Try accessing text to catch potential errors early
            except ValueError as e:
                 print(f"Warning: Could not directly access response text: {e}. Checking parts...")
                 if candidate.content and candidate.content.parts:
                      print("Response has parts, attempting to extract text later.")
                 else:
                     print("Error: No usable text content structure found in the response and response.text failed.")
                     raise ValueError("Invalid response structure or missing text content.") from e

            return response # Success

        except ValueError as ve: # Catch safety/blocking errors raised above
            print(f"Content Safety/Blocking Error: {ve}")
            raise ve # Re-raise to be caught by the calling function
        except Exception as e:
            # Handle other potential API errors (e.g., network, rate limits)
            print(f"Error during API call: {e}")
            retries += 1
            if retries >= API_MAX_RETRIES:
                print("Max retries reached for API call. Failing.")
                raise # Re-raise the last exception
            print(f"Retrying in {API_RETRY_DELAY_SECONDS * (retries + 1)} seconds...") # Basic exponential backoff
            time.sleep(API_RETRY_DELAY_SECONDS * (retries + 1))

    raise Exception("API call failed after multiple retries.")


# --- PDF Processing Functions ---

def split_pdf_into_chunks(pdf_path: Path, chunk_size: int, overlap: int, temp_dir: Path) -> list[Path]:
    """Splits a PDF into potentially overlapping chunks."""
    chunks = []
    print(f"Splitting '{pdf_path.name}' into chunks (size: {chunk_size}, overlap: {overlap})...")
    try:
        reader = PdfReader(pdf_path)
        total_pages = len(reader.pages)
        print(f"Total pages: {total_pages}")

        if total_pages == 0:
            print("Warning: PDF has no pages. Skipping splitting.")
            return []

        current_page = 0
        chunk_index = 0
        while current_page < total_pages:
            chunk_start_page = current_page
            # Calculate end page, ensuring it doesn't exceed total pages
            chunk_end_page = min(current_page + chunk_size, total_pages)

            writer = PdfWriter()
            for page_num in range(chunk_start_page, chunk_end_page):
                writer.add_page(reader.pages[page_num])

            # Create a unique filename for the chunk in the temp directory
            chunk_filename = f"{pdf_path.stem}_chunk_{chunk_index:03d}_pages_{chunk_start_page + 1}-{chunk_end_page}.pdf"
            chunk_path = temp_dir / chunk_filename
            writer.write(chunk_path)
            chunks.append(chunk_path)
            print(f"  Created chunk {chunk_index}: {chunk_path.name} (Pages {chunk_start_page + 1} to {chunk_end_page})")

            chunk_index += 1

            # Determine the start of the next chunk based on overlap
            next_start_page = chunk_end_page - overlap
            # Ensure next start page is valid and prevents infinite loops if overlap >= chunk_size
            if next_start_page <= current_page:
                 if chunk_end_page == total_pages:
                      break # We reached the end, normal exit
                 else:
                      # Overlap is too large or chunk size too small, force progress
                      print(f"Warning: Overlap logic issue detected. Forcing progress to next page after chunk.")
                      next_start_page = chunk_end_page
                      if next_start_page >= total_pages:
                           break # Already processed everything

            current_page = next_start_page

            # Safety break if something goes wrong with page logic
            if chunk_index > total_pages * 2: # Arbitrary limit
                 print("Error: Exceeded maximum expected chunks. Aborting split.")
                 return [] # Return empty list or raise error

    except Exception as e:
        print(f"ERROR: Failed to split PDF {pdf_path.name}: {e}")
        traceback.print_exc()
        return [] # Return empty list on failure

    print(f"Splitting complete. Generated {len(chunks)} chunks.")
    return chunks

def process_chunk(chunk_path: Path, base_prompt: str, model: genai.GenerativeModel, chunk_index: int, total_chunks: int, original_filename: str) -> str | None:
    """Processes a single PDF chunk using the Gemini API."""
    print(f"\n--- Processing Chunk: {chunk_path.name} ({chunk_index + 1}/{total_chunks}) ---")
    uploaded_file = None
    html_fragment = None
    processing_start_time = time.time()

    # Extract page numbers from filename for the prompt note
    try:
        parts = chunk_path.stem.split('_')
        page_info = parts[-1] # Should be "pages_start-end"
        start_page, end_page = map(int, page_info.split('-'))
    except Exception:
        print(f"Warning: Could not parse page numbers from chunk filename '{chunk_path.name}'. Using chunk index.")
        start_page, end_page = f"chunk {chunk_index+1}", "N/A"


    # Determine chunk description for the prompt
    if chunk_index == 0 and total_chunks == 1:
        chunk_desc = "the only"
    elif chunk_index == 0:
        chunk_desc = "the first"
    elif chunk_index == total_chunks - 1:
        chunk_desc = "the last"
    else:
        chunk_desc = "an intermediate"

    # Modify the prompt for this chunk
    modified_prompt = base_prompt + CHUNK_PROMPT_SUFFIX.format(
        chunk_desc=chunk_desc,
        start_page=start_page,
        end_page=end_page,
        original_filename=original_filename
    )
    # print(f"DEBUG: Modified Prompt for chunk:\n{modified_prompt}\n---") # Uncomment for debugging

    try:
        # 1. Upload the chunk PDF file
        print(f"Uploading {chunk_path.name}...")
        start_upload_time = time.time()
        # Retrying uploads might be needed for large/flaky connections
        try:
             upload_wait_time = 5 # Adjust if needed
             uploaded_file = genai.upload_file(path=chunk_path, display_name=chunk_path.name)
             print(f"Upload successful: {uploaded_file.name} (took {time.time() - start_upload_time:.2f}s). Waiting {upload_wait_time}s...")
             time.sleep(upload_wait_time)
        except Exception as e:
             print(f"ERROR: Failed to upload chunk {chunk_path.name}: {e}")
             return None # Indicate failure for this chunk

        # 2. Generation Request
        print("Sending generation request for chunk...")
        request_content = [modified_prompt, uploaded_file] # Prompt first, then file

        response = make_api_call_with_retry(
            model,
            request_content,
            request_options={"timeout": API_TIMEOUT_SECONDS}
        )

        # 3. Extract HTML Fragment
        try:
            html_fragment = response.text.strip()
            if not html_fragment:
                 print("Warning: Received empty response for chunk.")
                 # Return empty string instead of None, signifies processed but no content
                 html_fragment = ""
            else:
                 print(f"Received fragment (length: {len(html_fragment)} chars).")
        except Exception as e:
            # Should be caught by retry func, but as fallback:
            print(f"Error extracting text from response for chunk: {e}")
            html_fragment = None # Indicate failure

    except ValueError as ve: # Catch safety/blocking errors from retry function
        print(f"ERROR: Generation failed for chunk {chunk_path.name} due to: {ve}")
        html_fragment = None # Indicate failure
    except Exception as e:
        print(f"ERROR: An unexpected error occurred processing chunk {chunk_path.name}: {e}")
        traceback.print_exc()
        html_fragment = None # Indicate failure
    finally:
        # 4. Clean up the uploaded chunk file
        if uploaded_file:
            try:
                print(f"Deleting uploaded chunk file: {uploaded_file.name}...")
                genai.delete_file(uploaded_file.name)
                print("Deletion successful.")
            except Exception as e:
                print(f"Warning: Failed to delete uploaded chunk file {uploaded_file.name}: {e}")

        print(f"--- Finished Processing Chunk: {chunk_path.name} (took {time.time() - processing_start_time:.2f}s) ---")

    return html_fragment # Return the string fragment or None on failure

def stitch_html_fragments_intelligently(fragments: list[str | None], original_filename: str) -> str | None:
    """
    Stitches HTML fragments together, attempting to find and remove overlap,
    and performs final cleanup.

    Args:
        fragments: A list of HTML fragment strings (or None for failed chunks).
        original_filename: The name of the original PDF file for titling.

    Returns:
        The cleaned, stitched HTML as a single string, or None if no valid fragments exist.
    """
    print("\n--- Stitching HTML Fragments Intelligently ---")

    # Filter out None values in case some chunks failed
    valid_fragments = [f for f in fragments if f is not None]

    if not valid_fragments:
        print("No valid fragments to stitch.")
        return None

    if len(valid_fragments) == 1:
        print("Only one fragment, processing for stitching.")
        stitched_content = valid_fragments[0]
    else:
        # Start with the first fragment
        stitched_html = valid_fragments[0]
        print(f"Starting with fragment 0 (length: {len(stitched_html)})")

        # Iterate through the rest of the fragments
        for i in range(1, len(valid_fragments)):
            previous_html = stitched_html
            current_fragment = valid_fragments[i]
            print(f"\nProcessing fragment {i} (length: {len(current_fragment)})")

            if not current_fragment.strip():
                 print("  Fragment is empty or whitespace, skipping overlap check.")
                 continue

            # Define search zones, handle potential short fragments
            haystack_text = previous_html[-STITCH_HAYSTACK_CHARS:]
            needle_text = current_fragment[:STITCH_NEEDLE_CHARS]

            if not needle_text or not haystack_text:
                print("  Warning: Not enough text in previous or current fragment for overlap check.")
                stitched_html += "\n" + current_fragment # Fallback: concatenate
                continue

            print(f"  Searching for overlap (needle length: {len(needle_text)}, haystack length: {len(haystack_text)})")
            found_overlap = False
            best_overlap_len = 0
            splice_point_in_previous = -1 # Index in previous_html where current should start

            for overlap_len in range(min(len(needle_text), len(haystack_text)), STITCH_MIN_OVERLAP - 1, -1):
                potential_overlap_from_needle = needle_text[:overlap_len]
                found_index_in_haystack = haystack_text.find(potential_overlap_from_needle)

                if found_index_in_haystack != -1:
                    overlap_start_index_in_previous = len(previous_html) - len(haystack_text) + found_index_in_haystack
                    splice_point_in_previous = overlap_start_index_in_previous
                    best_overlap_len = overlap_len
                    found_overlap = True
                    print(f"  Found overlap of length {best_overlap_len} chars.")
                    break # Stop searching once the longest possible overlap is found

            if found_overlap:
                print(f"  Splicing fragment {i} at index {splice_point_in_previous} of the accumulated HTML.")
                stitched_html = previous_html[:splice_point_in_previous] + current_fragment
            else:
                print(f"  Warning: No overlap found >= {STITCH_MIN_OVERLAP} chars. Concatenating fragment {i}.")
                stitched_html += "\n" + current_fragment # Fallback concatenation

        stitched_content = stitched_html

    print(f"\nTotal stitched content length before final cleanup: {len(stitched_content)}")

    # *** START: Added Cleanup Step ***
    print("Performing final cleanup: Removing lines with ```...")
    lines = stitched_content.splitlines()
    cleaned_lines = [line for line in lines if "```" not in line]
    cleaned_stitched_content = "\n".join(cleaned_lines)
    lines_removed = len(lines) - len(cleaned_lines)
    if lines_removed > 0:
        print(f"  Removed {lines_removed} lines containing ```.")
    else:
        print("  No lines containing ``` found.")
    # *** END: Added Cleanup Step ***

    # Add basic HTML structure using the cleaned content
    final_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <link rel="stylesheet" type="text/css" href="style.css">
</head>
<body>
    {cleaned_stitched_content}
</body>
</html>""" # Use cleaned_stitched_content here

    # Optional: Basic validation/cleaning with BeautifulSoup
    #if BeautifulSoup:
    #    try:
    #        print("Attempting basic HTML structure check/prettify with BeautifulSoup...")
    #        soup = BeautifulSoup(final_html, 'html.parser')
    #        final_html = soup.prettify()
    #        print("Basic structure check/prettify complete.")
    #    except Exception as e:
    #        print(f"Warning: BeautifulSoup parsing/prettifying failed: {e}")

    print("--- Stitching Complete ---")
    return final_html

# --- Main Execution ---

def main():
    """Main function to parse args, configure API, find PDFs, and process them."""

    parser = argparse.ArgumentParser(description="Process PDF files via chunking using Google Gemini to generate HTML.")
    parser.add_argument("-i", "--input-dir", required=True, type=Path, help="Directory containing input PDF files.")
    parser.add_argument("-o", "--output-dir", type=Path, default=None, help="Directory for output HTML files. Defaults to input directory.")
    parser.add_argument("--skip-existing", action="store_true", help="Skip PDFs if corresponding HTML exists in output directory.")
    parser.add_argument("--chunk-size", type=int, default=CHUNK_SIZE_PAGES, help=f"Number of pages per PDF chunk (default: {CHUNK_SIZE_PAGES}).")
    parser.add_argument("--overlap", type=int, default=CHUNK_OVERLAP_PAGES, help=f"Number of overlapping pages between chunks (default: {CHUNK_OVERLAP_PAGES}).")

    args = parser.parse_args()

    input_dir: Path = args.input_dir
    output_dir: Path = args.output_dir if args.output_dir else input_dir
    skip_existing: bool = args.skip_existing
    chunk_size: int = args.chunk_size
    overlap: int = args.overlap

    if overlap >= chunk_size or overlap < 0:
        print(f"Error: Invalid overlap ({overlap}). Must be >= 0 and < chunk size ({chunk_size}).")
        sys.exit(1)

    print(f"Input PDF Directory: {input_dir}")
    print(f"Output HTML Directory: {output_dir}")
    print(f"Skip Existing HTML: {skip_existing}")
    print(f"Chunk Size: {chunk_size} pages")
    print(f"Chunk Overlap: {overlap} pages")

    # --- API Key & Model Setup ---
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key: print("Error: GOOGLE_API_KEY not set."); sys.exit(1)
    try:
        genai.configure(api_key=api_key)
        print("Google Generative AI SDK configured.")
        model = genai.GenerativeModel(MODEL_NAME)
        print(f"Using model: {MODEL_NAME}")
    except Exception as e:
        print(f"Error configuring SDK or model '{MODEL_NAME}': {e}"); sys.exit(1)

    # --- Validate Dirs & Prompt ---
    if not input_dir.is_dir(): print(f"Error: Input dir not found: {input_dir}"); sys.exit(1)
    if not PROMPT_FILE.is_file(): print(f"Error: Prompt file not found: {PROMPT_FILE}"); sys.exit(1)
    if not output_dir.exists():
        print(f"Creating output directory: {output_dir}")
        try: output_dir.mkdir(parents=True, exist_ok=True)
        except OSError as e: print(f"Error creating output dir {output_dir}: {e}"); sys.exit(1)
    elif not output_dir.is_dir(): print(f"Error: Output path is not a directory: {output_dir}"); sys.exit(1)

    try:
        base_prompt_text = PROMPT_FILE.read_text(encoding='utf-8').strip()
        if not base_prompt_text: print(f"Warning: Prompt file {PROMPT_FILE} is empty.")
        print(f"Loaded base prompt from {PROMPT_FILE}")
    except IOError as e: print(f"Error reading prompt file {PROMPT_FILE}: {e}"); sys.exit(1)

    # --- Find and Process PDFs ---
    print(f"\nSearching for PDF files in: {input_dir}")
    pdf_files = [p for p in input_dir.glob("*") if p.suffix.lower() == ".pdf"]
    print(f"Found {len(pdf_files)} PDF file(s).")

    processed_count = 0
    skipped_count = 0
    error_count = 0

    for pdf_path in pdf_files:
        print(f"\n========================================")
        print(f"Starting processing for: {pdf_path.name}")
        print(f"========================================")
        output_html_path = output_dir / f"{pdf_path.stem}.html"

        if skip_existing and output_html_path.exists():
            print(f"Skipping '{pdf_path.name}' as output file '{output_html_path.name}' already exists.")
            skipped_count += 1
            continue

        # Use a temporary directory for PDF chunks for this specific PDF
        with tempfile.TemporaryDirectory(prefix=f"pdf_chunks_{pdf_path.stem}_") as temp_dir_str:
            temp_dir = Path(temp_dir_str)
            print(f"Using temporary directory for chunks: {temp_dir}")

            # 1. Split PDF into Chunks
            chunk_paths = split_pdf_into_chunks(pdf_path, chunk_size, overlap, temp_dir)

            if not chunk_paths:
                print(f"Failed to create chunks for {pdf_path.name}. Skipping.")
                error_count += 1
                # Cleanup happens automatically via TemporaryDirectory context manager
                continue

            # 2. Process Each Chunk
            html_fragments = []
            chunk_errors = 0
            for i, chunk_path in enumerate(chunk_paths):
                fragment = process_chunk(
                    chunk_path=chunk_path,
                    base_prompt=base_prompt_text,
                    model=model,
                    chunk_index=i,
                    total_chunks=len(chunk_paths),
                    original_filename=pdf_path.name
                )
                # Store the fragment (even if it's None, stitching function handles it)
                html_fragments.append(fragment)

                if fragment is None:
                    # If a chunk fails, log it, but continue processing other chunks.
                    # Stitching will proceed with the fragments that were successful.
                    print(f"ERROR: Failed to process chunk {i+1}/{len(chunk_paths)} for {pdf_path.name}. Will attempt to stitch successful fragments.")
                    chunk_errors += 1
                    # Removed the 'break' here to allow processing remaining chunks

                time.sleep(1) # Small delay between chunk API calls

            # Check if we got *any* successful fragments at all
            if all(f is None for f in html_fragments):
                 print(f"ERROR: All chunks for {pdf_path.name} failed processing. No HTML file will be saved.")
                 error_count += 1
                 continue # Move to the next PDF file
            elif chunk_errors > 0:
                 print(f"Warning: {chunk_errors} chunk(s) failed for {pdf_path.name}. Proceeding to stitch the successful fragments.")


            # 3. Stitch HTML Fragments Intelligently
            final_html = stitch_html_fragments_intelligently(html_fragments, pdf_path.name)

            # 4. Save Final HTML
            if final_html:
                print(f"Saving final stitched HTML to: {output_html_path}")
                try:
                    output_html_path.write_text(final_html, encoding='utf-8')
                    print("Save successful.")
                    processed_count += 1
                    if chunk_errors > 0:
                        print(f"Note: Saved HTML for {pdf_path.name} is based on partially successful chunk processing.")
                except IOError as e:
                    print(f"ERROR: Failed to save final HTML file {output_html_path}: {e}")
                    error_count += 1
            else:
                # This case should be rare now unless the only successful fragments were empty
                print(f"ERROR: Stitching failed or resulted in no content for {pdf_path.name}.")
                error_count += 1

            # Temporary directory and its contents (chunks) are automatically deleted here
            print(f"Temporary directory {temp_dir} cleaned up.")


        # Optional delay between processing entire PDFs
        time.sleep(2)

    print("\n--- Batch Processing Summary ---")
    print(f"Total PDF files found: {len(pdf_files)}")
    print(f"Files processed (at least partially): {processed_count}")
    print(f"Files skipped (already exist): {skipped_count}")
    print(f"Files encountering errors preventing save: {error_count}")
    print("--- All PDF processing finished. ---")

if __name__ == "__main__":
    main()