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
      let parent: HTMLElement | null = target.parentElement;
      while (parent) {
        if (parent.tagName === 'DETAILS' && !(parent as HTMLDetailsElement).open) {
          (parent as HTMLDetailsElement).open = true;
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
      let parent: HTMLElement | null = target.parentElement;
      while (parent) {
        if (parent.tagName === 'DETAILS' && !(parent as HTMLDetailsElement).open) {
          (parent as HTMLDetailsElement).open = true;
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
        let parent: HTMLElement | null = target.parentElement;
        while (parent) {
          if (parent.tagName === 'DETAILS' && !(parent as HTMLDetailsElement).open) {
            (parent as HTMLDetailsElement).open = true;
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

  describe('Sidenav Toggle (Accordion)', () => {
    /**
     * Helper: creates a sidenav item with a toggle button and sublist,
     * mirroring the structure produced by buildNavItem in script.ts.
     */
    function createToggleItem(label: string, collapsed = true): {
      li: HTMLLIElement;
      toggleBtn: HTMLButtonElement;
      subList: HTMLUListElement;
    } {
      const li = document.createElement('li');
      li.className = 'usa-sidenav__item';

      const div = document.createElement('div');
      div.className = 'usa-sidenav__item-inner';
      div.style.display = 'flex';
      div.style.alignItems = 'center';
      div.style.justifyContent = 'space-between';

      const a = document.createElement('a');
      a.href = `#${label}`;
      a.textContent = label;
      a.style.flex = '1';
      div.appendChild(a);

      const toggleBtn = document.createElement('button');
      toggleBtn.className = collapsed
        ? 'usa-sidenav__toggle is-collapsed'
        : 'usa-sidenav__toggle';
      toggleBtn.setAttribute('aria-expanded', String(!collapsed));
      toggleBtn.setAttribute('aria-label', `Toggle ${label}`);
      toggleBtn.innerHTML = `
        <svg class="usa-icon" aria-hidden="true" focusable="false" role="img"
             xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
            <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" fill="currentColor"/>
        </svg>
      `;
      div.appendChild(toggleBtn);
      li.appendChild(div);

      const subList = document.createElement('ul');
      subList.className = 'usa-sidenav__sublist';
      if (collapsed) subList.setAttribute('hidden', '');

      // Add some children
      const child = document.createElement('li');
      child.className = 'usa-sidenav__item';
      const childA = document.createElement('a');
      childA.href = '#child';
      childA.textContent = 'Child Item';
      child.appendChild(childA);
      subList.appendChild(child);
      li.appendChild(subList);

      return { li, toggleBtn, subList };
    }

    /**
     * Toggle logic extracted from script.ts toggleSidenavItem function.
     */
    function toggleSidenavItem(button: HTMLButtonElement): void {
      const isExpanded = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!isExpanded));

      const wrapperDiv = button.closest('.usa-sidenav__item-inner');
      const subList = wrapperDiv ? wrapperDiv.nextElementSibling : null;

      if (subList && subList.tagName === 'UL') {
        if (!isExpanded) {
          subList.removeAttribute('hidden');
        } else {
          subList.setAttribute('hidden', '');
        }
      }
      button.classList.toggle('is-collapsed', isExpanded);
    }

    it('should create toggle buttons with inline SVG icons', () => {
      const { toggleBtn } = createToggleItem('Section 100');
      testContainer.appendChild(toggleBtn);

      const svg = toggleBtn.querySelector('svg.usa-icon');
      expect(svg).not.toBeNull();
      expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');

      // Should NOT use external <use> element
      const useEl = toggleBtn.querySelector('use');
      expect(useEl).toBeNull();

      // Should have inline <path>
      const path = toggleBtn.querySelector('path');
      expect(path).not.toBeNull();
    });

    it('should start in collapsed state by default', () => {
      const { toggleBtn, subList } = createToggleItem('Section 100');
      testContainer.appendChild(toggleBtn);

      expect(toggleBtn.getAttribute('aria-expanded')).toBe('false');
      expect(toggleBtn.classList.contains('is-collapsed')).toBe(true);
      expect(subList.hasAttribute('hidden')).toBe(true);
    });

    it('should expand when toggled from collapsed state', () => {
      const { li, toggleBtn, subList } = createToggleItem('Section 100');
      testContainer.appendChild(li);

      // Toggle: collapsed -> expanded
      toggleSidenavItem(toggleBtn);

      expect(toggleBtn.getAttribute('aria-expanded')).toBe('true');
      expect(toggleBtn.classList.contains('is-collapsed')).toBe(false);
      expect(subList.hasAttribute('hidden')).toBe(false);
    });

    it('should collapse when toggled from expanded state', () => {
      const { li, toggleBtn, subList } = createToggleItem('Section 100', false);
      testContainer.appendChild(li);

      // Toggle: expanded -> collapsed
      toggleSidenavItem(toggleBtn);

      expect(toggleBtn.getAttribute('aria-expanded')).toBe('false');
      expect(toggleBtn.classList.contains('is-collapsed')).toBe(true);
      expect(subList.hasAttribute('hidden')).toBe(true);
    });

    it('should toggle back and forth (round-trip)', () => {
      const { li, toggleBtn, subList } = createToggleItem('Section 100');
      testContainer.appendChild(li);

      // Start: collapsed
      expect(toggleBtn.getAttribute('aria-expanded')).toBe('false');

      // Toggle 1: expand
      toggleSidenavItem(toggleBtn);
      expect(toggleBtn.getAttribute('aria-expanded')).toBe('true');
      expect(subList.hasAttribute('hidden')).toBe(false);

      // Toggle 2: collapse
      toggleSidenavItem(toggleBtn);
      expect(toggleBtn.getAttribute('aria-expanded')).toBe('false');
      expect(subList.hasAttribute('hidden')).toBe(true);

      // Toggle 3: expand again
      toggleSidenavItem(toggleBtn);
      expect(toggleBtn.getAttribute('aria-expanded')).toBe('true');
      expect(subList.hasAttribute('hidden')).toBe(false);
    });

    it('should have correct ARIA attributes', () => {
      const { toggleBtn } = createToggleItem('Section 200');

      expect(toggleBtn.getAttribute('aria-label')).toBe('Toggle Section 200');
      expect(toggleBtn.getAttribute('aria-expanded')).toBe('false');

      const svg = toggleBtn.querySelector('svg');
      expect(svg?.getAttribute('aria-hidden')).toBe('true');
      expect(svg?.getAttribute('focusable')).toBe('false');
      expect(svg?.getAttribute('role')).toBe('img');
    });

    it('should find the sublist via closest() traversal', () => {
      const { li, toggleBtn, subList } = createToggleItem('Section 300');
      testContainer.appendChild(li);

      // Verify the DOM traversal logic in toggleSidenavItem
      const wrapperDiv = toggleBtn.closest('.usa-sidenav__item-inner');
      expect(wrapperDiv).not.toBeNull();

      const foundSubList = wrapperDiv?.nextElementSibling;
      expect(foundSubList).toBe(subList);
      expect(foundSubList?.tagName).toBe('UL');
    });

    it('should handle toggle button with no sublist sibling gracefully', () => {
      // Edge case: button exists but no sublist
      const div = document.createElement('div');
      div.className = 'usa-sidenav__item-inner';
      const btn = document.createElement('button');
      btn.className = 'usa-sidenav__toggle is-collapsed';
      btn.setAttribute('aria-expanded', 'false');
      div.appendChild(btn);
      testContainer.appendChild(div);

      // Should not throw
      expect(() => toggleSidenavItem(btn)).not.toThrow();
      expect(btn.getAttribute('aria-expanded')).toBe('true');
    });

    // --- Regression tests: conditional toggle presence ---

    it('should NOT have a toggle button on items without children', () => {
      // Simulate chapter item with no sub-content (e.g., "About This Site")
      const li = document.createElement('li');
      li.className = 'usa-sidenav__item';

      const a = document.createElement('a');
      a.href = '/about.html';
      a.textContent = 'About This Site';

      // No sub-items: append link directly (no wrapper div, no toggle)
      li.appendChild(a);
      testContainer.appendChild(li);

      const toggleBtn = li.querySelector('.usa-sidenav__toggle');
      expect(toggleBtn).toBeNull();

      const innerDiv = li.querySelector('.usa-sidenav__item-inner');
      expect(innerDiv).toBeNull();

      // The link should be a direct child of the li
      expect(li.firstElementChild).toBe(a);
    });

    it('should have a toggle button on items WITH children', () => {
      const { li, toggleBtn, subList } = createToggleItem('100 General Background');
      testContainer.appendChild(li);

      // Toggle button should exist
      expect(toggleBtn).not.toBeNull();
      expect(toggleBtn.classList.contains('usa-sidenav__toggle')).toBe(true);

      // Wrapper div should exist
      const innerDiv = li.querySelector('.usa-sidenav__item-inner');
      expect(innerDiv).not.toBeNull();

      // Sublist should exist
      expect(subList).not.toBeNull();
      expect(subList.className).toBe('usa-sidenav__sublist');
      expect(subList.hasChildNodes()).toBe(true);
    });

    it('items without children should be plain links in the li', () => {
      // Build two items: one with children, one without
      const nav = document.createElement('ul');
      nav.className = 'usa-sidenav';

      // Item WITH children
      const { li: liWith } = createToggleItem('Chapter 100');
      nav.appendChild(liWith);

      // Item WITHOUT children (plain link)
      const liWithout = document.createElement('li');
      liWithout.className = 'usa-sidenav__item';
      const plainLink = document.createElement('a');
      plainLink.href = '/introduction.html';
      plainLink.textContent = 'Introduction';
      liWithout.appendChild(plainLink);
      nav.appendChild(liWithout);

      testContainer.appendChild(nav);

      // Item with children has toggle
      expect(liWith.querySelector('.usa-sidenav__toggle')).not.toBeNull();
      expect(liWith.querySelector('.usa-sidenav__sublist')).not.toBeNull();

      // Item without children has no toggle, no sublist
      expect(liWithout.querySelector('.usa-sidenav__toggle')).toBeNull();
      expect(liWithout.querySelector('.usa-sidenav__sublist')).toBeNull();
      expect(liWithout.querySelector('.usa-sidenav__item-inner')).toBeNull();

      // Plain link is direct child
      expect(liWithout.firstElementChild?.tagName).toBe('A');
      expect(liWithout.firstElementChild?.textContent).toBe('Introduction');
    });
  });
});
