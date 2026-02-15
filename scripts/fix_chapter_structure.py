#!/usr/bin/env python3
"""
Fix chapter structure by nesting subsections and provisions under their parent sections/subsections.

This script fixes the XML structure where subsections and provisions are siblings
instead of being nested children.
"""

try:
    import re2 as re
except ImportError:
    import re
    print("Warning: google-re2 not installed, falling back to standard re module")
from pathlib import Path
import sys

def find_closing_tag(content, start_pos, tag_name):
    """Find the closing tag for a given opening tag, handling nesting."""
    open_tag = f'<{tag_name} '
    close_tag = f'</{tag_name}>'
    depth = 1
    pos = start_pos
    
    while depth > 0 and pos < len(content):
        if content[pos:pos+len(open_tag)] == open_tag:
            depth += 1
        elif content[pos:pos+len(close_tag)] == close_tag:
            depth -= 1
            if depth == 0:
                return pos, pos + len(close_tag)
        pos += 1
    
    return None, None

def get_parent_id_candidates(child_id):
    """Get list of possible parent IDs for a child, in priority order."""
    candidates = []
    
    if child_id.startswith('prov-'):
        # Remove the 'prov-' prefix to get the number part
        num_part = child_id[5:]  # Everything after 'prov-'
        
        # Split by dash
        parts = num_part.split('-')
        
        # Try removing segments from the end to find parent
        # For prov-1009-4-A-1, try: prov-1009-4-A, then subsec-1009-4-A, then subsec-1009-4
        for i in range(len(parts) - 1, 0, -1):
            parent_num = '-'.join(parts[:i])
            # First try as another provision
            candidates.append(f'prov-{parent_num}')
            # Then try as a subsection
            candidates.append(f'subsec-{parent_num}')
    
    elif child_id.startswith('subsec-'):
        # subsec-602-1 -> sec-602
        # subsec-1108-6-B -> subsec-1108-6 or sec-1108
        num_part = child_id[7:]  # Everything after 'subsec-'
        parts = num_part.split('-')
        
        # Try removing segments from the end
        for i in range(len(parts) - 1, 0, -1):
            parent_num = '-'.join(parts[:i])
            # First try as another subsection (for nested subsections)
            if i > 1:  # Only if there's more than just the section number
                candidates.append(f'subsec-{parent_num}')
            # Then try as a section
            if i == 1:  # Just the section number
                candidates.append(f'sec-{parent_num}')
    
    return candidates

def get_parent_id(child_id, all_element_ids):
    """Find the actual parent ID from candidates that exist in the document."""
    candidates = get_parent_id_candidates(child_id)
    for candidate in candidates:
        if candidate in all_element_ids:
            return candidate
    return None

