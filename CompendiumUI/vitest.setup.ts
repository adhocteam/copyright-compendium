// Vitest setup file
// This runs before each test file

// Mock browser APIs that aren't available in happy-dom
if (typeof window !== 'undefined') {
  // Mock Translation API (experimental Chrome API)
  (window as any).translation = undefined;

  // Mock fetch globally to prevent network errors
  if (!global.fetch) {
    global.fetch = vi.fn().mockImplementation((url) => {
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(''),
        json: () => Promise.resolve({}),
      });
    });
  } else {
    // If fetch exists (happy-dom), wrap it or mock it
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation((url, options) => {
      const urlStr = url.toString();

      // Handle AbortSignal
      if (options?.signal?.aborted) {
        const error = new Error('The operation was aborted.');
        error.name = 'AbortError';
        return Promise.reject(error);
      }

      // Block external USWDS/CDN calls
      if (urlStr.includes('uswds') || urlStr.includes('googleapis') || urlStr.includes('cdn')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(''),
          json: () => Promise.resolve({}),
        });
      }
      // For other calls, we can either pass through or return 404 default
      // But since we spy on it in tests, we ideally want the test to override this.
      // If the test mocks it via vi.fn(), this assignment gets overwritten for that test file context?
      // Yes, vitest isolates files or restores mocks.
      return Promise.resolve({
        ok: false,
        status: 404,
        statusText: 'Not Found (Global Mock)',
        text: () => Promise.resolve(''),
      });
    });
  }
}
