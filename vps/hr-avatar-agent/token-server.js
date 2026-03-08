/**
 * SmartClock HR Avatar — Token Server
 * Runs on VPS alongside the Hikvision relay
 * Port 7680 | Provides LiveKit room tokens to hr-avatar.html
 *
 * Fetches business HR policies from Firestore and injects them
 * into room metadata so the Python agent can read them.
 */

'use strict';

const http    = require('http');
const url     = require('url');
const { AccessToken, RoomServiceClient } = require('livekit-server-sdk');

// ── Config (set via .env or PM2 env) ────────────────────────────────────────
const PORT             = process.env.TOKEN_SERVER_PORT  || 7680;
const LIVEKIT_URL      = process.env.LIVEKIT_URL        || '';
const LIVEKIT_API_KEY  = process.env.LIVEKIT_API_KEY    || '';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || '';
const FIREBASE_PROJECT = process.env.FIREBASE_PROJECT_ID || 'smartclock-v2-8271f';
const FIREBASE_KEY     = process.env.FIREBASE_API_KEY   || '';  // Web API key for REST

// ── Optional: CORS origins (allow browser requests from Firebase hosting) ───
const ALLOWED_ORIGINS = [
  'https://smartclock-v2-8271f.web.app',
  'https://smartclock-v2-8271f.firebaseapp.com',
  'https://aiclock-82608.web.app',
  'https://aiclock-82608.firebaseapp.com',
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function setCORS(req, res) {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin) || origin.includes('localhost')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');   // open during dev
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJSON(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

/**
 * Fetch HR Avatar settings for a business from Firestore REST API.
 * Returns the hr_avatar settings doc or {} on error.
 */
async function fetchHrConfig(businessId) {
  if (!businessId || !FIREBASE_KEY) return {};
  const firestoreUrl =
    `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents` +
    `/businesses/${encodeURIComponent(businessId)}/settings/hr_avatar?key=${FIREBASE_KEY}`;
  try {
    const res = await fetch(firestoreUrl);
    if (!res.ok) return {};
    const doc = await res.json();
    const fields = doc.fields || {};
    const extract = (f) => (f && f.stringValue) ? f.stringValue : '';
    return {
      businessName: extract(fields.businessName || fields.companyName),
      leavePolicy:  extract(fields.leavePolicy),
      workingHours: extract(fields.workingHours),
      extraNotes:   extract(fields.extraNotes || fields.customInstructions),
      avatarName:   extract(fields.avatarName),
    };
  } catch (e) {
    console.warn('[token-server] Firestore fetch failed:', e.message);
    return {};
  }
}

// ── Token generation ─────────────────────────────────────────────────────────
async function generateToken(businessId, employeeName, employeeId) {
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    throw new Error('LiveKit credentials not configured. Set LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET in .env');
  }

  // Create unique room name per session
  const roomName = `hr-${businessId}-${Date.now()}`;
  const identity = `emp-${employeeId || Date.now()}`;

  // Fetch HR config from Firestore to embed in room metadata
  const hrConfig = await fetchHrConfig(businessId);

  // Room metadata — the Python agent reads this in entrypoint()
  const roomMeta = JSON.stringify({
    businessId,
    employeeName: employeeName || 'Employee',
    hrConfig,
  });

  // Create the room in LiveKit with metadata (so agent gets it on dispatch)
  const roomService = new RoomServiceClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
  try {
    await roomService.createRoom({
      name: roomName,
      metadata: roomMeta,
      emptyTimeout: 300,   // 5-min empty room auto-close
      maxParticipants: 10,
    });
  } catch (e) {
    // Room may already exist or service unavailable — token still works
    console.warn('[token-server] createRoom warning:', e.message);
  }

  // Generate participant JWT
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity,
    name: employeeName || 'Employee',
    ttl: '1h',
  });
  at.addGrant({
    room: roomName,
    roomJoin:        true,
    canPublish:      true,   // employee publishes mic
    canSubscribe:    true,   // employee subscribes to avatar video
    canPublishData:  true,   // for RPC text messages
  });

  return {
    serverUrl:        LIVEKIT_URL,
    roomName,
    participantToken: await at.toJwt(),
    participantName:  employeeName || 'Employee',
  };
}

// ── HTTP Server ──────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  setCORS(req, res);

  // Pre-flight
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const parsed  = url.parse(req.url, true);
  const path    = parsed.pathname;
  const query   = parsed.query;

  // Health check
  if (path === '/health' || path === '/') {
    return sendJSON(res, { status: 'ok', service: 'smartclock-hr-token-server', port: PORT });
  }

  // Token endpoint
  if (path === '/token' && req.method === 'GET') {
    const { businessId, employeeName, employeeId } = query;
    if (!businessId) {
      return sendJSON(res, { error: 'businessId is required' }, 400);
    }
    try {
      const details = await generateToken(businessId, employeeName, employeeId);
      return sendJSON(res, details);
    } catch (err) {
      console.error('[token-server] Token generation error:', err.message);
      return sendJSON(res, { error: err.message }, 500);
    }
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[token-server] SmartClock HR Token Server running on port ${PORT}`);
  console.log(`[token-server] LiveKit URL: ${LIVEKIT_URL || '(not set)'}`);
  console.log(`[token-server] Firebase Project: ${FIREBASE_PROJECT}`);
});

server.on('error', (err) => {
  console.error('[token-server] Server error:', err);
});
