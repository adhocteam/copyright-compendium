import sys

filename = '/Users/arihershowitz/Documents/AdHoc/workspace/copyright-compendium/CompendiumUI/script.ts'

append_code = """

// --- Setup CopyrightBot Search Functionality ---
window.submitRagSearch = async () => {
    const queryInput = document.getElementById('rag-query') as HTMLInputElement | null;
    const loadingDiv = document.getElementById('rag-loading');
    const resultsContainer = document.getElementById('rag-results-container');
    const summaryDiv = document.getElementById('rag-summary');
    const sourcesDiv = document.getElementById('rag-sources');

    if (!queryInput || !loadingDiv || !resultsContainer || !summaryDiv || !sourcesDiv) {
        console.warn("Ask CopyrightBot UI elements not found.");
        return;
    }

    const queryValue = queryInput.value.trim();
    if (!queryValue) return;

    // Ensure URL hash stays synced
    window.location.hash = `#copyright-bot-src.html?q=${encodeURIComponent(queryValue)}`;

    // UI states
    loadingDiv.style.display = 'block';
    resultsContainer.style.display = 'none';
    summaryDiv.innerHTML = '';
    sourcesDiv.innerHTML = '';

    try {
        // Initiate both search requests
        const baseUrl = window.location.hostname === 'localhost' ? 'http://localhost:8000' : '/api';
        const searchPromise = fetch(`${baseUrl}/api/search?q=${encodeURIComponent(queryValue)}`);
        const ragPromise = fetch(`${baseUrl}/api/rag-query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: queryValue })
        });

        const [searchRes, ragRes] = await Promise.all([searchPromise, ragPromise]);

        if (searchRes.ok) {
            const searchData = await searchRes.json();
            const hits = searchData.results || [];
            
            if (hits.length === 0) {
                sourcesDiv.innerHTML = '<p>No results found.</p>';
            } else {
                const ul = document.createElement('ul');
                ul.className = 'usa-list';
                hits.forEach((hit: any) => {
                    const li = document.createElement('li');
                    const a = document.createElement('a');
                    a.href = hit.link;
                    a.textContent = hit.chapter ? `${hit.chapter} - ${hit.title}` : hit.title;
                    const p = document.createElement('p');
                    p.innerHTML = hit.snippet;
                    li.appendChild(a);
                    li.appendChild(p);
                    ul.appendChild(li);
                });
                sourcesDiv.appendChild(ul);
            }
        } else {
            sourcesDiv.innerHTML = '<p class="usa-alert usa-alert--error">Error retrieving sources.</p>';
        }

        if (ragRes.ok) {
            const ragData = await ragRes.json();
            summaryDiv.textContent = ragData.summary || "No summary provided.";
        } else {
            summaryDiv.textContent = "Error generating AI summary.";
        }

    } catch (error) {
        console.error("Error during RAG search:", error);
        summaryDiv.textContent = "Failed to connect to search service.";
        sourcesDiv.innerHTML = '<p class="usa-alert usa-alert--error">Failed to connect to search service.</p>';
    } finally {
        loadingDiv.style.display = 'none';
        resultsContainer.style.display = 'block';
    }
};
"""

with open(filename, 'r') as f:
    content = f.read()

# I also need to update loadContent to trigger submitRagSearch
new_content = content.replace("            const finalHashToScroll = targetHash || (isInitialLoad ? location.hash.substring(1) : null);", 
"""            // Auto-trigger bot if loaded with a query parameter
            if (filename === 'copyright-bot-src.html') {
                const qParam = new URLSearchParams(window.location.hash.split('?')[1] || '').get('q');
                if (qParam && window.submitRagSearch) {
                    setTimeout(() => {
                        const queryInput = document.getElementById('rag-query') as HTMLInputElement;
                        if (queryInput) queryInput.value = qParam;
                        window.submitRagSearch!();
                    }, 100);
                }
            }

            const finalHashToScroll = targetHash || (isInitialLoad ? location.hash.substring(1) : null);""")

with open(filename, 'w') as f:
    f.write(new_content + "\n" + append_code)

print("Updated script.ts safely.")
