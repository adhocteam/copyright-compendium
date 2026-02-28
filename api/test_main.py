import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_rag_query():
    response = client.post("/api/rag-query", json={"query": "test query"})
    assert response.status_code == 200
    data = response.json()
    assert "summary" in data
    assert data["summary"] == "This is an experimental RAG summary feature currently under development."
    assert "sources" in data

def test_search_missing_query():
    # Calling the actual backend, but it's mocked by default if ES isn't hit
    response = client.get("/api/search")
    assert response.status_code == 422 # FastAPI validation error for missing required query param

def test_healthcheck_not_found():
    # just an arbitrary test to ensure the server starts properly
    response = client.get("/nonexistent")
    assert response.status_code == 404
