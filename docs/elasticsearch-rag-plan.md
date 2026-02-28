# Goal Description

The objective is to replace the existing Algolia search with an Elasticsearch-based local search experience. This new search engine will fulfill standard search queries with snippets and live links and serve as the context provider for a Retrieval-Augmented Generation (RAG) LLM query engine. 

## Proposed Changes

### 1. UI Refactoring (`CompendiumUI` directory)

#### [NEW] `CompendiumUI/public/copyright-bot-src.html`
Create a new HTML page following the structure of existing pages like `about-src.html`. This page will include:
- A search input for natural language queries.
- A results container to display both the AI-generated RAG summary and the standard Elasticsearch results (with snippets and live links back to the specific sections).
- JavaScript to interact with the new Dockerized FastAPI backend.

#### [MODIFY] `CompendiumUI/chapters.ts`
Add the "Ask CopyrightBot" page to the navigation list so it appears in the Compendium index preceding the `about-src.html` page:
```typescript
{ number: "", title: "Ask CopyrightBot", filename: "copyright-bot.html" },
```

#### [MODIFY] `CompendiumUI/public/index-src.html` & `CompendiumUI/script.ts`
Remove Algolia-specific scripts, CSS, and API usage (`@algolia/autocomplete-js`, `algoliasearch/lite`). Replace the top header search bar to either directly query the new backend or redirect the user to the `copyright-bot-src.html` page.

---

### 2. Dockerized FastAPI and Elasticsearch App

#### [NEW] `api/Dockerfile` & `api/docker-compose.yml`
Create a new backend service directory `api/`. 
- `docker-compose.yml` will run two services:
  1. `elasticsearch`: The free version of Elasticsearch (e.g. `docker.elastic.co/elasticsearch/elasticsearch:8.x.x` with `xpack.security.enabled=false` for local dev or configured properly).
  2. `api`: The FastAPI application.
- `Dockerfile` using `python:3.11-slim` running Uvicorn.

#### [NEW] `api/main.py`
FastAPI application with OpenAPI documentation enabled by default. Two main routes:
- `GET /api/search`: Proxies a query to Elasticsearch. Returns JSON containing hits with `chapter`, `section`, `title`, context `snippet`, and `link` (e.g. `/ch100-general-background.html#sec-101`).
- `POST /api/rag-query`: Accepts a user query, fetches top K documents from Elasticsearch, constructs a system prompt with the context chunks, queries an LLM (e.g., via Gemini API or a local model), and returns a JSON object containing the RAG summary and the source citations.

---

### 3. Elasticsearch Indexing Script

#### [NEW] `api/indexer.py`
A Python script to ingest the content into Elasticsearch. 
- **Source Data**: It will parse the local `CompendiumUI/public/ch*-src.html` files.
- **Index Strategy**: It will utilize BeautifulSoup to parse `<chapter>`, `<section>`, `<paragraph>`, and `<list>` tags.
- **Document Mapping**: Each Elasticsearch document will represent a **Section** or **Subsection** for granularity, reducing the text length per doc natively suited for RAG.
  - `chapter_title`: weight boosted.
  - `section_title`: weight boosted.
  - `content`: the paragraph/list text inside the section.
  - `xhtml_id`: the `id` attribute of the section (e.g., `sec-101`), used to construct the live link.
  - `filename`: the source HTML filename (e.g. `ch100-general-background.html`).

## Verification Plan

### Automated Tests
1. **Frontend Tests**: 
   - Update existing Vitest files (e.g., `CompendiumUI/navigation.test.ts`) to assert `copyright-bot.html` exists in the generated TOC.
   - Add `CompendiumUI/copyright-bot.test.ts` to mock the FastAPI endpoint and ensure the UI renders the RAG summary and snippets correctly. Run using `npm run test` inside `CompendiumUI/`.
2. **Backend API Tests**: 
   - Add Pytest suite in `api/tests/` to mock Elasticsearch and the LLM, validating `GET /api/search` and `POST /api/rag-query` schemas. Run using `pytest` inside the `api/` container.
3. **Indexer Tests**:
   - Add Pytest cases for `indexer.py` ensuring it properly chunks a sample `ch100-general-background-src.html` file into the correct number of expected sections with the correct `xhtml_id`s.

### Manual Verification
1. Run `docker-compose up` in the `api/` directory.
2. Run the ingestion script `python indexer.py` and verify `curl localhost:9200/compendium/_count` returns the expected number of section documents.
3. Open the `CompendiumUI` app on the browser (e.g. via `npm run dev`), load `Ask CopyrightBot` from the Chapter menu.
4. Issue a query like "How do I register a motion picture?"
5. Verify that the UI displays an AI-generated answer, and below it, exact snippets with clickable links highlighting `ch*-src.html#sec-xxx` that successfully navigate to the respective headings in the viewer.
