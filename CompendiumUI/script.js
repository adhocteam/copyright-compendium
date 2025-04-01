document.addEventListener('DOMContentLoaded', () => {

	// --- Element Selection ---
	const chapterContent = document.getElementById('chapter-content');
	const sectionList = document.getElementById('section-list'); // Sidenav container
	const headerSearchForm = document.querySelector('.usa-header .usa-search');
	const headerSearchInput = document.getElementById('search-field');
	const chapterListDropdown = document.querySelector('#basic-nav-section-one');
	const uswdsMenuButton = document.querySelector('.usa-header .usa-menu-btn');
	const uswdsNavCloseButton = document.querySelector('.usa-header .usa-nav__close');
	const uswdsOverlay = document.querySelector('.usa-overlay');
	const uswdsNav = document.querySelector('.usa-header .usa-nav');

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
	    { number: "", title: "Table of Authorities", filename: "table-of-authorities.html" }
	];

	// --- State Variables ---
	let highlightMarkInstance;

	// --- Functions ---

	// Function to load a chapter or the Table of Authorities
	async function loadContent(filename) {
	    // Clear previous highlights and search state
	    clearHighlighting();
	    headerSearchInput.value = '';

	    chapterContent.innerHTML = `<p class="usa-prose">Loading...</p>`;
	    sectionList.innerHTML = ''; // Clear old side nav

	    try {
	        const response = await fetch(filename);
	        if (!response.ok) {
	            throw new Error(`HTTP error! Status: ${response.status}`);
	        }
	        const html = await response.text();

            // More robust check for full HTML vs fragment
            const trimmedHtml = html.trim();
            let contentToInject = '';
            if (trimmedHtml.toLowerCase().startsWith('<!doctype') || trimmedHtml.toLowerCase().startsWith('<html')) {
                console.warn(`Fetched content from ${filename} looks like a full HTML page. Extracting body or specific root content.`);
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                // Try to get specific root first, then fallback to body
                const specificRoot = doc.querySelector('chapter, table_of_authorities'); // Add expected roots
                if (specificRoot) {
                     contentToInject = specificRoot.outerHTML; // Use the root element and its content
                } else if (doc.body) {
                    contentToInject = doc.body.innerHTML;
                } else {
                     contentToInject = '<p class="usa-alert usa-alert--error">Could not parse main content from fetched file.</p>';
                }
            } else {
                contentToInject = html; // Assume it's a fragment
            }
	        chapterContent.innerHTML = contentToInject;

	        // Generate navigation based on the loaded content type
	        generateHierarchicalNavigation();

	    } catch (error) {
	        console.error("Could not load content:", error);
	        chapterContent.innerHTML = `<p class="usa-alert usa-alert--error">Failed to load content: ${error.message}. Please check the file path and ensure the server is running.</p>`;
	        sectionList.innerHTML = '';
	    }
	}

	// Function to generate hierarchical side navigation for Chapters OR Table of Authorities
	function generateHierarchicalNavigation() {
	    sectionList.innerHTML = ''; // Clear existing navigation
	    const nav = document.createElement('nav');
	    const ul = document.createElement('ul');
	    ul.className = 'usa-sidenav';

	    const firstLevelContent = chapterContent.firstElementChild; // Get the root element (chapter or table_of_authorities)

	    if (!firstLevelContent) {
	        sectionList.innerHTML = '<p>No content structure found.</p>';
	        return;
	    }

	    // Determine content type and query selectors
	    let topLevelSelector, itemType;
	    if (firstLevelContent.tagName.toLowerCase() === 'chapter') {
            nav.setAttribute('aria-label', 'Chapter Sections');
	        topLevelSelector = 'section[id]'; // Use ID for linking sections
            itemType = 'section';
	    } else if (firstLevelContent.tagName.toLowerCase() === 'table_of_authorities') {
            nav.setAttribute('aria-label', 'Table of Authorities Groups');
	        topLevelSelector = 'authority_group[id]'; // Use ID for linking authority groups
            itemType = 'authority_group';
	    } else {
	        sectionList.innerHTML = '<p>Unknown content type.</p>';
	        return;
	    }

	    const topLevelItems = chapterContent.querySelectorAll(topLevelSelector);

	    if (topLevelItems.length === 0) {
	        sectionList.innerHTML = '<p>No navigable items found.</p>';
	        return;
	    }

	    topLevelItems.forEach(item => {
	        buildNavItem(item, itemType, ul, 0); // Build nav tree starting with top-level items
	    });

	    nav.appendChild(ul);
	    sectionList.appendChild(nav);

	    addSmoothScrollListeners(sectionList);
	}

	// Recursive helper function to build nav items (handles sections, subsections, provisions, and authority_groups)
	function buildNavItem(element, type, parentUl, level) {
	    const id = element.id;
	    // Use ID for linking, no need for label attribute in this logic anymore
	    // const label = element.getAttribute('label') || id;

	    if (!id) {
	        console.warn(`Element of type ${type} is missing an ID. Skipping nav link.`);
	        return; // Cannot create a link without an ID
	    }

	    // Determine the correct title element based on type
	    let titleElement;
	    if (type === 'authority_group') {
	        titleElement = element.querySelector(':scope > title'); // TOA uses <title>
	    } else {
	        // For chapters: section_title, subsection_title, provision_title
	        titleElement = element.querySelector(`:scope > ${type}_title`);
	    }

	    let titleText;
	    if (titleElement) {
	        const titleClone = titleElement.cloneNode(true);
	        titleClone.querySelector('num')?.remove(); // Remove <num> if present
	        titleText = titleClone.textContent.trim() || `[${id}]`; // Use text or ID as fallback
	    } else {
	        // Fallback title if no specific title element found
            // Capitalize type for display
	        const typeDisplay = type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            titleText = `${typeDisplay} [${id}]`; // Use type and ID
	    }

	    const li = document.createElement('li');
	    li.className = 'usa-sidenav__item';

	    const a = document.createElement('a');
	    a.href = `#${id}`;
	    a.textContent = titleText;

	    li.appendChild(a);

	    // --- Recursion Logic (Only for Chapters) ---
	    if (type === 'section' || type === 'subsection') {
	        // Find direct children subsections or provisions with IDs
	        const children = element.querySelectorAll(':scope > subsection[id], :scope > provision[id]');

	        if (children.length > 0) {
	            const subUl = document.createElement('ul');
	            if (level >= 0) { // Apply sublist class to all nested levels
	                subUl.className = 'usa-sidenav__sublist';
	            }
	            children.forEach(child => {
	                const childType = child.tagName.toLowerCase();
	                buildNavItem(child, childType, subUl, level + 1);
	            });
	            if (subUl.hasChildNodes()) {
	                li.appendChild(subUl);
	            }
	        }
	    }
        // --- No Recursion for 'authority_group' or 'provision' ---

	    parentUl.appendChild(li);
	}


	// Add click listeners for smooth scrolling and highlighting current item
	function addSmoothScrollListeners(navContainer) {
	    navContainer.querySelectorAll('a[href^="#"]').forEach(link => {
	        link.addEventListener('click', function(e) {
	            e.preventDefault();
	            const targetId = this.getAttribute('href').substring(1);
	            const targetElement = document.getElementById(targetId);

	            if (targetElement) {
	                targetElement.scrollIntoView({
	                    behavior: 'smooth',
	                    block: 'start' // Align target to the top of the viewport
	                });

	                // Update 'usa-current' class for active link
	                navContainer.querySelectorAll('.usa-current').forEach(el => {
	                    el.classList.remove('usa-current');
	                });
	                this.classList.add('usa-current'); // Highlight the clicked link

                    // Find the parent LI and add usa-current as well if USWDS needs it
                    this.closest('.usa-sidenav__item')?.classList.add('usa-current');


	                // Optional: Add temporary visual highlight to the scrolled-to element
	                targetElement.classList.add('temp-highlight');
	                setTimeout(() => targetElement.classList.remove('temp-highlight'), 1500);

	                // Update URL hash without page jump
	                try { history.pushState(null, '', `#${targetId}`); }
	                catch (err) { console.warn("Browser does not fully support History API."); }

	            } else {
	                console.warn(`Target element with ID "${targetId}" not found.`);
	            }
	        });
	    });
	}


	// --- Search Functionality (Using Mark.js) ---

	// Function to remove highlights
	function clearHighlighting() {
	    if (highlightMarkInstance) {
	        highlightMarkInstance.unmark();
	        highlightMarkInstance = null;
	    } else {
	        new Mark(chapterContent).unmark();
	    }
	    chapterContent.querySelectorAll('.highlight').forEach(el => {
	        try {
	            const parent = el.parentNode;
	            if (parent) {
	                while (el.firstChild) {
	                    parent.insertBefore(el.firstChild, el);
	                }
	                parent.removeChild(el);
	            }
	        } catch (e) { console.error("Error removing highlight span:", e, el); }
	    });
	}

	// Function to perform search and highlight
	function performSearch(searchTerm) {
	    clearHighlighting();

	    if (!searchTerm || searchTerm.trim() === '') {
	        return;
	    }

	    if (typeof Mark === 'undefined') {
	        console.error("Mark.js library is not loaded. Cannot perform search highlighting.");
	        return;
	    }

	    highlightMarkInstance = new Mark(chapterContent);
	    highlightMarkInstance.mark(searchTerm.trim(), {
	        element: "span",
	        className: "highlight",
	        separateWordSearch: false,
	        accuracy: "partially",
	        ignoreJoiners: true,
	        exclude: [
	            ".usa-sidenav *", // Exclude side nav
                "nav *",          // Exclude any nav elements just in case
                "script",
                "style",
                "noscript",
                ".usa-identifier *" // Exclude footer identifier
	        ],
	        done: (counter) => {
	            console.log(`${counter} matches found for "${searchTerm}"`);
	            if (counter > 0) {
	                const firstMatch = chapterContent.querySelector('.highlight');
	                if (firstMatch) {
	                    firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
	                }
	            }
	        },
	        filter: (textNode, term, totalCounter, counter) => {
	             // Prevent highlighting within attributes or already excluded areas' descendants
                const parent = textNode.parentNode;
                if (!parent || parent.closest('.usa-sidenav, script, style, noscript, .usa-identifier')) {
                    return false;
                }
	            return true;
	        }
	    });
	}

	// --- Initialization and Event Listeners ---

	// Populate the main navigation chapter list dropdown
	if (chapterListDropdown) {
	    chapters.forEach((chapter, index) => {
	        const listItem = document.createElement('li');
	        listItem.classList.add('usa-nav__submenu-item');
	        const link = document.createElement('a');
	        link.href = '#';
	        link.textContent = `${chapter.number}${chapter.number ? ': ' : ''}${chapter.title}`;
	        link.dataset.filename = chapter.filename;

	        link.addEventListener('click', (e) => {
	            e.preventDefault();
	            loadContent(chapter.filename); // Use the combined load function

	            // Update 'usa-current' in the main nav dropdown
	            chapterListDropdown.querySelectorAll('a').forEach(el => {
	                el.classList.remove('usa-current');
	                el.removeAttribute('aria-current');
	            });
	            link.classList.add('usa-current');
	            link.setAttribute('aria-current', 'page');

	            // Close mobile menu if open
	            if (uswdsNav && uswdsNav.classList.contains('is-visible')) {
	                uswdsOverlay?.classList.remove('is-visible');
	                uswdsNav.classList.remove('is-visible');
                    uswdsMenuButton?.setAttribute('aria-expanded', 'false');
	            }
	        });

	        listItem.appendChild(link);
	        chapterListDropdown.appendChild(listItem);

	        // Mark the first item as current initially
	        if (index === 0) {
	            link.classList.add('usa-current');
	            link.setAttribute('aria-current', 'page');
	        }
	    });
	} else {
	    console.error("Chapter list dropdown container (#basic-nav-section-one) not found.");
	}

	// Load the first content item by default
	if (chapters.length > 0) {
	    loadContent(chapters[0].filename); // Use the combined load function
	} else {
	    chapterContent.innerHTML = "<p>No content defined.</p>";
	}

	// Header Search Event Listener
	if (headerSearchForm) {
	    headerSearchForm.addEventListener('submit', function(event) {
	        event.preventDefault();
	        performSearch(headerSearchInput.value);
	    });

	    headerSearchInput.addEventListener('input', function() {
	        if (this.value.trim() === '') {
	            clearHighlighting();
	        }
	    });
	    headerSearchInput.addEventListener('keyup', (event) => {
	        if (event.key === 'Enter') {
	            event.preventDefault();
	            performSearch(headerSearchInput.value);
	        }
	    });
	} else {
	    console.error("Header search form (.usa-header .usa-search) not found.");
	}

	// USWDS Mobile Menu Toggle Listeners
	if (uswdsMenuButton && uswdsNavCloseButton && uswdsOverlay && uswdsNav) {
	    uswdsMenuButton.addEventListener('click', () => {
	        uswdsOverlay.classList.toggle('is-visible');
	        uswdsNav.classList.toggle('is-visible');
	        const isExpanded = uswdsNav.classList.contains('is-visible');
	        uswdsMenuButton.setAttribute('aria-expanded', isExpanded);
	    });

	    uswdsNavCloseButton.addEventListener('click', () => {
	        uswdsOverlay.classList.remove('is-visible');
	        uswdsNav.classList.remove('is-visible');
	        uswdsMenuButton.setAttribute('aria-expanded', 'false');
	        uswdsMenuButton.focus();
	    });
	    uswdsOverlay.addEventListener('click', () => {
	        uswdsOverlay.classList.remove('is-visible');
	        uswdsNav.classList.remove('is-visible');
	        uswdsMenuButton.setAttribute('aria-expanded', 'false');
	    });
	} else {
	    console.warn("One or more USWDS header/nav elements not found. Mobile menu toggling might not work.");
	}

	// Add temporary highlight style if not in CSS
	if (!document.getElementById('temp-highlight-style')) {
	    const style = document.createElement('style');
	    style.id = 'temp-highlight-style';
	    style.textContent = `
		  .temp-highlight {
		      animation: tempHighlightAnimation 1.5s ease-out;
		  }
		  @keyframes tempHighlightAnimation {
		      0% { background-color: yellow; }
		      100% { background-color: transparent; }
		  }
		  .highlight { /* Ensure highlight style is defined */
		       background-color: yellow;
		       /* font-weight: bold; */ /* Optional: Style as desired */
               padding: 0.1em; /* Add slight padding */
               border-radius: 2px; /* Slightly rounded corners */
               box-shadow: 0 0 0 1px yellow; /* Ensure visibility */
		  }
	      `;
	    document.head.appendChild(style);
	}

}); // End DOMContentLoaded