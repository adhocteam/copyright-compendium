// --- START OF FILE script.ts ---
import * as algoliasearchLite from 'algoliasearch/lite';
import { autocomplete } from '@algolia/autocomplete-js';
import '@algolia/autocomplete-theme-classic/dist/theme.css'; // Import theme CSS

import { chapters } from './chapters';
import { version } from './package.json';

// --- Type Definitions ---
interface MarkOptions {
    element?: string;
    className?: string;
    separateWordSearch?: boolean;
    accuracy?: string;
    ignoreJoiners?: boolean;
    exclude?: string[];
    done?: (counter: number) => void;
    filter?: (textNode: Text, term: string, marks: number, counter: number) => boolean;
    each?: (element: Element) => void;
    debug?: boolean;
    log?: object;
}

interface MarkInstance {
    mark(keyword: string | string[], options?: MarkOptions): void;
    unmark(options?: { element?: string; className?: string; done?: () => void }): void;
}

declare const Mark: {
    new(context: string | HTMLElement | NodeList | HTMLElement[]): MarkInstance;
};

// Algolia Types
interface AlgoliaResult {
    hits: AlgoliaItem[];
}

interface AlgoliaItem {
    objectID: string;
    title: string;
    content: string;
    url?: string;
    sectionTitle?: string;
    [key: string]: any;
    _snippetResult?: {
        content?: {
            value: string;
        };
    };
}

interface LoadContentOptions {
    updateHistory?: boolean;
    isInitialLoad?: boolean;
    targetHash?: string | null;
    forceReload?: boolean;
}

interface GlossaryData {
    [termId: string]: string;
}

// Translation API types (experimental browser API)
interface TranslationAPI {
    canTranslate(options: { sourceLanguage: string; targetLanguage: string }): Promise<string>;
    createTranslator(options: { sourceLanguage: string; targetLanguage: string }): Promise<Translator>;
}

interface Translator {
    translate(text: string): Promise<string>;
}

declare global {
    interface WindowOrWorkerGlobalScope {
        translation?: TranslationAPI;
    }

    interface Window {
        MyAppGlossary?: {
            refreshTooltips?: () => void;
        };
    }
}

// --- Translation Service ---
class TranslationService {
    private currentLanguage: string;
    private translator: Translator | null;
    private canTranslate: boolean;

    constructor() {
        this.currentLanguage = '';
        this.translator = null;
        this.canTranslate = false;
        this.checkBrowserSupport();
    }

    async checkBrowserSupport(): Promise<boolean> {
        // Check for Translation API support
        // The Translation API is currently experimental in Chrome 120+
        if ('translation' in self && self.translation && 'createTranslator' in self.translation) {
            try {
                // Check if we can create a translator
                // We must check if it's actually usable, not just present
                const canTranslate = await self.translation.canTranslate({
                    sourceLanguage: 'en',
                    targetLanguage: 'es'
                });

                // If the API returns 'no', it means it's not available for this pair or at all
                this.canTranslate = canTranslate !== 'no';
                console.log('Translation API available status:', canTranslate, '->', this.canTranslate);
            } catch (error) {
                console.warn('Translation API check failed:', error);
                this.canTranslate = false;
            }
        } else {
            console.warn('Translation API not supported in this browser');
            this.canTranslate = false;
        }
        return this.canTranslate;
    }

    async translateContent(element: HTMLElement, targetLanguage: string): Promise<boolean> {
        if (!this.canTranslate) {
            console.warn('Translation not available');
            return false;
        }

        if (!targetLanguage || targetLanguage === '') {
            // Reset to original
            this.currentLanguage = '';
            return true;
        }

        try {
            // Create translator if needed
            if (!this.translator || this.currentLanguage !== targetLanguage) {
                if (!self.translation) return false;
                this.translator = await self.translation.createTranslator({
                    sourceLanguage: 'en',
                    targetLanguage: targetLanguage
                });
                this.currentLanguage = targetLanguage;
            }

            // Translate text nodes in the element
            await this.translateElement(element);
            return true;
        } catch (error) {
            console.error('Translation failed:', error);
            return false;
        }
    }

