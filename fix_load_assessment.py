#!/usr/bin/env python3
"""Fix loadAssessment() to ONLY read from cache, never calculate"""

import re

file_path = "src/pages/business-dashboard.html"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Pattern to find the cache reading code that still calculates
old_pattern = r'''        // 🚀 Load from CACHE first \(instant!\)
        let employeeAssessments = \[\];
        
        try \{
          // Try to read from assessment_cache first
          console\.log\('📦 Checking cache for month:', month\);
          const cacheRef = ref\(rtdb, `businesses/\$\{businessId\}/assessment_cache/\$\{month\}`\);
          const cacheSnap = await get\(cacheRef\);
          
          if \(cacheSnap\.exists\(\)\) \{
            const cacheData = cacheSnap\.val\(\);
            const cacheAge = Date\.now\(\) - \(cacheData\.summary\?\.lastCalculated \|\| 0\);
            const maxCacheAge = 5 \* 60 \* 1000; // 5 minutes
            
            if \(cacheAge < maxCacheAge\) \{
              // Use cached data \(instant!\)
              console\.log\('✅ Using cached assessment \(age:', Math\.round\(cacheAge / 1000\), 'sec\)'\);
              employeeAssessments = Object\.values\(cacheData\.employees \|\| \{\}\);
            \} else \{
              console\.log\('⚠️ Cache stale, recalculating\.\.\.'\);
              await calculateAndCacheMonthlyAssessment\(businessId, month\);
              const newSnap = await get\(cacheRef\);
              employeeAssessments = Object\.values\(newSnap\.val\(\)\?\.employees \|\| \{\}\);
            \}
          \} else \{
            // No cache, calculate and cache it
            console\.log\('📊 No cache found, calculating\.\.\.'\);
            await calculateAndCacheMonthlyAssessment\(businessId, month\);
            const newSnap = await get\(cacheRef\);
            employeeAssessments = Object\.values\(newSnap\.val\(\)\?\.employees \|\| \{\}\);
          \}
          
        \} catch \(error\) \{
          console\.error\('❌ Error loading from cache:', error\);
          employeeAssessments = await calculateAssessmentFromRealtimeDB\(businessId, month\);
        \}

        // Fallback to dummy data if still empty'''

# New cache-ONLY code (no calculation!)
new_code = '''        // 🚀 Load from CACHE ONLY (instant!)
        let employeeAssessments = [];
        
        try {
          // Read from assessment_cache - NO calculation!
          console.log('📦 Reading cached assessment for month:', month);
          const cacheRef = ref(rtdb, `businesses/${businessId}/assessment_cache/${month}`);
          const cacheSnap = await get(cacheRef);
          
          if (cacheSnap.exists()) {
            const cacheData = cacheSnap.val();
            console.log('✅ Cache found! Loading instantly...');
            employeeAssessments = Object.values(cacheData.employees || {});
            
            // Show cache age
            const cacheAge = Date.now() - (cacheData.summary?.lastCalculated || 0);
            console.log('📊 Cache age:', Math.round(cacheAge / 1000), 'seconds old');
          } else {
            console.log('❌ No cache found for', month, '- Click "Fix Cache" button');
            employeeAssessments = [];
          }
          
        } catch (error) {
          console.error('❌ Error reading cache:', error);
          employeeAssessments = [];
        }

        // Show message if no cached data'''

# Replace all occurrences
new_content = re.sub(old_pattern, new_code, content)

# Count replacements
count = len(re.findall(old_pattern, content))
print(f"Found {count} occurrences to replace")

if count > 0:
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f"✅ Replaced {count} occurrences - NOW cache-only, NO calculation!")
else:
    print("❌ Pattern not found!")

