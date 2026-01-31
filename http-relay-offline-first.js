const express = require('express');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const busboy = require('busboy');

const app = express();
const PORT = 7661;
const FIREBASE_WEBHOOK = 'https://us-central1-aiclock-82608.cloudfunctions.net/attendanceWebhook';
const DB_PATH = '/opt/aiclock/aiclock.db';

// Initialize SQLite database
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Database connection error:', err.message);
  } else {
    console.log('✅ Connected to SQLite database');
    initDatabase();
  }
});

// Create tables if they don't exist
function initDatabase() {
  db.run(`
    CREATE TABLE IF NOT EXISTS attendance_events (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      employee_name TEXT,
      event_type TEXT,
      timestamp TEXT NOT NULL,
      source TEXT,
      synced_to_firebase BOOLEAN DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      raw_data TEXT
    )
  `, (err) => {
    if (err) console.error('❌ Table creation error:', err.message);
    else console.log('✅ Database tables ready');
  });

  // Create sync queue for failed Firebase pushes
  db.run(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      retry_count INTEGER DEFAULT 0,
      last_attempt TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (event_id) REFERENCES attendance_events(id)
    )
  `, (err) => {
    if (err) console.error('❌ Sync queue creation error:', err.message);
    else console.log('✅ Sync queue ready');
  });
}

// Parse Hikvision multipart webhook - handles both JSON and XML formats
function parseHikvisionWebhook(req) {
  return new Promise((resolve, reject) => {
    const bb = busboy({ headers: req.headers });
    let deviceId = null;
    let employeeId = null;
    let employeeName = null;
    let eventType = null;
    let timestamp = null;
    let rawData = '';
    let isHeartbeat = true; // Assume heartbeat unless we find real attendance data

    bb.on('field', (name, val) => {
      console.log(`📝 Field [${name}]: ${val.substring(0, 300)}...`);
      rawData = val;

      // Try JSON parsing first (Hikvision uses JSON format for events)
      try {
        const jsonData = JSON.parse(val);
        
        // Check for AccessControllerEvent (real attendance event)
        if (jsonData.AccessControllerEvent) {
          isHeartbeat = false;
          const ace = jsonData.AccessControllerEvent;
          
          deviceId = ace.serialNo || jsonData.serialNo || jsonData.deviceID;
          employeeId = ace.employeeNoString || ace.verifyNo;
          employeeName = ace.name;
          eventType = ace.attendanceStatus || 'in';
          timestamp = ace.time || jsonData.dateTime;
          
          console.log(`✅ JSON AccessControllerEvent parsed:`, {
            deviceId,
            employeeId,
            employeeName,
            eventType
          });
        } else {
          // Heartbeat/keepalive packet
          console.log(`💓 Heartbeat packet (no AccessControllerEvent)`);
        }
      } catch (jsonErr) {
        // Not JSON, try XML parsing
        try {
          // Extract device serial number
          const serialMatch = val.match(/<serialNumber>([^<]+)<\/serialNumber>/i);
          if (serialMatch) {
            deviceId = serialMatch[1];
            console.log(`🔑 Device ID extracted from XML: ${deviceId}`);
          }

          // Extract employee ID
          const empIdMatch = val.match(/<employeeNo[A-Za-z]*>([^<]+)<\/employeeNo[A-Za-z]*>/i);
          if (empIdMatch) {
            employeeId = empIdMatch[1];
            isHeartbeat = false;
            console.log(`👤 Employee ID extracted from XML: ${employeeId}`);
          }

          // Extract employee name
          const nameMatch = val.match(/<name>([^<]+)<\/name>/i);
          if (nameMatch) {
            employeeName = nameMatch[1];
            console.log(`📛 Employee name extracted from XML: ${employeeName}`);
          }

          // Extract event type (attendance status)
          const statusMatch = val.match(/<attendanceStatus>([^<]+)<\/attendanceStatus>/i);
          if (statusMatch) {
            eventType = statusMatch[1].toLowerCase();
            console.log(`📊 Event type extracted from XML: ${eventType}`);
          }

          // Extract timestamp
          const timeMatch = val.match(/<time>([^<]+)<\/time>/i);
          if (timeMatch) {
            timestamp = timeMatch[1];
            console.log(`⏰ Timestamp extracted from XML: ${timestamp}`);
          }
        } catch (xmlErr) {
          console.error('⚠️ XML parsing error:', xmlErr.message);
        }
      }
    });

    bb.on('finish', () => {
      // Try to extract device ID from boundary if not found in payload
      if (!deviceId && req.headers['content-type']) {
        const boundaryMatch = req.headers['content-type'].match(/boundary=([^;,\s]+)/);
        if (boundaryMatch) {
          deviceId = boundaryMatch[1].replace(/^-+/, '');
          console.log(`🔑 Device ID from boundary: ${deviceId}`);
        }
      }

      resolve({
        deviceId,
        employeeId,
        employeeName,
        eventType,
        timestamp: timestamp || new Date().toISOString(),
        rawData,
        isHeartbeat
      });
    });

    bb.on('error', reject);
    req.pipe(bb);
  });
}

// Save event to SQLite (PRIMARY STORAGE - this must succeed)
function saveToSQLite(eventData) {
  return new Promise((resolve, reject) => {
    const eventId = uuidv4();
    const sql = `
      INSERT INTO attendance_events 
      (id, device_id, employee_id, employee_name, event_type, timestamp, source, synced_to_firebase, raw_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      eventId,
      eventData.deviceId,
      eventData.employeeId,
      eventData.employeeName,
      eventData.eventType,
      eventData.timestamp,
      'hikvision_webhook',
      0, // Not synced yet
      eventData.rawData
    ];

    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        console.log(`✅ SQLite: Event saved with ID ${eventId}`);
        resolve(eventId);
      }
    });
  });
}

