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

	it('should have the translation controls wrapper', () => {
		const wrapper = document.getElementById('translation-controls-wrapper');
		expect(wrapper).not.toBeNull();
	});

	it('should have the translation disclaimer banner', () => {
		const disclaimer = document.getElementById('translation-disclaimer');
		expect(disclaimer).not.toBeNull();
		expect(disclaimer?.getAttribute('role')).toBe('alert');
	});

	it('should have the language select element', () => {
		const languageSelect = document.getElementById('language-select');
		expect(languageSelect).not.toBeNull();
		expect(languageSelect?.tagName).toBe('SELECT');
		expect(languageSelect?.getAttribute('aria-label')).toBe('Select translation language');
	});

	it('should have the translation disclaimer with proper content', () => {
		const disclaimer = document.getElementById('translation-disclaimer');
		expect(disclaimer).not.toBeNull();
		
		const alertText = disclaimer?.querySelector('.usa-alert__text');
		expect(alertText).not.toBeNull();
		expect(alertText?.textContent).toContain('Chrome 141+');
		expect(alertText?.textContent).toContain('Translation API');
		expect(alertText?.textContent).toContain('Additional languages can be added upon request');
	});
});
