import os
import json
import asyncio
from bs4 import BeautifulSoup
from elasticsearch import AsyncElasticsearch, helpers

# Configuration
ES_URL = os.getenv("ELASTICSEARCH_URL", "http://localhost:9200")
INDEX_NAME = "compendium"
UI_PUBLIC_DIR = os.path.join("..", "CompendiumUI", "public")

# Initialize Elasticsearch Client
es = AsyncElasticsearch([ES_URL])

async def create_index():
    """Create the Elasticsearch index with appropriate mappings."""
    mapping = {
        "mappings": {
            "properties": {
                "chapter_title": {"type": "text"},
                "section_title": {"type": "text"},
                "subsection_title": {"type": "text"},
                "content": {"type": "text"},
                "xhtml_id": {"type": "keyword"},
                "filename": {"type": "keyword"}
            }
        }
    }
    
    if await es.indices.exists(index=INDEX_NAME):
        print(f"Index '{INDEX_NAME}' already exists. Deleting it.")
        await es.indices.delete(index=INDEX_NAME)
        
    print(f"Creating index '{INDEX_NAME}'...")
    await es.indices.create(index=INDEX_NAME, body=mapping)
    print("Index created successfully.")

def extract_text_content(element):
    """Extract and clean text from an element."""
    if not element:
        return ""
    # Extract text and replace multiple spaces/newlines with a single space
    text = element.get_text(separator=' ', strip=True)
    return text

def parse_html_file(filepath):
    """Parse an HTML file and extract hierarchical documents."""
    filename = os.path.basename(filepath)
    print(f"Parsing {filename}...")
    
    with open(filepath, 'r', encoding='utf-8') as f:
        soup = BeautifulSoup(f, 'lxml') # using lxml for better handling of custom tags
    
    documents = []
    
    # Extract Chapter Title
    chapter_title_elem = soup.find('level_title')
    chapter_title = extract_text_content(chapter_title_elem) if chapter_title_elem else ""
    
    # Process sections
    sections = soup.find_all('section')
    
    # If no sections, maybe just paragraphs at the root chapter level
    if not sections:
        content_elements = soup.find_all(['paragraph', 'list'])
        for i, elem in enumerate(content_elements):
            text = extract_text_content(elem)
            if not text:
                continue
            doc = {
                "chapter_title": chapter_title,
                "section_title": "",
                "subsection_title": "",
                "content": text,
                "xhtml_id": elem.get('id', f"chapter-element-{i}"),
                "filename": filename
            }
            documents.append(doc)
        return documents

    for section in sections:
        section_title_elem = section.find('section_title', recursive=False)
        section_title = extract_text_content(section_title_elem) if section_title_elem else ""
        section_id = section.get('id', '')
        
        # Look for subsections within this section
        subsections = section.find_all('subsection', recursive=False)
        
        # If no subsections, just process the section's content
        if not subsections:
            # Get paragraphs or lists directly under the section (not inside deeper sections)
            content_elements = section.find_all(['paragraph', 'list'], recursive=False)
            
            # If no direct content, get all text
            if not content_elements:
               doc = {
                   "chapter_title": chapter_title,
                   "section_title": section_title,
                   "subsection_title": "",
                   "content": extract_text_content(section),
                   "xhtml_id": section_id,
                   "filename": filename
               }
               if doc['content']:
                    documents.append(doc)
            else:
               for i, elem in enumerate(content_elements):
                   text = extract_text_content(elem)
                   if not text:
                       continue
                       
                   # Use section ID if it's the first element, otherwise generate an ID
                   elem_id = elem.get('id')
                   item_id = elem_id if elem_id else (section_id if i == 0 else f"{section_id}-p{i}")
                   
                   doc = {
                       "chapter_title": chapter_title,
                       "section_title": section_title,
                       "subsection_title": "",
                       "content": text,
                       "xhtml_id": item_id,
                       "filename": filename
                   }
                   documents.append(doc)
        else:
            # Process content directly under the section (before subsections)
            direct_content = section.find_all(['paragraph', 'list'], recursive=False)
            for i, elem in enumerate(direct_content):
                text = extract_text_content(elem)
                if not text:
                    continue
                
                elem_id = elem.get('id')
                item_id = elem_id if elem_id else (section_id if i == 0 else f"{section_id}-p{i}")
                
                doc = {
                    "chapter_title": chapter_title,
                    "section_title": section_title,
                    "subsection_title": "",
                    "content": text,
                    "xhtml_id": item_id,
                    "filename": filename
                }
                documents.append(doc)

            # Process subsections
            for subsection in subsections:
                subsection_title_elem = subsection.find('subsection_title', recursive=False)
                subsection_title = extract_text_content(subsection_title_elem) if subsection_title_elem else ""
                subsection_id = subsection.get('id', '')
                
                content_elements = subsection.find_all(['paragraph', 'list'], recursive=False)
                
                if not content_elements:
                   doc = {
                       "chapter_title": chapter_title,
                       "section_title": section_title,
                       "subsection_title": subsection_title,
                       "content": extract_text_content(subsection),
                       "xhtml_id": subsection_id,
                       "filename": filename
                   }
                   if doc['content']:
                       documents.append(doc)
                else:
                    for i, elem in enumerate(content_elements):
                       text = extract_text_content(elem)
                       if not text:
                           continue
                           
                       elem_id = elem.get('id')
                       item_id = elem_id if elem_id else (subsection_id if i == 0 else f"{subsection_id}-p{i}")
                       
                       doc = {
                           "chapter_title": chapter_title,
                           "section_title": section_title,
                           "subsection_title": subsection_title,
                           "content": text,
                           "xhtml_id": item_id,
                           "filename": filename
                       }
                       documents.append(doc)

    return documents

async def index_documents(documents):
    """Bulk index documents into Elasticsearch."""
    print(f"Indexing {len(documents)} logic chunks...")
    
    actions = [
        {
            "_index": INDEX_NAME,
            "_source": doc
        }
        for doc in documents
    ]
    
    success, failed = await helpers.async_bulk(es, actions, stats_only=True)
    print(f"Successfully indexed {success} documents.")
    if failed:
        print(f"Failed to index {failed} documents.")

async def main():
    await create_index()
    
    all_documents = []
    
    # Process all chapter HTML files
    target_dir = os.path.abspath(UI_PUBLIC_DIR)
    print(f"Scanning target directory: {target_dir}")
    
    if not os.path.exists(target_dir):
        print(f"Directory {target_dir} not found. Are you running this script from the api/ folder?")
        return
        
    for filename in os.listdir(target_dir):
        if filename.startswith("ch") and filename.endswith("-src.html"):
            filepath = os.path.join(target_dir, filename)
            docs = parse_html_file(filepath)
            all_documents.extend(docs)
            print(f"Found {len(docs)} indexable items in {filename}.")
            
    if all_documents:
        print(f"Total documents to index: {len(all_documents)}")
        await index_documents(all_documents)
    else:
        print("No documents found to index.")
        
    await es.close()

if __name__ == "__main__":
    asyncio.run(main())
