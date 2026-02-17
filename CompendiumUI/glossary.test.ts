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

		// Mock fetch for glossary
		global.fetch = vi.fn().mockImplementation((url) => {
			if (url.toString().includes('glossary')) {
				return Promise.resolve({
					ok: true,
					text: () => Promise.resolve(`
                        <html><body>
                            <dt id="term1">Term 1</dt>
                            <p>Definition of Term 1</p>
                            <dt id="term2">Term 2</dt>
                            <p>Definition of Term 2</p>
                        </body></html>
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

		// Import script to trigger side effects and initialization
		await import('./script');

		// Trigger DOMContentLoaded manually if needed (script listens for it)
		window.document.dispatchEvent(new Event('DOMContentLoaded', {
			bubbles: true,
			cancelable: true
		}));

		// Wait for fetch to be called
		await vi.waitUntil(() => fetchSpy.mock.calls.length > 0, { timeout: 1000, interval: 50 });

		// Wait for promise resolution (microtasks)
		await new Promise(resolve => setTimeout(resolve, 200));

		// Manually refresh to ensure listeners are attached with the loaded data
		if ((window as any).MyAppGlossary && (window as any).MyAppGlossary.refreshTooltips) {
			(window as any).MyAppGlossary.refreshTooltips();
		}

		const link = document.getElementById('link1') as HTMLAnchorElement;
		const tooltip = document.getElementById('glossary-tooltip') as HTMLDivElement;

		// Simulate MouseOver
		link.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

		// Debug info
		if (tooltip.style.display !== 'block') {
			console.log('Tooltip failed to show. Fetch calls:', fetchSpy.mock.calls);
		}

		expect(tooltip.style.display).toBe('block');
		expect(tooltip.textContent).toContain('Definition of Term 1');

		// Simulate Click - this should trigger our FIX
		link.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		// Verify tooltip is hidden
		expect(tooltip.style.display).toBe('none');
	});
});
