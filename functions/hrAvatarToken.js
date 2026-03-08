/**
 * hrAvatarToken — Firebase Cloud Function (HTTPS)
 * Generates a LiveKit room token for the SmartClock HR Avatar.
 * Called by hr-avatar.html instead of the bare-HTTP VPS endpoint,
 * so there are no mixed-content issues from the HTTPS Firebase Hosting domain.
 *
 * GET /hrAvatarToken?businessId=X&employeeName=X&employeeId=X
 */

const { onRequest } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');
const { AccessToken, RoomServiceClient } = require('livekit-server-sdk');

const LIVEKIT_URL       = process.env.LIVEKIT_URL       || 'wss://smartclock-live-agent-9q52p8u5.livekit.cloud';
const LIVEKIT_API_KEY   = process.env.LIVEKIT_API_KEY   || '';
const LIVEKIT_API_SECRET= process.env.LIVEKIT_API_SECRET|| '';

exports.hrAvatarToken = onRequest(
  { region: 'us-central1', cors: true },
  async (req, res) => {
    // CORS pre-flight
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'GET');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      return res.status(204).send('');
    }

    const { businessId, employeeName = 'Employee', employeeId = '' } = req.query;

    if (!businessId) {
      return res.status(400).json({ error: 'businessId is required' });
    }

    try {
      // ── Fetch HR Avatar config from Firestore ────────────────────────────
      const db   = getFirestore();
      const snap = await db.doc(`businesses/${businessId}/settings/hr_avatar`).get();
      const cfg  = snap.exists ? snap.data() : {};

      const hrConfig = {
        businessName : cfg.businessName  || businessId,
        leavePolicy  : cfg.policyLeave   || '',
        workingHours : cfg.policyHours   || '',
        extraNotes   : cfg.policyOther   || '',
      };

      // ── Create LiveKit room with HR config as metadata ───────────────────
      const roomName        = `hr-${businessId}-${Date.now()}`;
      const participantName = `emp-${(employeeId || employeeName).replace(/\s+/g, '-').toLowerCase()}`;

      const roomMetadata = JSON.stringify({
        businessId,
        employeeName,
        employeeId,
        hrConfig,
      });

      const roomSvc = new RoomServiceClient(
        LIVEKIT_URL,
        LIVEKIT_API_KEY,
        LIVEKIT_API_SECRET
      );
      await roomSvc.createRoom({ name: roomName, metadata: roomMetadata });

      // ── Generate participant token ────────────────────────────────────────
      const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
        identity: participantName,
        name    : employeeName,
        ttl     : '2h',
      });
      at.addGrant({
        roomJoin     : true,
        room         : roomName,
        canPublish   : true,
        canSubscribe : true,
      });

      const participantToken = await at.toJwt();

      return res.status(200).json({
        serverUrl       : LIVEKIT_URL,
        roomName,
        participantToken,
        participantName,
      });

    } catch (err) {
      console.error('hrAvatarToken error:', err);
      return res.status(500).json({ error: err.message });
    }
  }
);
