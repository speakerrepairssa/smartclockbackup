#!/usr/bin/env python3

import urllib.request
import urllib.error
import base64
import ssl

# Test different approaches to find how Uniclox extracted events

device_ip = '192.168.0.114'
username = 'admin'
password = 'Azam198419880001'

# Create auth header
credentials = f"{username}:{password}"
auth_header = base64.b64encode(credentials.encode()).decode()

# Create SSL context that ignores certificate errors
ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

def test_endpoint(url, method='GET', data=None):
    """Test a specific endpoint"""
    try:
        req = urllib.request.Request(url)
        req.add_header('Authorization', f'Basic {auth_header}')
        
        if method == 'POST' and data:
            req.add_header('Content-Type', 'application/xml')
            req.data = data.encode()
        
        with urllib.request.urlopen(req, timeout=5, context=ssl_context) as response:
            body = response.read().decode()
            return response.code, body
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode() if hasattr(e, 'read') else str(e)
    except Exception as e:
        return None, str(e)

print("=== Testing Different Approaches for Event Extraction ===")
print(f"Device: {device_ip}")
print()

# Test endpoints that might work
endpoints = [
    ("Event Logs Direct", f"http://{device_ip}/ISAPI/AccessControl/AcsEventLogs"),
    ("Event Database", f"http://{device_ip}/ISAPI/AccessControl/EventLogs"),
    ("Event Search", f"http://{device_ip}/ISAPI/Event/triggers/AccessControllerEvent"),
    ("Content Search", f"http://{device_ip}/ISAPI/ContentMgmt/search"),
    ("Simple Event Query", f"http://{device_ip}/ISAPI/AccessControl/AcsEvent?searchID=1"),
    ("Event with Format", f"http://{device_ip}/ISAPI/AccessControl/AcsEvent?format=json"),
    ("Record Search", f"http://{device_ip}/ISAPI/ContentMgmt/record/search"),
]

for name, url in endpoints:
    print(f"Testing: {name}")
    status, body = test_endpoint(url)
    
    if status == 200:
        print(f"  ✓ SUCCESS! Status: {status}")
        print(f"  Response length: {len(body)}")
        print(f"  Preview: {body[:200]}...")
        
        # Check if this contains event data
        if any(keyword in body.lower() for keyword in ['event', 'record', 'access', 'time']):
            print(f"  ⭐ CONTAINS EVENT DATA!")
            
    elif status:
        print(f"  ✗ Failed with status {status}")
        print(f"  Error: {body[:100]}...")
    else:
        print(f"  ✗ Connection failed: {body}")
    
    print()

# Test POST requests with XML
print("=== Testing POST Requests with XML ===")

xml_search = '''<?xml version="1.0" encoding="UTF-8"?>
<searchDescription>
    <searchID>1</searchID>
    <maxResults>100</maxResults>
</searchDescription>'''

post_endpoints = [
    ("Content Management Search", f"http://{device_ip}/ISAPI/ContentMgmt/search"),
    ("Access Control Search", f"http://{device_ip}/ISAPI/AccessControl/search"),
]

for name, url in post_endpoints:
    print(f"Testing POST: {name}")
    status, body = test_endpoint(url, method='POST', data=xml_search)
    
    if status == 200:
        print(f"  ✓ SUCCESS! Status: {status}")
        print(f"  Response: {body[:300]}...")
    elif status:
        print(f"  ✗ Failed with status {status}")
        print(f"  Error: {body[:100]}...")
    else:
        print(f"  ✗ Connection failed: {body}")
    
    print()

print("=== Analysis Complete ===")
print("If any endpoint returned status 200 with event data,")
print("that's likely how Uniclox was accessing the device.")