// Push event to Firebase (SECONDARY - nice to have but not critical)
async function pushToFirebase(eventData) {
  try {
    const response = await axios.post(FIREBASE_WEBHOOK, eventData, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });
    
    console.log(`✅ Firebase: Event pushed successfully`);
    return true;
  } catch (err) {
    console.error(`⚠️ Firebase push failed: ${err.message}`);
    return false;
  }
}

// Mark event as synced in SQLite
function markAsSynced(eventId) {
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE attendance_events SET synced_to_firebase = 1 WHERE id = ?',
      [eventId],
      (err) => {
        if (err) reject(err);
        else {
          console.log(`✅ SQLite: Event ${eventId} marked as synced`);
          resolve();
        }
      }
    );
  });
}

// Add to sync queue if Firebase push fails
function addToSyncQueue(eventId) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT OR IGNORE INTO sync_queue (id, event_id, last_attempt) VALUES (?, ?, ?)',
      [uuidv4(), eventId, new Date().toISOString()],
      (err) => {
        if (err) reject(err);
        else {
          console.log(`📋 Added event ${eventId} to sync queue`);
          resolve();
        }
      }
    );
  });
}

// Webhook endpoint - CRASH-PROOF
app.post('/webhook', async (req, res) => {
  console.log('\n🔔 ===== NEW WEBHOOK RECEIVED =====');
  console.log(`⏰ Time: ${new Date().toISOString()}`);
  
  try {
    // Step 1: Parse Hikvision data
    console.log('🔄 Step 1: Parsing Hikvision webhook...');
    const eventData = await parseHikvisionWebhook(req);
    
    // Skip heartbeat packets
    if (eventData.isHeartbeat) {
      console.log('💓 Heartbeat packet - skipping (no attendance event data)');
      return res.status(200).json({ success: true, message: 'Heartbeat received' });
    }
    
    if (!eventData.deviceId || !eventData.employeeId) {
      console.error('❌ Missing required fields:', { 
        deviceId: eventData.deviceId, 
        employeeId: eventData.employeeId 
      });
      return res.status(400).json({ 
        success: false, 
        error: 'Missing device ID or employee ID' 
      });
    }

    console.log('✅ Parsed attendance event:', {
      deviceId: eventData.deviceId,
      employeeId: eventData.employeeId,
      employeeName: eventData.employeeName,
      eventType: eventData.eventType
    });

    // Step 2: Save to SQLite (CRITICAL - must succeed for offline resilience)
    console.log('🔄 Step 2: Saving to SQLite (primary storage)...');
    let eventId;
    try {
      eventId = await saveToSQLite(eventData);
      console.log(`✅ OFFLINE-SAFE: Event stored in SQLite (ID: ${eventId})`);
    } catch (dbErr) {
      console.error('❌ CRITICAL: SQLite save failed:', dbErr.message);
      // Still return 200 to device so it doesn't retry
      return res.status(200).json({ 
        success: false, 
        error: 'Database error',
        message: 'Event received but storage failed. Please check logs.'
      });
    }

    // Step 3: Try to push to Firebase (nice to have, but not critical)
    console.log('🔄 Step 3: Attempting Firebase push (secondary sync)...');
    const firebaseSuccess = await pushToFirebase(eventData);
    
    if (firebaseSuccess) {
      // Mark as synced
      try {
        await markAsSynced(eventId);
      } catch (err) {
        console.error('⚠️ Failed to mark as synced:', err.message);
      }
    } else {
      // Add to retry queue
      try {
        await addToSyncQueue(eventId);
      } catch (err) {
        console.error('⚠️ Failed to add to sync queue:', err.message);
      }
    }

    console.log('✅ ===== WEBHOOK PROCESSING COMPLETE =====\n');
    
    // Always return success to device
    res.json({ 
      success: true, 
      eventId, 
      offlineSafe: true,
      firebaseSynced: firebaseSuccess 
    });

  } catch (err) {
    // CATCH-ALL ERROR HANDLER - Never crash the relay
    console.error('❌ Webhook processing error:', err.message);
    console.error(err.stack);
    
    // Return 200 to device so it doesn't keep retrying
    res.status(200).json({ 
      success: false, 
      error: 'Processing error',
      message: err.message 
    });
  }
});

