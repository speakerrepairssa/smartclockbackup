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
const { AccessToken, RoomServiceClient, AgentDispatchClient } = require('livekit-server-sdk');

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
      const db = getFirestore();

      // ── Fetch HR Avatar config ─────────────────────────────────────────────
      const [hrSnap, empSnap] = await Promise.all([
        db.doc(`businesses/${businessId}/settings/hr_avatar`).get(),
        employeeId ? db.doc(`businesses/${businessId}/employees/${employeeId}`).get() : Promise.resolve(null),
      ]);

      const cfg = hrSnap.exists ? hrSnap.data() : {};
      const hrConfig = {
        businessName : cfg.businessName  || businessId,
        voiceMode    : cfg.hrVoiceMode   || 'livekit-bey',
        leavePolicy  : cfg.policyLeave   || '',
        cashPolicy   : cfg.policyCash    || '',
        workingHours : cfg.policyHours   || '',
        extraNotes   : cfg.policyOther   || '',
        // BEY
        beyAvatarId  : cfg.beyAvatarId   || '',
        // Simli
        simliAvatarId: cfg.simliAvatarId || '',
        simliApiKey  : cfg.simliApiKey   || '',
      };

      // ── Fetch employee profile ─────────────────────────────────────────────
      let employeeProfile = null;
      if (empSnap && empSnap.exists) {
        const e = empSnap.data();
        employeeProfile = {
          name       : e.name        || employeeName,
          position   : e.position    || e.jobTitle  || '',
          department : e.department  || '',
          hourlyRate : e.hourlyRate  || null,
          phone      : e.phone       || '',
          email      : e.email       || '',
          startDate  : e.startDate   || e.joiningDate || '',
          idNumber   : e.idNumber    || '',
          status     : e.status      || 'active',
        };
      }

      // ── Fetch latest assessment (most recent month doc) ────────────────────
      let latestAssessment = null;
      if (employeeId) {
        const now = new Date();
        const tryMonths = [
          `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
          `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`,
        ];
        for (const month of tryMonths) {
          const aSnap = await db.doc(`businesses/${businessId}/assessments/${month}_${employeeId}`).get();
          if (!aSnap.exists) {
            // Try querying the assessments subcollection under employee
            const aSnap2 = await db.doc(`businesses/${businessId}/employees/${employeeId}/assessments/${month}`).get();
            if (aSnap2.exists) {
              const a = aSnap2.data();
              latestAssessment = { month, ...a };
              break;
            }
          } else {
            const a = aSnap.data();
            latestAssessment = { month, ...a };
            break;
          }
        }

        // Fallback: query assessments collection for this employee
        if (!latestAssessment) {
          const assQuery = await db.collection(`businesses/${businessId}/assessments`)
            .where('employeeId', '==', employeeId)
            .orderBy('month', 'desc')
            .limit(1)
            .get();
          if (!assQuery.empty) {
            const a = assQuery.docs[0].data();
            latestAssessment = { month: a.month || 'recent', ...a };
          }
        }
      }

      // ── Fetch pending applications (leave/cash advance) ────────────────────
      let pendingApplications = [];
      if (employeeId) {
        const appsSnap = await db.collection(`businesses/${businessId}/applications`)
          .where('employeeId', '==', employeeId)
          .where('status', '==', 'pending')
          .limit(5)
          .get();
        pendingApplications = appsSnap.docs.map(d => {
          const a = d.data();
          return { type: a.type, status: a.status, date: a.date || a.startDate || '', amount: a.amount || null };
        });
      }

      // ── Create LiveKit room with full employee context as metadata ─────────
      const roomName        = `hr-${businessId}-${Date.now()}`;
      const participantName = `emp-${(employeeId || employeeName).replace(/\s+/g, '-').toLowerCase()}`;

      const roomMetadata = JSON.stringify({
        businessId,
        employeeName,
        employeeId,
        hrConfig,
        employeeProfile,
        latestAssessment,
        pendingApplications,
      });

      const roomSvc = new RoomServiceClient(
        LIVEKIT_URL,
        LIVEKIT_API_KEY,
        LIVEKIT_API_SECRET
      );
      await roomSvc.createRoom({ name: roomName, metadata: roomMetadata });

      // ── Dispatch the HR agent to the room ─────────────────────────────────
      const agentSvc = new AgentDispatchClient(
        LIVEKIT_URL,
        LIVEKIT_API_KEY,
        LIVEKIT_API_SECRET
      );
      await agentSvc.createDispatch(roomName, 'smartclock-hr-agent', {
        metadata: roomMetadata,
      });

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
