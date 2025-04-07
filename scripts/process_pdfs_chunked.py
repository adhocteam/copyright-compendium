import google.generativeai as genai
import os
import time
from pathlib import Path
import sys
import argparse
import traceback
import tempfile  # For temporary chunk files
import re  # Import regex for tag finding

# Attempt to import necessary libraries and provide clear errors if missing
try:
    from pypdf import PdfReader, PdfWriter
except ImportError:
    print("Error: pypdf library not found. Please install it: pip install pypdf")
    sys.exit(1)

try:
    from bs4 import BeautifulSoup
except ImportError:
    # BeautifulSoup is optional for final cleanup but not essential for stitching logic
    print(
        "Warning: beautifulsoup4 library not found. Final HTML cleanup will be basic."
    )
    print("Install it for potential improvements: pip install beautifulsoup4")
    BeautifulSoup = None  # Set to None if not available

# --- Configuration ---
MODEL_NAME = "gemini-2.5-pro-exp-03-25"  # Keeping original model name as requested
# Input/Output directories from command-line args
SCRIPT_DIR = Path(__file__).parent.resolve()
PROMPT_FILE = (
    SCRIPT_DIR / "ParsingPrompt-pdf.txt"
)  # Base instructions (Assumed to contain page tag instructions)

# Chunking Strategy
CHUNK_SIZE_PAGES = 20  # Max pages per chunk
CHUNK_OVERLAP_PAGES = 1  # Default overlap is 1 page for the page-tag logic

# Prompt modification for chunks
# No explicit instruction to add page tags here; assumed to be in the base prompt file
CHUNK_PROMPT_SUFFIX = """
---
NOTE: The above content is a {chunk_desc} chunk (pages {start_page}-{end_page}) of a larger PDF document ({original_filename}).
Parse *only this portion* as a clean XHTML fragment.
*   Focus on preserving text, headings, lists, and tables accurately.
*   **Crucially, DO NOT include** `<!DOCTYPE html>`, `<html>`, `<head>`, or `<body>` tags in your response unless specifically instructed otherwise (e.g., if this chunk contains the primary Table of Contents and document start). Assume the fragment will be stitched together with others later.
*   Ensure the output is only the XHTML fragment.
"""

# API Settings
API_RETRY_DELAY_SECONDS = 15
API_MAX_RETRIES = 3
API_TIMEOUT_SECONDS = 600  # Timeout per chunk request

# --- Helper Functions (make_api_call_with_retry) ---


