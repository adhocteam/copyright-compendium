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

	it('should have the translation wrapper', () => {
		const wrapper = document.querySelector('.translation-wrapper');
		expect(wrapper).not.toBeNull();
	});

	it('should have the translation disclaimer and progress inside the wrapper', () => {
		const wrapper = document.querySelector('.translation-wrapper');
		const disclaimer = wrapper?.querySelector('#translation-disclaimer');
		const progress = wrapper?.querySelector('#translation-progress');

		expect(disclaimer).not.toBeNull();
		expect(progress).not.toBeNull();
	});

	it('should place the translation wrapper in the grid container', () => {
		const container = document.querySelector('.grid-container');
		const wrapper = container?.querySelector('.translation-wrapper');

		expect(container).not.toBeNull();
		expect(wrapper).not.toBeNull();

		// Verify wrapper is a direct child of grid-container (or reasonably placed)
		expect(wrapper?.parentElement).toBe(container);
	});
});
