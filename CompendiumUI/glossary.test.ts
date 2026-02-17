import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Glossary Tooltip Behavior', () => {
	beforeEach(() => {
		// Mock Algolia to prevent "appId is missing" error
		vi.mock('algoliasearch/lite', () => ({
			default: vi.fn(() => ({
				search: vi.fn(),
			})),
			liteClient: vi.fn(() => ({
				search: vi.fn(),
			})),
		}));

		// Mock autocomplete to prevent initialization errors
		vi.mock('@algolia/autocomplete-js', () => ({
			autocomplete: vi.fn(),
			getAlgoliaResults: vi.fn(),
		}));

		vi.resetModules();
		document.body.innerHTML = `
            <div id="chapter-content">
                <a href="/compendium/glossary.html#term1" id="link1">Term 1</a>
                <a href="/compendium/glossary.html#term2" id="link2">Term 2</a>
            </div>
            <div id="glossary-tooltip" style="display: none;"></div>
            <div id="section-list"></div>
            <div id="search-field"></div>
            <div id="basic-nav-section-one"></div>
        `;

		// Mock fetch for glossary and content
		global.fetch = vi.fn().mockImplementation((url) => {
			const urlStr = url.toString();
			if (urlStr.includes('glossary-src.html')) {
				return Promise.resolve({
					ok: true,
					text: () => Promise.resolve(`<!DOCTYPE html>
                        <html>
                            <head><title>Glossary</title></head>
                            <body>
                                <dl>
                                    <dt id="term1">Term 1</dt>
                                    <p>Definition of Term 1</p>
                                    <dt id="term2">Term 2</dt>
                                    <p>Definition of Term 2</p>
                                </dl>
                            </body>
                        </html>
                    `)
				});
			}
			if (urlStr.includes('introduction.html')) {
				return Promise.resolve({
					ok: true,
					text: () => Promise.resolve(`
                        <chapter>
                            <h1>Introduction</h1>
                            <p>Test content with <a href="/compendium/glossary.html#term1" id="link1">Term 1</a>.</p>
                        </chapter>
                    `)
				});
			}
			return Promise.resolve({ ok: false, status: 404 });
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it('should close the tooltip when a glossary link is clicked', async () => {
		// Listen for fetch calls
		const fetchSpy = vi.spyOn(global, 'fetch');
		const warnSpy = vi.spyOn(console, 'warn');

		// Set specific URL to trigger loadContent
		window.history.replaceState({}, 'Test', '/introduction.html');

		// Import script to trigger side effects and initialization
		await import('./script');

		// Initialize glossary manually to ensure it runs
		if ((window as any).MyAppGlossary?.initialize) {
			await (window as any).MyAppGlossary.initialize();
		}

		// Wait for glossary to fetch
		await vi.waitUntil(() => {
			return Object.keys((window as any).MyAppGlossary?.glossaryTerms || {}).length > 0;
		}, { timeout: 1000, interval: 50 });


		// Re-query link to ensure we have the fresh element
		const link = document.getElementById('link1') as HTMLAnchorElement;
		const tooltip = document.getElementById('glossary-tooltip') as HTMLDivElement;

		expect(link).toBeDefined();

		// VERIFY listener is attached
		expect(link.dataset.glossaryListenerAttached).toBe('true');

		// Simulate MouseOver to show tooltip
		link.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

		// Check if tooltip is shown
		if (tooltip.style.display !== 'block') {
			console.log('Warn calls:', warnSpy.mock.calls);
			console.log('Glossary terms count:', (window as any).MyAppGlossary.glossaryTerms ? Object.keys((window as any).MyAppGlossary.glossaryTerms).length : 'N/A');
		}

		expect(tooltip.style.display).toBe('block');
		expect(tooltip.textContent).toContain('Definition of Term 1');

		// Simulate Click - this should trigger the fix (closing the tooltip)
		link.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		// Verify tooltip is hidden
		expect(tooltip.style.display).toBe('none');
	});
});