def make_api_call_with_retry(model, *args, **kwargs):
    """Makes an API call with retries for common transient errors."""
    retries = 0
    while retries < API_MAX_RETRIES:
        try:
            # print(f"Making API call (Attempt {retries + 1})...")
            response = model.generate_content(*args, **kwargs)

            # Check for blocked responses right away (prompt blocking)
            if not response.candidates:
                print(
                    "Warning: Prompt was potentially blocked (no candidates returned)."
                )
                prompt_feedback_text = "N/A"
                try:
                    prompt_feedback_text = f"{response.prompt_feedback}"
                except Exception:
                    pass  # Ignore if feedback isn't accessible
                raise ValueError(
                    f"Prompt blocked by safety settings or other issue. Feedback: {prompt_feedback_text}"
                )

            # Check finish reason for safety *after* generation attempt
            candidate = response.candidates[0]
            finish_reason = candidate.finish_reason
            # Use .name for enum comparison as values might change
            if finish_reason.name == "SAFETY":
                safety_ratings_text = "N/A"
                try:
                    safety_ratings_text = f"{candidate.safety_ratings}"
                except Exception:
                    pass
                print(
                    f"Warning: Response generation stopped due to safety concerns. Ratings: {safety_ratings_text}"
                )
                raise ValueError(
                    f"Response blocked by safety settings. Ratings: {safety_ratings_text}"
                )

            # Check for MAX_TOKENS
            if finish_reason.name == "MAX_TOKENS":
                print(
                    "Warning: Response truncated due to MAX_TOKENS, even for a chunk. The fragment might be incomplete."
                )

            # Check if the response has the expected text part
            try:
                _ = response.text  # Try accessing text to catch potential errors early
            except ValueError as e:
                print(
                    f"Warning: Could not directly access response text: {e}. Checking parts..."
                )
                if candidate.content and candidate.content.parts:
                    # Check for function call if applicable
                    if (
                        hasattr(candidate.content.parts[0], "function_call")
                        and candidate.content.parts[0].function_call
                    ):
                        print(
                            "Error: Response contained a function call instead of text."
                        )
                        raise ValueError(
                            "Invalid response: Function call received instead of text."
                        ) from e
                    else:
                        print("Response has parts, attempting to extract text later.")
                else:
                    print(
                        "Error: No usable text content structure found in the response and response.text failed."
                    )
                    raise ValueError(
                        "Invalid response structure or missing text content."
                    ) from e

            return response  # Success

        except ValueError as ve:  # Catch safety/blocking/structure errors raised above
            print(f"Content Safety/Blocking/Structure Error: {ve}")
            raise ve  # Re-raise to be caught by the calling function
        except Exception as e:
            # Handle other potential API errors (e.g., network, rate limits)
            error_str = str(e).lower()
            wait_time = API_RETRY_DELAY_SECONDS * (
                2**retries
            )  # Default exponential backoff

            if "rate_limit_exceeded" in error_str or "429" in error_str:
                print(f"Rate limit likely hit. Retrying in {wait_time} seconds...")
            elif "503" in error_str or "service unavailable" in error_str:
                wait_time = API_RETRY_DELAY_SECONDS * (
                    retries + 1
                )  # Linear backoff for server errors
                print(f"Service unavailable (503). Retrying in {wait_time} seconds...")
            elif "file processing" in error_str or "file error" in error_str:
                print(f"API Error potentially related to file processing: {e}")
                print(f"Retrying in {wait_time} seconds...")
            else:
                print(f"Error during API call: {e}")
                print(f"Retrying in {wait_time} seconds...")

            retries += 1
            if retries >= API_MAX_RETRIES:
                print("Max retries reached for API call. Failing.")
                raise  # Re-raise the last exception
            time.sleep(wait_time)

    raise Exception("API call failed after multiple retries.")


# --- PDF Processing Functions ---


# <<< CORRECTED split_pdf_into_chunks function >>>
def split_pdf_into_chunks(
    pdf_path: Path, chunk_size: int, overlap: int, temp_dir: Path
) -> list[Path]:
    """Splits a PDF into potentially overlapping chunks."""
    chunks = []
    print(
        f"Splitting '{pdf_path.name}' into chunks (size: {chunk_size}, overlap: {overlap})..."
    )
    try:
        reader = PdfReader(pdf_path)
        total_pages = len(reader.pages)
        print(f"Total pages: {total_pages}")

        if total_pages == 0:
            print("Warning: PDF has no pages. Skipping splitting.")
            return []

        current_page = 0  # Use 0-based index internally for PyPDF
        chunk_index = 0
        while current_page < total_pages:
            chunk_start_page = current_page
            # Calculate end page (exclusive index for range, but inclusive page number)
            chunk_end_page = min(current_page + chunk_size, total_pages)

            # Ensure we don't create an empty chunk if start somehow meets or exceeds end
            if chunk_start_page >= chunk_end_page:
                print(
                    f"Warning: Skipping empty chunk generation (start={chunk_start_page}, end={chunk_end_page})."
                )
                break

            writer = PdfWriter()
            original_pages_in_chunk = []  # Store 1-based original page numbers
            for page_num_zero_based in range(chunk_start_page, chunk_end_page):
                writer.add_page(reader.pages[page_num_zero_based])
                original_pages_in_chunk.append(page_num_zero_based + 1)

            # Create a unique filename for the chunk in the temp directory
            page_range_str = (
                f"{original_pages_in_chunk[0]}-{original_pages_in_chunk[-1]}"
            )
            chunk_filename = (
                f"{pdf_path.stem}_chunk_{chunk_index:03d}_pages_{page_range_str}.pdf"
            )
            chunk_path = temp_dir / chunk_filename
            writer.write(chunk_path)
            chunks.append(chunk_path)
            print(
                f"  Created chunk {chunk_index}: {chunk_path.name} (Original Pages {page_range_str})"
            )

            chunk_index += 1

            # --- Correction: Check for loop termination *after* creating the chunk ---
            # If the chunk we just created ends at the total number of pages, we are done.
            if chunk_end_page == total_pages:
                print("  Reached end of document. Stopping chunk creation.")
                break  # Exit the loop

            # Determine the start of the next chunk based on overlap
            next_start_page = chunk_end_page - overlap

            # Sanity check: Ensure next_start_page is valid and doesn't regress.
            # If overlap is too large causing next_start <= current_page, force progress.
            if next_start_page <= current_page:
                print(
                    f"Warning: Chunking logic resulted in non-progressing start page ({next_start_page} <= {current_page}). Forcing progress to {chunk_end_page}."
                )
                next_start_page = chunk_end_page
                # If forcing progress still doesn't advance, break to prevent definite infinite loop.
                if next_start_page >= total_pages:
                    print("  Forced progress reached end. Stopping chunk creation.")
                    break

            current_page = next_start_page

            # Safety break for excessive chunks (remains useful)
            if (
                chunk_index > total_pages * 2
            ):  # Arbitrary limit slightly larger than total pages
                print(
                    f"Error: Exceeded maximum expected chunks ({total_pages * 2}). Aborting split to prevent potential infinite loop."
                )
                return []  # Return empty list

    except Exception as e:
        print(f"ERROR: Failed to split PDF {pdf_path.name}: {e}")
        traceback.print_exc()
        return []

    print(f"Splitting complete. Generated {len(chunks)} chunks.")
    return chunks


