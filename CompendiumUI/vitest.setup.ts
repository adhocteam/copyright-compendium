// Vitest setup file
// This runs before each test file

// Mock browser APIs that aren't available in happy-dom
if (typeof window !== 'undefined') {
  // Mock Translation API (experimental Chrome API)
  (window as any).translation = undefined;
  
  // Mock fetch if needed
  if (!window.fetch) {
    (window as any).fetch = async () => {
      throw new Error('fetch should be mocked in tests');
    };
  }
}
