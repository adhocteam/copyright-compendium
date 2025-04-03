import os
import argparse
import sys
import time
from pathlib import Path
import google.generativeai as genai
from google.api_core import exceptions as google_exceptions

# --- Configuration ---
PROMPT_FILENAME = "ParsingPrompt-pdf.txt"
# Specific experimental model requested
GEMINI_MODEL_NAME = "gemini-2.5-pro-exp-03-25"
# Safety settings can be adjusted if needed
GENERATION_CONFIG = {
    "temperature": 0.2,
    "max_output_tokens": 8192,
    "response_mime_type": "text/plain",
}
SAFETY_SETTINGS = {}
RETRY_DELAY_SECONDS = 5
MAX_RETRIES = 1  # << CHANGED: Max retries set to 1

# --- New Configuration ---
# Set to True to skip processing if the output HTML file already exists
SKIP_IF_HTML_EXISTS = True # << ADDED: Skip flag

# --- Helper Functions ---

def find_pdf_files(directory: Path) -> list[Path]:
    """Finds all PDF files in the specified directory."""
    if not directory.is_dir():
        print(f"Error: Directory not found: {directory}", file=sys.stderr)
        sys.exit(1)
    return sorted(list(directory.glob("*.pdf")))

def load_prompt(filename: str) -> str:
    """Loads the prompt text from a file."""
    try:
        with open(filename, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        print(f"Error: Prompt file not found: {filename}", file=sys.stderr)
        print(f"Please ensure '{PROMPT_FILENAME}' exists in the script's directory.", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error reading prompt file {filename}: {e}", file=sys.stderr)
        sys.exit(1)

# Modified signature to accept output_path directly
def process_single_pdf(
    pdf_path: Path,
    output_path: Path, # << CHANGED: Accept full output path
    prompt_text: str,
    model: genai.GenerativeModel
) -> bool:
    """
    Processes a single PDF: uploads it, calls Gemini API with streaming,
    and saves the streamed response to the specified HTML file path.
    Returns True on success, False on failure.
    """
    print(f"\n--- Processing: {pdf_path.name} ---")
    print(f"  Output target: {output_path}")

    uploaded_file = None
    retries = 0
    while retries <= MAX_RETRIES:
        try:
            print(f"  Uploading {pdf_path.name}...")
            if not pdf_path.is_file():
                 print(f"  Error: PDF file not found or not accessible: {pdf_path}", file=sys.stderr)
                 return False
            uploaded_file = genai.upload_file(path=pdf_path, display_name=pdf_path.name)
            print(f"  Upload successful. File URI: {uploaded_file.uri}")
            break # Exit retry loop on successful upload

        except google_exceptions.GoogleAPIError as e:
            retries += 1
            print(f"  Error uploading file (Attempt {retries}/{MAX_RETRIES+1}): {e}", file=sys.stderr)
            if retries > MAX_RETRIES:
                print(f"  Upload failed after {MAX_RETRIES+1} attempt(s).", file=sys.stderr)
                return False
            print(f"  Retrying in {RETRY_DELAY_SECONDS} seconds...")
            time.sleep(RETRY_DELAY_SECONDS)
        except FileNotFoundError:
             print(f"  Error: PDF file not found during upload attempt: {pdf_path}", file=sys.stderr)
             return False
        except Exception as e:
            print(f"  An unexpected error occurred during upload: {e}", file=sys.stderr)
            if uploaded_file:
                try:
                    print(f"  Attempting to delete potentially orphaned uploaded file: {uploaded_file.name}")
                    genai.delete_file(uploaded_file.name)
                except Exception as del_e:
                    print(f"    Could not delete orphaned file {uploaded_file.name}: {del_e}", file=sys.stderr)
            return False

    if not uploaded_file:
        print("  Upload did not complete successfully. Skipping API call.", file=sys.stderr)
        return False

    try:
        print(f"  Calling Gemini ({GEMINI_MODEL_NAME}) for parsing (streaming)...")
        api_prompt = [prompt_text, uploaded_file]

        retries = 0
        while retries <= MAX_RETRIES:
            try:
                response = model.generate_content(
                    api_prompt,
                    stream=True,
                    generation_config=GENERATION_CONFIG,
                    safety_settings=SAFETY_SETTINGS
                )

                print(f"  Streaming response to: {output_path}")
                # Ensure parent directory exists just in case
                output_path.parent.mkdir(parents=True, exist_ok=True)
                with open(output_path, "w", encoding="utf-8") as f:
                    for chunk in response:
                        try:
                            if chunk.text:
                                f.write(chunk.text)
                        except ValueError as ve:
                            print(f"  Warning: Skipping problematic chunk: {ve}", file=sys.stderr)
                        except Exception as chunk_ex:
                            print(f"  Warning: Error processing chunk: {chunk_ex}", file=sys.stderr)

                # Feedback check after streaming
                try:
                    if response.prompt_feedback and response.prompt_feedback.block_reason:
                        print(f"  Warning: Prompt blocked. Reason: {response.prompt_feedback.block_reason}", file=sys.stderr)
                        # output_path.unlink(missing_ok=True) # Optionally delete
                        # return False # Treat as failure?

                except (ValueError, IndexError, AttributeError) as feedback_err:
                     print(f"  Warning: Could not retrieve full feedback after streaming: {feedback_err}", file=sys.stderr)

                print(f"  Successfully saved parsed output to {output_path}")
                return True # Success

            except (google_exceptions.GoogleAPIError, google_exceptions.RetryError) as e:
                retries += 1
                print(f"  Error during Gemini API call (Attempt {retries}/{MAX_RETRIES+1}): {e}", file=sys.stderr)
                if retries > MAX_RETRIES:
                    print(f"  API call failed after {MAX_RETRIES+1} attempt(s).", file=sys.stderr)
                    # Clean up output file if it was created but generation failed
                    # output_path.unlink(missing_ok=True) # Keep partial or delete? User choice.
                    return False
                print(f"  Retrying in {RETRY_DELAY_SECONDS} seconds...")
                time.sleep(RETRY_DELAY_SECONDS)
            except Exception as e:
                print(f"  An unexpected error occurred during API call or streaming: {e}", file=sys.stderr)
                output_path.unlink(missing_ok=True)
                return False

    except Exception as e:
        print(f"  An critical error occurred in process_single_pdf: {e}", file=sys.stderr)
        return False
    finally:
        if uploaded_file:
            try:
                print(f"  Cleaning up uploaded file: {uploaded_file.name}...")
                genai.delete_file(uploaded_file.name)
                print("  Cleanup successful.")
            except Exception as e:
                print(f"  Warning: Failed to delete uploaded file {uploaded_file.name}: {e}", file=sys.stderr)

# --- Main Execution ---

def main():
    parser = argparse.ArgumentParser(description="Process PDF files in a directory using the Gemini API.")
    parser.add_argument(
        "-d", "--directory",
        type=str,
        required=True,
        help="Path to the directory containing PDF files."
    )
    parser.add_argument(
        "-o", "--output-dir",
        type=str,
        default=None,
        help="Directory to save the output HTML files. Defaults to the input directory."
    )
    parser.add_argument(
        "--force-process", # Add an argument to override skipping
        action="store_true",
        help=f"Process all PDFs even if corresponding HTML files exist (overrides SKIP_IF_HTML_EXISTS={SKIP_IF_HTML_EXISTS})."
    )
    args = parser.parse_args()

    input_dir = Path(args.directory).resolve()
    output_dir = Path(args.output_dir).resolve() if args.output_dir else input_dir
    prompt_file_path = Path(__file__).parent / PROMPT_FILENAME

    # Determine if skipping should actually happen based on flag and argument
    # << ADDED: logic to handle --force-process flag >>
    should_skip = SKIP_IF_HTML_EXISTS and not args.force_process

    # Ensure output directory exists
    output_dir.mkdir(parents=True, exist_ok=True)
    print(f"Input directory:  {input_dir}")
    print(f"Output directory: {output_dir}")
    print(f"Prompt file:    {prompt_file_path}")
    print(f"Model:          {GEMINI_MODEL_NAME}")
    print(f"Max Retries:    {MAX_RETRIES}")
    if should_skip:
        print(f"Skip existing:  True (use --force-process to override)")
    else:
        print(f"Skip existing:  False ({'--force-process used' if args.force_process else 'SKIP_IF_HTML_EXISTS is False'})")


    # --- API Key and Model Setup ---
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        print("Error: GOOGLE_API_KEY environment variable not set.", file=sys.stderr)
        sys.exit(1)

    try:
        genai.configure(api_key=api_key)
        # Verify model availability during setup if possible (optional)
        # try:
        #    genai.get_model(f'models/{GEMINI_MODEL_NAME}')
        # except Exception as model_err:
        #    print(f"Warning: Could not verify model '{GEMINI_MODEL_NAME}' existence: {model_err}", file=sys.stderr)
        #    print("Proceeding, but check model name if errors occur.", file=sys.stderr)

        model = genai.GenerativeModel(GEMINI_MODEL_NAME)
        print(f"Using Gemini model: {GEMINI_MODEL_NAME}")
    except Exception as e:
        print(f"Error configuring Google Generative AI or creating model: {e}", file=sys.stderr)
        sys.exit(1)

    # --- Load Prompt ---
    prompt_text = load_prompt(prompt_file_path)
    print("Prompt loaded successfully.")

    # --- Find PDF Files ---
    pdf_files = find_pdf_files(input_dir)
    if not pdf_files:
        print(f"No PDF files found in {input_dir}.")
        sys.exit(0)
    print(f"Found {len(pdf_files)} PDF file(s) to process.")

    # --- Process Files ---
    success_count = 0
    failure_count = 0
    skip_count = 0
    for pdf_path in pdf_files:
        # << ADDED: Skip logic here >>
        base_name = pdf_path.stem
        output_filename = f"{base_name}.html"
        output_path = output_dir / output_filename

        if should_skip and output_path.exists():
            print(f"\n--- Skipping: {pdf_path.name} (Output '{output_path.name}' already exists) ---")
            skip_count += 1
            continue # Move to the next PDF file

        # Call the processing function (passing the calculated output_path)
        # << CHANGED: Passing output_path now >>
        if process_single_pdf(pdf_path, output_path, prompt_text, model):
            success_count += 1
        else:
            failure_count += 1
            # Error message printed within process_single_pdf
            # print(f"!!! Failed to process: {pdf_path.name} !!!", file=sys.stderr) # Redundant now

    # --- Summary ---
    print("\n--- Processing Complete ---")
    print(f"Successfully processed: {success_count}")
    print(f"Skipped (output exists): {skip_count}")
    print(f"Failed to process:    {failure_count}")
    print("--------------------------")

if __name__ == "__main__":
    main()