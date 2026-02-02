# Uniclox Method Investigation Plan

## Current Status
- Device: DS-K1T34ICMFW at 192.168.0.114
- Credentials: admin/Azam198419880001
- Known: Uniclox successfully extracted 2905 events from this exact device
- Problem: All standard ISAPI endpoints fail, no SDK service running

## Failed Approaches
1. ❌ Standard ISAPI (all endpoints return 404/401)
2. ❌ YouTube-style SDK API (ports 8600/8080/8000 not responding)
3. ❌ Alternative authentication methods

## Next Investigation Steps

### 1. Web Interface Analysis
Test if Uniclox used the device's web interface:
- Access device web management at http://192.168.0.114
- Look for event logs in the web interface
- Check if data can be scraped from HTML/JavaScript

### 2. TCP Protocol Analysis  
Test if Uniclox used direct TCP communication:
- Scan all open ports on the device
- Test raw TCP connections to common Hikvision ports
- Look for proprietary binary protocols

### 3. SDK Implementation
Research official Hikvision SDK:
- Download Hikvision Device Network SDK
- Create wrapper service similar to YouTube video
- Register device and test event extraction

### 4. Session-Based Authentication
Test advanced authentication methods:
- Session cookies from web login
- Digest authentication variants
- Certificate-based authentication

### 5. Alternative Protocols
Test other communication methods:
- WebSocket connections
- RTSP metadata streams  
- ONVIF protocol support

## Implementation Priority
1. Web interface analysis (fastest to test)
2. TCP port scanning (reveals available services)
3. SDK implementation (most likely to work)
4. Advanced authentication (if web/TCP fail)
5. Alternative protocols (last resort)

## Success Criteria
Find method that returns actual event data containing:
- Employee IDs
- Timestamps  
- Door access events
- Face detection data (if available)