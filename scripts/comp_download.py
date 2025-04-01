import os
import requests
from bs4 import BeautifulSoup
import re
import time

def download_pdf(url, save_path):
    """
    Downloads a PDF file from the given URL and saves it to the specified path
    """
    try:
        response = requests.get(url, stream=True)
        response.raise_for_status()  # Raise an exception for 4XX/5XX responses
        
        with open(save_path, 'wb') as file:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    file.write(chunk)
        
        print(f"Successfully downloaded: {save_path}")
        return True
    except Exception as e:
        print(f"Error downloading {url}: {str(e)}")
        return False

def main():
    # URL of the Copyright Office Compendium page
    url = "https://www.copyright.gov/comp3/"
    
    # Create a directory to store the PDFs
    output_dir = "copyright_compendium_pdfs"
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    try:
        # Fetch the webpage
        response = requests.get(url)
        response.raise_for_status()
        
        # Parse the HTML
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Find all links that contain PDF files
        pdf_links = []
        for a_tag in soup.find_all('a', href=True):
            href = a_tag['href']
            print(href)
            # Look for PDF links
            if (
                href.lower().endswith('.pdf')
                and href.lower().find('comp3') > 0  # Ensure it's part of the compendium
                and not href.lower().endswith('compendium.pdf')
            ):
                # Handle both absolute and relative URLs
                if href.startswith('http'):
                    pdf_links.append(href)
                else:
                    # Convert relative URL to absolute
                    pdf_links.append(requests.compat.urljoin(url, href))
        
        if not pdf_links:
            print("No PDF links found on the page.")
            return
        
        print(f"Found {len(pdf_links)} PDF links.")
        
        # Download each PDF
        for i, pdf_url in enumerate(pdf_links, 1):
            # Extract filename from URL
            filename = os.path.basename(pdf_url)
            
            # Clean up filename if needed
            filename = re.sub(r'[^\w\-\.]', '_', filename)
            
            # Full path to save the file
            save_path = os.path.join(output_dir, filename)
            
            print(f"[{i}/{len(pdf_links)}] Downloading {filename}...")
            download_pdf(pdf_url, save_path)
            
            # Add a small delay to be nice to the server
            if i < len(pdf_links):
                time.sleep(1)
        
        print(f"\nDownload complete. Files saved to '{os.path.abspath(output_dir)}'")
    
    except Exception as e:
        print(f"An error occurred: {str(e)}")

if __name__ == "__main__":
    main()