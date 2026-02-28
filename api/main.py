from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from elasticsearch import Elasticsearch

app = FastAPI(title="Copyright Compendium RAG API")

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For local development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Elasticsearch Client
ES_URL = os.getenv("ELASTICSEARCH_URL", "http://localhost:9200")
es = Elasticsearch([ES_URL])
INDEX_NAME = "compendium"

class RagQuery(BaseModel):
    query: str

@app.get("/")
async def root():
    return {"status": "ok", "message": "Copyright Compendium API is running"}

@app.get("/api/search")
async def search(q: str):
    """
    Standard Elasticsearch query returning hits with snippets for UI rendering.
    """
    try:
        body = {
            "query": {
                "multi_match": {
                    "query": q,
                    "fields": ["chapter_title^3", "section_title^2", "subsection_title^1.5", "content"]
                }
            },
            "highlight": {
                "fields": {
                    "content": {
                        "pre_tags": ["<mark>"],
                        "post_tags": ["</mark>"]
                    }
                }
            }
        }
        res = es.search(index=INDEX_NAME, body=body, size=10)
        hits = res.get("hits", {}).get("hits", [])
        
        results = []
        for hit in hits:
            source = hit["_source"]
            highlight = hit.get("highlight", {})
            snippet = highlight.get("content", [source.get("content", "")])[0]
            
            filename = source.get("filename", "")
            xhtml_id = source.get("xhtml_id", "")
            link = f"/{filename}#{xhtml_id}?hlt={q}" if filename and xhtml_id else ""
            
            results.append({
                "chapter": source.get("chapter_title", ""),
                "section": source.get("section_title", ""),
                "subsection": source.get("subsection_title", ""),
                "title": source.get("section_title", ""), # Fallback title
                "snippet": snippet,
                "link": link
            })
            
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/rag-query")
async def rag_query(request: RagQuery):
    """
    Placeholder for the RAG endpoint.
    Should fetch documents from ES, trigger LLM, and return summary + exact results list.
    """
    llm_model = os.getenv("LLM_MODEL_NAME", "gemma:2b")
    llm_api_key = os.getenv("LLM_API_KEY", "")

    if not llm_api_key or llm_api_key == "your_api_key_here":
        return {
            "summary": "The RAG feature requires an LLM API key to function. Please set LLM_API_KEY and LLM_MODEL_NAME in your environment or api/.env file as detailed in the README.",
            "sources": []
        }

    # TODO: Implement full RAG pattern with LLM
    return {
        "summary": f"This is an experimental RAG summary feature currently under development. Configured to use model: {llm_model}.",
        "sources": []
    }
