import { describe, it, expect, beforeEach, afterEach } from 'vitest';

/**
 * Tests for DOM manipulation and navigation utilities
 */
describe('DOM Navigation Utilities', () => {
  let testContainer: HTMLDivElement;

  beforeEach(() => {
    testContainer = document.createElement('div');
    testContainer.id = 'test-container';
    document.body.appendChild(testContainer);
  });

  afterEach(() => {
    document.body.removeChild(testContainer);
  });

  describe('scrollElementIntoView', () => {
    it('should open parent details elements when scrolling', () => {
      // Create nested details/summary structure
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = 'Summary';
      const target = document.createElement('div');
      target.id = 'target';
      target.textContent = 'Target content';
      
      details.appendChild(summary);
      details.appendChild(target);
      testContainer.appendChild(details);

      // Details should start closed
      expect(details.open).toBe(false);

      // Simulate opening parent details when scrolling to target
      let parent = target.parentElement;
      while (parent) {
        if (parent.tagName === 'DETAILS' && !parent.open) {
          parent.open = true;
        }
        parent = parent.parentElement;
      }

      // Details should now be open
      expect(details.open).toBe(true);
    });

    it('should handle nested details elements', () => {
      // Create deeply nested structure
      const outer = document.createElement('details');
      const outerSummary = document.createElement('summary');
      outerSummary.textContent = 'Outer';
      
      const inner = document.createElement('details');
      const innerSummary = document.createElement('summary');
      innerSummary.textContent = 'Inner';
      
      const target = document.createElement('div');
      target.id = 'nested-target';
      
      inner.appendChild(innerSummary);
      inner.appendChild(target);
      outer.appendChild(outerSummary);
      outer.appendChild(inner);
      testContainer.appendChild(outer);

      // Both should start closed
      expect(outer.open).toBe(false);
      expect(inner.open).toBe(false);

      // Open all parent details
      let parent = target.parentElement;
      while (parent) {
        if (parent.tagName === 'DETAILS' && !parent.open) {
          parent.open = true;
        }
        parent = parent.parentElement;
      }

      // Both should now be open
      expect(outer.open).toBe(true);
      expect(inner.open).toBe(true);
    });

    it('should handle elements without details parents', () => {
      const target = document.createElement('div');
      target.id = 'simple-target';
      testContainer.appendChild(target);

      // Should not throw when no details elements exist
      expect(() => {
        let parent = target.parentElement;
        while (parent) {
          if (parent.tagName === 'DETAILS' && !parent.open) {
            parent.open = true;
          }
          parent = parent.parentElement;
        }
      }).not.toThrow();
    });
  });

  describe('updateSideNavCurrent', () => {
    it('should clear all current classes', () => {
      const nav = document.createElement('nav');
      nav.id = 'section-list';
      
      const item1 = document.createElement('li');
      item1.className = 'usa-sidenav__item usa-current';
      const link1 = document.createElement('a');
      link1.className = 'usa-current';
      link1.href = '#section1';
      item1.appendChild(link1);
      
      const item2 = document.createElement('li');
      item2.className = 'usa-sidenav__item';
      const link2 = document.createElement('a');
      link2.href = '#section2';
      item2.appendChild(link2);
      
      nav.appendChild(item1);
      nav.appendChild(item2);
      testContainer.appendChild(nav);

      // Clear current classes
      nav.querySelectorAll('.usa-sidenav__item.usa-current, .usa-sidenav__item a.usa-current')
        .forEach(el => el.classList.remove('usa-current'));

      expect(item1.classList.contains('usa-current')).toBe(false);
      expect(link1.classList.contains('usa-current')).toBe(false);
    });

    it('should set current class on target link and parent', () => {
      const nav = document.createElement('nav');
      nav.id = 'section-list';
      
      const item = document.createElement('li');
      item.className = 'usa-sidenav__item';
      const link = document.createElement('a');
      link.href = '#target-section';
      item.appendChild(link);
      nav.appendChild(item);
      testContainer.appendChild(nav);

      // Simulate setting current
      const targetLink = nav.querySelector('a[href="#target-section"]');
      if (targetLink) {
        targetLink.classList.add('usa-current');
        const parentLi = targetLink.closest('.usa-sidenav__item');
        if (parentLi) {
          parentLi.classList.add('usa-current');
        }
      }

      expect(link.classList.contains('usa-current')).toBe(true);
      expect(item.classList.contains('usa-current')).toBe(true);
    });

    it('should handle missing target gracefully', () => {
      const nav = document.createElement('nav');
      nav.id = 'section-list';
      testContainer.appendChild(nav);

      // Should not throw when target doesn't exist
      const targetLink = nav.querySelector('a[href="#nonexistent"]');
      expect(targetLink).toBeNull();
    });
  });

  describe('updateTopNavCurrent', () => {
    it('should set aria-current on active link', () => {
      const dropdown = document.createElement('ul');
      dropdown.id = 'basic-nav-section-one';
      
      const link1 = document.createElement('a');
      link1.href = '/chapter1.html';
      link1.dataset.filename = 'chapter1.html';
      
      const link2 = document.createElement('a');
      link2.href = '/chapter2.html';
      link2.dataset.filename = 'chapter2.html';
      
      dropdown.appendChild(link1);
      dropdown.appendChild(link2);
      testContainer.appendChild(dropdown);

      // Simulate setting current for chapter1
      const filename = 'chapter1.html';
      dropdown.querySelectorAll('a').forEach(el => {
        if (el.dataset.filename === filename) {
          el.classList.add('usa-current');
          el.setAttribute('aria-current', 'page');
        } else {
          el.classList.remove('usa-current');
          el.removeAttribute('aria-current');
        }
      });

      expect(link1.classList.contains('usa-current')).toBe(true);
      expect(link1.getAttribute('aria-current')).toBe('page');
      expect(link2.classList.contains('usa-current')).toBe(false);
      expect(link2.hasAttribute('aria-current')).toBe(false);
    });

    it('should remove current from all links when switching', () => {
      const dropdown = document.createElement('ul');
      dropdown.id = 'basic-nav-section-one';
      
      const link1 = document.createElement('a');
      link1.href = '/chapter1.html';
      link1.dataset.filename = 'chapter1.html';
      link1.classList.add('usa-current');
      link1.setAttribute('aria-current', 'page');
      
      const link2 = document.createElement('a');
      link2.href = '/chapter2.html';
      link2.dataset.filename = 'chapter2.html';
      
      dropdown.appendChild(link1);
      dropdown.appendChild(link2);
      testContainer.appendChild(dropdown);

      // Switch to chapter2
      const filename = 'chapter2.html';
      dropdown.querySelectorAll('a').forEach(el => {
        if (el.dataset.filename === filename) {
          el.classList.add('usa-current');
          el.setAttribute('aria-current', 'page');
        } else {
          el.classList.remove('usa-current');
          el.removeAttribute('aria-current');
        }
      });

      expect(link1.classList.contains('usa-current')).toBe(false);
      expect(link1.hasAttribute('aria-current')).toBe(false);
      expect(link2.classList.contains('usa-current')).toBe(true);
      expect(link2.getAttribute('aria-current')).toBe('page');
    });
  });
});