    async translateElement(element: HTMLElement): Promise<void> {
        // Walk through text nodes and translate them
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    // Skip empty text nodes and nodes in script/style tags
                    if (!node.textContent || !node.textContent.trim()) return NodeFilter.FILTER_REJECT;
                    const parent = node.parentElement;
                    if (parent && (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE')) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        const textNodes = [];
        let node;
        while (node = walker.nextNode()) {
            textNodes.push(node);
        }

        // Translate each text node
        for (const textNode of textNodes) {
            try {
                if (!this.translator || !textNode.textContent) continue;
                const translatedText = await this.translator.translate(textNode.textContent);
                textNode.textContent = translatedText;
            } catch (error) {
                console.warn('Failed to translate text node:', error);
            }
        }
    }

    isSupported(): boolean {
        return this.canTranslate;
    }
}

document.addEventListener('DOMContentLoaded', () => {

    // --- Element Selection ---
    const chapterContent = document.getElementById('chapter-content');
    const sectionListContainer = document.getElementById('section-list');
    const sideNavElement = document.querySelector('.sidenav'); // Select the outer nav element
    const headerSearchForm = document.querySelector('.usa-header .usa-search');
    const headerSearchInput = document.getElementById('search-field');
    const chapterListDropdown = document.querySelector('#basic-nav-section-one');
    const uswdsMenuButton = document.querySelector('.usa-header .usa-menu-btn');
    const uswdsNavCloseButton = document.querySelector('.usa-header .usa-nav__close');
    const uswdsOverlay = document.querySelector('.usa-overlay');
    const uswdsNav = document.querySelector('.usa-header .usa-nav');
    const homeLink = document.querySelector('.usa-logo a');
    const headerChapterTitle = document.getElementById('header-chapter-title');

    // Translation elements
    const languageSelect = document.getElementById('language-select');
    const translationDisclaimer = document.getElementById('translation-disclaimer');
    const translationControlsWrapper = document.getElementById('translation-controls-wrapper');
    const translationInfoLinkWrapper = document.getElementById('translation-info-link-wrapper');
    const translationInfoLink = document.getElementById('translation-info-link');
    const translationInfoTooltip = document.getElementById('translation-info-tooltip');
    const viewOriginalLink = document.getElementById('view-original-link');

    // --- Initial Checks ---
    // Check for elements critical for basic functionality
    if (!chapterContent) console.error("CRITICAL: #chapter-content not found.");
    if (!chapterListDropdown) console.error("CRITICAL: #basic-nav-section-one not found. Chapter dropdown cannot be populated.");
    if (!homeLink) console.warn("WARN: Home link (.usa-logo a) not found.");

    // Check for elements related to the sidenav (less critical for initial load)
    if (!sectionListContainer) console.warn("WARN: #section-list not found. Sidenav cannot be populated.");
    if (!sideNavElement) console.warn("WARN: .sidenav element not found. Sidenav hiding/showing might not work.");

    // Version Display
    const versionNumberElement = document.getElementById('version-number');
    if (versionNumberElement) {
        versionNumberElement.textContent = version;
    }


    // --- Data ---
    // --- Data ---
    // imported from chapters.ts

    // --- State Variables ---
    // --- State Variables ---
    let highlightMarkInstance: MarkInstance;
    let currentFilename: string | null = null;
    // Persist chapter toggle (expanded/collapsed) state across navigation rebuilds
    const chapterToggleState = new Map<string, boolean>(); // filename -> isExpanded

    // --- Functions ---

    function scrollElementIntoView(targetElement: HTMLElement | null, highlight = false, blockOption: ScrollLogicalPosition = 'start'): boolean {
        if (!targetElement) return false;
        let parent = targetElement.parentElement;
        while (parent) {
            if (parent.tagName === 'DETAILS' && !(parent as HTMLDetailsElement).open) {
                (parent as HTMLDetailsElement).open = true;
            }
            parent = parent.parentElement;
        }
        setTimeout(() => {
            targetElement.scrollIntoView({ behavior: 'smooth', block: blockOption });
            if (highlight) {
                targetElement.classList.add('temp-highlight');
                setTimeout(() => targetElement.classList.remove('temp-highlight'), 1500);
            }
        }, 50);
        return true;
    }

    function updateSideNavCurrent(targetId: string | null): boolean {
        if (!sectionListContainer) return false;
        sectionListContainer.querySelectorAll('.usa-sidenav__item.usa-current, .usa-sidenav__item a.usa-current').forEach(el => el.classList.remove('usa-current'));
        if (targetId) {
            const newActiveLink = sectionListContainer.querySelector(`a[href="#${targetId}"]`);
            if (newActiveLink) {
                newActiveLink.classList.add('usa-current');
                const parentLi = newActiveLink.closest('.usa-sidenav__item');
                if (parentLi) parentLi.classList.add('usa-current');
                const isGlossaryNav = sectionListContainer.querySelector('nav[aria-label="Glossary A-Z Navigation"]');
                if (!isGlossaryNav && sideNavElement) { // Only scroll hierarchical nav
                    scrollElementIntoView((parentLi || newActiveLink) as HTMLElement, false, 'nearest');
                }
                return true;
            }
        }
        return false;
    }

    function updateTopNavCurrent(filename: string | null): void {
        if (!chapterListDropdown) {
            // console.warn("updateTopNavCurrent called but chapterListDropdown element not found."); // Already logged
            return;
        }
        if (chapterListDropdown.hasChildNodes()) {
            chapterListDropdown.querySelectorAll('a').forEach(el => {
                if (el.dataset.filename === filename) {
                    el.classList.add('usa-current');
                    el.setAttribute('aria-current', 'page');
                } else {
                    el.classList.remove('usa-current');
                    el.removeAttribute('aria-current');
                }
            });
        }
    }


    // --- loadContent ---
    async function loadContent(filename: string, options: LoadContentOptions = {}): Promise<void> {
        const { updateHistory = true, isInitialLoad = false, targetHash = null, forceReload = false } = options;

        // --- Same-page hash scrolling logic ---
        if (!forceReload && filename === currentFilename && !isInitialLoad) {
            console.log(`Content ${filename} already loaded.`);
            if (targetHash) {
                const targetElement = document.getElementById(targetHash);
                if (targetElement) {
                    scrollElementIntoView(targetElement, true, 'start');
                    if (filename !== 'glossary.html') {
                        updateSideNavCurrent(targetHash);
                    }
                    if (updateHistory) {
                        const state = { filename: filename, hash: targetHash }; const title = document.title; const url = `/${filename}#${targetHash}`;
                        if (history.state && history.state.filename === filename) { history.replaceState(state, title, url); }
                        else { history.pushState(state, title, url); }
                        // console.log(`History ${history.state && history.state.filename === filename ? 'replaceState' : 'pushState'} (hash update):`, state, title, url);
                    }
                }
            } else {
                if (!isInitialLoad && chapterContent) {
                    chapterContent.scrollTo({ top: 0, behavior: 'smooth' });
                    if (filename !== 'glossary.html') {
                        updateSideNavCurrent(null);
                    }
                    // Remove hash from URL on scroll to top
                    history.replaceState({ filename: filename, hash: null }, document.title, `/${filename}`);
                }
            }
            return;
        }
        // --- End same-page logic ---

        // console.log(`Loading content: ${filename}, updateHistory: ${updateHistory}, isInitialLoad: ${isInitialLoad}, targetHash: ${targetHash}`);
        clearHighlighting();
        if (headerSearchInput) (headerSearchInput as HTMLInputElement).value = '';

        // Clear previous side nav content *before* loading new main content
        if (sectionListContainer) sectionListContainer.innerHTML = '';
        // Ensure sidenav is hidden by default before attempting to load/generate
        if (sideNavElement) {
            sideNavElement.classList.add('hidden');
        } else {
            // Warning already logged at top if element missing
        }

        // Set loading message for main content
        if (!chapterContent) {
            console.error("Cannot load content: chapterContent element not found.");
            return; // Stop if main content area is missing
        }
        chapterContent.innerHTML = `<p class="usa-prose">Loading ${filename}...</p>`;

        try {
            // --- Fetching and parsing content ---
            const fetchPath = filename.replace(/\s*\.html$/i, '-src.html'); // Assuming files are in the same directory or relative paths work
            // console.log("Fetching:", fetchPath);
            const response = await fetch(fetchPath);
            // console.log("Fetch response status:", response.status);
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status} for ${fetchPath}`);
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            // Prefer specific root elements, fall back to body
            const specificRoot = doc.querySelector('chapter, table_of_authorities, dl');
            const contentElement = specificRoot || doc.body; // Use specific root or body if not found
            console.log("Setting chapterContent.innerHTML");
            chapterContent.innerHTML = contentElement ? contentElement.innerHTML : '<p class="usa-alert usa-alert--error">Could not parse main content.</p>';
            // --- End fetching/parsing ---

            console.log("Updating currentFilename and title");
            currentFilename = filename;
            const chapterTitle = findChapterTitle(filename);

            // Update document title
            document.title = `Compendium Viewer - ${chapterTitle || filename}`;

            // Update Header Title
            if (headerChapterTitle) {
                if (chapterTitle) {
                    headerChapterTitle.textContent = chapterTitle;
                } else if (filename === 'glossary.html') {
                    headerChapterTitle.textContent = 'Glossary';
                } else if (filename === 'introduction.html') {
                    headerChapterTitle.textContent = 'Introduction';
                } else {
                    headerChapterTitle.textContent = ''; // Clear or default
                }
            }

            // --- Generate navigation AND handle visibility ---
            console.log("Calling generateNavigation");
            generateNavigation(filename); // This function now handles showing/hiding sideNavElement

            // --- History update ---
            console.log("Updating history");
            if (updateHistory) {
                const state = { filename: filename, hash: targetHash }; const title = document.title; let url = `/${filename}`;
                if (targetHash) { url += `#${targetHash}`; } else if (isInitialLoad && location.hash) { url += location.hash; } // Preserve initial hash
                const targetFullUrl = url; // Base path is handled by browser resolving relative links

                if (isInitialLoad) {
                    history.replaceState(state, title, targetFullUrl);
                    console.log(`History replaceState (initial):`, state, title, targetFullUrl);
                } else {
                    history.pushState(state, title, targetFullUrl);
                    console.log(`History pushState (navigation):`, state, title, targetFullUrl);
                }

                // Scroll to top if navigating to a new page without a hash, unless it's initial load
                if (!targetHash && !isInitialLoad && chapterContent) {
                    chapterContent.scrollTo({ top: 0, behavior: 'smooth' });
                }
            }
            // --- End History update ---

            console.log("Calling updateTopNavCurrent");
            updateTopNavCurrent(filename); // Update top nav highlighting

            // --- Scrolling logic ---
            console.log("Handling scrolling");
            const finalHashToScroll = targetHash || (isInitialLoad ? location.hash.substring(1) : null);
            if (finalHashToScroll) {
                // Use a slightly longer delay to ensure layout potentially settles after sidenav show/hide
                setTimeout(() => {
                    const targetElement = document.getElementById(finalHashToScroll);
                    if (targetElement) {
                        console.log("Scrolling to target:", finalHashToScroll);
                        scrollElementIntoView(targetElement, true, 'start');
                        if (filename !== 'glossary.html') {
                            updateSideNavCurrent(finalHashToScroll);
                        }
                    } else {
                        console.warn(`Target element ID "${finalHashToScroll}" not found after loading content.`);
                        if (filename !== 'glossary.html') {
                            updateSideNavCurrent(null);
                        }
                    }
                }, 200); // Increased delay
            } else if (!isInitialLoad) {
                // Clear side nav current state if navigating to a non-glossary page without a hash
                if (filename !== 'glossary.html') {
                    updateSideNavCurrent(null);
                }
            }
            // --- End Scrolling ---
            console.log("loadContent try block finished successfully.");

            // --- Glossary Tooltip Refresh ---
            if (window.MyAppGlossary && typeof window.MyAppGlossary.refreshTooltips === 'function') {
                console.log("Triggering glossary tooltip refresh.");
                window.MyAppGlossary.refreshTooltips();
            } else {
                console.warn("Glossary tooltip refresh function not available.");
                // This might happen if the glossary script failed to load or initialize
            }

        } catch (error) {
            console.error("Error during loadContent:", error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            if (chapterContent) { // Check if element exists before modifying
                chapterContent.innerHTML = `<p class="usa-alert usa-alert--error">Failed to load content: ${errorMessage}. Check console for details.</p>`;
            }
            // Ensure sidenav remains hidden on error
            if (sectionListContainer) sectionListContainer.innerHTML = '';
            if (sideNavElement) sideNavElement.classList.add('hidden');
            currentFilename = null; // Reset state
            document.title = "Compendium Viewer - Error";
            updateTopNavCurrent(null); // Ensure nav state is cleared on error
        }
    }

    // --- Find Chapter Title ---
    function findChapterTitle(filename: string): string | null {
        const chapter = chapters.find(c => c.filename === filename);
        return chapter ? `${chapter.number}${chapter.number ? ': ' : ''}${chapter.title}` : null;
    }

    // --- Navigation Dispatcher Function ---
    function generateNavigation(filename: string): void {
        // Determine if sidenav should be shown based on the result of generator functions
        // For the new design, we always want the side nav to be visible if we can generate it
        const success = generateSideNav(filename);

        // Apply visibility class based on the result
        if (sideNavElement) {
            if (success) {
                sideNavElement.classList.remove('hidden');
            } else {
                sideNavElement.classList.add('hidden');
            }
        }
    }


    function generateSideNav(currentFilename: string): boolean {
        if (!sectionListContainer) return false;

        sectionListContainer.innerHTML = '';
        const nav = document.createElement('nav');
        nav.setAttribute('aria-label', 'Side navigation');
        const ul = document.createElement('ul');
        ul.className = 'usa-sidenav';

        chapters.forEach(chapter => {
            const isActive = chapter.filename === currentFilename;
            const li = document.createElement('li');
            li.className = 'usa-sidenav__item';

            const a = document.createElement('a');
            a.href = `/${chapter.filename}`;
            a.textContent = `${chapter.number ? chapter.number + ' ' : ''}${chapter.title}`;

            if (isActive) {
                a.classList.add('usa-current');
                li.classList.add('usa-current');
                a.setAttribute('aria-current', 'page');
            }

            // Build sublist for active chapter (sections), empty for others
            const subUl = document.createElement('ul');
            subUl.className = 'usa-sidenav__sublist';

            if (isActive) {
                if (currentFilename === 'glossary.html') {
                    generateGlossaryItems(subUl);
                } else {
                    generateHierarchicalItems(subUl);
                }
            }

            const hasSubItems = subUl.hasChildNodes();

            if (hasSubItems) {
                // Determine toggle state: use saved state, or default (active=expanded, others=collapsed)
                const savedState = chapterToggleState.get(chapter.filename);
                const isExpanded = savedState !== undefined ? savedState : isActive;

                // Wrap link + toggle in a flex container
                const innerDiv = document.createElement('div');
                innerDiv.className = 'usa-sidenav__item-inner';

                a.style.flex = '1';
                innerDiv.appendChild(a);

                // Add toggle button only when sub-items exist
                const toggleBtn = document.createElement('button');
                toggleBtn.className = isExpanded ? 'usa-sidenav__toggle' : 'usa-sidenav__toggle is-collapsed';
                toggleBtn.setAttribute('aria-expanded', String(isExpanded));
                toggleBtn.setAttribute('aria-label', `Toggle ${chapter.title}`);
                toggleBtn.innerHTML = `
                    <svg class="usa-icon" aria-hidden="true" focusable="false" role="img"
                         xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
                        <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" fill="currentColor"/>
                    </svg>
                `;
                toggleBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleSidenavItem(toggleBtn);
                    // Persist state
                    const nowExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
                    chapterToggleState.set(chapter.filename, nowExpanded);
                });
                innerDiv.appendChild(toggleBtn);

                li.appendChild(innerDiv);

                // Apply hidden state to sublist
                if (!isExpanded) {
                    subUl.setAttribute('hidden', '');
                }
                li.appendChild(subUl);
            } else {
                // No sub-items: simple link without toggle
                li.appendChild(a);
            }

            // Add click listener for navigation
            a.addEventListener('click', (e) => {
                e.preventDefault();
                if (chapter.filename !== currentFilename) {
                    // When navigating to a new chapter, set it to expanded
                    chapterToggleState.set(chapter.filename, true);
                    loadContent(chapter.filename, { updateHistory: true, isInitialLoad: false });
                } else {
                    chapterContent?.scrollTo({ top: 0, behavior: 'smooth' });
                }
            });

            ul.appendChild(li);
        });

        nav.appendChild(ul);
        sectionListContainer.appendChild(nav);
        return true;
    }

