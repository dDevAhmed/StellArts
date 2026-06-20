#!/usr/bin/env python3
"""Script to fix ruff errors in test files."""
import re

def fix_import_sorting(content):
    """Fix import block sorting - move app.core imports before app.models imports."""
    lines = content.split('\n')
    fixed_lines = []
    i = 0
    
    while i < len(lines):
        line = lines[i]
        
        # Detect import block pattern
        if 'from app.core.security import get_password_hash' in line:
            fixed_lines.append(line)
            i += 1
            # Skip blank line
            if i < len(lines) and lines[i].strip() == '':
                fixed_lines.append(lines[i])
                i += 1
            # Check if next line is app.models import
            if i < len(lines) and 'from app.models' in lines[i]:
                # Collect all app.models imports
                models_imports = []
                while i < len(lines) and 'from app.models' in lines[i]:
                    models_imports.append(lines[i])
                    i += 1
                    if i < len(lines) and lines[i].strip() == '':
                        models_imports.append(lines[i])
                        i += 1
                # Sort models imports alphabetically
                models_imports.sort()
                fixed_lines.extend(models_imports)
            continue
        
        fixed_lines.append(line)
        i += 1
    
    return '\n'.join(fixed_lines)

def fix_trailing_whitespace(content):
    """Remove trailing whitespace from all lines."""
    lines = content.split('\n')
    fixed_lines = [line.rstrip() for line in lines]
    return '\n'.join(fixed_lines)

def fix_file(filepath):
    """Fix ruff errors in a single file."""
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Fix trailing whitespace
    content = fix_trailing_whitespace(content)
    
    # Fix import sorting
    content = fix_import_sorting(content)
    
    with open(filepath, 'w') as f:
        f.write(content)
    
    print(f"Fixed {filepath}")

if __name__ == '__main__':
    files = [
        'backend/app/tests/test_payment_auth_guards.py',
        'backend/app/tests/test_stub_endpoints.py',
    ]
    
    for filepath in files:
        try:
            fix_file(filepath)
        except Exception as e:
            print(f"Error fixing {filepath}: {e}")
    
    print("Done! Please run ruff check again to verify.")
