# Testing in CompendiumUI

This project uses `vitest` for automated testing.

## Running Tests

To run the full test suite:

```bash
npm test
```

## Test Suite Overview

As of the latest update, the test suite consists of **6 test files** with **72 tests** in total.

### Test Files

1.  **`translation.test.ts`**: Verifies the `TranslationService` logic.
    *   Tests support for `window.ai.translator` (Chrome Experimental).
    *   Tests fallback to `window.Translator`.
    *   Tests graceful handling of missing APIs and errors.
2.  **`accessibility.test.ts`**: Checks for accessibility compliance (ARIA attributes, keyboard navigation, etc.).
3.  **`layout.test.ts`**: Verifies layout consistency and responsiveness.
4.  **`navigation.test.ts`**: Tests the navigation menu, sidenav generation, and link handling.
5.  **`security.test.ts`**: Checks for security best practices (e.g., input sanitization, linking to external sites).
6.  **`utilities.test.ts`**: Tests utility functions (e.g., helpers, formatting).

## Recent Changes

-   **TranslationService**: The `TranslationService` class is now exported from `script.ts` to allow for direct unit testing.
-   **Mocking**: Tests use `vi.fn()` and mock objects for `window` APIs (like `localStorage` and `translator`) to ensure isolation and reliability.
