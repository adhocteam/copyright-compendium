import { describe, it, expect } from 'vitest';
import { replaceUrlOrigin } from './script';

describe('replaceUrlOrigin', () => {
	it('should replace the origin of an absolute URL', () => {
		const original = 'https://copyright-compendium.vercel.app/demo/page.html#section-1';
		const targetOrigin = 'http://localhost:5174';
		const expected = 'http://localhost:5174/demo/page.html#section-1';

		expect(replaceUrlOrigin(original, targetOrigin)).toBe(expected);
	});

	it('should handle different target protocols (http vs https)', () => {
		const original = 'http://example.com/path';
		const targetOrigin = 'https://compendium.adhocteam.us';
		const expected = 'https://compendium.adhocteam.us/path';

		expect(replaceUrlOrigin(original, targetOrigin)).toBe(expected);
	});

	it('should handle root paths without trailing slashes', () => {
		const original = 'https://copyright-compendium.vercel.app';
		const targetOrigin = 'http://127.0.0.1:3000';
		const expected = 'http://127.0.0.1:3000/';

		expect(replaceUrlOrigin(original, targetOrigin)).toBe(expected);
	});

	it('should keep query parameters intact', () => {
		const original = 'https://copyright-compendium.vercel.app/search?q=test&page=2';
		const targetOrigin = 'http://localhost:8080';
		const expected = 'http://localhost:8080/search?q=test&page=2';

		expect(replaceUrlOrigin(original, targetOrigin)).toBe(expected);
	});

	it('should return original string if it is a relative path (invalid URL constructor)', () => {
		const original = '/relative/path.html';
		const targetOrigin = 'http://localhost:5174';

		expect(replaceUrlOrigin(original, targetOrigin)).toBe(original);
	});

	it('should return original string if targetOrigin is invalid', () => {
		const original = 'https://example.com/path';
		const targetOrigin = 'invalid-origin';

		expect(replaceUrlOrigin(original, targetOrigin)).toBe(original);
	});
});