    // Helper to generate glossary items into a specific list
    function generateGlossaryItems(targetList: HTMLUListElement): boolean {
        if (!chapterContent) return false;
        const glossaryTerms = chapterContent.querySelectorAll('dt[id]');
        if (!glossaryTerms || glossaryTerms.length === 0) return false;

        const firstTermPerLetter: Record<string, string> = {};
        glossaryTerms.forEach(dt => {
            const termText = dt.textContent ? dt.textContent.trim() : '';
            if (termText) {
                const firstChar = termText.charAt(0).toUpperCase();
                if (/^[A-Z]$/.test(firstChar) && !firstTermPerLetter[firstChar]) {
                    firstTermPerLetter[firstChar] = dt.id;
                }
            }
        });

        let foundLinks = false;
        for (let i = 65; i <= 90; i++) {
            const letter = String.fromCharCode(i);
            // Verify if we have terms for this letter
            if (firstTermPerLetter[letter]) {
                const li = document.createElement('li');
                li.className = 'usa-sidenav__item';
                const a = document.createElement('a');
                a.textContent = letter;
                a.href = `#${firstTermPerLetter[letter]}`;
                a.addEventListener('click', handleGlossaryLinkClick);
                li.appendChild(a);
                targetList.appendChild(li);
                foundLinks = true;
            }
        }
        return foundLinks;
    }

