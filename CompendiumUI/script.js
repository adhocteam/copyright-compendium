// --- START OF FILE script.js ---

document.addEventListener('DOMContentLoaded', () => {

	// --- Element Selection ---
	const chapterContent = document.getElementById('chapter-content');
	const sectionListContainer = document.getElementById('section-list');
	const headerSearchForm = document.querySelector('.usa-header .usa-search');
	const headerSearchInput = document.getElementById('search-field');
	const chapterListDropdown = document.querySelector('#basic-nav-section-one'); // <<< Ensure ID matches HTML
	const uswdsMenuButton = document.querySelector('.usa-header .usa-menu-btn');
	const uswdsNavCloseButton = document.querySelector('.usa-header .usa-nav__close');
	const uswdsOverlay = document.querySelector('.usa-overlay');
	const uswdsNav = document.querySelector('.usa-header .usa-nav');
	const homeLink = document.querySelector('.usa-logo a');

    console.log("DOM Content Loaded. Selecting elements...");
    console.log("chapterListDropdown selected:", chapterListDropdown);

	// --- Data ---
	const chapters = [
		// ... (chapter data remains the same) ...
        { number: "", title: "Introduction: Intro to the Compendium", filename: "introduction.html" },
	    { number: "100", title: "U.S. Copyright Office and the Copyright Law: General Background", filename: "ch100-general-background.html" },
	    { number: "200", title: "Overview of the Registration Process", filename: "ch200-registration-process.html" },
	    { number: "300", title: "Copyrightable Authorship: What Can Be Registered", filename: "ch300-copyrightable-authorship.html" },
	    { number: "400", title: "Who May File an Application", filename: "ch400-application.html" },
	    { number: "500", title: "Identifying the Work(s) Covered by a Registration", filename: "ch500-identifying-works.html" },
	    { number: "600", title: "Examination Practices", filename: "ch600-examination-practices.html" },
	    { number: "700", title: "Literary Works", filename: "ch700-literary-works.html" },
	    { number: "800", title: "Works of the Performing Arts", filename: "ch800-performing-arts.html" },
	    { number: "900", title: "Visual Art Works", filename: "ch900-visual-art.html" },
	    { number: "1000", title: "Websites and Website Content", filename: "ch1000-websites.html" },
	    { number: "1100", title: "Registration for Multiple Works", filename: "ch1100-registration-multiple-works.html" },
	    { number: "1200", title: "Mask Works", filename: "ch1200-mask-works.html" },
	    { number: "1300", title: "Vessel Designs", filename: "ch1300-vessel-designs.html" },
	    { number: "1400", title: "Applications and Filing Fees", filename: "ch1400-applications-filing-fees.html" },
	    { number: "1500", title: "Deposits", filename: "ch1500-deposits.html" },
	    { number: "1600", title: "Preregistration", filename: "ch1600-preregistration.html" },
	    { number: "1700", title: "Administrative Appeals", filename: "ch1700-administrative-appeals.html" },
	    { number: "1800", title: "Post-Registration Procedures", filename: "ch1800-post-registration.html" },
	    { number: "1900", title: "Publication", filename: "ch1900-publication.html" },
	    { number: "2000", title: "Foreign Works: Eligibility and GATT Registration", filename: "ch2000-foreign-works.html" },
	    { number: "2100", title: "Renewal Registration", filename: "ch2100-renewal-registration.html" },
	    { number: "2200", title: "Notice of Copyright", filename: "ch2200-notice.html" },
	    { number: "2300", title: "Recordation", filename: "ch2300-recordation.html" },
	    { number: "2400", title: "U.S. Copyright Office Services", filename: "ch2400-office-services.html" },
	    { number: "", title: "Glossary", filename: "glossary.html" },
	    { number: "", title: "Table of Authorities", filename: "table-of-authorities.html" },
	    { number: "", title: "Revision History", filename: "revision-history.html" }
	];

	// --- State Variables ---
	let highlightMarkInstance;
	let currentFilename = null;

	// --- Functions ---

	function scrollElementIntoView(targetElement, highlight = false, blockOption = 'start') {
        if (!targetElement) return false;
        let parent = targetElement.parentElement;
        while (parent) { if (parent.tagName === 'DETAILS' && !parent.open) { parent.open = true; } parent = parent.parentElement; }
        setTimeout(() => { targetElement.scrollIntoView({ behavior: 'smooth', block: blockOption }); if (highlight) { targetElement.classList.add('temp-highlight'); setTimeout(() => targetElement.classList.remove('temp-highlight'), 1500); } }, 50);
        return true;
    }

	function updateSideNavCurrent(targetId) {
        if (!sectionListContainer) return;
        sectionListContainer.querySelectorAll('.usa-sidenav__item.usa-current, .usa-sidenav__item a.usa-current').forEach(el => el.classList.remove('usa-current'));
        if (targetId) { const newActiveLink = sectionListContainer.querySelector(`a[href="#${targetId}"]`); if (newActiveLink) { newActiveLink.classList.add('usa-current'); const parentLi = newActiveLink.closest('.usa-sidenav__item'); if (parentLi) parentLi.classList.add('usa-current'); scrollElementIntoView(parentLi || newActiveLink, false, 'nearest'); return true; } } return false;
    }

	// *** MODIFIED updateTopNavCurrent ***
	// Now forces the accordion button to 'closed' state after load,
	// while still marking the internal link as current.
	function updateTopNavCurrent(filename) {
	    if (!chapterListDropdown) {
            console.warn("updateTopNavCurrent called but chapterListDropdown element not found.");
            return;
        }

	    let foundActiveLink = false; // Keep track if a link *inside* is active

	    // 1. Update 'usa-current' status for links *inside* the dropdown
        if (chapterListDropdown.hasChildNodes()) {
            chapterListDropdown.querySelectorAll('a').forEach(el => {
                if (el.dataset.filename === filename) {
                    el.classList.add('usa-current');
                    el.setAttribute('aria-current', 'page');
                    foundActiveLink = true; // Mark that an item inside IS active
                } else {
                    el.classList.remove('usa-current');
                    el.removeAttribute('aria-current');
                }
            });
        }

	    // 2. Find the accordion button that controls this dropdown
	    const accordionButton = document.querySelector(`button.usa-accordion__button[aria-controls="${chapterListDropdown.id}"]`);

	    if (accordionButton) {
            // 3. *** CHANGE HERE: Force the button state to closed ***
            // Set aria-expanded to 'false' regardless of foundActiveLink.
            // This ensures the arrow points down after load.
            accordionButton.setAttribute('aria-expanded', 'false');

            // 4. Ensure the dropdown list itself is visually hidden
            // This should match the aria-expanded="false" state.
            chapterListDropdown.setAttribute('hidden', '');

            // console.log(`updateTopNavCurrent: Set aria-expanded=false and hidden=true for #${chapterListDropdown.id}. Found active link inside: ${foundActiveLink}`);

	    } else {
            console.warn(`Could not find accordion button controlling #${chapterListDropdown.id} in updateTopNavCurrent`);
        }
	}


	// loadContent (No changes needed here, calls the modified updateTopNavCurrent)
	async function loadContent(filename, options = {}) {
	    const { updateHistory = true, isInitialLoad = false, targetHash = null, forceReload = false } = options;

        // --- Same-page hash scrolling logic ---
        if (!forceReload && filename === currentFilename && !isInitialLoad) {
            // ... (same as before) ...
            console.log(`Content ${filename} already loaded.`);
			if(targetHash) {
				const targetElement = document.getElementById(targetHash);
				if (targetElement) {
					scrollElementIntoView(targetElement, true, 'start');
					updateSideNavCurrent(targetHash);
					if (updateHistory) {
						const state = { filename: filename, hash: targetHash }; const title = document.title; const url = `/${filename}#${targetHash}`;
						if (history.state && history.state.filename === filename) { history.replaceState(state, title, url); }
						else { history.pushState(state, title, url); }
						console.log(`History ${history.state && history.state.filename === filename ? 'replaceState' : 'pushState'} (hash update):`, state, title, url);
					}
				}
			} else {
				 if (!isInitialLoad && chapterContent) { chapterContent.scrollTo({ top: 0, behavior: 'smooth' }); updateSideNavCurrent(null); }
			}
			return;
        }
        // --- End same-page logic ---

	    console.log(`Loading content: ${filename}, updateHistory: ${updateHistory}, isInitialLoad: ${isInitialLoad}, targetHash: ${targetHash}`);
	    clearHighlighting();
	    if (headerSearchInput) headerSearchInput.value = '';
	    chapterContent.innerHTML = `<p class="usa-prose">Loading ${filename}...</p>`;
	    sectionListContainer.innerHTML = '';

	    try {
            // --- Fetching and parsing content ---
            const fetchPath = filename;
            const response = await fetch(fetchPath);
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status} for ${fetchPath}`);
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const specificRoot = doc.querySelector('chapter, table_of_authorities');
            const contentElement = specificRoot || doc.body;
            chapterContent.innerHTML = contentElement ? contentElement.innerHTML : '<p class="usa-alert usa-alert--error">Could not parse main content.</p>';
            // --- End fetching/parsing ---

			currentFilename = filename;
			const chapterTitle = findChapterTitle(filename);
			document.title = `Compendium Viewer - ${chapterTitle || filename}`;

			generateHierarchicalNavigation();

			// --- History update ---
            if (updateHistory) {
                const state = { filename: filename, hash: targetHash }; const title = document.title; let url = `/${filename}`;
                if (targetHash) { url += `#${targetHash}`; } else if (isInitialLoad && location.hash) { url += location.hash; }
                const targetFullUrl = url;
                if (isInitialLoad) { history.replaceState(state, title, targetFullUrl); console.log(`History replaceState (initial):`, state, title, targetFullUrl); }
                else { history.pushState(state, title, targetFullUrl); console.log(`History pushState (navigation):`, state, title, targetFullUrl); }
                if (!targetHash && !isInitialLoad && chapterContent) { chapterContent.scrollTo({ top: 0, behavior: 'smooth' }); }
            }
            // --- End History update ---

			// *** This call now uses the modified updateTopNavCurrent ***
			updateTopNavCurrent(filename);

			// --- Scrolling logic ---
            const finalHashToScroll = targetHash || (isInitialLoad ? location.hash.substring(1) : null);
            if (finalHashToScroll) {
                setTimeout(() => {
                const targetElement = document.getElementById(finalHashToScroll);
                if(targetElement) { console.log("Scrolling to target:", finalHashToScroll); scrollElementIntoView(targetElement, true, 'start'); updateSideNavCurrent(finalHashToScroll); }
                else { console.warn(`Target element ID "${finalHashToScroll}" not found after loading content.`); updateSideNavCurrent(null); }
                }, 150);
            } else if (!isInitialLoad) {
                 updateSideNavCurrent(null);
            }
            // --- End Scrolling ---

	    } catch (error) {
            console.error("Could not load content:", error);
            chapterContent.innerHTML = `<p class="usa-alert usa-alert--error">Failed to load content: ${error.message}.</p>`;
            sectionListContainer.innerHTML = '';
            currentFilename = null;
            document.title = "Compendium Viewer - Error";
            updateTopNavCurrent(null); // Ensure nav state is cleared on error
	    }
	}

    // --- Other Functions (findChapterTitle, generateHierarchicalNavigation, buildNavItem, addSmoothScrollListeners, clearHighlighting, performSearch) ---
    // ... (These functions remain unchanged from the previous working version) ...
    function findChapterTitle(filename) { const chapter = chapters.find(c => c.filename === filename); return chapter ? `${chapter.number}${chapter.number ? ': ' : ''}${chapter.title}` : null; }
    function generateHierarchicalNavigation() { sectionListContainer.innerHTML = ''; const nav = document.createElement('nav'); const ul = document.createElement('ul'); ul.className = 'usa-sidenav'; const firstLevelContent = chapterContent.firstElementChild; if (!firstLevelContent) { sectionListContainer.innerHTML = '<p>No content structure.</p>'; return; } let topLevelSelector, itemType, navLabel; const tagNameLower = firstLevelContent.tagName.toLowerCase(); if (tagNameLower === 'chapter') { navLabel = 'Chapter Sections'; topLevelSelector = ':scope > section[id]'; itemType = 'section'; } else if (tagNameLower === 'table_of_authorities') { navLabel = 'Table of Authorities Groups'; topLevelSelector = ':scope > authority_group[id]'; itemType = 'authority_group'; } else if (chapterContent.querySelector(':scope > section[id]')) { navLabel = 'Sections'; topLevelSelector = ':scope > section[id]'; itemType = 'section'; } else { sectionListContainer.innerHTML = '<p class="usa-prose">No side navigation available.</p>'; return; } nav.setAttribute('aria-label', navLabel); const rootElement = (tagNameLower === 'chapter' || tagNameLower === 'table_of_authorities') ? firstLevelContent : chapterContent; const topLevelItems = rootElement.querySelectorAll(topLevelSelector); if (topLevelItems.length === 0) { sectionListContainer.innerHTML = '<p class="usa-prose">No navigable items found.</p>'; return; } topLevelItems.forEach(item => buildNavItem(item, itemType, ul, 0)); nav.appendChild(ul); sectionListContainer.appendChild(nav); addSmoothScrollListeners(nav); }
    function buildNavItem(element, type, parentUl, level) { const id = element.id; if (!id) return; let titleElement = (type === 'authority_group') ? element.querySelector(':scope > title') : element.querySelector(`:scope > ${type}_title`); let displayTitle = `[${id}]`; let numberText = ''; let titleOnlyText = ''; if (titleElement) { const titleClone = titleElement.cloneNode(true); const numElement = titleClone.querySelector('num'); if (numElement) { numberText = numElement.textContent.trim(); numElement.remove(); } titleOnlyText = titleClone.textContent.trim(); if (numberText && titleOnlyText) { displayTitle = `${numberText} ${titleOnlyText}`; } else if (titleOnlyText) { displayTitle = titleElement.textContent.trim(); } else if (numberText) { displayTitle = numberText; } } else { const typeDisplay = type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()); const fallbackText = element.textContent.trim().substring(0, 50) + (element.textContent.length > 50 ? '...' : ''); displayTitle = fallbackText || `${typeDisplay} [${id}]`; } const li = document.createElement('li'); li.className = 'usa-sidenav__item'; const a = document.createElement('a'); a.href = `#${id}`; a.textContent = displayTitle; li.appendChild(a); if (type === 'section' || type === 'subsection') { const children = element.querySelectorAll(':scope > subsection[id], :scope > provision[id]'); if (children.length > 0) { const subUl = document.createElement('ul'); subUl.className = 'usa-sidenav__sublist'; children.forEach(child => buildNavItem(child, child.tagName.toLowerCase(), subUl, level + 1)); if (subUl.hasChildNodes()) li.appendChild(subUl); } } parentUl.appendChild(li); }
    function addSmoothScrollListeners(navContainer) { navContainer.querySelectorAll('a[href^="#"]').forEach(link => { link.addEventListener('click', function(e) { e.preventDefault(); const targetId = this.getAttribute('href').substring(1); const targetElement = document.getElementById(targetId); if (targetElement) { scrollElementIntoView(targetElement, true, 'start'); updateSideNavCurrent(targetId); if (currentFilename) { const state = { filename: currentFilename, hash: targetId }; const title = document.title; const url = `/${currentFilename}#${targetId}`; try { history.replaceState(state, title, url); /* console.log("History replaceState (side nav click):", state, title, url); */ } catch (err) { console.warn("History API error on replaceState.", err); } } } else { console.warn(`Target element ID "${targetId}" not found for side nav link.`); } }); }); }
    function clearHighlighting() { if (typeof Mark === 'undefined') return; if (highlightMarkInstance) highlightMarkInstance.unmark(); else if (chapterContent) new Mark(chapterContent).unmark(); chapterContent?.querySelectorAll('span.highlight').forEach(el => { if (el.innerHTML === '') el.remove(); else if(el.parentNode) el.outerHTML = el.innerHTML; }); }
    function performSearch(searchTerm) { clearHighlighting(); if (!searchTerm || searchTerm.trim() === '' || typeof Mark === 'undefined') return; highlightMarkInstance = new Mark(chapterContent); highlightMarkInstance.mark(searchTerm.trim(), { element: "span", className: "highlight", separateWordSearch: false, accuracy: "partially", ignoreJoiners: true, exclude: [ ".usa-sidenav *", "nav *", "script", "style", "noscript", ".usa-identifier *", "*[aria-hidden='true']"], done: (counter) => { console.log(`${counter} matches found`); if (counter > 0) { const firstMatch = chapterContent.querySelector('.highlight'); if (firstMatch) scrollElementIntoView(firstMatch, false, 'nearest'); } }, filter: (textNode) => { const parent = textNode.parentNode; if (!parent || parent.closest('script, style, noscript, nav, .usa-sidenav, .usa-identifier, [aria-hidden="true"]')) return false; return true; } }); }

	// --- Initialization and Event Listeners ---

	// Populate Chapters menu (No changes needed)
	if (chapterListDropdown) {
        console.log(`Starting population of #${chapterListDropdown.id}...`);
		chapters.forEach((chapter, index) => {
			const listItem = document.createElement('li'); listItem.classList.add('usa-nav__submenu-item');
			const link = document.createElement('a'); link.href = `/${chapter.filename}`; link.textContent = `${chapter.number}${chapter.number ? ': ' : ''}${chapter.title}`; link.dataset.filename = chapter.filename;
			link.addEventListener('click', (e) => {
				e.preventDefault(); const filename = link.dataset.filename;
				if (filename !== currentFilename) {
					loadContent(filename, { updateHistory: true, isInitialLoad: false });
				} else { chapterContent?.scrollTo({ top: 0, behavior: 'smooth' }); updateSideNavCurrent(null); }
				if (uswdsNav && uswdsNav.classList.contains('is-visible')) { uswdsOverlay?.classList.remove('is-visible'); uswdsNav.classList.remove('is-visible'); if (uswdsMenuButton) uswdsMenuButton.setAttribute('aria-expanded', 'false'); }
			}); listItem.appendChild(link); chapterListDropdown.appendChild(listItem);
		});
        console.log(`✅ Finished population. Added ${chapters.length} items to #${chapterListDropdown.id}.`);
	} else {
		console.error(`❌ CRITICAL ERROR: Could not find element with ID 'basic-nav-section-one' to populate Chapters menu. Check HTML id attribute.`);
	}

	// Home link listener (No changes needed)
	if (homeLink) { homeLink.addEventListener('click', (e) => { e.preventDefault(); if (chapters.length > 0) { if (chapters[0].filename !== currentFilename) { loadContent(chapters[0].filename, { updateHistory: true, isInitialLoad: false }); } else { chapterContent?.scrollTo({ top: 0, behavior: 'smooth' }); updateSideNavCurrent(null); } } }); }

	// Content link listener (No changes needed)
	if (chapterContent) { chapterContent.addEventListener('click', (event) => { const link = event.target.closest('a'); if (!link || !link.href) { return; } let targetUrl; try { targetUrl = new URL(link.href, window.location.origin); } catch (e) { console.warn("Could not parse link href:", link.href, e); return; } if (targetUrl.origin !== window.location.origin) { return; } const pathname = targetUrl.pathname; const hash = targetUrl.hash; const potentialFilename = pathname.split('/').pop(); const isChapterLink = chapters.some(chapter => chapter.filename === potentialFilename); if (isChapterLink) { console.log(`Intercepted chapter link: ${potentialFilename}, hash: ${hash}`); event.preventDefault(); const targetHash = hash ? hash.substring(1) : null; loadContent(potentialFilename, { updateHistory: true, targetHash: targetHash, isInitialLoad: false }); } }); }

	// Initial load logic (No changes needed)
	function handleInitialLoad() {
	    let path = location.pathname.substring(1).replace(/\/$/, ''); let filenameFromPath = path.split('/').pop();
	    const matchedChapter = chapters.find(c => c.filename === filenameFromPath);
	    let initialFilename = (path === '' || !matchedChapter) ? (chapters.length > 0 ? chapters[0].filename : null) : matchedChapter.filename;
	    if (!initialFilename) { console.error("No initial chapter content found to load."); if(chapterContent) chapterContent.innerHTML = "<p class='usa-alert usa-alert--error'>Content not found.</p>"; updateTopNavCurrent(null); return; }
        const initialHash = location.hash.substring(1);
	    console.log(`Initial load request: path='${path}', filename='${initialFilename}', hash='${initialHash}'`);
	    loadContent(initialFilename, { updateHistory: true, isInitialLoad: true, targetHash: initialHash });
	}

	// Popstate listener (No changes needed)
	window.addEventListener('popstate', (event) => { console.log("Popstate event:", event.state, location.pathname, location.hash); let filenameToLoad = null; let hashToLoad = location.hash.substring(1); if (event.state && event.state.filename) { filenameToLoad = event.state.filename; hashToLoad = event.state.hash || hashToLoad; } else { let path = location.pathname.substring(1).replace(/\/$/, ''); let filenameFromPath = path.split('/').pop(); const matchedChapter = chapters.find(c => c.filename === filenameFromPath); if (matchedChapter) { filenameToLoad = matchedChapter.filename; } else if ((path === '' || path === '/') && chapters.length > 0) { filenameToLoad = chapters[0].filename; } } if (filenameToLoad) { console.log(`Popstate loading: filename='${filenameToLoad}', hash='${hashToLoad}'`); loadContent(filenameToLoad, { updateHistory: false, forceReload: true, targetHash: hashToLoad, isInitialLoad: false }); } else { console.warn("Popstate: Could not determine content to load from state or URL."); if (chapters.length > 0) { loadContent(chapters[0].filename, { updateHistory: false, forceReload: true, targetHash: null, isInitialLoad: false }); } else { updateTopNavCurrent(null); } } });

	// Search listener (No changes needed)
	if (headerSearchForm) { headerSearchForm.addEventListener('submit', (e) => { e.preventDefault(); performSearch(headerSearchInput.value); }); headerSearchInput.addEventListener('input', () => { if (headerSearchInput.value.trim() === '') clearHighlighting(); }); headerSearchInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') performSearch(headerSearchInput.value); }); }
	// Mobile menu toggles (No changes needed)
	if (uswdsMenuButton && uswdsNavCloseButton && uswdsOverlay && uswdsNav) { uswdsMenuButton.addEventListener('click', () => { const isExpanded = uswdsNav.classList.toggle('is-visible'); uswdsOverlay.classList.toggle('is-visible', isExpanded); uswdsMenuButton.setAttribute('aria-expanded', isExpanded); }); const closeMenu = () => { uswdsOverlay.classList.remove('is-visible'); uswdsNav.classList.remove('is-visible'); uswdsMenuButton.setAttribute('aria-expanded', 'false'); }; uswdsNavCloseButton.addEventListener('click', closeMenu); uswdsOverlay.addEventListener('click', closeMenu); }

	// --- Start the application ---
	console.log("Running initial load...");
	handleInitialLoad();
    console.log("Initialization complete.");

}); // End DOMContentLoaded