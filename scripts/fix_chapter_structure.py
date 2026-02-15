#!/usr/bin/env python3
"""
Fix chapter structure by nesting subsections under their parent sections.

This script fixes the XML structure where subsections are siblings to sections
instead of being nested children. It moves subsections under their parent section
based on the numbering (e.g., subsection 602.1 belongs under section 602).
"""

import re
from pathlib import Path
import sys

def fix_chapter_structure(file_path, dry_run=False):
    """Fix chapter structure by nesting subsections under their parent sections."""
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Check if this file needs fixing (has sibling subsections)
    # Look for pattern: </section> followed by <subsection
    if not re.search(r'</section>\s*<subsection', content):
        return False, "No sibling subsections found"
    
    print(f"\nProcessing: {file_path.name}")
    
    # Extract section number from subsection ID
    # Examples: subsec-602-1 -> 602, subsec-1004-1-A -> 1004
    def get_parent_section_num(subsec_id):
        match = re.match(r'subsec-(\d+)', subsec_id)
        if match:
            return match.group(1)
        return None
    
    # Find all sections and subsections with their positions
    sections = []
    subsections = []
    
    for match in re.finditer(r'<section id="([^"]*)"[^>]*>', content):
        sections.append({
            'id': match.group(1),
            'start': match.start(),
            'tag_end': match.end()
        })
    
    for match in re.finditer(r'<subsection id="([^"]*)"[^>]*>', content):
        subsections.append({
            'id': match.group(1),
            'start': match.start(),
            'tag_end': match.end()
        })
    
    print(f"  Found {len(sections)} sections and {len(subsections)} subsections")
    
    # Find closing tags for sections
    for section in sections:
        # Find the closing </section> tag for this section
        # We need to count nested sections
        depth = 1
        pos = section['tag_end']
        while depth > 0 and pos < len(content):
            if content[pos:pos+9] == '<section ':
                depth += 1
            elif content[pos:pos+10] == '</section>':
                depth -= 1
                if depth == 0:
                    section['end'] = pos
                    section['close_tag_end'] = pos + 10
                    break
            pos += 1
        
        if depth != 0:
            print(f"  Warning: Could not find closing tag for section {section['id']}")
            return False, f"Could not find closing tag for section {section['id']}"
    
    # Extract section numbers
    for section in sections:
        match = re.match(r'sec-(\d+)', section['id'])
        if match:
            section['num'] = match.group(1)
    
    # Group subsections by their parent section
    subsections_to_move = {}
    for subsec in subsections:
        parent_num = get_parent_section_num(subsec['id'])
        if parent_num:
            if parent_num not in subsections_to_move:
                subsections_to_move[parent_num] = []
            subsections_to_move[parent_num].append(subsec)
    
    print(f"  Subsections to move: {sum(len(v) for v in subsections_to_move.values())}")
    
    # Build the new content
    # We'll process the file in reverse order to maintain positions
    new_content = content
    
    # For each section, find subsections that should be nested
    for section in reversed(sections):
        if 'num' not in section:
            continue
        
        section_num = section['num']
        if section_num not in subsections_to_move:
            continue
        
        # Find subsections that come after this section closes
        subsecs_for_this_section = []
        section_close_pos = section['close_tag_end']
        
        for subsec in subsections_to_move[section_num]:
            if subsec['start'] >= section_close_pos:
                # This subsection is after the section closes, so it needs to be moved
                subsecs_for_this_section.append(subsec)
        
        if not subsecs_for_this_section:
            continue
        
        # Sort by position
        subsecs_for_this_section.sort(key=lambda x: x['start'])
        
        # Find the end of each subsection to extract the full content
        for subsec in subsecs_for_this_section:
            depth = 1
            pos = subsec['tag_end']
            while depth > 0 and pos < len(new_content):
                if new_content[pos:pos+12] == '<subsection ':
                    depth += 1
                elif new_content[pos:pos+13] == '</subsection>':
                    depth -= 1
                    if depth == 0:
                        subsec['end'] = pos
                        subsec['close_tag_end'] = pos + 13
                        break
                pos += 1
        
        # Extract subsection content and remove from original position (in reverse order)
        subsec_contents = []
        for subsec in reversed(subsecs_for_this_section):
            if 'close_tag_end' not in subsec:
                print(f"  Warning: Could not find closing tag for subsection {subsec['id']}")
                continue
            
            # Extract the full subsection including whitespace before it
            start = subsec['start']
            # Look back for whitespace/newlines
            while start > 0 and new_content[start-1] in ' \n\t':
                start -= 1
            
            subsec_content = new_content[start:subsec['close_tag_end']]
            subsec_contents.insert(0, subsec_content)  # Insert at beginning to maintain order
            
            # Remove from original position
            new_content = new_content[:start] + new_content[subsec['close_tag_end']:]
        
        # Re-find the section closing tag position (it may have shifted)
        # Search for </section> before the position where we removed content
        section_pattern = f'<section id="{section["id"]}"[^>]*>'
        section_match = re.search(re.escape(section_pattern).replace(r'\[', '[').replace(r'\]', ']'), new_content)
        if not section_match:
            # Try without escaping special chars in ID
            section_match = re.search(f'<section id="{re.escape(section["id"])}"[^>]*>', new_content)
        
        if section_match:
            # Find the closing tag
            depth = 1
            pos = section_match.end()
            while depth > 0 and pos < len(new_content):
                if new_content[pos:pos+9] == '<section ':
                    depth += 1
                elif new_content[pos:pos+10] == '</section>':
                    depth -= 1
                    if depth == 0:
                        insert_pos = pos
                        # Insert subsections before the closing </section> tag
                        subsec_text = ''.join(subsec_contents)
                        new_content = new_content[:insert_pos] + subsec_text + new_content[insert_pos:]
                        print(f"  Moved {len(subsec_contents)} subsections into section {section['id']}")
                        break
                pos += 1
    
    if not dry_run:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"  ✓ File updated successfully")
    
    return True, "Fixed"

def main():
    dry_run = '--dry-run' in sys.argv
    
    # Find all chapter files
    public_dir = Path('CompendiumUI/public')
    chapter_files = sorted(public_dir.glob('ch[0-9]*.html'))
    
    if not chapter_files:
        print("No chapter files found in CompendiumUI/public/")
        return 1
    
    print(f"Found {len(chapter_files)} chapter files")
    if dry_run:
        print("DRY RUN - No files will be modified")
    
    fixed_count = 0
    skipped_count = 0
    error_count = 0
    
    for ch_file in chapter_files:
        try:
            success, message = fix_chapter_structure(ch_file, dry_run)
            if success:
                fixed_count += 1
            else:
                if "No sibling subsections" in message:
                    skipped_count += 1
                    print(f"\nSkipping {ch_file.name}: {message}")
                else:
                    error_count += 1
                    print(f"\nError processing {ch_file.name}: {message}")
        except Exception as e:
            error_count += 1
            print(f"\nException processing {ch_file.name}: {e}")
    
    print(f"\n{'='*60}")
    print(f"Summary:")
    print(f"  Fixed: {fixed_count}")
    print(f"  Skipped: {skipped_count}")
    print(f"  Errors: {error_count}")
    print(f"{'='*60}")
    
    return 0 if error_count == 0 else 1

if __name__ == '__main__':
    sys.exit(main())
