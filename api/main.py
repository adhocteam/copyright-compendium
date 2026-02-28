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

import logging

logger = logging.getLogger(__name__)

# Try importing Langchain components
try:
    from langchain_core.prompts import ChatPromptTemplate
    from langchain_openai import ChatOpenAI
    from langchain_anthropic import ChatAnthropic
    from langchain_google_genai import ChatGoogleGenerativeAI
    from langchain_community.chat_models import ChatOllama
    LANGCHAIN_AVAILABLE = True
except ImportError:
    LANGCHAIN_AVAILABLE = False

def get_llm(model_name: str, api_key: str):
    """Factory to return the appropriate Langchain ChatModel."""
    model_name_lower = model_name.lower()
    
    if not LANGCHAIN_AVAILABLE:
        raise RuntimeError("LangChain packages are not installed.")

    if "gpt-" in model_name_lower:
        return ChatOpenAI(model_name=model_name, api_key=api_key)
    elif "claude-" in model_name_lower:
        return ChatAnthropic(model_name=model_name, api_key=api_key)
    elif "gemini" in model_name_lower:
        return ChatGoogleGenerativeAI(model=model_name, google_api_key=api_key)
    elif "gemma" in model_name_lower or "llama" in model_name_lower:
        # Assuming local Ollama for open source models if API key isn't strictly needed or points to a local endpoint
        # For this prototype we can use ChatOllama
        return ChatOllama(model=model_name)
    else:
        # Fallback to OpenAI API format (often used by local servers like LM Studio / vLLM)
        base_url = os.getenv("LLM_BASE_URL")
        if base_url:
            return ChatOpenAI(model_name=model_name, api_key=api_key or "dummy", base_url=base_url)
        raise ValueError(f"Unsupported model pattern for '{model_name}'.")

@app.post("/api/rag-query")
async def rag_query(request: RagQuery):
    """
    RAG endpoint. Fetches documents from ES, triggers LLM via LangChain, and returns summary + exact results list.
    """
    llm_model = os.getenv("LLM_MODEL_NAME", "gemma:2b")
    llm_api_key = os.getenv("LLM_API_KEY", "")

    # For local models via Ollama (like gemma), we might not need an API key if running locally.
    # But for external APIs, we definitely do.
    requires_key = not ("gemma" in llm_model.lower() or "llama" in llm_model.lower() or os.getenv("LLM_BASE_URL"))
    
    if requires_key and (not llm_api_key or llm_api_key == "your_api_key_here"):
        return {
            "summary": "The RAG feature requires an LLM API key to function for cloud models. Please set LLM_API_KEY and LLM_MODEL_NAME in your environment or api/.env file.",
            "sources": []
        }

    # 1. Fetch Context from Elasticsearch
    # We reuse the search query logic, but maybe limit to top 5 for context window
    context_chunks = []
    sources = []
    try:
        body = {
            "query": {
                "multi_match": {
                    "query": request.query,
                    "fields": ["chapter_title^3", "section_title^2", "subsection_title^1.5", "content"]
                }
            }
        }
        res = es.search(index=INDEX_NAME, body=body, size=5)
        hits = res.get("hits", {}).get("hits", [])
        
        for idx, hit in enumerate(hits):
            source = hit["_source"]
            content = source.get("content", "")
            title = source.get("section_title", "Unknown Section")
            chapter = source.get("chapter_title", "Unknown Chapter")
            
            # Add to context string
            context_chunks.append(f"--- Document {idx+1} ---\nChapter: {chapter}\nSection: {title}\nContent:\n{content}\n")
            
            # Construct link for sources array
            filename = source.get("filename", "")
            xhtml_id = source.get("xhtml_id", "")
            link = f"/{filename}#{xhtml_id}?hlt={request.query}" if filename and xhtml_id else ""
            
            sources.append({
                "chapter": chapter,
                "title": title,
                "link": link
            })
            
    except Exception as e:
        logger.error(f"Failed to fetch context from Elasticsearch: {e}")
        return {
            "summary": "Error: Failed to retrieve search context from Elasticsearch.",
            "sources": []
        }

    if not context_chunks:
        return {
            "summary": "I could not find any relevant sections in the Copyright Compendium to answer your question.",
            "sources": []
        }

    # 2. Trigger LLM
    try:
        combined_context = "\n".join(context_chunks)
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", "You are CopyrightBot, a helpful assistant specializing in the U.S. Copyright Office's Compendium of U.S. Copyright Office Practices, Third Edition.\n\n"
                       "You will be provided with retrieved context documents from the Compendium. "
                       "Your goal is to answer the user's question clearly and concisely, strictly based on the provided context.\n"
                       "Do NOT use outside knowledge. If the answer is not contained within the context, state that you cannot answer based on the Compendium.\n"
                       "Limit your response to a concise summary (around 2-3 paragraphs).\n\n"
                       "Context Documents:\n{context}"),
            ("user", "{question}")
        ])
        
        llm = get_llm(llm_model, llm_api_key)
        chain = prompt | llm
        
        # Invoke Langchain
        response = chain.invoke({
            "context": combined_context,
            "question": request.query
        })
        
        answer = response.content
        
        return {
            "summary": answer,
            "sources": sources
        }
        
    except Exception as e:
        logger.error(f"LLM Generation failed: {e}")
        error_msg = str(e)
        if not LANGCHAIN_AVAILABLE:
            error_msg = "LangChain packages are missing. Did you pip install -r requirements.txt?"
        return {
            "summary": f"Failed to generate AI summary. Error: {error_msg}\n\nRunning experimental model '{llm_model}' requires the correct backend configuration.",
            "sources": sources
        }