// Retry worker - runs every minute to sync failed events
function retryWorker() {
  console.log('\n🔄 Running retry worker...');
  
  db.all(
    `SELECT sq.id as queue_id, sq.event_id, ae.* 
     FROM sync_queue sq 
     JOIN attendance_events ae ON sq.event_id = ae.id 
     WHERE sq.retry_count < 5 
     ORDER BY sq.created_at 
     LIMIT 10`,
    async (err, rows) => {
      if (err) {
        console.error('⚠️ Retry worker error:', err.message);
        return;
      }

      if (rows.length === 0) {
        console.log('✅ Sync queue empty - all events synced');
        return;
      }

      console.log(`📋 Found ${rows.length} events to retry`);

      for (const row of rows) {
        try {
          const eventData = {
            deviceId: row.device_id,
            employeeId: row.employee_id,
            employeeName: row.employee_name,
            eventType: row.event_type,
            timestamp: row.timestamp,
            rawData: row.raw_data
          };

          const success = await pushToFirebase(eventData);

          if (success) {
            // Remove from queue and mark as synced
            await markAsSynced(row.event_id);
            db.run('DELETE FROM sync_queue WHERE id = ?', [row.queue_id]);
            console.log(`✅ Retried and synced event ${row.event_id}`);
          } else {
            // Increment retry count
            db.run(
              'UPDATE sync_queue SET retry_count = retry_count + 1, last_attempt = ? WHERE id = ?',
              [new Date().toISOString(), row.queue_id]
            );
            console.log(`⚠️ Retry failed for event ${row.event_id}`);
          }
        } catch (retryErr) {
          console.error(`⚠️ Error retrying event ${row.event_id}:`, retryErr.message);
        }
      }
    }
  );
}

// Status endpoint
app.get('/', (req, res) => {
  db.get('SELECT COUNT(*) as total FROM attendance_events', (err, row) => {
    const total = err ? 'unknown' : row.total;
    
    db.get('SELECT COUNT(*) as synced FROM attendance_events WHERE synced_to_firebase = 1', (err2, row2) => {
      const synced = err2 ? 'unknown' : row2.synced;
      
      db.get('SELECT COUNT(*) as queued FROM sync_queue', (err3, row3) => {
        const queued = err3 ? 'unknown' : row3.queued;
        
        res.json({
          status: 'online',
          version: 'offline-first-v1.0',
          port: PORT,
          database: DB_PATH,
          stats: {
            totalEvents: total,
            syncedToFirebase: synced,
            pendingSync: queued
          },
          features: [
            'Offline-first architecture',
            'Crash-proof error handling',
            'SQLite primary storage',
            'Firebase secondary sync',
            'Automatic retry queue'
          ]
        });
      });
    });
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║  🚀 OFFLINE-FIRST RELAY - RUNNING                         ║
╠═══════════════════════════════════════════════════════════╣
║  Port:           ${PORT}                                    ║
║  Database:       ${DB_PATH}              ║
║  Architecture:   SQLite → Firebase                        ║
║  Error Handling: Crash-proof                              ║
║  Retry Worker:   Every 60 seconds                         ║
╚═══════════════════════════════════════════════════════════╝
  `);

  // Start retry worker (runs every minute)
  setInterval(retryWorker, 60000);
  
  // Run once on startup
  setTimeout(retryWorker, 5000);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  db.close((err) => {
    if (err) console.error('Error closing database:', err.message);
    else console.log('✅ Database connection closed');
    process.exit(0);
  });
});
