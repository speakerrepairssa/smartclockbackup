import urllib.request, urllib.error, json, hashlib, re

DEVICE = "192.168.0.114"
USER = "admin"
PASS = "Azam198419880001"
START = "2026-02-01T00:00:00"
END   = "2026-02-28T23:59:59"

def digest_request(url, body):
    data = body.encode()
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    try:
        return urllib.request.urlopen(req).read()
    except urllib.error.HTTPError as e:
        if e.code != 401:
            raise
        www_auth = e.headers.get("WWW-Authenticate", "")
        realm = re.search(r'realm="([^"]+)"', www_auth).group(1)
        nonce = re.search(r'nonce="([^"]+)"', www_auth).group(1)
        uri = "/ISAPI/AccessControl/AcsEvent?format=json"
        ha1 = hashlib.md5(f"{USER}:{realm}:{PASS}".encode()).hexdigest()
        ha2 = hashlib.md5(f"POST:{uri}".encode()).hexdigest()
        resp_hash = hashlib.md5(f"{ha1}:{nonce}:{ha2}".encode()).hexdigest()
        auth = (f'Digest username="{USER}", realm="{realm}", nonce="{nonce}", '
                f'uri="{uri}", response="{resp_hash}"')
        req2 = urllib.request.Request(url, data=data, headers={
            "Content-Type": "application/json",
            "Authorization": auth
        })
        return urllib.request.urlopen(req2).read()

url = f"http://{DEVICE}/ISAPI/AccessControl/AcsEvent?format=json"
all_events = []
pos = 0
total = None

while True:
    body = json.dumps({
        "AcsEventCond": {
            "searchID": "feb_all",
            "searchResultPosition": pos,
            "maxResults": 30,
            "major": 5,
            "minor": 75,
            "startTime": START,
            "endTime": END
        }
    })
    raw = digest_request(url, body)
    d = json.loads(raw)
    evts = d.get("AcsEvent", {})
    if total is None:
        total = evts.get("totalMatches", 0)
    batch = evts.get("InfoList", [])
    all_events.extend(batch)
    fetched = len(batch)
    pos += fetched
    print(f"  Fetched {pos}/{total}...", flush=True)
    if fetched == 0 or pos >= total:
        break

print(f"\n=== February 2026 — All {len(all_events)} events ===\n")
print(f"{'Time':<32} {'Name':<20} {'Badge':>6}")
print("-" * 62)
for e in all_events:
    print(f"{e.get('time',''):<32} {e.get('name','(no name)'):<20} {e.get('employeeNoString','?'):>6}")
print(f"\nTotal: {len(all_events)}")
