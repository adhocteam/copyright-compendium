import sys

filename = '/Users/arihershowitz/Documents/AdHoc/workspace/copyright-compendium/CompendiumUI/script.ts'
with open(filename, 'r') as f:
    lines = f.readlines()

new_lines = []
skip = False
i = 0
while i < len(lines):
    line = lines[i]
    
    # Remove Algolia imports
    if "import * as algoliasearchLite from 'algoliasearch/lite';" in line:
        i += 1
        continue
    if "import { autocomplete } from '@algolia/autocomplete-js';" in line:
        i += 1
        continue
    if "import '@algolia/autocomplete-theme-classic/dist/theme.css';" in line:
        i += 1
        continue
        
    # Replace targetHash logic (part 1)
    if "if (targetHash) {" in line and "const targetElement = document.getElementById(targetHash);" in lines[i+1]:
        new_lines.append(line)
        new_lines.append('                const actualHash = targetHash.split(\'?\')[0];\n')
        new_lines.append('                const searchParams = new URLSearchParams(targetHash.split(\'?\')[1] || \'\');\n')
        new_lines.append('                const hltParam = searchParams.get(\'hlt\');\n\n')
        new_lines.append('                const targetElement = document.getElementById(actualHash);\n')
        new_lines.append(lines[i+2])
        new_lines.append(lines[i+3])
        new_lines.append('                    if (filename !== \'glossary.html\') {\n')
        new_lines.append('                        updateSideNavCurrent(actualHash);\n')
        new_lines.append('                    }\n')
        new_lines.append(lines[i+7])
        new_lines.append(lines[i+8])
        new_lines.append(lines[i+9])
        new_lines.append(lines[i+10])
        new_lines.append(lines[i+11])
        new_lines.append(lines[i+12])
        new_lines.append('                \n                if (hltParam) {\n                    performSearch(hltParam);\n                }\n')
        i += 13
        continue
        
    # Replace finalHashToScroll logic (part 2)
    if "const targetElement = document.getElementById(finalHashToScroll);" in line and "if (finalHashToScroll) {" in lines[i-3]:
        # we need to replace the preceding lines too, and we've already added them. Let's fix.
        pass # Better to match earlier. 
        
    # Remove Algolia init
    if "// --- Configuration ---" in line and "Replace with your actual Algolia credentials" in lines[i+1]:
        # Skip until end of autocomplete block
        while i < len(lines) and not "detachedMediaQuery: '', // Always detached" in lines[i]:
            i += 1
        i += 2 # skip "    });" and "\n"
        continue
        
    new_lines.append(line)
    i += 1

with open(filename, 'w') as f:
    f.writelines(new_lines)

print("Updated script.ts safely.")