def fix_chapter_structure(file_path, dry_run=False):
    """Fix chapter structure by nesting children under their parents."""
    
    with open(file_path, 'r', encoding='utf-8') as f:
        original_content = f.read()
    
    # Check if this file needs fixing
    needs_fixing = (
        re.search(r'</section>\s*<subsection', original_content) or
        re.search(r'</section>\s*<provision', original_content) or
        re.search(r'</subsection>\s*<provision', original_content)
    )
    
    if not needs_fixing:
        return False, "No sibling subsections or provisions found"
    
    print(f"\nProcessing: {file_path.name}")
    
    current_content = original_content
    total_moved = 0
    pass_num = 0
    
    # Loop until no more elements need to be moved
    while True:
        pass_num += 1
        
        # Find all elements (sections, subsections, provisions) with their positions
        elements = {}
        
        for tag_type in ['section', 'subsection', 'provision']:
            pattern = rf'<{tag_type} id="([^"]*)"[^>]*>'
            for match in re.finditer(pattern, current_content):
                element_id = match.group(1)
                start_pos = match.start()
                tag_end = match.end()
                
                # Find closing tag
                close_start, close_end = find_closing_tag(current_content, tag_end, tag_type)
                
                if close_start is None:
                    if pass_num == 1:  # Only warn on first pass
                        print(f"  Warning: Could not find closing tag for {tag_type} {element_id}")
                    continue
                
                elements[element_id] = {
                    'id': element_id,
                    'type': tag_type,
                    'start': start_pos,
                    'tag_end': tag_end,
                    'close_start': close_start,
                    'close_end': close_end
                }
        
        # Now determine parent relationships
        all_element_ids = set(elements.keys())
        for elem_id, elem in elements.items():
            elem['parent_id'] = get_parent_id(elem_id, all_element_ids)
        
        # Build parent-child relationships
        for elem_id, elem in elements.items():
            if elem['parent_id'] and elem['parent_id'] in elements:
                parent = elements[elem['parent_id']]
                if 'children' not in parent:
                    parent['children'] = []
                parent['children'].append(elem_id)
        
        # Find elements that need to be moved (children that are outside their parents)
        to_move = []
        for elem_id, elem in elements.items():
            if elem['parent_id'] and elem['parent_id'] in elements:
                parent = elements[elem['parent_id']]
                # Check if this element is outside its parent (starts after parent closes)
                if elem['start'] >= parent['close_end']:
                    to_move.append(elem_id)
        
        if not to_move:
            if pass_num == 1:
                print("  No elements need to be moved")
                return False, "No elements need moving"
            else:
                break  # Done - no more elements to move
        
        if pass_num == 1:
            print(f"  Found {len(to_move)} elements to move (pass {pass_num})")
        
        # Sort elements to move by their position (reverse order for safe removal)
        to_move.sort(key=lambda eid: elements[eid]['start'], reverse=True)
        
        # Group by parent
        by_parent = {}
        for elem_id in to_move:
            parent_id = elements[elem_id]['parent_id']
            if parent_id not in by_parent:
                by_parent[parent_id] = []
            by_parent[parent_id].append(elem_id)
        
        # Process the content
        new_content = current_content
        
        # Extract and remove elements (in reverse order to maintain positions)
        extracted = {}
        for elem_id in to_move:
            elem = elements[elem_id]
            
            # Find whitespace before element
            start = elem['start']
            while start > 0 and new_content[start-1] in ' \n\t':
                start -= 1
            
            # Extract the full element
            elem_text = new_content[start:elem['close_end']]
            extracted[elem_id] = elem_text
            
            # Remove from content
            new_content = new_content[:start] + new_content[elem['close_end']:]
            
            # Update positions of remaining elements
            removed_length = elem['close_end'] - start
            for other_id, other in elements.items():
                if other['start'] > start:
                    other['start'] -= removed_length
                    other['tag_end'] -= removed_length
                    other['close_start'] -= removed_length
                    other['close_end'] -= removed_length
        
        # Insert elements into their parents
        for parent_id in sorted(by_parent.keys(), key=lambda pid: elements[pid]['start'], reverse=True):
            parent = elements[parent_id]
            children_ids = sorted(by_parent[parent_id], key=lambda eid: original_content.find(f'id="{eid}"'))
            
            # Combine all children text
            children_text = ''.join(extracted[cid] for cid in children_ids)
            
            # Find current parent closing position
            insert_pos = parent['close_start']
            
            # Insert children before the closing tag
            new_content = new_content[:insert_pos] + children_text + new_content[insert_pos:]
            
            # Update positions
            inserted_length = len(children_text)
            for other_id, other in elements.items():
                if other['start'] > insert_pos:
                    other['start'] += inserted_length
                    other['tag_end'] += inserted_length
                    other['close_start'] += inserted_length
                    other['close_end'] += inserted_length
            
            total_moved += len(children_ids)
            print(f"  Moved {len(children_ids)} {children_ids[0].split('-')[0]}(s) into {parent_id}")
        
        current_content = new_content
    
    if not dry_run:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(current_content)
        print(f"  ✓ File updated successfully ({total_moved} elements moved in {pass_num} passes)")
    
    return True, f"Fixed - moved {total_moved} elements"

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
                skipped_count += 1
                if not "No sibling" in message and not "No elements" in message:
                    print(f"\nSkipping {ch_file.name}: {message}")
        except Exception as e:
            error_count += 1
            print(f"\nException processing {ch_file.name}: {e}")
            import traceback
            traceback.print_exc()
    
    print(f"\n{'='*60}")
    print(f"Summary:")
    print(f"  Fixed: {fixed_count}")
    print(f"  Skipped: {skipped_count}")
    print(f"  Errors: {error_count}")
    print(f"{'='*60}")
    
    return 0 if error_count == 0 else 1

if __name__ == '__main__':
    sys.exit(main())
