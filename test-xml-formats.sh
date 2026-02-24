#!/bin/bash

# 🎯 TEST DIFFERENT XML FORMATS FOR AcsEvent

DEVICE_IP="192.168.7.2"
USERNAME="admin"
PASSWORD="Azam198419880001"

echo "🎯 TESTING DIFFERENT XML FORMATS FOR ACSEVENT"
echo "═══════════════════════════════════════════════════════"
echo "Device: DS-K1T341AM (Firmware V3.2.30)"
echo ""

test_xml() {
    local name="$1"
    local body="$2"
    
    echo "[$name]"
    echo "Body:"
    echo "$body"
    echo ""
    
    response=$(curl -s -w "\nHTTP_CODE:%{http_code}" --digest -u "$USERNAME:$PASSWORD" \
        -X POST \
        -H "Content-Type: application/xml" \
        -H "Accept: application/xml" \
        -d "$body" \
        "http://$DEVICE_IP/ISAPI/AccessControl/AcsEvent" 2>&1)
    
    http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d: -f2)
    body_resp=$(echo "$response" | grep -v "HTTP_CODE:")
    
    if [ "$http_code" = "200" ]; then
        echo "✅ SUCCESS! Status: $http_code"
        echo ""
        echo "Response:"
        echo "$body_resp"
        
        if echo "$body_resp" | grep -q "<InfoList>"; then
            count=$(echo "$body_resp" | grep -o "<InfoList>" | wc -l | tr -d ' ')
            echo ""
            echo "🎉🎉🎉 FOUND $count EVENTS! 🎉🎉🎉"
        fi
    else
        echo "❌ Failed: Status $http_code"
        echo "$(echo "$body_resp" | head -c 300)"
    fi
    
    echo ""
    echo "─────────────────────────────────────────────────────"
    echo ""
}

# Format 1: Minimal XML
test_xml "1. Minimal XML" \
'<?xml version="1.0" encoding="UTF-8"?>
<AcsEventCond>
<searchID>1</searchID>
<maxResults>30</maxResults>
</AcsEventCond>'

# Format 2: With namespace
test_xml "2. With Hikvision Namespace" \
'<?xml version="1.0" encoding="UTF-8"?>
<AcsEventCond version="2.0" xmlns="http://www.hikvision.com/ver20/XMLSchema">
<searchID>1</searchID>
<maxResults>30</maxResults>
</AcsEventCond>'

# Format 3: With ISAPI namespace (ver20)
test_xml "3. With ISAPI Namespace (ver20)" \
'<?xml version="1.0" encoding="UTF-8"?>
<AcsEventCond version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
<searchID>1</searchID>
<maxResults>30</maxResults>
</AcsEventCond>'

# Format 4: With search position
test_xml "4. With searchResultPosition" \
'<?xml version="1.0" encoding="UTF-8"?>
<AcsEventCond version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
<searchID>1</searchID>
<searchResultPosition>0</searchResultPosition>
<maxResults>30</maxResults>
</AcsEventCond>'

# Format 5: With major/minor
test_xml "5. With major/minor event types" \
'<?xml version="1.0" encoding="UTF-8"?>
<AcsEventCond version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
<searchID>1</searchID>
<searchResultPosition>0</searchResultPosition>
<maxResults>30</maxResults>
<major>5</major>
<minor>75</minor>
</AcsEventCond>'

# Format 6: Simple with dates
test_xml "6. With date range (simple format)" \
'<?xml version="1.0" encoding="UTF-8"?>
<AcsEventCond version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
<searchID>1</searchID>
<maxResults>50</maxResults>
<startTime>2020-01-01T00:00:00</startTime>
<endTime>2026-12-31T23:59:59</endTime>
</AcsEventCond>'

# Format 7: Date with Z suffix
test_xml "7. Dates with Z (UTC)" \
'<?xml version="1.0" encoding="UTF-8"?>
<AcsEventCond version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
<searchID>1</searchID>
<maxResults>50</maxResults>
<startTime>2020-01-01T00:00:00Z</startTime>
<endTime>2026-12-31T23:59:59Z</endTime>
</AcsEventCond>'

# Format 8: Compact date format
test_xml "8. Compact date format" \
'<?xml version="1.0" encoding="UTF-8"?>
<AcsEventCond version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
<searchID>1</searchID>
<maxResults>50</maxResults>
<startTime>20200101T000000</startTime>
<endTime>20261231T235959</endTime>
</AcsEventCond>'

# Format 9: TimeSpan instead of startTime/endTime
test_xml "9. Using TimeSpan" \
'<?xml version="1.0" encoding="UTF-8"?>
<AcsEventCond version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
<searchID>1</searchID>
<maxResults>50</maxResults>
<TimeSpan>
<beginTime>2020-01-01T00:00:00</beginTime>
<endTime>2026-12-31T23:59:59</endTime>
</TimeSpan>
</AcsEventCond>'

# Format 10: Everything combined
test_xml "10. Full specification" \
'<?xml version="1.0" encoding="UTF-8"?>
<AcsEventCond version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
<searchID>1</searchID>
<searchResultPosition>0</searchResultPosition>
<maxResults>100</maxResults>
<major>5</major>
<minor>75</minor>
<startTime>2020-01-01T00:00:00</startTime>
<endTime>2026-12-31T23:59:59</endTime>
</AcsEventCond>'

echo ""
echo "═══════════════════════════════════════════════════════"
echo "✅ Done! Check above for any successful formats."