# <<< END of corrected split_pdf_into_chunks function >>>


def process_chunk(
    chunk_path: Path,
    base_prompt: str,
    model: genai.GenerativeModel,
    chunk_index: int,
    total_chunks: int,
    original_filename: str,
) -> str | None:
    """Processes a single PDF chunk using the Gemini API."""
    print(
        f"\n--- Processing Chunk: {chunk_path.name} ({chunk_index + 1}/{total_chunks}) ---"
    )
    uploaded_file = None
    html_fragment = None
    processing_start_time = time.time()

    # Extract page numbers from filename for the prompt note
    page_range_str = "unknown"
    start_page_num = -1
    end_page_num = -1
    try:
        # Regex to find page numbers like _pages_1-20.pdf or _pages_5.pdf
        match = re.search(
            r"_pages_(\d+)(?:-(\d+))?\.pdf$", chunk_path.name, re.IGNORECASE
        )
        if match:
            start_page_num = int(match.group(1))
            if match.group(2):  # If end page is captured (range)
                end_page_num = int(match.group(2))
                page_range_str = f"{start_page_num}-{end_page_num}"
            else:  # Single page chunk
                end_page_num = start_page_num
                page_range_str = str(start_page_num)
        else:
            print(
                f"Warning: Could not parse page numbers from chunk filename '{chunk_path.name}' using regex. Using chunk index."
            )
            page_range_str = f"chunk_{chunk_index+1}"
    except Exception as e:
        print(
            f"Warning: Error parsing page numbers from filename '{chunk_path.name}': {e}. Using chunk index."
        )
        page_range_str = f"chunk_{chunk_index+1}"

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
        start_page=start_page_num if start_page_num != -1 else "N/A",
        end_page=end_page_num if end_page_num != -1 else "N/A",
        original_filename=original_filename,
    )
    # print(f"DEBUG: Modified Prompt for chunk:\n{modified_prompt}\n---") # Uncomment for debugging

    try:
        # 1. Upload the chunk PDF file
        print(f"Uploading {chunk_path.name}...")
        start_upload_time = time.time()
        upload_wait_time = 5  # Base wait time
        upload_attempts = 0
        max_upload_attempts = 2  # Try upload twice

        while upload_attempts < max_upload_attempts:
            upload_attempts += 1
            try:
                uploaded_file = genai.upload_file(
                    path=chunk_path, display_name=chunk_path.name
                )
                print(
                    f"Upload successful ({upload_attempts}/{max_upload_attempts}): {uploaded_file.name} (took {time.time() - start_upload_time:.2f}s)."
                )

                # Wait for the file to become ACTIVE
                print(f"Waiting up to {upload_wait_time * 5}s for file processing...")
                for _ in range(5):  # Check 5 times with 'upload_wait_time' delay
                    # Use the name property to get the file
                    file_state_obj = genai.get_file(name=uploaded_file.name)
                    file_state = file_state_obj.state.name  # Access state name
                    if file_state == "ACTIVE":
                        print("File is ACTIVE.")
                        break
                    elif file_state == "FAILED" or file_state == "CANCELLED":
                        raise IOError(
                            f"File upload {uploaded_file.name} entered state: {file_state}"
                        )
                    else:  # PROCESSING or unspecified
                        print(
                            f"  File state: {file_state}. Waiting {upload_wait_time}s..."
                        )
                        time.sleep(upload_wait_time)
                else:  # Loop finished without breaking (file not active)
                    file_state_obj = genai.get_file(
                        name=uploaded_file.name
                    )  # Get final state
                    file_state = file_state_obj.state.name
                    raise TimeoutError(
                        f"File {uploaded_file.name} did not become ACTIVE after waiting. Final state: {file_state}"
                    )
                break  # Break upload retry loop if successful

            except Exception as upload_err:
                print(
                    f"ERROR during upload/processing attempt {upload_attempts}/{max_upload_attempts} for {chunk_path.name}: {upload_err}"
                )
                if uploaded_file:  # Clean up partial upload if possible
                    try:
                        genai.delete_file(uploaded_file.name)
                    except Exception:
                        pass
                    uploaded_file = None  # Reset
                if upload_attempts >= max_upload_attempts:
                    print(
                        f"Max upload attempts reached for {chunk_path.name}. Failing chunk."
                    )
                    return None  # Indicate failure for this chunk
                print("Retrying upload...")
                time.sleep(3)  # Short delay before retrying upload

        # 2. Generation Request
        print("Sending generation request for chunk...")
        request_content = [modified_prompt, uploaded_file]  # Prompt first, then file

        response = make_api_call_with_retry(
            model, request_content, request_options={"timeout": API_TIMEOUT_SECONDS}
        )

        # 3. Extract HTML Fragment
        try:
            html_fragment = response.text.strip()
            if not html_fragment:
                print("Warning: Received empty response for chunk.")
                html_fragment = (
                    ""  # Return empty string, signifies processed but no content
                )
            else:
                print(f"Received fragment (length: {len(html_fragment)} chars).")
                # Basic check if page tags seem to be present (helps debugging prompt)
                if not re.search(r"<(/?)page\s", html_fragment, re.IGNORECASE):
                    print(
                        "Warning: Received fragment does not appear to contain the expected <page> tags. Stitching might fail."
                    )

        except Exception as e:
            print(f"Error extracting text from response for chunk: {e}")
            html_fragment = None  # Indicate failure

    except ValueError as ve:  # Catch safety/blocking errors from retry function
        print(f"ERROR: Generation failed for chunk {chunk_path.name} due to: {ve}")
        html_fragment = None  # Indicate failure
    except Exception as e:
        print(
            f"ERROR: An unexpected error occurred processing chunk {chunk_path.name}: {e}"
        )
        traceback.print_exc()
        html_fragment = None  # Indicate failure
    finally:
        # 4. Clean up the uploaded chunk file *immediately* after use
        if uploaded_file:
            try:
                print(f"Deleting uploaded chunk file: {uploaded_file.name}...")
                genai.delete_file(uploaded_file.name)
                print("Deletion successful.")
            except Exception as e:
                # Log warning but don't fail the whole process
                print(
                    f"Warning: Failed to delete uploaded chunk file {uploaded_file.name}: {e}"
                )

        print(
            f"--- Finished Processing Chunk: {chunk_path.name} (took {time.time() - processing_start_time:.2f}s) ---"
        )

    return html_fragment  # Return the string fragment or None on failure