    // Helper to generate hierarchical items
    function generateHierarchicalItems(targetList: HTMLUListElement): boolean {
        if (!chapterContent) return false;

        const firstLevelContent = chapterContent.firstElementChild;
        if (!firstLevelContent) return false;

        let topLevelSelector, itemType;
        const tagNameLower = firstLevelContent.tagName.toLowerCase();

        if (tagNameLower === 'chapter') {
            topLevelSelector = ':scope > section[id]'; itemType = 'section';
        } else if (tagNameLower === 'table_of_authorities') {
            topLevelSelector = ':scope > authority_group[id]'; itemType = 'authority_group';
        } else if (chapterContent.querySelector(':scope > section[id]')) {
            topLevelSelector = ':scope > section[id]'; itemType = 'section';
        } else {
            return false;
        }

        const rootElement = (tagNameLower === 'chapter' || tagNameLower === 'table_of_authorities') ? firstLevelContent : chapterContent;
        const topLevelItems = rootElement.querySelectorAll(topLevelSelector);

        if (topLevelItems.length === 0) return false;

        topLevelItems.forEach(item => buildNavItem(item, itemType, targetList, 0));

        // Add scroll listeners for these new items
        addSmoothScrollListeners(targetList);

        return targetList.hasChildNodes();
    }



    // --- Event Handler for Glossary Links ---
    function handleGlossaryLinkClick(this: HTMLAnchorElement, e: Event): void {
        e.preventDefault();
        const targetId = this.getAttribute('href')!.substring(1);
        const targetElement = document.getElementById(targetId);

        if (targetElement) {
            scrollElementIntoView(targetElement, true, 'start');
            // Update URL hash without triggering popstate
            if (currentFilename) {
                const state = { filename: currentFilename, hash: targetId };
                const title = document.title;
                const url = `/${currentFilename}#${targetId}`;
                try {
                    // Use replaceState for A-Z clicks to avoid polluting history too much
                    history.replaceState(state, title, url);
                    // console.log("History replaceState (glossary nav click):", state, title, url);
                } catch (err) {
                    console.warn("History API error on replaceState.", err);
                }
            }
        } else {
            console.warn(`Target element ID "${targetId}" not found for glossary link.`);
        }
        // Do NOT call updateSideNavCurrent for A-Z links
    }

    // --- Helper to toggle Sidenav Items ---
    function toggleSidenavItem(button: HTMLButtonElement): void {
        const isExpanded = button.getAttribute('aria-expanded') === 'true';
        button.setAttribute('aria-expanded', String(!isExpanded));

        // Button is inside .usa-sidenav__item-inner (div), so we look for the UL which is a sibling of that div
        const wrapperDiv = button.closest('.usa-sidenav__item-inner');
        const subList = wrapperDiv ? wrapperDiv.nextElementSibling : null;

        if (subList && subList.tagName === 'UL') {
            if (!isExpanded) {
                subList.removeAttribute('hidden');
            } else {
                subList.setAttribute('hidden', '');
            }
        }
        // Toggle icon rotation class
        button.classList.toggle('is-collapsed', isExpanded);
    }




