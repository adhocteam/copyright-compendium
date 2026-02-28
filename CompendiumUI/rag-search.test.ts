import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// We import the entire script so that the 'submitRagSearch' is defined on window.
import './script';

describe('CopyrightBot RAG Search Interface', () => {
	let mockFetch: any;

	beforeEach(() => {
		// Create the expected DOM structure
		document.body.innerHTML = `
            <div id="rag-search-form">
                <input id="rag-query" type="text" value="test query" />
            </div>
            <div id="rag-loading" style="display: none;"></div>
            
            <div id="rag-es-results" style="display: none;">
                <div id="rag-es-list"></div>
                <button id="rag-es-load-more" style="display: none;">Load More</button>
            </div>
            
            <div id="rag-results-container" style="display: none;"></div>
            <div id="rag-summary"></div>
            <div id="rag-sources"></div>
        `;

		mockFetch = vi.fn();
		global.fetch = mockFetch;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should show loading state and then render results on successful fetch', async () => {
		// Mock successful responses
		mockFetch.mockImplementation(async (url: string) => {
			if (url.includes('/api/search')) {
				return {
					ok: true,
					json: async () => ({
						results: [{ link: '/ch100', title: 'Chapter 100', chapter: 'Chapter 100', snippet: 'some snippet text' }]
					})
				};
			}
			if (url.includes('/api/rag-query')) {
				return {
					ok: true,
					json: async () => ({
						summary: "This is a mocked summary.",
						sources: [{ link: '/ch100', title: 'Chapter 100', chapter: 'Chapter 100' }]
					})
				};
			}
			return { ok: false };
		});

		// Trigger the search
		await window.submitRagSearch!();

		const loadingDiv = document.getElementById('rag-loading')!;
		const resultsContainer = document.getElementById('rag-results-container')!;
		const esResultsContainer = document.getElementById('rag-es-results')!;
		const summaryDiv = document.getElementById('rag-summary')!;
		const sourcesDiv = document.getElementById('rag-sources')!;
		const esListDiv = document.getElementById('rag-es-list')!;

		// Check if fetched correctly
		// Since we decoupled, the searches aren't awaited together in Promise.all
		// But vitest's await might flush microtasks, let's wait a bit for fetch to settle
		await new Promise(resolve => setTimeout(resolve, 0));

		// Verify UI states after promise resolution
		expect(loadingDiv.style.display).toBe('none');
		expect(resultsContainer.style.display).toBe('block');
		expect(esResultsContainer.style.display).toBe('block');

		// Verify Content
		expect(summaryDiv.textContent).toBe('This is a mocked summary.');
		expect(sourcesDiv.querySelector('ul')).not.toBeNull();
		expect(sourcesDiv.querySelector('a')?.textContent).toBe('Chapter 100 - Chapter 100');

		// Verify ES list
		expect(esListDiv.innerHTML).toContain('Chapter 100');
		expect(esListDiv.innerHTML).toContain('some snippet text');
	});

	it('should handle API errors gracefully', async () => {
		// Mock rejected/failed responses
		mockFetch.mockImplementation(async () => {
			return {
				ok: false,
			};
		});

		await window.submitRagSearch!();

		// Flush microtasks
		await new Promise(resolve => setTimeout(resolve, 0));

		const summaryDiv = document.getElementById('rag-summary')!;
		const esListDiv = document.getElementById('rag-es-list')!;

		expect(summaryDiv.textContent).toBe('Error generating AI summary.');
		expect(esListDiv.innerHTML).toContain('Failed to connect to standard search.');
	});
});
