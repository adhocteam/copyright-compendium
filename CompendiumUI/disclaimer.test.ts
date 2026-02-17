import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Tests for Disclaimer Banner
 * Verifies key elements and content of the disclaimer banner.
 */
describe('Disclaimer Banner Support', () => {
	beforeEach(() => {
		// Load the actual index.html content
		const htmlPath = path.resolve(__dirname, 'index.html');
		const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
		document.body.innerHTML = htmlContent;
	});

	afterEach(() => {
		document.body.innerHTML = '';
	});

	it('should display the banner', () => {
		const banner = document.getElementById('disclaimer-banner');
		expect(banner).not.toBeNull();
		expect(banner?.getAttribute('role')).toBe('banner');
	});

	it('should contain the correct disclaimer text', () => {
		const textWrapper = document.querySelector('.disclaimer-banner__text-wrapper');
		expect(textWrapper).not.toBeNull();
		expect(textWrapper?.textContent).toContain('This is not official government information');
		expect(textWrapper?.textContent).toContain('Prototype by Ad Hoc');
	});

	it('should have a link to the About page', () => {
		const aboutLink = document.querySelector('.disclaimer-banner__links a[href="/about.html"]');
		expect(aboutLink).not.toBeNull();
	});

	it('should have a link to the official copyright.gov site', () => {
		const officialLink = document.querySelector('.disclaimer-banner__textWrapper a[href="https://www.copyright.gov/comp3/"]');
		// The class might be slightly different in structure, check specific anchor
		const links = Array.from(document.querySelectorAll('#disclaimer-banner a'));
		const hasOfficialLink = links.some(link => link.getAttribute('href') === 'https://www.copyright.gov/comp3/');
		expect(hasOfficialLink).toBe(true);
	});

	it('should have the Ad Hoc logo', () => {
		const logo = document.querySelector('.disclaimer-banner__logo img');
		expect(logo).not.toBeNull();
		expect(logo?.getAttribute('alt')).toBe('Ad Hoc');
	});
});