    function buildNavItem(element: Element, type: string, parentUl: HTMLUListElement, level: number): void {
        const id = element.id;
        if (!id) return; // Skip elements without IDs

        let titleElement = (type === 'authority_group')
            ? element.querySelector(':scope > title')
            : element.querySelector(`:scope > ${type}_title`);

        let displayTitle = `[${id}]`; // Fallback display
        let numberText = '';
        let titleOnlyText = '';

        if (titleElement) {
            const titleClone = titleElement.cloneNode(true) as Element;
            const numElement = titleClone.querySelector('num');
            if (numElement && numElement.textContent) {
                numberText = numElement.textContent.trim();
                numElement.remove();
            }
            titleOnlyText = titleClone.textContent?.trim() || '';

            if (numberText && titleOnlyText) {
                displayTitle = `${numberText} ${titleOnlyText}`;
            } else if (titleOnlyText) {
                displayTitle = titleOnlyText;
            } else if (numberText) {
                displayTitle = numberText;
            }
        } else {
            const typeDisplay = type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            const fallbackText = element.textContent.trim().substring(0, 50) + (element.textContent.length > 50 ? '...' : '');
            displayTitle = fallbackText || `${typeDisplay} [${id}]`;
        }

        const li = document.createElement('li');
        li.className = 'usa-sidenav__item';

        // Check for children first to decide if we need a toggle
        let hasChildren = false;
        if (type === 'section' || type === 'subsection') {
            const children = element.querySelectorAll(':scope > subsection[id], :scope > provision[id]');
            if (children.length > 0) hasChildren = true;
        }

        const div = document.createElement('div');
        div.className = 'usa-sidenav__item-inner';
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.justifyContent = 'space-between';

        const a = document.createElement('a');
        a.href = `#${id}`;
        a.textContent = displayTitle;
        a.style.flex = '1'; // Allow link to take available space

        div.appendChild(a);

        if (hasChildren) {
            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'usa-sidenav__toggle is-collapsed';
            toggleBtn.setAttribute('aria-expanded', 'false'); // Default collapsed
            toggleBtn.setAttribute('aria-label', `Toggle ${displayTitle}`);

            // Inline SVG chevron (pointing right when collapsed, rotates down when expanded)
            toggleBtn.innerHTML = `
                <svg class="usa-icon" aria-hidden="true" focusable="false" role="img" 
                     xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
                    <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" fill="currentColor"/>
                </svg>
            `;

            toggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleSidenavItem(toggleBtn);
            });
            div.appendChild(toggleBtn);
        }

        li.appendChild(div);

        // Recursively build sub-navigation for sections and subsections
        if (hasChildren) {
            const children = element.querySelectorAll(':scope > subsection[id], :scope > provision[id]');
            const subUl = document.createElement('ul');
            subUl.className = 'usa-sidenav__sublist';
            subUl.setAttribute('hidden', ''); // Default collapsed
            children.forEach(child => buildNavItem(child, child.tagName.toLowerCase(), subUl, level + 1));
            li.appendChild(subUl);
        }
        parentUl.appendChild(li);
    }

    function addSmoothScrollListeners(navContainer: HTMLElement): void {
        // This listener is specifically for hierarchical nav items
        navContainer.querySelectorAll('a[href^="#"]').forEach(link => {
            link.addEventListener('click', function (this: HTMLAnchorElement, e: Event) {
                e.preventDefault();
                const href = this.getAttribute('href');
                if (!href) return;
                const targetId = href.substring(1);
                const targetElement = document.getElementById(targetId);

                if (targetElement) {
                    scrollElementIntoView(targetElement, true, 'start');
                    updateSideNavCurrent(targetId); // Update highlighting in side nav

                    if (currentFilename) {
                        const state = { filename: currentFilename, hash: targetId };
                        const title = document.title;
                        const url = `/${currentFilename}#${targetId}`;
                        try {
                            history.replaceState(state, title, url);
                            // console.log("History replaceState (side nav click):", state, title, url);
                        } catch (err) {
                            console.warn("History API error on replaceState.", err);
                        }
                    }
                } else {
                    console.warn(`Target element ID "${targetId}" not found for side nav link.`);
                }
            });
        });
    }

    // --- Highlighting and Search ---
    function clearHighlighting(): void {
        if (typeof Mark === 'undefined') return;
        if (highlightMarkInstance) {
            highlightMarkInstance.unmark();
        } else if (chapterContent) {
            try { // Add try/catch around Mark instantiation
                new Mark(chapterContent).unmark();
            } catch (e) {
                console.warn("Error clearing highlights with Mark.js:", e);
                // Manual fallback cleanup
                chapterContent?.querySelectorAll('span.highlight').forEach(el => {
                    if (el.parentNode) el.outerHTML = el.innerHTML;
                });
            }
        }
        // Ensure manual cleanup runs even if Mark.js instance existed but failed
        chapterContent?.querySelectorAll('span.highlight').forEach(el => {
            if (el.parentNode) el.outerHTML = el.innerHTML;
        });
    }

    function performSearch(searchTerm: string): void {
        clearHighlighting();
        if (!searchTerm || searchTerm.trim() === '' || typeof Mark === 'undefined') {
            return;
        }
        if (!chapterContent) {
            console.warn("performSearch: chapterContent element not found.");
            return;
        }

        try { // Add try/catch around Mark.js usage
            highlightMarkInstance = new Mark(chapterContent);
            highlightMarkInstance.mark(searchTerm.trim(), {
                element: "span",
                className: "highlight",
                separateWordSearch: false,
                accuracy: "partially",
                ignoreJoiners: true,
                exclude: [
                    ".usa-sidenav *", "nav *", "script", "style", "noscript",
                    ".usa-identifier *", "*[aria-hidden='true']"
                ],
                done: (counter: number) => {
                    console.log(`${counter} matches found for "${searchTerm.trim()}"`);
                    if (counter > 0) {
                        const firstMatch = chapterContent.querySelector('.highlight');
                        if (firstMatch) {
                            scrollElementIntoView(firstMatch as HTMLElement, false, 'nearest');
                        }
                    }
                },
                filter: (textNode: Text) => {
                    const parent = textNode.parentNode;
                    if (!parent || (parent as Element).closest?.('script, style, noscript, nav, .usa-sidenav, .usa-identifier, [aria-hidden="true"]')) {
                        return false;
                    }
                    return true;
                }
            });
        } catch (e) {
            console.error("Error during Mark.js execution:", e);
        }
    }

    // --- Initialization and Event Listeners ---

    // Populate Chapters menu
    if (chapterListDropdown) {
        console.log(`Starting population of #${chapterListDropdown.id}...`);
        chapters.forEach((chapter) => {
            const listItem = document.createElement('li');
            listItem.classList.add('usa-nav__submenu-item');
            const link = document.createElement('a');
            link.href = `/${chapter.filename}`; // Use relative path
            link.textContent = `${chapter.number}${chapter.number ? ': ' : ''}${chapter.title}`;
            link.dataset.filename = chapter.filename; // Store filename for easy access

            link.addEventListener('click', (e) => {
                e.preventDefault(); // Prevent default link navigation
                const filename = link.dataset.filename;
                // Only load if it's a different chapter
                if (filename !== currentFilename) {
                    console.log("Chapter link clicked, calling loadContent for:", filename);
                    if (filename) {
                        loadContent(filename, { updateHistory: true, isInitialLoad: false });
                    }
                } else {
                    // If same chapter, scroll to top and clear side nav highlight
                    console.log("Chapter link clicked for current chapter, scrolling top.");
                    chapterContent?.scrollTo({ top: 0, behavior: 'smooth' });
                    if (filename !== 'glossary.html') {
                        updateSideNavCurrent(null);
                    }
                    // Also update URL to remove hash if any
                    history.replaceState({ filename: filename, hash: null }, document.title, `/${filename}`);
                }
                // Close mobile menu if open
                if (uswdsNav && uswdsNav.classList.contains('is-visible')) {
                    uswdsOverlay?.classList.remove('is-visible');
                    uswdsNav.classList.remove('is-visible');
                    if (uswdsMenuButton) uswdsMenuButton.setAttribute('aria-expanded', 'false');
                }
            });
            listItem.appendChild(link);
            chapterListDropdown.appendChild(listItem);
        });
        console.log(`✅ Finished population. Added ${chapters.length} items to #${chapterListDropdown.id}.`);

        // Add accordion toggle functionality for the Chapters button
        // This is needed because USWDS JS may not load in some environments
        const chaptersAccordionButton = document.querySelector(`button.usa-accordion__button[aria-controls="${chapterListDropdown.id}"]`);
        if (chaptersAccordionButton) {
            // Close when clicking outside
            document.addEventListener('click', (event) => {
                const isExpanded = chaptersAccordionButton.getAttribute('aria-expanded') === 'true';
                if (isExpanded && !chapterListDropdown.contains(event.target as Node) && !chaptersAccordionButton.contains(event.target as Node)) {
                    chaptersAccordionButton.setAttribute('aria-expanded', 'false');
                    chapterListDropdown.setAttribute('hidden', '');
                }
            });

            chaptersAccordionButton.addEventListener('click', (event) => {
                event.stopPropagation(); // Prevent immediate closing from document listener
                const isExpanded = chaptersAccordionButton.getAttribute('aria-expanded') === 'true';

                if (isExpanded) {
                    // Collapse the menu
                    chaptersAccordionButton.setAttribute('aria-expanded', 'false');
                    chapterListDropdown.setAttribute('hidden', '');
                } else {
                    // Expand the menu
                    chaptersAccordionButton.setAttribute('aria-expanded', 'true');
                    chapterListDropdown.removeAttribute('hidden');
                }
            });
        } else {
            console.warn('Could not find accordion button for chapters menu.');
        }
    } else {
        // Error already logged at the top
    }

    // Home link listener
    if (homeLink) {
        homeLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (chapters.length > 0) {
                const firstChapter = chapters[0];
                const firstChapterFilename = firstChapter ? firstChapter.filename : null;
                if (!firstChapterFilename) return;
                console.log("Home link clicked, checking chapter:", firstChapterFilename);
                if (firstChapterFilename !== currentFilename) {
                    console.log("Loading first chapter:", firstChapterFilename);
                    loadContent(firstChapterFilename, { updateHistory: true, isInitialLoad: false });
                } else {
                    console.log("Already on first chapter, scrolling top.");
                    chapterContent?.scrollTo({ top: 0, behavior: 'smooth' });
                    if (firstChapterFilename !== 'glossary.html') {
                        updateSideNavCurrent(null);
                    }
                    history.replaceState({ filename: firstChapterFilename, hash: null }, document.title, `/${firstChapterFilename}`);
                }
            } else {
                console.warn("Home link clicked, but no chapters defined.");
            }
        });
    } // Warning logged at top if not found


    // Content link listener
    if (chapterContent) {
        chapterContent.addEventListener('click', (event) => {
            if (!event.target) return;
            const link = (event.target as HTMLElement).closest('a');
            if (!link || !link.href) { return; }

            let targetUrl;
            try {
                targetUrl = new URL(link.href, window.location.origin + (document.querySelector('base')?.href || '/'));
            } catch (e) {
                console.warn("Could not parse link href:", link.href, e);
                return;
            }

            if (targetUrl.origin !== window.location.origin) { return; } // Ignore external links

            const pathname = targetUrl.pathname.startsWith('/') ? targetUrl.pathname : '/' + targetUrl.pathname;
            const hash = targetUrl.hash;
            const pathSegments = pathname.replace(/\/$/, '').split('/');
            const potentialFilename = pathSegments.pop() || (pathSegments.length > 0 ? pathSegments.pop() : '');

            const isChapterLink = chapters.some(chapter => chapter.filename === potentialFilename);

            if (isChapterLink) {
                console.log(`Intercepted internal chapter link: ${potentialFilename}, hash: ${hash}`);
                event.preventDefault();
                const targetHash = hash ? hash.substring(1) : null;
                if (potentialFilename) {
                    loadContent(potentialFilename, { updateHistory: true, targetHash: targetHash, isInitialLoad: false });
                }
            }
            // Handle same-page anchor links within the loaded content
            else if (potentialFilename === currentFilename && hash) {
                event.preventDefault();
                const targetHash = hash.substring(1);
                const targetElement = document.getElementById(targetHash);
                if (targetElement) {
                    scrollElementIntoView(targetElement, true, 'start');
                    if (currentFilename !== 'glossary.html') {
                        updateSideNavCurrent(targetHash);
                    }
                    const state = { filename: currentFilename, hash: targetHash };
                    const title = document.title;
                    const url = `/${currentFilename}#${targetHash}`;
                    history.replaceState(state, title, url);
                }
            }
        });
    } // Error logged at top if not found


    // Initial load logic
    function handleInitialLoad(): void {
        console.log("handleInitialLoad started.");
        // Determine initial file based on URL path
        const baseHref = document.querySelector('base')?.href || window.location.origin + '/';
        let pathInput = window.location.href.substring(baseHref.length).replace(/^#/, '');
        let pathWithoutHash = pathInput.split('#')[0] || ''; // Remove hash part for filename matching
        let path = pathWithoutHash.replace(/\/$/, ''); // Remove trailing slash
        let filenameFromPath = path.split('/').pop(); // Get last segment

        const matchedChapter = chapters.find(c => c.filename === filenameFromPath);
        const firstChapter = chapters.length > 0 ? chapters[0] : null;
        let initialFilename = (path === '' || !matchedChapter)
            ? (firstChapter ? firstChapter.filename : null)
            : matchedChapter.filename;

        if (!initialFilename) {
            console.error("handleInitialLoad: No initial chapter filename could be determined.");
            if (chapterContent) chapterContent.innerHTML = "<p class='usa-alert usa-alert--error'>No content specified.</p>";
            updateTopNavCurrent(null);
            // Hide sidenav if it exists
            if (sideNavElement) sideNavElement.classList.add('hidden');
            return;
        }

        const initialHash = window.location.hash.substring(1); // Get hash from original URL
        console.log(`handleInitialLoad: Requesting initial load for filename='${initialFilename}', hash='${initialHash}'`);
        loadContent(initialFilename, { updateHistory: true, isInitialLoad: true, targetHash: initialHash });
        console.log("handleInitialLoad finished.");
    }

    // Popstate listener (Handles browser back/forward)
    window.addEventListener('popstate', (event) => {
        console.log("Popstate event:", event.state, location.pathname, location.hash);
        let filenameToLoad = null;
        let hashToLoad = location.hash.substring(1);

        if (event.state && event.state.filename) {
            filenameToLoad = event.state.filename;
            hashToLoad = event.state.hash || hashToLoad;
        } else {
            const baseHref = document.querySelector('base')?.href || window.location.origin + '/';
            let path = window.location.pathname.substring(baseHref.replace(window.location.origin, '').length);
            path = path.replace(/\/$/, '');
            let filenameFromPath = path.split('/').pop();
            const matchedChapter = chapters.find(c => c.filename === filenameFromPath);

            if (matchedChapter) {
                filenameToLoad = matchedChapter.filename;
            } else if ((path === '' || path === '/') && chapters.length > 0) {
                const defaultChapter = chapters[0];
                filenameToLoad = defaultChapter ? defaultChapter.filename : 'introduction.html';
            } else {
                // Happens when user hits Back button to reach the initial state
                // Load the first chapter (or default)
                console.log("popstate: No filename in state or URL. Loading default chapter.");
                const defaultChapter = chapters[0];
                filenameToLoad = defaultChapter ? defaultChapter.filename : 'introduction.html';
            }
        }

        if (filenameToLoad) {
            console.log(`Popstate loading: filename='${filenameToLoad}', hash='${hashToLoad}'`);
            loadContent(filenameToLoad, {
                updateHistory: false, // History already changed
                forceReload: true,   // Force reload to ensure UI consistency
                targetHash: hashToLoad,
                isInitialLoad: false
            });
        } else {
            console.warn("Popstate: Could not determine content to load from state or URL.");
            if (chapters.length > 0) { // Attempt to load default if possible
                const defaultChapter = chapters[0];
                if (defaultChapter) {
                    loadContent(defaultChapter.filename, { updateHistory: false, forceReload: true, targetHash: null, isInitialLoad: false });
                }
            } else {
                if (chapterContent) chapterContent.innerHTML = "<p class='usa-alert usa-alert--error'>Cannot determine content to load.</p>";
                updateTopNavCurrent(null);
                if (sideNavElement) sideNavElement.classList.add('hidden');
            }
        }
    });

    // Search listener
    if (headerSearchForm && headerSearchInput) {
        headerSearchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            performSearch((headerSearchInput as HTMLInputElement).value);
        });
        headerSearchInput.addEventListener('input', () => {
            if ((headerSearchInput as HTMLInputElement).value.trim() === '') {
                clearHighlighting();
            }
        });
        headerSearchInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                performSearch((headerSearchInput as HTMLInputElement).value);
            }
        });
    } else {
        console.warn("Header search form or input not found.");
    }

    // Mobile menu toggles
    if (uswdsMenuButton && uswdsNavCloseButton && uswdsOverlay && uswdsNav) {
        const toggleMenu = () => {
            const isExpanded = uswdsNav.classList.toggle('is-visible');
            uswdsOverlay.classList.toggle('is-visible', isExpanded);
            uswdsMenuButton.setAttribute('aria-expanded', String(isExpanded));
        };
        const closeMenu = () => {
            uswdsOverlay.classList.remove('is-visible');
            uswdsNav.classList.remove('is-visible');
            uswdsMenuButton.setAttribute('aria-expanded', 'false');
        };
        uswdsMenuButton.addEventListener('click', toggleMenu);
        uswdsNavCloseButton.addEventListener('click', closeMenu);
        uswdsOverlay.addEventListener('click', closeMenu);
    } else {
        console.warn("One or more USWDS mobile menu elements not found.");
    }


    // --- Start the application ---
    console.log("Running initial load sequence...");
    handleInitialLoad(); // This triggers the first loadContent
    console.log("Initialization complete (event listeners attached, initial load started).");

    // --- Configuration ---
    // Replace with your actual Algolia credentials
    const ALGOLIA_APP_ID = import.meta.env.VITE_ALGOLIA_APP_ID;
    const ALGOLIA_SEARCH_KEY = import.meta.env.VITE_ALGOLIA_SEARCH_KEY;
    const ALGOLIA_INDEX_NAME = 'copyright_compendium_vercel_app_v8o52jy05q_pages';

    if (!ALGOLIA_APP_ID || !ALGOLIA_SEARCH_KEY) {
        console.error("Algolia environment variables are missing!");
        // Potentially disable search functionality here
    }

    // --- Initialize Algolia Client ---
    // Use algoliasearch.lite for search-only operations
    const searchClient = algoliasearchLite.liteClient(ALGOLIA_APP_ID, ALGOLIA_SEARCH_KEY);

    // --- Initialize Autocomplete ---
    // Ensure the DOM is ready if not using defer or module imports
    // document.addEventListener('DOMContentLoaded', () => { ... });

    autocomplete<AlgoliaItem>({
        container: '#autocomplete-search', // CSS selector for your container div
        placeholder: 'Search sections...', // Placeholder text for the input
        autoFocus: false, // Don't auto-focus on page load
        // openOnFocus: true, // Uncomment to show suggestions immediately on focus

        // --- Define How to Get Suggestions ---
        getSources({ query }: { query: string }) {
            return [
                {
                    sourceId: 'compendium', // Unique identifier for this source
                    getItems() {
                        // Fetch suggestions from your Algolia index
                        return searchClient.search([
                            {
                                indexName: ALGOLIA_INDEX_NAME,
                                params: {
                                    query: query,
                                    hitsPerPage: 8, // Limit the number of suggestions
                                    highlightPreTag: '<mark>', // Highlight start tag
                                    highlightPostTag: '</mark>', // Highlight end tag
                                    attributesToHighlight: ['title', 'content'],
                                    attributesToSnippet: ['content:10'], // Optional: Snippet relevant attributes
                                    snippetEllipsisText: '...',
                                },
                            },
                        ])
                            .then(({ results }) => {
                                // Return the hits array from the results
                                return (results[0] as unknown as AlgoliaResult)?.hits || [];
                            });
                    },
                    // --- Define How to Render Suggestions ---
                    templates: {
                        item({ item, components, html }) {
                            // Customize how each suggestion item looks
                            // Use components.Highlight to highlight matching text
                            // Use item._snippetResult for snippets if configured
                            // --- Description/Snippet Part ---
                            // Get the raw snippet string from Algolia. This string contains
                            // the snippet text PLUS the raw HTML highlight tags (e.g., <em>...</em>)
                            const rawSnippetHtml = item._snippetResult?.content?.value;

                            // Conditionally create the description element using dangerouslySetInnerHTML
                            const contentElement = rawSnippetHtml ? html`
                                      <div class="aa-ItemContentDescription"
                                           dangerouslySetInnerHTML=${{ __html: rawSnippetHtml }}>
                                        </div>` : null; // Set to null if no snippet

                            return html`<div class="aa-ItemWrapper">
                          <div class="aa-ItemContent">
                            <div class="aa-ItemContentBody">
                              <div class="aa-ItemContentTitle">
                                ${components.Highlight({ hit: item, attribute: 'sectionTitle' })}  </div>
                              ${item._snippetResult?.content ? html`
                                <div class="aa-ItemContentDescription">
                                    ${contentElement || '' /* Render description or empty string */}
                                   <!-- ${components.Snippet({ hit: item, attribute: 'content' })} -->
                                </div>
                              ` : ''}
                            </div>
                          </div>
                        </div>`;
                        },
                        noResults() {
                            return 'No results found.';
                        },
                        // You can also customize header, footer, etc.
                    },
                    // --- Define What Happens On Select ---
                    onSelect({ item, setQuery, setIsOpen }) {
                        // Example: Navigate to a product page or log the selection
                        console.log('Selected:', item);
                        // If you have product URLs in your index (e.g., item.url)
                        if (item.url) {
                            window.location.href = item.url;
                        } else {
                            // Or maybe fill the input with the selected item's name
                            setQuery(item.title);
                            setIsOpen(false); // Close the dropdown
                            // You might want to trigger a full search here if needed
                        }
                    },
                },
                // You can add more sources here (e.g., searching multiple indices)
            ];
        },

        // Optional: Customize Autocomplete appearance and behavior further
        // See Autocomplete.js documentation for more options
        // Example: Detached mode (dropdown appears separate from input)
        // detachedMediaQuery: '', // Always detached
    });

    // --- Translation Initialization ---
    const translationService = new TranslationService();
    let originalContent = '';

    // Initialize translation controls
    async function initializeTranslation() {
        const isSupported = await translationService.checkBrowserSupport();

        if (!isSupported) {
            // Hide translation controls in menu
            if (translationControlsWrapper) {
                translationControlsWrapper.style.display = 'none';
            }

            // Show translation info link
            if (translationInfoLinkWrapper) {
                translationInfoLinkWrapper.style.display = 'flex';
            }
        } else {
            // Show translation controls in menu
            if (translationControlsWrapper) {
                translationControlsWrapper.style.display = 'block';
            }

            // Hide translation info link
            if (translationInfoLinkWrapper) {
                translationInfoLinkWrapper.style.display = 'none';
            }
        }
    }

    // Handle language selection change
    if (languageSelect) {
        languageSelect.addEventListener('change', async (event) => {
            const selectedLanguage = (event.target as HTMLSelectElement).value;

            if (!selectedLanguage || selectedLanguage === '') {
                // Reset to original
                if (translationDisclaimer) {
                    translationDisclaimer.style.display = 'none';
                }
                // Restore original content if saved
                if (originalContent && chapterContent) {
                    // Reload the current page to get original content
                    const currentFile = currentFilename || 'introduction.html';
                    loadContent(currentFile, { updateHistory: false, forceReload: true });
                }
            } else {
                // Save original content before translating
                if (chapterContent) {
                    originalContent = chapterContent.innerHTML;
                }

                // Show disclaimer
                if (translationDisclaimer) {
                    translationDisclaimer.style.display = 'block';
                }

                // Perform translation
                if (chapterContent) {
                    const success = await translationService.translateContent(chapterContent, selectedLanguage);
                    if (!success) {
                        console.warn('Translation failed');
                    }
                }
            }
        });
    }

    // Handle "view original" link
    if (viewOriginalLink) {
        viewOriginalLink.addEventListener('click', (event) => {
            event.preventDefault();
            if (languageSelect) {
                (languageSelect as HTMLSelectElement).value = '';
                languageSelect.dispatchEvent(new Event('change'));
            }
        });
    }

    // Handle translation info link tooltip
    if (translationInfoLink && translationInfoTooltip) {
        // Media query for responsive behavior
        const mobileBreakpoint = window.matchMedia('(max-width: 40em)');

        // Toggle tooltip on click
        translationInfoLink.addEventListener('click', (event) => {
            event.stopPropagation();
            const isVisible = translationInfoTooltip.style.display !== 'none';
            const newVisibility = isVisible ? 'none' : 'block';
            translationInfoTooltip.style.display = newVisibility;
            // Update ARIA attribute for accessibility
            translationInfoLink.setAttribute('aria-expanded', newVisibility === 'block' ? 'true' : 'false');
        });

        // Show tooltip on hover (desktop only) - use media query
        const handleMouseEnter = () => {
            if (!mobileBreakpoint.matches) {
                translationInfoTooltip.style.display = 'block';
                translationInfoLink.setAttribute('aria-expanded', 'true');
            }
        };

        const handleMouseLeave = () => {
            if (!mobileBreakpoint.matches) {
                translationInfoTooltip.style.display = 'none';
                translationInfoLink.setAttribute('aria-expanded', 'false');
            }
        };

        translationInfoLink.addEventListener('mouseenter', handleMouseEnter);
        translationInfoLink.addEventListener('mouseleave', handleMouseLeave);

        // Close tooltip when clicking outside
        document.addEventListener('click', (event) => {
            if (translationInfoTooltip.style.display === 'block' &&
                !translationInfoLink.contains(event.target as Node) &&
                !translationInfoTooltip.contains(event.target as Node)) {
                translationInfoTooltip.style.display = 'none';
                translationInfoLink.setAttribute('aria-expanded', 'false');
            }
        });
    }

    // Initialize translation on page load
    initializeTranslation();

}); // End DOMContentLoaded