def stitch_html_fragments_by_page_tag(
    fragments: list[str | None], original_filename: str
) -> str | None:
    """
    Stitches HTML fragments together using <page label="..."> tags (allowing variations).
    Assumes a 1-page overlap where the last page of fragment N should replace
    the first page of fragment N+1.

    Args:
        fragments: A list of HTML fragment strings (or None for failed chunks).
        original_filename: The name of the original PDF file for titling.

    Returns:
        The cleaned, stitched HTML as a single string, or None if no valid fragments exist.
    """
    print("\n--- Stitching HTML Fragments by Page Tag ---")

    valid_fragments = [
        f for f in fragments if f is not None and f.strip()
    ]  # Filter out None and empty/whitespace fragments
    if not valid_fragments:
        print("No valid, non-empty fragments to stitch.")
        return None

    if len(valid_fragments) == 1:
        print("Only one valid fragment, no stitching needed.")
        stitched_content = valid_fragments[0]
    else:
        stitched_html = valid_fragments[0]
        print(f"Starting with fragment 0 (length: {len(stitched_html)})")

        # Regex to find page tags robustly. Handles variations.
        page_tag_pattern = re.compile(
            r"<page\s+label\s*=\s*([\"\'])(?P<page_num>\d+)\1\s*(?:/>|>(.*?)</page>?)",
            re.IGNORECASE | re.DOTALL,
        )

        for i in range(1, len(valid_fragments)):
            previous_html = stitched_html
            current_fragment = valid_fragments[i]
            print(f"\nProcessing fragment {i} (length: {len(current_fragment)})")

            # --- Find the end of the *last* page in the previous fragment ---
            previous_matches = list(page_tag_pattern.finditer(previous_html))
            if not previous_matches:
                print(
                    f"  Warning: No page tags found in the accumulated HTML (up to fragment {i-1}). Cannot perform page-based stitch."
                )
                print(f"  Falling back to simple concatenation for fragment {i}.")
                stitched_html += (
                    "\n\n" + current_fragment
                )  # Add extra newline as separator
                continue

            last_match_prev = previous_matches[-1]
            split_point_prev = last_match_prev.end()  # Index *after* the matched tag
            last_page_num_prev = last_match_prev.group("page_num")
            print(
                f"  Found last page tag in previous content: (Page {last_page_num_prev}) ending at index {split_point_prev}."
            )
            previous_part = previous_html[
                :split_point_prev
            ]  # Keep everything up to and including the last page tag

            # --- Find the end of the *first* page in the current fragment ---
            first_match_curr = page_tag_pattern.search(current_fragment)
            if not first_match_curr:
                print(
                    f"  Warning: No page tags found in the current fragment {i}. Cannot perform page-based stitch."
                )
                print(f"  Falling back to simple concatenation for fragment {i}.")
                stitched_html += (
                    "\n\n" + current_fragment
                )  # Append the whole current fragment
                continue

            split_point_curr = first_match_curr.end()  # Index *after* the matched tag
            first_page_num_curr = first_match_curr.group("page_num")
            print(
                f"  Found first page tag in current fragment: (Page {first_page_num_curr}) ending at index {split_point_curr}."
            )

            # Optional overlap check
            try:
                if int(first_page_num_curr) != int(last_page_num_prev):
                    print(
                        f"  Warning: Page number mismatch at overlap. Previous ends on page {last_page_num_prev}, current starts processing on page {first_page_num_curr}. Stitching proceeds, but check results."
                    )
            except ValueError:
                print("  Warning: Could not compare page numbers numerically.")

            current_part = current_fragment[
                split_point_curr:
            ]  # Keep everything *after* the first page tag

            # --- Combine ---
            stitched_html = (
                previous_part + "\n" + current_part.lstrip()
            )  # Remove leading whitespace from the next part

        stitched_content = stitched_html

    print(
        f"\nTotal stitched content length before final cleanup: {len(stitched_content)}"
    )

    # --- Final Cleanup & Wrapping ---
    print("Performing final cleanup: Removing potential ``` markdown fences...")
    cleaned_stitched_content = re.sub(
        r"^\s*```[a-zA-Z]*\s*?\n?", "", stitched_content, flags=re.MULTILINE
    )
    cleaned_stitched_content = re.sub(
        r"\n?\s*```\s*?$", "", cleaned_stitched_content, flags=re.MULTILINE
    ).strip()

    # Add basic HTML structure using the cleaned content
    final_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>{original_filename}</title>
    <link rel="stylesheet" type="text/css" href="style.css">
