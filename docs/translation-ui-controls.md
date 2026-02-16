# Translation UI Controls - Technical Documentation

## Overview

This document describes the translation UI controls implementation, including the dropdown language selector and translate button behavior.

## Components

### Language Selector Dropdown

**Element ID:** `language-select`  
**Type:** `<select>` element  
**CSS Class:** `translation-select`

**Features:**
- Minimum width of 200px to ensure "English (Original)" displays fully
- Supports 13 options (English + 12 target languages)
- Styled with USWDS design system

**Behavior:**
- Default value is empty string (English)
- When changed to a non-empty value, shows the translate button
- When changed back to empty (English), hides the translate button and reloads original content

### Translate Button

**Element ID:** `translate-button`  
**Type:** `<button>` element  
**CSS Classes:** `usa-button usa-button--outline translate-button`

**States:**

1. **Hidden** (Initial State)
   - CSS class: `hidden`
   - Display: `none`
   - When: No language is selected (English)

2. **Visible & Enabled**
   - No `hidden` class
   - No `disabled` attribute
   - `aria-disabled="false"`
   - When: 
     - A target language is selected
     - After navigating to a new chapter (if language is selected)
     - After changing the selected language

3. **Visible & Disabled**
   - No `hidden` class
   - `disabled="true"` attribute
   - `aria-disabled="true"`
   - Opacity: 0.5
   - Cursor: not-allowed
   - When: Translation has completed successfully

## User Interaction Flow

### Scenario 1: First Translation

1. User lands on page
   - Button state: **Hidden**
   - Dropdown: "English (Original)"

2. User selects "Español (Spanish)"
   - Button state: **Visible & Enabled**
   - Event: `change` event on language-select

3. User clicks "Translate"
   - Button state: **Visible & Enabled** (during translation)
   - Translation service processes content

4. Translation completes successfully
   - Button state: **Visible & Disabled**
   - Content is now in Spanish
   - Warning banner appears

### Scenario 2: Changing Language

1. Current state: Page translated to Spanish, button disabled
   - Button state: **Visible & Disabled**
   - Dropdown: "Español (Spanish)"

2. User selects "Français (French)"
   - Button state: **Visible & Enabled**
   - Previous translation is cleared
   - Content reloads in English (original)

3. User clicks "Translate"
   - Translation to French begins
   - After completion: **Visible & Disabled**

### Scenario 3: Returning to English

1. Current state: Page translated, button disabled
   - Button state: **Visible & Disabled**
   - Dropdown: Any target language

2. User selects "English (Original)"
   - Button state: **Hidden**
   - Content reloads to English
   - Warning banner disappears
   - Translation progress indicator disappears

### Scenario 4: Chapter Navigation

1. Current state: Page translated to Spanish, button disabled
   - Button state: **Visible & Disabled**
   - Dropdown: "Español (Spanish)"
   - Current chapter: Chapter 200

2. User clicks link to Chapter 300
   - `loadContent()` is called
   - Button state: **Visible & Enabled** (re-enabled automatically)
   - Content loads in English (original)
   - Dropdown remains: "Español (Spanish)"

3. User clicks "Translate" again
   - Chapter 300 translates to Spanish
   - Button state: **Visible & Disabled**

## Implementation Details

### CSS Styling

```css
/* Dropdown width */
.translation-select {
    width: 100%;
    min-width: 200px; /* Ensures "English (Original)" displays fully */
}

/* Button hidden state */
.translate-button.hidden {
    display: none;
}

/* Button disabled state */
.translate-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
```

### JavaScript Event Handlers

#### Language Selection Change

```typescript
languageSelect.addEventListener('change', async (event) => {
    const selectedLanguage = (event.target as HTMLSelectElement).value;

    if (!selectedLanguage || selectedLanguage === '') {
        // English selected
        if (translateButton) {
            translateButton.classList.add('hidden');
            translateButton.removeAttribute('disabled');
        }
        // Reload original content...
    } else {
        // Target language selected
        if (translateButton) {
            translateButton.classList.remove('hidden');
            translateButton.removeAttribute('disabled');
            translateButton.setAttribute('aria-disabled', 'false');
        }
    }
});
```

#### Translate Button Click

```typescript
translateButton.addEventListener('click', async () => {
    const selectedLanguage = (languageSelect as HTMLSelectElement).value;
    
    // Validate selection...
    
    // Perform translation
    const success = await translationService.translateContent(
        chapterContent, 
        selectedLanguage, 
        currentFile
    );
    
    if (success) {
        // Disable button after successful translation
        translateButton.setAttribute('disabled', 'true');
        translateButton.setAttribute('aria-disabled', 'true');
    }
});
```

