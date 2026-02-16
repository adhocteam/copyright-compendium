import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Tests for Layout Structure
 * Verifies key structural elements exist, like the new translation top bar.
 */
describe('Layout Structure', () => {
	let container: HTMLDivElement;

	beforeEach(() => {
		// Load the actual index.html content
		const htmlPath = path.resolve(__dirname, 'index.html');
		const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

		// Create a container and inject the HTML
		// Note: We need to be careful about scripts execution, so we might just parse it 
		// or inject strictly the body content we care about.
		// For simplicity in JSDOM/HappyDOM, we can set document.body.innerHTML
		document.body.innerHTML = htmlContent;
	});

	afterEach(() => {
		document.body.innerHTML = '';
	});

	it('should have the translation top bar', () => {
		const topBar = document.querySelector('.translation-top-bar');
		expect(topBar).not.toBeNull();
		expect(topBar?.classList.contains('translation-info-wrapper')).toBe(true);
	});

	it('should have the translation info link inside the top bar', () => {
		const topBar = document.querySelector('.translation-top-bar');
		const infoLink = topBar?.querySelector('#translation-info-link');
		expect(infoLink).not.toBeNull();
		expect(infoLink?.tagName).toBe('BUTTON');
	});

	it('should have the translation controls properly labeled', () => {
		const infoLink = document.getElementById('translation-info-link');
		expect(infoLink?.getAttribute('aria-label')).toBe('Translation information');
		expect(infoLink?.getAttribute('aria-expanded')).toBe('false');
	});

	it('should place the top bar before the nav container in the header', () => {
		const header = document.querySelector('.usa-header');
		const topBar = header?.querySelector('.translation-top-bar');
		const navContainer = header?.querySelector('.usa-nav-container');

		expect(header).not.toBeNull();
		expect(topBar).not.toBeNull();
		expect(navContainer).not.toBeNull();

		// Verify topBar comes before navContainer
		const headerChildren = Array.from(header!.children);
		const topBarIndex = headerChildren.indexOf(topBar!);
		const navContainerIndex = headerChildren.indexOf(navContainer!);

		expect(topBarIndex).toBeLessThan(navContainerIndex);
	});
});
