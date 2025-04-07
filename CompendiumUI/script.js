document.addEventListener('DOMContentLoaded', () => {

	// --- Element Selection (remains the same) ---
	const chapterContent = document.getElementById('chapter-content');
	const sectionListContainer = document.getElementById('section-list');
	const headerSearchForm = document.querySelector('.usa-header .usa-search');
	const headerSearchInput = document.getElementById('search-field');
	const chapterListDropdown = document.querySelector('#basic-nav-section-one');
	const uswdsMenuButton = document.querySelector('.usa-header .usa-menu-btn');
	const uswdsNavCloseButton = document.querySelector('.usa-header .usa-nav__close');
	const uswdsOverlay = document.querySelector('.usa-overlay');
	const uswdsNav = document.querySelector('.usa-header .usa-nav');
	const homeLink = document.querySelector('.usa-logo a');
    
	// --- Data (remains the same) ---
	const chapters = [
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
    
	// --- State Variables (remains the same) ---
	let highlightMarkInstance;
	let currentFilename = null;
    
	// --- Functions ---
    
	// scrollElementIntoView (remains the same)
	function scrollElementIntoView(targetElement, highlight = false, blockOption = 'start') {
	    if (!targetElement) return false;
	    targetElement.scrollIntoView({ behavior: 'smooth', block: blockOption });
	    if (highlight) { targetElement.classList.add('temp-highlight'); setTimeout(() => targetElement.classList.remove('temp-highlight'), 1500); }
	    return true;
	}
    
	// updateSideNavCurrent (remains the same)
	function updateSideNavCurrent(targetId) {
	    if (!sectionListContainer) return;
	    sectionListContainer.querySelectorAll('.usa-sidenav__item.usa-current, .usa-sidenav__item a.usa-current').forEach(el => el.classList.remove('usa-current'));
	    if (targetId) {
		const newActiveLink = sectionListContainer.querySelector(`a[href="#${targetId}"]`);
		if (newActiveLink) {
		    newActiveLink.classList.add('usa-current'); const parentLi = newActiveLink.closest('.usa-sidenav__item'); if (parentLi) parentLi.classList.add('usa-current');
		    scrollElementIntoView(parentLi || newActiveLink, false, 'nearest'); return true;
		}
	    } return false;
	}
    
	// updateTopNavCurrent (remains the same)
	function updateTopNavCurrent(filename) {
	    if (!chapterListDropdown) return; let foundActive = false; chapterListDropdown.querySelectorAll('a').forEach(el => { if (el.dataset.filename === filename) { el.classList.add('usa-current'); el.setAttribute('aria-current', 'page'); foundActive = true; } else { el.classList.remove('usa-current'); el.removeAttribute('aria-current'); } }); const accordionButton = chapterListDropdown.previousElementSibling; // ... accordion logic ...
	}
    
	// loadContent (remains the same)
	async function loadContent(filename, options = {}) {
	    const { updateHistory = true, isInitialLoad = false, targetHash = null } = options;
	    if (!isInitialLoad && filename === currentFilename && !options.forceReload) { console.log(`Content ${filename} already loaded.`); if(targetHash) { const targetElement = document.getElementById(targetHash); if (targetElement) { scrollElementIntoView(targetElement, true, 'start'); updateSideNavCurrent(targetHash); } } return; }
	    console.log(`Loading content: ${filename}, updateHistory: ${updateHistory}, isInitialLoad: ${isInitialLoad}`);
	    clearHighlighting(); headerSearchInput.value = ''; chapterContent.innerHTML = `<p class="usa-prose">Loading ${filename}...</p>`; sectionListContainer.innerHTML = '';
	    try {
		const fetchPath = filename; const response = await fetch(fetchPath); if (!response.ok) throw new Error(`HTTP error! Status: ${response.status} for ${fetchPath}`); const html = await response.text();
		const parser = new DOMParser(); const doc = parser.parseFromString(html, 'text/html'); const specificRoot = doc.querySelector('chapter, table_of_authorities'); const contentElement = specificRoot || doc.body; chapterContent.innerHTML = contentElement ? contentElement.innerHTML : '<p class="usa-alert usa-alert--error">Could not parse main content.</p>';
		currentFilename = filename; document.title = `Compendium Viewer - ${findChapterTitle(filename) || filename}`;
		generateHierarchicalNavigation();
		if (updateHistory) { const state = { filename: filename }; const title = document.title; let url = `/${filename}`; const currentHash = targetHash ? `#${targetHash}` : (isInitialLoad ? location.hash : ''); url += currentHash; if (isInitialLoad) { history.replaceState(state, title, url); } else { history.pushState(state, title, url); } console.log(`History ${isInitialLoad ? 'replaceState' : 'pushState'}:`, state, title, url); if(!currentHash && !isInitialLoad) { if (chapterContent) chapterContent.scrollTo({ top: 0, behavior: 'smooth' }); } }
		updateTopNavCurrent(filename);
		const hashToScroll = targetHash || location.hash.substring(1);
		if (hashToScroll) { setTimeout(() => { const targetElement = document.getElementById(hashToScroll); if(targetElement) scrollElementIntoView(targetElement, true, 'start'); updateSideNavCurrent(hashToScroll); }, 150); }
		else if (!isInitialLoad) { updateSideNavCurrent(null); }
	    } catch (error) { console.error("Could not load content:", error); chapterContent.innerHTML = `<p class="usa-alert usa-alert--error">Failed to load content: ${error.message}.</p>`; sectionListContainer.innerHTML = ''; currentFilename = null; document.title = "Compendium Viewer - Error"; }
	}
    
	// findChapterTitle (remains the same)
	function findChapterTitle(filename) { const chapter = chapters.find(c => c.filename === filename); return chapter ? `${chapter.number}${chapter.number ? ': ' : ''}${chapter.title}` : null; }
    
	// generateHierarchicalNavigation (remains the same)
	function generateHierarchicalNavigation() {
	    sectionListContainer.innerHTML = ''; const nav = document.createElement('nav'); const ul = document.createElement('ul'); ul.className = 'usa-sidenav'; const firstLevelContent = chapterContent.firstElementChild; if (!firstLevelContent) { sectionListContainer.innerHTML = '<p>No content structure.</p>'; return; }
	    let topLevelSelector, itemType, navLabel; const tagNameLower = firstLevelContent.tagName.toLowerCase();
	    if (tagNameLower === 'chapter') { navLabel = 'Chapter Sections'; topLevelSelector = ':scope > section[id]'; itemType = 'section'; }
	    else if (tagNameLower === 'table_of_authorities') { navLabel = 'Table of Authorities Groups'; topLevelSelector = ':scope > authority_group[id]'; itemType = 'authority_group'; }
	    else if (chapterContent.querySelector(':scope > section[id]')) { navLabel = 'Sections'; topLevelSelector = ':scope > section[id]'; itemType = 'section'; }
	    else { sectionListContainer.innerHTML = '<p class="usa-prose">No side navigation available.</p>'; return; }
	    nav.setAttribute('aria-label', navLabel);
	    const rootElement = (tagNameLower === 'chapter' || tagNameLower === 'table_of_authorities') ? firstLevelContent : chapterContent; const topLevelItems = rootElement.querySelectorAll(topLevelSelector);
	    if (topLevelItems.length === 0) { sectionListContainer.innerHTML = '<p class="usa-prose">No navigable items found.</p>'; return; }
	    topLevelItems.forEach(item => buildNavItem(item, itemType, ul, 0)); nav.appendChild(ul); sectionListContainer.appendChild(nav); addSmoothScrollListeners(nav);
	}
    
	    // *** MODIFIED buildNavItem to include number ***
	    function buildNavItem(element, type, parentUl, level) {
		const id = element.id; if (!id) return;
    
		let titleElement = (type === 'authority_group')
		? element.querySelector(':scope > title') // TOA uses <title>
		: element.querySelector(`:scope > ${type}_title`); // Chapters use <section_title> etc.
    
		let displayTitle = `[${id}]`; // Default fallback
	    let numberText = '';
	    let titleOnlyText = '';
    
		if (titleElement) {
		    const titleClone = titleElement.cloneNode(true);
    
		// Extract number from <num> tag if present
		const numElement = titleClone.querySelector('num');
		if (numElement) {
		    numberText = numElement.textContent.trim();
		    // Remove the num element from the clone to get only the title text
		    numElement.remove();
		}
    
		// Get the remaining text content as the title
		titleOnlyText = titleClone.textContent.trim();
    
		// Construct the display title
		if (numberText && titleOnlyText) {
		    displayTitle = `${numberText} ${titleOnlyText}`;
		} else if (titleOnlyText) {
		    // If no number was found, use the full text content of the original title element
		    // This handles cases where the number might be part of the text but not in <num>
		     displayTitle = titleElement.textContent.trim(); // Use original full text
		} else if (numberText) {
		     displayTitle = numberText; // Only number found
		}
		// If both are empty, fallback [id] remains
		} else {
		// Fallback if no title element found at all
		const typeDisplay = type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
		const fallbackText = element.textContent.trim().substring(0, 50) + (element.textContent.length > 50 ? '...' : '');
		displayTitle = fallbackText || `${typeDisplay} [${id}]`; // Use element text or type/id
		}
    
		const li = document.createElement('li'); li.className = 'usa-sidenav__item';
		const a = document.createElement('a');
	    a.href = `#${id}`;
	    a.textContent = displayTitle; // Use the constructed title with number
		li.appendChild(a);
    
	    // Recursion logic remains the same
		if (type === 'section' || type === 'subsection') {
		    const children = element.querySelectorAll(':scope > subsection[id], :scope > provision[id]');
		    if (children.length > 0) {
			const subUl = document.createElement('ul'); subUl.className = 'usa-sidenav__sublist';
			children.forEach(child => buildNavItem(child, child.tagName.toLowerCase(), subUl, level + 1));
			if (subUl.hasChildNodes()) li.appendChild(subUl);
		    }
		}
		parentUl.appendChild(li);
	    }
    
	// addSmoothScrollListeners (remains the same)
	function addSmoothScrollListeners(navContainer) {
	    navContainer.querySelectorAll('a[href^="#"]').forEach(link => {
		link.addEventListener('click', function(e) {
		    e.preventDefault(); const targetId = this.getAttribute('href').substring(1); const targetElement = document.getElementById(targetId);
		    if (targetElement) { scrollElementIntoView(targetElement, true, 'start'); updateSideNavCurrent(targetId); if (currentFilename) { const state = { filename: currentFilename, hash: targetId }; const title = document.title; const url = `/${currentFilename}#${targetId}`; try { if (window.location.pathname + window.location.hash !== url) history.replaceState(state, title, url); } catch (err) { console.warn("History API error on replaceState.", err); } } }
		    else { console.warn(`Target element ID "${targetId}" not found.`); }
		});
	    });
	}
    
	    // clearHighlighting (remains the same)
	function clearHighlighting() { if (typeof Mark === 'undefined') return; if (highlightMarkInstance) highlightMarkInstance.unmark(); else new Mark(chapterContent).unmark(); chapterContent.querySelectorAll('span.highlight').forEach(el => { if (el.innerHTML === '') el.remove(); else if(el.parentNode) el.outerHTML = el.innerHTML; }); }
	    // performSearch (remains the same)
	function performSearch(searchTerm) { clearHighlighting(); if (!searchTerm || searchTerm.trim() === '' || typeof Mark === 'undefined') return; highlightMarkInstance = new Mark(chapterContent); highlightMarkInstance.mark(searchTerm.trim(), { element: "span", className: "highlight", separateWordSearch: false, accuracy: "partially", ignoreJoiners: true, exclude: [ ".usa-sidenav *", "nav *", "script", "style", "noscript", ".usa-identifier *", "*[aria-hidden='true']"], done: (counter) => { console.log(`${counter} matches found`); if (counter > 0) { const firstMatch = chapterContent.querySelector('.highlight'); if (firstMatch) scrollElementIntoView(firstMatch, false, 'nearest'); } }, filter: (textNode) => { const parent = textNode.parentNode; if (!parent || parent.closest('script, style, noscript, nav, .usa-sidenav, .usa-identifier, [aria-hidden="true"]')) return false; return true; } }); }
    
	// --- Initialization and Event Listeners (remain the same) ---
    
	// Populate Chapters menu
	if (chapterListDropdown) { chapters.forEach((chapter) => { const listItem = document.createElement('li'); listItem.classList.add('usa-nav__submenu-item'); const link = document.createElement('a'); link.href = `/${chapter.filename}`; link.textContent = `${chapter.number}${chapter.number ? ': ' : ''}${chapter.title}`; link.dataset.filename = chapter.filename; link.addEventListener('click', (e) => { e.preventDefault(); const filename = link.dataset.filename; if (filename !== currentFilename) loadContent(filename, { updateHistory: true }); else chapterContent.scrollTo({ top: 0, behavior: 'smooth' }); if (uswdsNav && uswdsNav.classList.contains('is-visible')) { uswdsOverlay?.classList.remove('is-visible'); uswdsNav.classList.remove('is-visible'); uswdsMenuButton?.setAttribute('aria-expanded', 'false'); } }); listItem.appendChild(link); chapterListDropdown.appendChild(listItem); }); }
	// Home link listener
	if (homeLink) { homeLink.addEventListener('click', (e) => { e.preventDefault(); if (chapters.length > 0) { if (chapters[0].filename !== currentFilename) loadContent(chapters[0].filename, { updateHistory: true }); else chapterContent.scrollTo({ top: 0, behavior: 'smooth' }); } }); }
	// Initial load logic
	function handleInitialLoad() { let path = location.pathname.substring(1).replace(/\/$/, ''); const matchedChapter = chapters.find(c => c.filename === path); let initialFilename = (path === '' || !matchedChapter) ? (chapters.length > 0 ? chapters[0].filename : null) : matchedChapter.filename; if (!initialFilename) { console.error("No content found."); chapterContent.innerHTML = "<p class='usa-alert usa-alert--error'>Content not found.</p>"; return; } loadContent(initialFilename, { updateHistory: true, isInitialLoad: true, targetHash: location.hash.substring(1) }); }
	// Popstate listener
	window.addEventListener('popstate', (event) => { let filenameToLoad = null; let hashToLoad = location.hash.substring(1); if (event.state && event.state.filename) filenameToLoad = event.state.filename; else { let path = location.pathname.substring(1).replace(/\/$/, ''); const matchedChapter = chapters.find(c => c.filename === path); if (matchedChapter) filenameToLoad = matchedChapter.filename; else if (path === '' && chapters.length > 0) filenameToLoad = chapters[0].filename; } if (filenameToLoad) loadContent(filenameToLoad, { updateHistory: false, forceReload: true, targetHash: hashToLoad }); else console.warn("Popstate: Could not determine content."); });
	// Search listener
	if (headerSearchForm) { headerSearchForm.addEventListener('submit', (e) => { e.preventDefault(); performSearch(headerSearchInput.value); }); headerSearchInput.addEventListener('input', () => { if (headerSearchInput.value.trim() === '') clearHighlighting(); }); headerSearchInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') performSearch(headerSearchInput.value); }); }
	// Mobile menu toggles
	    if (uswdsMenuButton && uswdsNavCloseButton && uswdsOverlay && uswdsNav) { uswdsMenuButton.addEventListener('click', () => { const isExpanded = uswdsNav.classList.toggle('is-visible'); uswdsOverlay.classList.toggle('is-visible', isExpanded); uswdsMenuButton.setAttribute('aria-expanded', isExpanded); }); const closeMenu = () => { uswdsOverlay.classList.remove('is-visible'); uswdsNav.classList.remove('is-visible'); uswdsMenuButton.setAttribute('aria-expanded', 'false'); }; uswdsNavCloseButton.addEventListener('click', closeMenu); uswdsOverlay.addEventListener('click', closeMenu); }
    
	// --- Start the application ---
	handleInitialLoad();
    
    }); // End DOMContentLoaded