</head>
<body>
    {cleaned_stitched_content}
</body>
</html>"""

    # Optional: Use BeautifulSoup for prettifying if available
    if BeautifulSoup:
        try:
            print("Attempting HTML prettify with BeautifulSoup...")
            soup = BeautifulSoup(final_html, "html.parser")
            final_html = soup.prettify()
            print("Prettify complete.")
        except Exception as e:
            print(
                f"Warning: BeautifulSoup prettifying failed: {e}. Using un-prettified HTML."
            )

    print("--- Stitching Complete ---")
    return final_html


# --- Main Execution ---


def main():
    """Main function to parse args, configure API, find PDFs, and process them."""

    parser = argparse.ArgumentParser(
        description="Process PDF files via chunking using Google Gemini to generate HTML.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "-i",
        "--input-dir",
        required=True,
        type=Path,
        help="Directory containing input PDF files.",
    )
    parser.add_argument(
        "-o",
        "--output-dir",
        type=Path,
        default=None,
        help="Directory for output HTML files. Defaults to input directory.",
    )
    parser.add_argument(
        "--skip-existing",
        action="store_true",
        help="Skip PDFs if corresponding HTML exists in output directory.",
    )
    parser.add_argument(
        "--chunk-size",
        type=int,
        default=CHUNK_SIZE_PAGES,
        help="Number of pages per PDF chunk.",
    )
    parser.add_argument(
        "--overlap",
        type=int,
        default=CHUNK_OVERLAP_PAGES,
        help="Number of overlapping pages between chunks. MUST BE 1 for page-tag stitching.",
    )

    args = parser.parse_args()

    input_dir: Path = args.input_dir.resolve()
    output_dir: Path = (args.output_dir if args.output_dir else input_dir).resolve()
    skip_existing: bool = args.skip_existing
    chunk_size: int = args.chunk_size
    overlap: int = args.overlap

    # --- Validation ---
    if not input_dir.is_dir():
        print(f"Error: Input directory not found: {input_dir}")
        sys.exit(1)
    if not PROMPT_FILE.is_file():
        print(f"Error: Prompt file not found: {PROMPT_FILE}")
        sys.exit(1)

    if overlap != 1:
        print(
            f"Error: Invalid overlap ({overlap}). This script requires --overlap 1 for page-tag stitching."
        )
        sys.exit(1)

    if chunk_size <= overlap:
        print(
            f"Error: Chunk size ({chunk_size}) must be greater than overlap ({overlap}). Recommend chunk size >= 2."
        )
        sys.exit(1)

    if not output_dir.exists():
        print(f"Creating output directory: {output_dir}")
        try:
            output_dir.mkdir(parents=True, exist_ok=True)
        except OSError as e:
            print(f"Error creating output dir {output_dir}: {e}")
            sys.exit(1)
    elif not output_dir.is_dir():
        print(f"Error: Output path is not a directory: {output_dir}")
        sys.exit(1)

    print(f"Input PDF Directory: {input_dir}")
    print(f"Output HTML Directory: {output_dir}")
    print(f"Skip Existing HTML: {skip_existing}")
    print(f"Chunk Size: {chunk_size} pages")
    print(f"Chunk Overlap: {overlap} page (Required)")
    print(f"Base Prompt File: {PROMPT_FILE}")
    print(f"Using Model: {MODEL_NAME}")

    # --- API Key & Model Setup ---
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        print("Error: GOOGLE_API_KEY environment variable not set.")
        sys.exit(1)
    try:
        genai.configure(api_key=api_key)
        print("Google Generative AI SDK configured.")
        generation_config = genai.GenerationConfig(
            temperature=0.1,
        )

        model = genai.GenerativeModel(
            MODEL_NAME,
            generation_config=generation_config,
        )
    except Exception as e:
        print(f"Error configuring SDK or model '{MODEL_NAME}': {e}")
        sys.exit(1)

    try:
        base_prompt_text = PROMPT_FILE.read_text(encoding="utf-8").strip()
        if not base_prompt_text:
            print(f"Warning: Prompt file {PROMPT_FILE} is empty.")
    except IOError as e:
        print(f"Error reading prompt file {PROMPT_FILE}: {e}")
        sys.exit(1)

    # --- Find and Process PDFs ---
    print(f"\nSearching for PDF files in: {input_dir}")
    pdf_files = sorted([p for p in input_dir.glob("*") if p.suffix.lower() == ".pdf"])
    print(f"Found {len(pdf_files)} PDF file(s).")

    processed_count = 0
    skipped_count = 0
    error_count = 0
    total_start_time = time.time()

    for idx, pdf_path in enumerate(pdf_files):
        pdf_start_time = time.time()
        print(f"\n========================================")
        print(f"Starting processing for: {pdf_path.name} ({idx + 1}/{len(pdf_files)})")
        print(f"========================================")
        output_html_path = output_dir / f"{pdf_path.stem}.html"

        if skip_existing and output_html_path.exists():
            print(
                f"Skipping '{pdf_path.name}' as output file '{output_html_path.name}' already exists."
            )
            skipped_count += 1
            continue

        with tempfile.TemporaryDirectory(
            prefix=f"pdf_chunks_{pdf_path.stem}_"
        ) as temp_dir_str:
            temp_dir = Path(temp_dir_str)
            print(f"Using temporary directory for chunks: {temp_dir}")

            # 1. Split PDF into Chunks (using corrected function)
            chunk_paths = split_pdf_into_chunks(pdf_path, chunk_size, overlap, temp_dir)

            if not chunk_paths:
                print(f"Failed to create chunks for {pdf_path.name}. Skipping.")
                error_count += 1
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
                    original_filename=pdf_path.name,
                )
                html_fragments.append(fragment)

                if fragment is None:
                    print(
                        f"ERROR: Failed to process chunk {i+1}/{len(chunk_paths)} for {pdf_path.name}. Will attempt to stitch successful fragments."
                    )
                    chunk_errors += 1

                time.sleep(1.5)  # Delay between chunks

            if all(f is None for f in html_fragments):
                print(
                    f"ERROR: All chunks for {pdf_path.name} failed processing. No HTML file will be saved."
                )
                error_count += 1
                continue
            elif chunk_errors > 0:
                if not any(f is not None and f.strip() for f in html_fragments):
                    print(
                        f"ERROR: Chunk processing failed, and no valid fragments were generated for {pdf_path.name}. No HTML file will be saved."
                    )
                    error_count += 1
                    continue
                else:
                    print(
                        f"Warning: {chunk_errors} chunk(s) failed for {pdf_path.name}. Proceeding to stitch the successful fragments."
                    )

            # 3. Stitch HTML Fragments using Page Tags
            final_html = stitch_html_fragments_by_page_tag(
                html_fragments, pdf_path.name
            )

            # 4. Save Final HTML
            if final_html and final_html.strip():
                print(f"Saving final stitched HTML to: {output_html_path}")
                try:
                    output_html_path.write_text(final_html, encoding="utf-8")
                    print("Save successful.")
                    processed_count += 1
                    if chunk_errors > 0:
                        print(
                            f"Note: Saved HTML for {pdf_path.name} is based on partially successful chunk processing."
                        )
                except IOError as e:
                    print(
                        f"ERROR: Failed to save final HTML file {output_html_path}: {e}"
                    )
                    error_count += 1
            else:
                print(
                    f"ERROR: Stitching failed or resulted in empty content for {pdf_path.name}. No file saved."
                )
                error_count += 1

            print(f"Temporary directory {temp_dir} cleaned up.")
            pdf_time_taken = time.time() - pdf_start_time
            print(
                f"--- Time taken for {pdf_path.name}: {pdf_time_taken:.2f} seconds ---"
            )

        time.sleep(3)  # Delay between files

    total_time_taken = time.time() - total_start_time
    print("\n--- Batch Processing Summary ---")
    print(f"Total PDF files found: {len(pdf_files)}")
    print(f"Files processed (HTML saved): {processed_count}")
    print(f"Files skipped (already exist): {skipped_count}")
    print(f"Files encountering errors (no HTML saved): {error_count}")
    print(f"Total processing time: {total_time_taken:.2f} seconds")
    print("--- All PDF processing finished. ---")


if __name__ == "__main__":
    main()
