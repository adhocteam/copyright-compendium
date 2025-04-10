// --- START OF FILE script.js ---

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

    // --- Initial Checks ---
    // Check for elements critical for basic functionality
    if (!chapterContent) console.error("CRITICAL: #chapter-content not found.");
    if (!chapterListDropdown) console.error("CRITICAL: #basic-nav-section-one not found. Chapter dropdown cannot be populated.");
    if (!homeLink) console.warn("WARN: Home link (.usa-logo a) not found.");

    // Check for elements related to the sidenav (less critical for initial load)
    if (!sectionListContainer) console.warn("WARN: #section-list not found. Sidenav cannot be populated.");
    if (!sideNavElement) console.warn("WARN: .sidenav element not found. Sidenav hiding/showing might not work.");


	// --- Data ---
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

	// --- State Variables ---
	let highlightMarkInstance;
	let currentFilename = null;

	// --- Functions ---

	function scrollElementIntoView(targetElement, highlight = false, blockOption = 'start') {
        if (!targetElement) return false;
        let parent = targetElement.parentElement;
        while (parent) { if (parent.tagName === 'DETAILS' && !parent.open) { parent.open = true; } parent = parent.parentElement; }
        setTimeout(() => {
            targetElement.scrollIntoView({ behavior: 'smooth', block: blockOption });
            if (highlight) {
                targetElement.classList.add('temp-highlight');
                setTimeout(() => targetElement.classList.remove('temp-highlight'), 1500);
            }
        }, 50);
        return true;
    }

	function updateSideNavCurrent(targetId) {
        if (!sectionListContainer) return;
        sectionListContainer.querySelectorAll('.usa-sidenav__item.usa-current, .usa-sidenav__item a.usa-current').forEach(el => el.classList.remove('usa-current'));
        if (targetId) {
            const newActiveLink = sectionListContainer.querySelector(`a[href="#${targetId}"]`);
            if (newActiveLink) {
                newActiveLink.classList.add('usa-current');
                const parentLi = newActiveLink.closest('.usa-sidenav__item');
                if (parentLi) parentLi.classList.add('usa-current');
                const isGlossaryNav = sectionListContainer.querySelector('nav[aria-label="Glossary A-Z Navigation"]');
                if (!isGlossaryNav && sideNavElement) { // Only scroll hierarchical nav
                    scrollElementIntoView(parentLi || newActiveLink, false, 'nearest');
                }
                return true;
            }
        }
        return false;
    }

	function updateTopNavCurrent(filename) {
	    if (!chapterListDropdown) {
            // console.warn("updateTopNavCurrent called but chapterListDropdown element not found."); // Already logged
            return;
        }
	    let foundActiveLink = false;
        if (chapterListDropdown.hasChildNodes()) {
            chapterListDropdown.querySelectorAll('a').forEach(el => {
                if (el.dataset.filename === filename) {
                    el.classList.add('usa-current');
                    el.setAttribute('aria-current', 'page');
                    foundActiveLink = true;
                } else {
                    el.classList.remove('usa-current');
                    el.removeAttribute('aria-current');
                }
            });
        }
	    const accordionButton = document.querySelector(`button.usa-accordion__button[aria-controls="${chapterListDropdown.id}"]`);
	    if (accordionButton) {
            accordionButton.setAttribute('aria-expanded', 'false');
            chapterListDropdown.setAttribute('hidden', '');
	    } else {
            console.warn(`Could not find accordion button controlling #${chapterListDropdown.id} in updateTopNavCurrent`);
        }
	}


	// --- loadContent ---
	async function loadContent(filename, options = {}) {
        const { updateHistory = true, isInitialLoad = false, targetHash = null, forceReload = false } = options;

        // --- Same-page hash scrolling logic ---
        if (!forceReload && filename === currentFilename && !isInitialLoad) {
            console.log(`Content ${filename} already loaded.`);
			if(targetHash) {
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

	    console.log(`Loading content: ${filename}, updateHistory: ${updateHistory}, isInitialLoad: ${isInitialLoad}, targetHash: ${targetHash}`);
	    clearHighlighting();
	    if (headerSearchInput) headerSearchInput.value = '';

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
            const fetchPath = filename; // Assuming files are in the same directory or relative paths work
            console.log("Fetching:", fetchPath);
            const response = await fetch(fetchPath);
            console.log("Fetch response status:", response.status);
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
			document.title = `Compendium Viewer - ${chapterTitle || filename}`;

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
                    if(targetElement) {
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

	    } catch (error) {
            console.error("Error during loadContent:", error);
            if (chapterContent) { // Check if element exists before modifying
                 chapterContent.innerHTML = `<p class="usa-alert usa-alert--error">Failed to load content: ${error.message}. Check console for details.</p>`;
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
    function findChapterTitle(filename) {
        const chapter = chapters.find(c => c.filename === filename);
        return chapter ? `${chapter.number}${chapter.number ? ': ' : ''}${chapter.title}` : null;
    }

    // --- Navigation Dispatcher Function ---
    function generateNavigation(filename) {
        // Determine if sidenav should be shown based on the result of generator functions
        let shouldShowSidenav = false;

        if (filename === 'glossary.html') {
            console.log("Attempting to generate Glossary A-Z Navigation");
            shouldShowSidenav = generateGlossaryNavigation(); // Function returns true if content was generated
        } else {
            console.log("Attempting to generate Hierarchical Navigation for:", filename);
            shouldShowSidenav = generateHierarchicalNavigation(); // Function returns true if content was generated
        }

        // Apply visibility class based on the result
        if (sideNavElement) {
            if (shouldShowSidenav) {
                sideNavElement.classList.remove('hidden');
                console.log("Sidenav should be visible.");
            } else {
                sideNavElement.classList.add('hidden');
                 console.log("Sidenav should be hidden.");
            }
        } else {
            // Warning logged at top if element is missing
        }
    }

    // --- Glossary A-Z Navigation Function ---
    // Returns true if navigation was successfully generated and added, false otherwise.
    function generateGlossaryNavigation() {
        // Check required elements before proceeding
        if (!sectionListContainer) {
             console.error("generateGlossaryNavigation: sectionListContainer not found. Cannot generate nav.");
             return false; // Cannot generate
        }
         if (!chapterContent) {
            console.error("generateGlossaryNavigation: chapterContent not found. Cannot find terms.");
            return false; // Cannot generate
        }

        // Clear previous content first
        sectionListContainer.innerHTML = '';

        const nav = document.createElement('nav');
        nav.setAttribute('aria-label', 'Glossary A-Z Navigation');
        const ul = document.createElement('ul');
        ul.className = 'usa-sidenav';

        const glossaryTerms = chapterContent.querySelectorAll('dt[id]');

        if (!glossaryTerms || glossaryTerms.length === 0) {
            console.warn("generateGlossaryNavigation: No 'dt[id]' elements found in content.");
            return false; // Nothing to generate
        }

        const firstTermPerLetter = {};
        glossaryTerms.forEach(dt => {
            const termText = dt.textContent.trim();
            if (termText) {
                const firstChar = termText.charAt(0).toUpperCase();
                if (/^[A-Z]$/.test(firstChar) && !firstTermPerLetter[firstChar]) {
                    firstTermPerLetter[firstChar] = dt.id;
                }
            }
        });

        let foundLinks = false; // Track if any actual links are created
        for (let i = 65; i <= 90; i++) { // ASCII codes for A-Z
            const letter = String.fromCharCode(i);
            const li = document.createElement('li');
            li.className = 'usa-sidenav__item';
            const a = document.createElement('a');
            a.textContent = letter;

            if (firstTermPerLetter[letter]) {
                a.href = `#${firstTermPerLetter[letter]}`;
                a.addEventListener('click', handleGlossaryLinkClick);
                foundLinks = true; // Mark that we have at least one active link
            } else {
                a.href = '#'; // Make it a non-functional link
                a.setAttribute('aria-disabled', 'true'); // Indicate it's disabled
                a.style.color = 'grey'; // Basic disabled style
                a.style.pointerEvents = 'none'; // Prevent click events
            }
            li.appendChild(a);
            ul.appendChild(li);
        }

        if (foundLinks) { // Only add nav if we actually have links
            nav.appendChild(ul);
            sectionListContainer.appendChild(nav);
            console.log("Glossary navigation generated and added.");
            return true; // Success - content was generated
        } else {
             console.warn("generateGlossaryNavigation: Terms found, but no terms started with A-Z.");
             return false; // Technically generated, but no useful links added
        }
    }

    // --- Event Handler for Glossary Links ---
    function handleGlossaryLinkClick(e) {
        e.preventDefault();
        const targetId = this.getAttribute('href').substring(1);
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


    // --- Hierarchical Navigation Logic ---
    // Returns true if navigation was successfully generated and added, false otherwise.
    function generateHierarchicalNavigation() {
        // Check required elements before proceeding
        if (!sectionListContainer) {
             console.error("generateHierarchicalNavigation: sectionListContainer not found. Cannot generate nav.");
             return false;
        }
         if (!chapterContent) {
            console.error("generateHierarchicalNavigation: chapterContent not found. Cannot find structure.");
            return false;
        }

        // Clear previous content first
        sectionListContainer.innerHTML = '';

        const nav = document.createElement('nav');
        const ul = document.createElement('ul');
        ul.className = 'usa-sidenav';

        const firstLevelContent = chapterContent.firstElementChild;
        // Check for any possibility of navigation
        if (!firstLevelContent) {
            console.warn("generateHierarchicalNavigation: No first level content element found.");
            return false; // Cannot determine structure
        }

        let topLevelSelector, itemType, navLabel;
        const tagNameLower = firstLevelContent.tagName.toLowerCase();

        // Determine structure based on top-level element or presence of sections
        if (tagNameLower === 'chapter') {
            navLabel = 'Chapter Sections'; topLevelSelector = ':scope > section[id]'; itemType = 'section';
        } else if (tagNameLower === 'table_of_authorities') {
            navLabel = 'Table of Authorities Groups'; topLevelSelector = ':scope > authority_group[id]'; itemType = 'authority_group';
        } else if (chapterContent.querySelector(':scope > section[id]')) {
             // Fallback if no specific root, but sections exist directly under content
            navLabel = 'Sections'; topLevelSelector = ':scope > section[id]'; itemType = 'section';
        } else {
            console.warn("generateHierarchicalNavigation: No known navigable structure type detected.");
            return false; // Unknown structure
        }

        nav.setAttribute('aria-label', navLabel);
        // Use the specific root element if found, otherwise the main content container
        const rootElement = (tagNameLower === 'chapter' || tagNameLower === 'table_of_authorities') ? firstLevelContent : chapterContent;
        const topLevelItems = rootElement.querySelectorAll(topLevelSelector);

        // Check if any top-level items were found
        if (topLevelItems.length === 0) {
            console.warn(`generateHierarchicalNavigation: Structure type '${itemType}' identified, but no items matching '${topLevelSelector}' found.`);
            return false; // Structure type found, but no items
        }

        // Build the navigation items
        topLevelItems.forEach(item => buildNavItem(item, itemType, ul, 0));

        // Final check: Only add if items were actually added to the list
        if (ul.hasChildNodes()) {
            nav.appendChild(ul);
            sectionListContainer.appendChild(nav);
            addSmoothScrollListeners(nav);
            console.log("Hierarchical navigation generated and added.");
            return true; // Success - content generated
        } else {
            console.warn("generateHierarchicalNavigation: Top-level items found, but none resulted in list items (e.g., missing IDs?).");
            return false; // Items found, but failed to generate list
        }
    }

    function buildNavItem(element, type, parentUl, level) {
        const id = element.id;
        if (!id) return; // Skip elements without IDs

        let titleElement = (type === 'authority_group')
            ? element.querySelector(':scope > title')
            : element.querySelector(`:scope > ${type}_title`);

        let displayTitle = `[${id}]`; // Fallback display
        let numberText = '';
        let titleOnlyText = '';

        if (titleElement) {
            const titleClone = titleElement.cloneNode(true);
            const numElement = titleClone.querySelector('num');
            if (numElement) {
                numberText = numElement.textContent.trim();
                numElement.remove();
            }
            titleOnlyText = titleClone.textContent.trim();

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

        const a = document.createElement('a');
        a.href = `#${id}`;
        a.textContent = displayTitle;
        li.appendChild(a);

        // Recursively build sub-navigation for sections and subsections
        if (type === 'section' || type === 'subsection') {
            const children = element.querySelectorAll(':scope > subsection[id], :scope > provision[id]');
            if (children.length > 0) {
                const subUl = document.createElement('ul');
                subUl.className = 'usa-sidenav__sublist';
                children.forEach(child => buildNavItem(child, child.tagName.toLowerCase(), subUl, level + 1));
                if (subUl.hasChildNodes()) li.appendChild(subUl);
            }
        }
        parentUl.appendChild(li);
    }

    function addSmoothScrollListeners(navContainer) {
        // This listener is specifically for hierarchical nav items
        navContainer.querySelectorAll('a[href^="#"]').forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const targetId = this.getAttribute('href').substring(1);
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
    function clearHighlighting() {
        if (typeof Mark === 'undefined') return;
        if (highlightMarkInstance) {
            highlightMarkInstance.unmark();
        } else if (chapterContent) {
            try { // Add try/catch around Mark instantiation
                 new Mark(chapterContent).unmark();
            } catch(e) {
                 console.warn("Error clearing highlights with Mark.js:", e);
                 // Manual fallback cleanup
                 chapterContent?.querySelectorAll('span.highlight').forEach(el => {
                     if (el.parentNode) el.outerHTML = el.innerHTML;
                 });
            }
        }
        // Ensure manual cleanup runs even if Mark.js instance existed but failed
        chapterContent?.querySelectorAll('span.highlight').forEach(el => {
           if(el.parentNode) el.outerHTML = el.innerHTML;
        });
    }

    function performSearch(searchTerm) {
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
                done: (counter) => {
                    console.log(`${counter} matches found for "${searchTerm.trim()}"`);
                    if (counter > 0) {
                        const firstMatch = chapterContent.querySelector('.highlight');
                        if (firstMatch) {
                            scrollElementIntoView(firstMatch, false, 'nearest');
                        }
                    }
                },
                 filter: (textNode) => {
                     const parent = textNode.parentNode;
                     if (!parent || parent.closest('script, style, noscript, nav, .usa-sidenav, .usa-identifier, [aria-hidden="true"]')) {
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
					loadContent(filename, { updateHistory: true, isInitialLoad: false });
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
	} else {
		// Error already logged at the top
	}

	// Home link listener
	if (homeLink) {
        homeLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (chapters.length > 0) {
                const firstChapterFilename = chapters[0].filename;
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
            const link = event.target.closest('a');
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
                loadContent(potentialFilename, { updateHistory: true, targetHash: targetHash, isInitialLoad: false });
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
	function handleInitialLoad() {
        console.log("handleInitialLoad started.");
        // Determine initial file based on URL path
        const baseHref = document.querySelector('base')?.href || window.location.origin + '/';
        let path = window.location.href.substring(baseHref.length).replace(/^#/, '');
        path = path.split('#')[0]; // Remove hash part for filename matching
        path = path.replace(/\/$/, ''); // Remove trailing slash
	    let filenameFromPath = path.split('/').pop(); // Get last segment

        const matchedChapter = chapters.find(c => c.filename === filenameFromPath);
        let initialFilename = (path === '' || !matchedChapter)
            ? (chapters.length > 0 ? chapters[0].filename : null)
            : matchedChapter.filename;

	    if (!initialFilename) {
            console.error("handleInitialLoad: No initial chapter filename could be determined.");
            if(chapterContent) chapterContent.innerHTML = "<p class='usa-alert usa-alert--error'>No content specified.</p>";
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
                filenameToLoad = chapters[0].filename;
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
                loadContent(chapters[0].filename, { updateHistory: false, forceReload: true, targetHash: null, isInitialLoad: false });
            } else {
                if(chapterContent) chapterContent.innerHTML = "<p class='usa-alert usa-alert--error'>Cannot determine content to load.</p>";
                updateTopNavCurrent(null);
                if(sideNavElement) sideNavElement.classList.add('hidden');
            }
        }
    });

	// Search listener
	if (headerSearchForm && headerSearchInput) {
        headerSearchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            performSearch(headerSearchInput.value);
        });
        headerSearchInput.addEventListener('input', () => {
            if (headerSearchInput.value.trim() === '') {
                clearHighlighting();
            }
        });
         headerSearchInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                performSearch(headerSearchInput.value);
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


}); // End DOMContentLoaded

// --- END OF FILE script.js ---