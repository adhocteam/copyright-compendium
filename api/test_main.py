import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from main import app

client = TestClient(app)

@pytest.fixture
def mock_env(monkeypatch):
    monkeypatch.setenv("LLM_API_KEY", "test_api_key_override")
    monkeypatch.setenv("LLM_MODEL_NAME", "mock-model")

@patch("main.es.search")
@patch("main.get_llm")
def test_rag_query(mock_get_llm, mock_es_search, mock_env):
    # Mock Elasticsearch response
    mock_es_search.return_value = {
        "hits": {
            "hits": [
                {
                    "_source": {
                        "content": "Test content snippet.",
                        "section_title": "Test Section",
                        "chapter_title": "Test Chapter",
                        "filename": "test.html",
                        "xhtml_id": "sec-1"
                    }
                }
            ]
        }
    }
    
    # Mock LangChain ChatModel response
    from langchain_core.messages import AIMessage
    from langchain_core.runnables import RunnableLambda
    
    mock_get_llm.return_value = RunnableLambda(lambda x: AIMessage(content="This is a summarized output from the mock LLM."))

    response = client.post("/api/rag-query", json={"query": "test query"})
    
    assert response.status_code == 200
    data = response.json()
    assert "summary" in data
    assert data["summary"] == "This is a summarized output from the mock LLM."
    assert "sources" in data
    assert len(data["sources"]) == 1
    assert data["sources"][0]["title"] == "Test Section"

def test_rag_query_missing_api_key(monkeypatch):
    monkeypatch.setenv("LLM_API_KEY", "")
    monkeypatch.setenv("LLM_MODEL_NAME", "gpt-4")
    
    response = client.post("/api/rag-query", json={"query": "test query"})
    assert response.status_code == 200
    data = response.json()
    assert "requires an LLM API key" in data["summary"]

def test_search_missing_query():
    response = client.get("/api/search")
    assert response.status_code == 422 # FastAPI validation error for missing required query param

def test_healthcheck_not_found():
    response = client.get("/nonexistent")
    assert response.status_code == 404