// Wrap in IIFE to keep variables private unless explicitly exposed
(function () {
    'use strict';

    const glossaryUrl = '/glossary-src.html';
    const glossaryUrlBare = '/compendium/glossary.html';
    const glossaryData: GlossaryData = {}; // To store { id: definitionHTML }
    let tooltipElement: HTMLDivElement | null = null; // The single tooltip div
    let glossaryFetched = false; // Flag to track fetch status
    let isFetching = false; // Prevent multiple fetches

    // --- 1. Create the Tooltip Element (Run once) ---
    function createTooltip(): void {
        if (document.getElementById('glossary-tooltip')) {
            tooltipElement = document.getElementById('glossary-tooltip') as HTMLDivElement;
            return; // Already exists
        }
        tooltipElement = document.createElement('div');
        tooltipElement.id = 'glossary-tooltip';
        tooltipElement.setAttribute('role', 'tooltip');
        // Ensure it's hidden initially if created dynamically later
        tooltipElement.style.display = 'none';
        document.body.appendChild(tooltipElement);
    }

    // --- 2. Fetch and Parse Glossary (Run once, ensures data readiness) ---
    function fetchAndParseGlossary(): Promise<void> {
        // Prevent concurrent fetches and re-fetching if already done
        if (glossaryFetched || isFetching) {
            // If already fetched, potentially trigger attachment immediately
            if (glossaryFetched) {
                console.log("Glossary already fetched. Ready to attach listeners.");
                // Optionally, call attachTooltipListeners here if needed on subsequent calls,
                // but the primary mechanism is the exposed function.
            }
            return Promise.resolve(); // Return a resolved promise
        }

        isFetching = true;
        console.log("Fetching glossary data...");

        return fetch(glossaryUrl) // Return the promise chain
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status} for ${glossaryUrl}`);
                }
                return response.text();
            })
            .then(htmlText => {
                const parser = new DOMParser();
                const glossaryDoc = parser.parseFromString(htmlText, 'text/html');
                const terms = glossaryDoc.querySelectorAll('dt[id]'); // Specific selector

                terms.forEach(termElement => {
                    const termId = termElement.id;
                    const nextSibling = termElement.nextElementSibling;
                    if (termId && nextSibling && nextSibling.tagName === 'P') {
                        glossaryData[termId] = nextSibling.innerHTML;
                    } else if (termId) {
                        console.warn(`Glossary tooltip: Expected <p> after <dt id="${termId}">, found ${nextSibling ? nextSibling.tagName : 'nothing'}.`);
                    }
                });

                glossaryFetched = true; // Mark as fetched *successfully*
                isFetching = false;
                console.log(`Glossary data processed. Found ${Object.keys(glossaryData).length} terms.`);
                // Don't attach listeners here automatically anymore, wait for explicit call.
                // The initial call will happen via DOMContentLoaded -> initializeGlossaryTooltips
            })
            .catch(error => {
                console.error('Error fetching or parsing glossary:', error);
                glossaryFetched = false; // Ensure flag is false on error
                isFetching = false;
                // Re-throw or handle error appropriately
                throw error; // Allow calling code to know about the failure
            });
    }

    // --- 3. Attach Listeners to Links (THIS IS THE RE-RUNNABLE FUNCTION) ---
    function attachTooltipListeners(): void {
        // Ensure tooltip element exists (might be called before DOMContentLoaded finishes in rare cases)
        if (!tooltipElement) {
            createTooltip();
        }

        // IMPORTANT: Only proceed if glossary data is ready
        if (!glossaryFetched) {
            console.warn("attachTooltipListeners called, but glossary data is not ready yet.");
            // Optionally, trigger fetch here if it hasn't started,
            // but better to ensure fetch is triggered on init.
            return;
        }

        console.log("Attaching/Re-attaching glossary tooltip listeners...");
        const links = document.querySelectorAll(`a[href^="${glossaryUrlBare}#"]`);

        // Keep track of attached listeners to potentially avoid duplicates if needed,
        // though modern browsers handle duplicate identical listeners well.
        // For simplicity, we'll re-query and attach. If performance becomes an issue
        // on massive pages/updates, optimization might be needed (e.g., targeting only new links).

        links.forEach(link => {
            // Check if listener is potentially already attached (simple check)
            // Note: This isn't foolproof but can prevent redundant work in some cases.
            if ((link as HTMLElement).dataset.glossaryListenerAttached === 'true') {
                return; // Skip if we've marked it
            }

            link.removeEventListener('mouseover', handleMouseOver); // Remove potential old ones first
            link.removeEventListener('mouseout', handleMouseOut);
            link.removeEventListener('mousemove', handleMouseMove as EventListener);

            link.addEventListener('mouseover', handleMouseOver);
            link.addEventListener('mouseout', handleMouseOut);
            link.addEventListener('mousemove', handleMouseMove as EventListener);
            (link as HTMLElement).dataset.glossaryListenerAttached = 'true'; // Mark as attached
        });
        console.log(`Listeners updated for ${links.length} glossary links.`);
    }

    // --- 4. Tooltip Event Handlers (Internal, no changes needed) ---
    function showTooltip(link: HTMLAnchorElement, termId: string, event: MouseEvent): void {
        // Check flag *here* when the event actually fires
        if (!tooltipElement || !glossaryFetched) return;
        const definitionHtml = glossaryData[termId];
        if (definitionHtml) {
            tooltipElement.innerHTML = definitionHtml;
            positionTooltip(event);
            tooltipElement.style.display = 'block';
            link.setAttribute('aria-describedby', 'glossary-tooltip');
        } else {
            console.warn(`Glossary tooltip: Definition for "${termId}" not found.`);
            hideTooltip(link);
        }
    }

    function hideTooltip(link: HTMLAnchorElement): void {
        if (tooltipElement) {
            tooltipElement.style.display = 'none';
            tooltipElement.innerHTML = '';
            link.removeAttribute('aria-describedby');
        }
    }

    function positionTooltip(event: MouseEvent): void {
        // (Keep the positioning logic from the previous version)
        if (!tooltipElement || tooltipElement.style.display === 'none') return;
        const offsetX = 15;
        const offsetY = 15;
        let x = event.pageX + offsetX;
        let y = event.pageY + offsetY;
        const tooltipWidth = tooltipElement.offsetWidth;
        const tooltipHeight = tooltipElement.offsetHeight;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        if (x + tooltipWidth > viewportWidth - offsetX) {
            x = event.pageX - tooltipWidth - offsetX;
            if (x < offsetX) x = offsetX;
        }
        if (y + tooltipHeight > viewportHeight - offsetY) {
            y = event.pageY - tooltipHeight - offsetY;
            if (y < offsetY) y = offsetY;
        }
        tooltipElement.style.left = `${x}px`;
        tooltipElement.style.top = `${y}px`;
    }

    // --- Event Handler Wrappers (Internal, no changes needed) ---
    function handleMouseOver(event: Event): void {
        const link = event.currentTarget as HTMLAnchorElement;
        const href = link.getAttribute('href');
        if (!href) return;
        const termId = href.substring(href.indexOf('#') + 1);
        if (termId) {
            showTooltip(link, termId, event as MouseEvent);
        }
    }
    function handleMouseOut(event: Event): void {
        const link = event.currentTarget as HTMLAnchorElement;
        hideTooltip(link);
    }
    function handleMouseMove(event: MouseEvent): void {
        if (tooltipElement && tooltipElement.style.display === 'block') {
            positionTooltip(event);
        }
    }

    // --- 5. Initialization and Exposure ---

    // Function to be called initially and also exposed
    function initializeGlossaryTooltips(): void {
        createTooltip(); // Ensure tooltip div exists

        // Fetch glossary if not already fetched, then attach listeners
        fetchAndParseGlossary()
            .then(() => {
                // Now that glossary is fetched (or was already fetched), attach listeners
                attachTooltipListeners();
            })
            .catch(error => {
                console.error("Glossary initialization failed:", error);
                // Decide how to handle failure - maybe disable the refresh function?
            });
    }

    // Expose the function to refresh/reattach listeners
    // Use a namespace or a unique name
    window.MyAppGlossary = window.MyAppGlossary || {}; // Create namespace if doesn't exist
    window.MyAppGlossary.refreshTooltips = attachTooltipListeners; // Expose the re-runnable part
    // Optionally expose the full init if needed, though less common
    // window.MyAppGlossary.initialize = initializeGlossaryTooltips;

    // --- Initial Run ---
    // Use DOMContentLoaded to ensure the body exists for createTooltip
    // and that initial content is ready for the first listener attachment.
    document.addEventListener('DOMContentLoaded', initializeGlossaryTooltips);

})(); // End IIFE