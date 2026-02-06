#!/usr/bin/env python3
"""Fix businessId scope issue in loadAssessment functions"""

import re

file_path = "src/pages/business-dashboard.html"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Pattern to find loadAssessment function start
old_pattern = r'''    async function loadAssessment\(\) \{
      try \{
        const month = document\.getElementById\('assessmentMonthInput'\)\.value;
        const display = document\.getElementById\('assessmentContent'\);
        const monthDisplay = document\.getElementById\('assessmentMonth'\);'''

# New code with businessId defined
new_code = '''    async function loadAssessment() {
      try {
        // Get businessId from session storage
        const businessId = sessionStorage.getItem('businessId');
        if (!businessId) {
          console.error('❌ No businessId found');
          const display = document.getElementById('assessmentContent');
          if (display) {
            display.innerHTML = '<div style="text-align: center; padding: 3rem; color: #dc3545;">Error: Business ID not found</div>';
          }
          return;
        }
        
        const month = document.getElementById('assessmentMonthInput').value;
        const display = document.getElementById('assessmentContent');
        const monthDisplay = document.getElementById('assessmentMonth');'''

# Replace all occurrences
new_content = re.sub(old_pattern, new_code, content)

# Count replacements
count = len(re.findall(old_pattern, content))
print(f"Found {count} loadAssessment functions to fix")

if count > 0:
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f"✅ Fixed businessId scope in {count} functions!")
else:
    print("❌ Pattern not found!")
