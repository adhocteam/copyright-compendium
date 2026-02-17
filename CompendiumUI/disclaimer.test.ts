import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Tests for Disclaimer Banner
 * Verifies the presence and behavior of the USWDS government disclaimer banner.
 */
describe('Disclaimer Banner', () => {
	let container: HTMLDivElement;

	beforeEach(() => {
		// Load the actual index.html content
		const htmlPath = path.resolve(__dirname, 'index.html');
		const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

		// Create a container and inject the HTML
		container = document.createElement('div');
		container.innerHTML = htmlContent;
		document.body.appendChild(container); // Append to body to ensure visibility checks work if needed

		// Execute script interactions if necessary, but for static HTML checks, just DOM inspection is fine
		// Note: The toggle script is part of USWDS javascript or custom script. 
		// If it's custom in script.ts, we might need to import it. 
		// For now, let's verify the static structure first.
	});

	afterEach(() => {
		document.body.removeChild(container);
	});

	it('should render the official government banner', () => {
		const banner = container.querySelector('.disclaimer-banner');
		expect(banner).not.toBeNull();

		const headerText = banner?.querySelector('.disclaimer-banner__text');
		expect(headerText?.textContent).toContain('This is not official government information');
	});

	// The "Here's how you know" button seems to be missing in the provided HTML 
	// or it's part of the standard USWDS banner which this might not be.
	// Looking at index.html, it's a "Prototype Disclaimer Banner" by Ad Hoc.
	// It has "This is not official government information."

	// I should adapt the test to what is actually there.

	it('should contain links to About, Blog Post, and GitHub', () => {
		const links = container.querySelectorAll('.disclaimer-banner__links a');
		expect(links.length).toBeGreaterThan(0);
		const linkTexts = Array.from(links).map(l => l.textContent);
		expect(linkTexts).toContain('About');
		expect(linkTexts).toContain('Blog Post');
		expect(linkTexts).toContain('GitHub');
	});
});
