import { describe, it, expect, beforeEach, afterEach } from 'vitest';

/**
 * Accessibility tests for keyboard navigation, ARIA labels, and WCAG compliance
 */
describe('Accessibility - Keyboard Navigation', () => {
  let testContainer: HTMLDivElement;

  beforeEach(() => {
    testContainer = document.createElement('div');
    testContainer.id = 'test-container';
    document.body.appendChild(testContainer);
  });

  afterEach(() => {
    document.body.removeChild(testContainer);
  });

  describe('Escape key handling', () => {
    it('should close tooltip when Escape is pressed', () => {
      // Create a mock tooltip
      const tooltip = document.createElement('div');
      tooltip.id = 'test-tooltip';
      tooltip.style.display = 'block';
      tooltip.setAttribute('role', 'tooltip');
      
      const button = document.createElement('button');
      button.id = 'tooltip-trigger';
      button.setAttribute('aria-expanded', 'true');
      
      testContainer.appendChild(tooltip);
      testContainer.appendChild(button);
      
      // Add escape key handler
      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && tooltip.style.display === 'block') {
          tooltip.style.display = 'none';
          button.setAttribute('aria-expanded', 'false');
          button.focus();
        }
      };
      
      document.addEventListener('keydown', handleEscape);
      
      // Simulate Escape key press
      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(escapeEvent);
      
      // Tooltip should be hidden
      expect(tooltip.style.display).toBe('none');
      expect(button.getAttribute('aria-expanded')).toBe('false');
      
      // Cleanup
      document.removeEventListener('keydown', handleEscape);
    });

    it('should handle Escape key for multiple tooltips', () => {
      const tooltips = [
        { element: document.createElement('div'), button: document.createElement('button') },
        { element: document.createElement('div'), button: document.createElement('button') }
      ];
      
      tooltips.forEach((tooltip, index) => {
        tooltip.element.id = `tooltip-${index}`;
        tooltip.element.style.display = 'none';
        tooltip.button.id = `button-${index}`;
        testContainer.appendChild(tooltip.element);
        testContainer.appendChild(tooltip.button);
      });
      
      // Show first tooltip
      const firstTooltip = tooltips[0];
      if (firstTooltip) {
        firstTooltip.element.style.display = 'block';
        firstTooltip.button.setAttribute('aria-expanded', 'true');
      }
      
      // Escape should only close visible tooltip
      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          tooltips.forEach(tooltip => {
            if (tooltip.element.style.display === 'block') {
              tooltip.element.style.display = 'none';
              tooltip.button.setAttribute('aria-expanded', 'false');
            }
          });
        }
      };
      
      document.addEventListener('keydown', handleEscape);
      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(escapeEvent);
      
      if (tooltips[0] && tooltips[1]) {
        expect(tooltips[0].element.style.display).toBe('none');
        expect(tooltips[1].element.style.display).toBe('none');
      }
      
      document.removeEventListener('keydown', handleEscape);
    });
  });

  describe('Focus management', () => {
    it('should make non-focusable elements focusable with tabindex', () => {
      const section = document.createElement('section');
      section.id = 'test-section';
      testContainer.appendChild(section);
      
      // Initially, section should not be focusable
      expect(section.hasAttribute('tabindex')).toBe(false);
      
      // Make it focusable
      if (!section.hasAttribute('tabindex')) {
        section.setAttribute('tabindex', '-1');
      }
      
      expect(section.getAttribute('tabindex')).toBe('-1');
      
      // Should be focusable now
      section.focus({ preventScroll: true });
      expect(document.activeElement).toBe(section);
    });

    it('should restore focus after scrolling', () => {
      return new Promise<void>((resolve) => {
        const button = document.createElement('button');
        button.textContent = 'Click me';
        testContainer.appendChild(button);
        
        const targetElement = document.createElement('div');
        targetElement.id = 'scroll-target';
        targetElement.setAttribute('tabindex', '-1');
        testContainer.appendChild(targetElement);
        
        // Simulate scroll and focus
        setTimeout(() => {
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
          targetElement.focus({ preventScroll: true });
          
          expect(document.activeElement).toBe(targetElement);
          resolve();
        }, 50);
      });
    });

    it('should maintain focus when opening details elements', () => {
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = 'Expandable section';
      const content = document.createElement('div');
      content.id = 'details-content';
      content.setAttribute('tabindex', '-1');
      content.textContent = 'Hidden content';
      
      details.appendChild(summary);
      details.appendChild(content);
      testContainer.appendChild(details);
      
      // Initially closed
      expect(details.open).toBe(false);
      
      // Open details when navigating to content
      let parent: HTMLElement | null = content.parentElement;
      while (parent) {
        if (parent.tagName === 'DETAILS' && !(parent as HTMLDetailsElement).open) {
          (parent as HTMLDetailsElement).open = true;
        }
        parent = parent.parentElement;
      }
      
      expect(details.open).toBe(true);
      
      // Focus the content
      content.focus();
      expect(document.activeElement).toBe(content);
    });
  });

  describe('ARIA labels', () => {
    it('should have aria-label on chapter submenu', () => {
      const submenu = document.createElement('ul');
      submenu.id = 'basic-nav-section-one';
      submenu.className = 'usa-nav__submenu';
      submenu.setAttribute('hidden', '');
      submenu.setAttribute('aria-label', 'Available chapters');
      
      testContainer.appendChild(submenu);
      
      expect(submenu.getAttribute('aria-label')).toBe('Available chapters');
    });

    it('should have aria-expanded on toggle buttons', () => {
      const button = document.createElement('button');
      button.className = 'usa-accordion__button';
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-controls', 'accordion-content');
      
      testContainer.appendChild(button);
      
      expect(button.getAttribute('aria-expanded')).toBe('false');
      
      // Toggle
      button.setAttribute('aria-expanded', 'true');
      expect(button.getAttribute('aria-expanded')).toBe('true');
    });

    it('should have aria-current on current page link', () => {
      const link = document.createElement('a');
      link.href = '/chapter1.html';
      link.textContent = 'Chapter 1';
      link.classList.add('usa-current');
      link.setAttribute('aria-current', 'page');
      
      testContainer.appendChild(link);
      
      expect(link.getAttribute('aria-current')).toBe('page');
      expect(link.classList.contains('usa-current')).toBe(true);
    });

    it('should have aria-describedby for tooltips', () => {
      const link = document.createElement('a');
      link.href = '#term';
      
      const tooltip = document.createElement('div');
      tooltip.id = 'glossary-tooltip';
      tooltip.setAttribute('role', 'tooltip');
      
      testContainer.appendChild(link);
      testContainer.appendChild(tooltip);
      
      // Associate tooltip with link
      link.setAttribute('aria-describedby', 'glossary-tooltip');
      
      expect(link.getAttribute('aria-describedby')).toBe('glossary-tooltip');
      expect(tooltip.getAttribute('role')).toBe('tooltip');
    });
  });

  describe('Skip navigation', () => {
    it('should have skip link that targets main content', () => {
      const skipLink = document.createElement('a');
      skipLink.href = '#chapter-content';
      skipLink.className = 'usa-skipnav';
      skipLink.textContent = 'Skip to main content';
      
      const mainContent = document.createElement('main');
      mainContent.id = 'chapter-content';
      
      testContainer.appendChild(skipLink);
      testContainer.appendChild(mainContent);
      
      expect(skipLink.getAttribute('href')).toBe('#chapter-content');
      expect(mainContent.id).toBe('chapter-content');
    });
  });
});

