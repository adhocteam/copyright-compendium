# Goal Description

The objective is to replace the existing Algolia search with an Elasticsearch-based local search experience. This new search engine will fulfill standard search queries with snippets and live links and serve as the context provider for a Retrieval-Augmented Generation (RAG) LLM query engine. 

## Proposed Changes

### 1. UI Refactoring (`CompendiumUI` directory)

#### [NEW] `CompendiumUI/public/copyright-bot-src.html`
Create a new HTML page following the structure of existing pages like `about-src.html`. This page will include:
- A search input for natural language queries.
- A results container to display both the AI-generated RAG summary and the standard Elasticsearch results list (the exact results that the LLM used to generate the summary, complete with highlighted snippets and live links back to the specific sections).
- JavaScript to interact with the new Dockerized FastAPI backend.

#### [MODIFY] `CompendiumUI/chapters.ts`
Add the "Ask CopyrightBot" page to the navigation list so it appears in the Compendium index preceding the `about-src.html` page:
```typescript
{ number: "", title: "Ask CopyrightBot", filename: "copyright-bot.html" },
```

#### [MODIFY] `CompendiumUI/public/index-src.html` & `CompendiumUI/script.ts`
Remove Algolia-specific scripts, CSS, and API usage (`@algolia/autocomplete-js`, `algoliasearch/lite`). Replace the top header search bar to either directly query the new backend or redirect the user to the `copyright-bot-src.html` page. 
Implement a reversible highlighting mechanism (e.g., using `mark.js`) in `script.ts` that listens for a URL hash containing a specific highlighting parameter or query string passed from the search page. When a user navigates to a live link, the target text will be highlighted temporarily, perhaps fading out or clearing when the user clicks elsewhere.

---

### 2. Dockerized FastAPI and Elasticsearch App

#### [NEW] `docker-compose.yml` (Root Level)
Create a unified `docker-compose.yml` at the root of the repository to manage the entire application stack. This will orchestrate three services:
1. `ui`: The frontend application built from the existing `CompendiumUI/Dockerfile` (served via Nginx).
2. `api`: The FastAPI backend service built from `api/Dockerfile`.
3. `elasticsearch`: The free version of Elasticsearch (e.g., `docker.elastic.co/elasticsearch/elasticsearch:8.x.x` with `xpack.security.enabled=false` for local dev or configured properly).

#### [NEW] `api/Dockerfile`
Create a new backend service directory `api/`. 
- `Dockerfile` using `python:3.11-slim` running Uvicorn.

#### [NEW] `api/main.py`
FastAPI application with OpenAPI documentation enabled by default. Two main routes:
- `GET /api/search`: Proxies a query to Elasticsearch. Exposes an ES highlighting configuration over the `content` field. Returns JSON containing hits with `chapter`, `section`, `subsection`, `title`, context `snippet` (with ES `<em>` highlights), and `link` (e.g. `/ch100-general-background.html#sec-101?hlt=keyword`).
- `POST /api/rag-query`: Accepts a user query, fetches top K documents using the `search` logic from Elasticsearch, constructs a system prompt with the context chunks, queries an LLM (e.g., via Gemini API or a local model), and returns a JSON object containing **both** the RAG summary and the list of Elasticsearch results that served as the context.

---

### 3. Elasticsearch Indexing Script

#### [NEW] `api/indexer.py`
A Python script to ingest the content into Elasticsearch. 
- **Source Data**: It will parse the local `CompendiumUI/public/ch*-src.html` files.
- **Index Strategy**: It will utilize BeautifulSoup to parse `<chapter>`, `<section>`, `<subsection>`, `<paragraph>`, and `<list>` tags.
- **Document Mapping**: Each Elasticsearch document will represent a discrete granular element mapped hierarchically. That is, resolving content at the **Chapter**, **Section**, and **Subsection** levels:
  - `chapter_title`: weight boosted.
  - `section_title`: weight boosted.
  - `subsection_title`: weight boosted.
  - `content`: the paragraph/list text inside the lowest-level element.
  - `xhtml_id`: the `id` attribute of the element (e.g., `sec-101` or `subsec-101-1`), used to construct the live link.
  - `filename`: the source HTML filename (e.g. `ch100-general-background.html`).

## Agent Orchestration Strategy

This feature should be implemented modularly, ideally by delegating tasks sequentially to specialized agents or separate sessions. 

1. **Agent 1 (Frontend Setup)**: Focuses entirely on `CompendiumUI`. Given this plan, the agent creates `copyright-bot-src.html`, builds out the UI components per USWDS styling standards, links it in `chapters.ts`, and sets up the reversible highlighting feature in `script.ts`.
2. **Agent 2 (Backend & Elastic Infrastructure)**: Focuses on setting up the Docker environment and the initial FastAPI skeleton. The agent creates the root `docker-compose.yml`, the `api/Dockerfile`, and `api/main.py` scaffolding exposing the two main endpoints.
3. **Agent 3 (Data Ingestion)**: Develops the `api/indexer.py` script, parses the HTML locally from `CompendiumUI`, constructs the precise hierarchical Elasticsearch mapping for chunks, and verifies that the Elasticsearch container is correctly populated.
4. **Agent 4 (RAG Integration & E2E)**: Focuses on the LLM orchestration logic in `/api/rag-query`, connects the FastAPI backend to the `CompendiumUI` frontend, and executes end-to-end testing to verify the complete user flow.

## Verification Plan

### Automated Tests Strategy
A robust, automated CI-ready testing suite is required for this new RAG architecture. 

1. **Frontend Unit Tests (Vitest)**: 
   - *Navigation & Layout*: Assert `copyright-bot.html` is generated dynamically in the TOC (`CompendiumUI/navigation.test.ts`).
   - *Highlighting Logic*: Add unit tests for `script.ts` ensuring the specific hash navigation correctly invokes `mark.js` (or similar) to apply and revert highlights on click.
   - *Search UI Component*: Add `CompendiumUI/copyright-bot.test.ts` to mock the REST FastAPI responses and ensure both the RAG text and standard ES snippets map to the DOM correctly.
2. **Backend Unit & Integration Tests (Pytest)**: 
   - *API Endpoints*: Add a test suite in `api/tests/test_main.py` using FastAPI's `TestClient` to validate the OpenAPI schemas for `GET /api/search` and `POST /api/rag-query`.
   - *Service Mocking*: In the backend tests, mock out the downstream Elasticsearch connection and LLM API calls to ensure business logic remains isolated and executes quickly.
3. **Indexer Unit Tests**:
   - Create `api/tests/test_indexer.py`. Feed it a mocked excerpt of `ch100-general-background-src.html`. 
   - Verify the HTML parser accurately delineates parent `section_title` and `subsection_title` bounds and that it correctly assigns the `xhtml_id`.

### Integration & End-to-End Tests
1. **Container Integration test**: 
   - A shell script or Task runner that spins up the root `docker-compose up -d`.
   - A test script runs `python indexer.py` and then verifies `curl http://localhost:9200/compendium/_count` returns `> 0` documents.
2. **End-to-End Browser Flow**:
   - Utilize Playwright or Selenium (if applicable to the environment) to script user interactions:
     a. Load the server port.
     b. Click "Ask CopyrightBot".
     c. Type a query into the form and submit.
     d. Wait for the summarized content and the exact citation result list.
     e. Click a citation link and assert that the browser successfully targets the correct `xhtml_id` anchor on the specific chapter page, and verify the reversible highlight CSS class exists.
