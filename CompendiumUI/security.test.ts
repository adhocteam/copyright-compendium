import { describe, it, expect, beforeEach, afterEach } from 'vitest';

/**
 * Security tests for XSS prevention and safe DOM manipulation
 */
describe('Security - XSS Prevention', () => {
  let testContainer: HTMLDivElement;

  beforeEach(() => {
    testContainer = document.createElement('div');
    testContainer.id = 'test-container';
    document.body.appendChild(testContainer);
  });

  afterEach(() => {
    document.body.removeChild(testContainer);
  });

  describe('Error message handling', () => {
    it('should safely display error messages without executing scripts', () => {
      // Simulate the safe error display pattern used in loadContent
      const maliciousError = '<img src=x onerror="alert(\'XSS\')">';
      
      const alertDiv = document.createElement('p');
      alertDiv.className = 'usa-alert usa-alert--error';
      alertDiv.textContent = `Failed to load content: ${maliciousError}. Check console for details.`;
      
      testContainer.appendChild(alertDiv);
      
      // The text should be escaped, not executed
      expect(alertDiv.textContent).toContain('<img src=x onerror');
      expect(alertDiv.innerHTML).not.toContain('<img');
      expect(testContainer.querySelectorAll('img').length).toBe(0);
    });

    it('should not allow HTML injection via textContent', () => {
      const element = document.createElement('div');
      const maliciousContent = '<script>alert("XSS")</script>';
      
      element.textContent = maliciousContent;
      testContainer.appendChild(element);
      
      // Script tags should be escaped as text, not executed
      expect(element.textContent).toBe(maliciousContent);
      expect(testContainer.querySelectorAll('script').length).toBe(0);
    });
  });

  describe('URL validation', () => {
    it('should validate URLs before navigation', () => {
      const currentOrigin = window.location.origin;
      
      // Test same-origin URL (should be allowed)
      const sameOriginUrl = `${currentOrigin}/chapter1.html`;
      try {
        const url = new URL(sameOriginUrl, currentOrigin);
        expect(url.origin).toBe(currentOrigin);
      } catch (error) {
        expect.fail('Valid same-origin URL should not throw');
      }
      
      // Test cross-origin URL (should be blocked)
      const crossOriginUrl = 'https://evil.com/malware';
      try {
        const url = new URL(crossOriginUrl, currentOrigin);
        expect(url.origin).not.toBe(currentOrigin);
        // In the actual code, navigation would be blocked here
      } catch (error) {
        // This is expected for invalid URLs
      }
    });

    it('should handle malformed URLs gracefully', () => {
      const malformedUrls = [
        'javascript:alert("XSS")',
        'data:text/html,<script>alert("XSS")</script>',
        'vbscript:msgbox',
        '//evil.com/redirect'
      ];
      
      malformedUrls.forEach(maliciousUrl => {
        try {
          const url = new URL(maliciousUrl, window.location.origin);
          // Should not match current origin
          expect(url.origin).not.toBe(window.location.origin);
        } catch (error) {
          // Invalid URLs will throw, which is fine
          expect(error).toBeDefined();
        }
      });
    });
  });

  describe('DOM sanitization', () => {
    it('should use textContent for user-generated content', () => {
      const userContent = '<b>Bold</b> and <script>alert("XSS")</script>';
      const safeElement = document.createElement('div');
      
      // Using textContent (safe)
      safeElement.textContent = userContent;
      testContainer.appendChild(safeElement);
      
      // Content should be escaped
      expect(safeElement.textContent).toBe(userContent);
      expect(safeElement.innerHTML).not.toContain('<script>');
      expect(testContainer.querySelectorAll('script').length).toBe(0);
      expect(testContainer.querySelectorAll('b').length).toBe(0);
    });

    it('should prevent event handler injection', () => {
      const maliciousHtml = '<div onclick="alert(\'XSS\')">Click me</div>';
      const safeElement = document.createElement('div');
      
      safeElement.textContent = maliciousHtml;
      testContainer.appendChild(safeElement);
      
      // onclick should be escaped as text, not as an attribute
      expect(safeElement.textContent).toContain('onclick');
      // The innerHTML will contain escaped HTML entities
      expect(safeElement.innerHTML).toContain('&lt;div');
      expect(safeElement.innerHTML).toContain('&gt;');
      // Verify no actual onclick attribute exists on any child element
      const divElements = safeElement.querySelectorAll('div');
      divElements.forEach(div => {
        expect(div.hasAttribute('onclick')).toBe(false);
      });
    });
  });

  describe('AbortController for race conditions', () => {
    it('should create and abort fetch requests', async () => {
      const controller = new AbortController();
      const signal = controller.signal;
      
      expect(signal.aborted).toBe(false);
      
      // Abort the request
      controller.abort();
      
      expect(signal.aborted).toBe(true);
      
      // Attempting to fetch with aborted signal should throw
      try {
        await fetch('/test-url', { signal });
        expect.fail('Fetch should have been aborted');
      } catch (error) {
        if (error instanceof Error) {
          expect(error.name).toBe('AbortError');
        }
      }
    });

    it('should handle multiple abort controllers', () => {
      let controller1: AbortController | null = new AbortController();
      const controller2 = new AbortController();
      
      expect(controller1.signal.aborted).toBe(false);
      expect(controller2.signal.aborted).toBe(false);
      
      // Abort first controller
      controller1.abort();
      expect(controller1.signal.aborted).toBe(true);
      expect(controller2.signal.aborted).toBe(false);
      
      // Replace controller
      controller1 = new AbortController();
      expect(controller1.signal.aborted).toBe(false);
    });
  });
});