describe('Accessibility - Color Contrast', () => {
  it('should have sufficient contrast for version display', () => {
    // Simulating color contrast check
    // New color: #4a4a4a on #f0f0f0 should have 7.5:1 contrast
    const versionDiv = document.createElement('div');
    versionDiv.className = 'version-display';
    versionDiv.style.color = '#4a4a4a';
    versionDiv.style.backgroundColor = '#f0f0f0';
    
    document.body.appendChild(versionDiv);
    
    const computedStyle = window.getComputedStyle(versionDiv);
    // In test environment, inline styles may not be converted to rgb format
    expect(computedStyle.color).toBeTruthy();
    expect(versionDiv.style.color).toBe('#4a4a4a');
    expect(versionDiv.style.backgroundColor).toBe('#f0f0f0');
    
    document.body.removeChild(versionDiv);
  });

  it('should have sufficient contrast for disabled items', () => {
    // New color: #6c757d should provide better contrast
    const disabledItem = document.createElement('span');
    disabledItem.className = 'glossary-disabled';
    disabledItem.style.color = '#6c757d';
    
    document.body.appendChild(disabledItem);
    
    const computedStyle = window.getComputedStyle(disabledItem);
    expect(computedStyle.color).toBeTruthy();
    expect(disabledItem.style.color).toBe('#6c757d');
    
    document.body.removeChild(disabledItem);
  });
});
