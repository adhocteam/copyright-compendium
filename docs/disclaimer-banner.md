# Disclaimer Banner

## Overview

The Copyright Compendium Viewer includes a prominent disclaimer banner at the top of every page. This banner serves a critical role in distinguishing this prototype application from official U.S. government websites.

## Purpose

As a prototype developed by Ad Hoc to demonstrate the potential of AI in making government documents more accessible, it is essential to clearly communicate that:
1.  **This is not an official government website.**
2.  **The content matches the official Compendium but is presented in a new, experimental format.**
3.  **Users should refer to [copyright.gov](https://www.copyright.gov/comp3/) for the official legal text.**

## Features

### 1. Prototype Declaration
The banner clearly states: "This is not official government information." This text is visible at all times to ensure no confusion with official .gov sites.

### 2. "Here's how you know"
Similar to the official [USWDS identifier](https://designsystem.digital.gov/components/identifier/), the banner includes a "Here's how you know" button.
-   **Collapsed State**: Shows the summary disclaimer.
-   **Expanded State**: Clicking the button reveals additional context, explaining that the site is a prototype by Ad Hoc and providing links to:
    -   **About**: More information about the project.
    -   **Blog Post**: Background on the initiatives behind this prototype.
    -   **GitHub**: Access to the open-source code.
    -   **Official Compendium**: A direct link to the official PDF on copyright.gov.

### 3. Responsive Design
The banner is fully responsive, adjusting its layout for mobile and desktop screens while maintaining visibility of the core disclaimer message.

## Implementation Details

-   **Component**: The banner is implemented as a static HTML component in `index.html` (and other pages) with CSS styling in `style.css`.
-   **Interactivity**: The expand/collapse functionality is handled by `script.ts`, which toggles the `aria-expanded` attribute and the visibility of the detailed content.
-   **Styling**: It uses a custom design distinct from the standard USWDS header to visually differentiate it while maintaining a clean, professional look.

## Usage

No user action is required to see the banner. It is fixed at the top of the viewport. Users can interact with the "Here's how you know" button to learn more about the project's status.