#### Chapter Navigation

```typescript
async function loadContent(filename: string, options = {}) {
    // ... other code ...
    
    // Re-enable translate button when chapter changes (if language selected)
    if (translateButton && languageSelect) {
        const selectedLanguage = (languageSelect as HTMLSelectElement).value;
        if (selectedLanguage && selectedLanguage !== '') {
            translateButton.removeAttribute('disabled');
            translateButton.setAttribute('aria-disabled', 'false');
        }
    }
    
    // ... continue loading content ...
}
```

## Accessibility Features

### ARIA Attributes

- **aria-label**: "Translate current chapter" - provides descriptive label for screen readers
- **aria-disabled**: Reflects the button's disabled state for assistive technologies
  - `"false"` when enabled
  - `"true"` when disabled

### Keyboard Navigation

- All controls are keyboard accessible
- Tab order flows logically: dropdown → translate button
- Enter/Space activates the translate button when focused
- Arrow keys navigate dropdown options

### Screen Reader Announcements

- Button state changes are announced via `aria-disabled`
- Button visibility changes don't require announcement (natural flow)
- Translation progress uses `role="status"` with `aria-live="polite"`

## Testing

### Unit Tests

Location: `CompendiumUI/translation.test.ts`

**Test Coverage:**

1. **Button Visibility Tests**
   - Button is hidden initially
   - Button shows when language is selected
   - Button hides when English is re-selected

2. **Button State Tests**
   - Button is enabled when language changes
   - Button is disabled after successful translation
   - Button remains enabled if translation fails
   - Button re-enables when language changes again
   - Button re-enables when chapter changes

3. **Accessibility Tests**
   - Button has proper `aria-label`
   - `aria-disabled` updates correctly
   - `aria-disabled` is `false` when enabled
   - `aria-disabled` is `true` when disabled

4. **Chapter Navigation Tests**
   - Button re-enables on chapter change (if language selected)
   - Button stays hidden on chapter change (if no language selected)

5. **Dropdown Width Tests**
   - Dropdown has minimum width for "English (Original)"

### Running Tests

```bash
cd CompendiumUI
npm install
npm test translation.test.ts
```

### Manual Testing Checklist

- [ ] Initial page load: translate button is hidden
- [ ] Select Spanish: button appears and is enabled
- [ ] Click translate: button becomes disabled after completion
- [ ] Select French: button re-enables
- [ ] Click translate again: button disables
- [ ] Select English: button hides
- [ ] Select Spanish again: button shows and is enabled
- [ ] Navigate to new chapter: button re-enables
- [ ] Translate new chapter: button disables
- [ ] Test keyboard navigation through controls
- [ ] Test with screen reader (NVDA/JAWS/VoiceOver)

## Browser Compatibility

The UI controls work in all modern browsers:
- Chrome/Edge 90+
- Firefox 90+
- Safari 14+

**Note:** The translation *functionality* requires Chrome 120+ with flags enabled, but the UI controls are cross-browser compatible.

## Future Enhancements

### Potential Improvements

1. **Loading State**
   - Show spinner icon on button during translation
   - Update button text to "Translating..."

2. **Keyboard Shortcuts**
   - Alt+T to trigger translation
   - Alt+E to return to English

3. **Persistence**
   - Remember language selection across sessions
   - Auto-translate on page load if preference is set

4. **Visual Feedback**
   - Subtle animation when button state changes
   - Color change to indicate disabled state more clearly

5. **Multi-language Support**
   - Translate button text based on selected language
   - Localize all UI elements

## Troubleshooting

### Button Not Showing After Language Selection

**Cause:** JavaScript event listener not attached  
**Solution:** Check browser console for errors, ensure script.ts loaded correctly

### Button Not Re-enabling After Chapter Change

**Cause:** `loadContent` function not calling re-enable logic  
**Solution:** Verify the re-enable code is present in `loadContent` function

### Button Disabled State Not Visible

**Cause:** CSS opacity not applied  
**Solution:** Check that `.translate-button:disabled` styles are loaded

### ARIA Attributes Not Updating

**Cause:** JavaScript not setting attributes correctly  
**Solution:** Verify `setAttribute` calls in event handlers

## Related Files

- `CompendiumUI/index.html` - HTML structure
- `CompendiumUI/script.ts` - JavaScript logic
- `CompendiumUI/style.css` - CSS styling
- `CompendiumUI/translation.test.ts` - Unit tests
- `docs/translation-feature.md` - User-facing documentation
