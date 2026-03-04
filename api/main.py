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

from typing import List, Dict

class RagContextRequest(BaseModel):
    query: str

class RagSummaryRequest(BaseModel):
    query: str
    context_chunks: List[str]
    sources: List[Dict]

@app.get("/")
async def root():
    return {"status": "ok", "message": "Copyright Compendium API is running"}

import re

def filter_es_query(q: str) -> str:
    """Removes stop words unless they are part of a quoted phrase."""
    stop_words = {"a", "an", "the", "in", "copyright"}
    parts = re.split(r'("[^"]*")', q)
    filtered_parts = []
    for part in parts:
        if not part:
            continue
        if part.startswith('"') and part.endswith('"'):
            # Pre-quoted phrases perfectly skip the filter
            filtered_parts.append(part)
        else:
            words = part.split()
            filtered_words = [w for w in words if w.lower() not in stop_words]
            if filtered_words:
                filtered_parts.append(" ".join(filtered_words))
    filtered_query = " ".join(filtered_parts)
    return filtered_query if filtered_query.strip() else q

@app.get("/api/search")
async def search(q: str):
    """
    Standard Elasticsearch query returning hits with snippets for UI rendering.
    """
    try:
        filtered_q = filter_es_query(q)
        body = {
            "query": {
                "multi_match": {
                    "query": filtered_q,
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
        res = es.search(index=INDEX_NAME, body=body, size=30)
        hits = res.get("hits", {}).get("hits", [])
        
        results = []
        seen_sections = set()
        for hit in hits:
            source = hit["_source"]
            
            filename = source.get("filename", "")
            chapter_title = source.get("chapter_title", "")
            section_title = source.get("section_title", "")
            subsection_title = source.get("subsection_title", "")
            
            section_key = f"{filename}-{chapter_title}-{section_title}-{subsection_title}"
            
            if section_key in seen_sections:
                continue
            seen_sections.add(section_key)
            
            xhtml_id = source.get("xhtml_id", "")
            link = f"/{filename}#{xhtml_id}?hlt={q}" if filename and xhtml_id else ""
                
            highlight = hit.get("highlight", {})
            snippet = highlight.get("content", [source.get("content", "")])[0]
            
            results.append({
                "chapter": source.get("chapter_title", ""),
                "section": source.get("section_title", ""),
                "subsection": source.get("subsection_title", ""),
                "title": source.get("section_title", ""), # Fallback title
                "snippet": snippet,
                "link": link
            })
            
            if len(results) >= 10:
                break
            
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
    from langchain_huggingface import ChatHuggingFace, HuggingFaceEndpoint
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
    else:
        # Fallback to OpenAI API format
        base_url = os.getenv("LLM_BASE_URL")
        if base_url:
            return ChatOpenAI(model_name=model_name, api_key=api_key or "dummy", base_url=base_url)
        raise ValueError(f"Unsupported model pattern for '{model_name}'.")

@app.post("/api/rag-context")
async def rag_context(request: RagContextRequest):
    """
    RAG Step 1: Fetches documents from ES using LLM query extraction and returns context chunks.
    """
    llm_model = os.getenv("LLM_MODEL_NAME", "gemini-flash-latest")
    llm_api_key = os.getenv("LLM_API_KEY", "")

    if not llm_api_key or llm_api_key == "your_api_key_here":
        return {
            "error": "The RAG feature requires an LLM API key to function."
        }
        
    extracted_terms = [request.query]
    
    try:
        import ast
        import json
        prompt = ChatPromptTemplate.from_messages([
            ("user", f"This is a query for information about copyright. Please generate an array of 15 words or phrases related to this query for an elasticsearch query to gather relevant documents that will be used as context as a follow-up query to an LLM. Only return the array, in the following Python format (['term', 'phrase one', 'phrase two of two']).\n\nQuery: {request.query}")
        ])
        
        llm = get_llm(llm_model, llm_api_key)
        chain = prompt | llm
        
        response = chain.invoke({})
        content = response.content
        if isinstance(content, list):
            content = content[0].get("text", "") if content else ""
        content = content.strip()
        
        if content.startswith("```python"):
            content = content[9:-3].strip()
        elif content.startswith("```json"):
            content = content[7:-3].strip()
        elif content.startswith("```"):
            content = content[3:-3].strip()
            
        try:
            parsed_terms = ast.literal_eval(content)
        except (ValueError, SyntaxError):
            try:
                # Fallback to json after attempting to normalize single quotes
                parsed_terms = json.loads(content.replace("'", '"'))
            except Exception:
                parsed_terms = json.loads(content)

        if isinstance(parsed_terms, list):
            extracted_terms = parsed_terms
    except Exception as e:
        logger.error(f"Failed to extract search terms: {e}")

    filtered_terms = []
    stop_words = {"a", "an", "the", "in", "copyright"}
    for term in extracted_terms:
        term = str(term).strip()
        if not term:
            continue
        if " " in term:
            filtered_terms.append(f'"{term}"')
        elif term.lower() not in stop_words:
            filtered_terms.append(term)
            
    es_query = " ".join(filtered_terms)
    if not es_query.strip():
        es_query = filter_es_query(request.query)

    context_chunks = []
    sources = []
    try:
        body = {
            "query": {
                "multi_match": {
                    "query": es_query,
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
        res = es.search(index=INDEX_NAME, body=body, size=15)
        hits = res.get("hits", {}).get("hits", [])
        
        seen_sections = set()
        for hit in hits:
            source = hit["_source"]
            
            filename = source.get("filename", "")
            chapter_title = source.get("chapter_title", "")
            section_title = source.get("section_title", "")
            subsection_title = source.get("subsection_title", "")
            
            section_key = f"{filename}-{chapter_title}-{section_title}-{subsection_title}"
            
            if section_key in seen_sections:
                continue
            seen_sections.add(section_key)
            
            xhtml_id = source.get("xhtml_id", "")
            link = f"/{filename}#{xhtml_id}?hlt={request.query}" if filename and xhtml_id else ""
                
            content = source.get("content", "")
            title = source.get("section_title", "Unknown Section")
            chapter = source.get("chapter_title", "Unknown Chapter")
            
            highlight = hit.get("highlight", {})
            snippet = highlight.get("content", [content])[0]
            
            context_chunks.append(f"--- Document {len(context_chunks)+1} ---\nChapter: {chapter}\nSection: {title}\nContent:\n{content}\n")
            
            sources.append({
                "chapter": chapter,
                "title": title,
                "link": link,
                "snippet": snippet
            })
            
            if len(sources) >= 10:
                break
                
    except Exception as e:
        logger.error(f"Failed to fetch context from Elasticsearch: {e}")
        return {
            "error": "Failed to retrieve search context from Elasticsearch."
        }

    return {
        "context_chunks": context_chunks[:5],
        "sources": sources
    }

@app.post("/api/rag-summary")
async def rag_summary(request: RagSummaryRequest):
    """
    RAG Step 2: Generates summary based on provided context chunks.
    """
    llm_model = os.getenv("LLM_MODEL_NAME", "gemini-flash-latest")
    llm_api_key = os.getenv("LLM_API_KEY", "")

    if not llm_api_key or llm_api_key == "your_api_key_here":
        return {
            "summary": "The RAG feature requires an LLM API key to function.",
            "sources": []
        }

    if not request.context_chunks:
        return {
            "summary": "I could not find any relevant sections in the Copyright Compendium to answer your question.",
            "sources": []
        }

    try:
        combined_context = "\n".join(request.context_chunks)
        
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
        
        response = chain.invoke({
            "context": combined_context,
            "question": request.query
        })
        
        content = response.content
        if isinstance(content, list):
            content = content[0].get("text", "") if content else ""
        content = content.strip()
        
        return {
            "summary": content,
            "sources": request.sources
        }
        
    except Exception as e:
        logger.error(f"LLM Generation failed: {e}")
        
        friendly_error = "The AI service is currently unavailable or misconfigured."
        if not LANGCHAIN_AVAILABLE:
            friendly_error = "Required AI packages are missing from the server."
        elif "Connection refused" in str(e) or "Max retries exceeded" in str(e):
            friendly_error = f"Could not connect to the AI model ({llm_model}). Please ensure your LLM API configuration is correct."
        elif "authentication" in str(e).lower() or "api_key" in str(e).lower() or "unauthorized" in str(e).lower():
            friendly_error = "AI service authentication failed. Please check your API key configuration."
            
        return {
            "summary": f"Failed to generate AI summary: {friendly_error}\n\nPlease check the standard search results below.",
            "sources": request.sources
        }