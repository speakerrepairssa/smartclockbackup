/**
 * AiClock Enhanced VPS Server v2.0 - Triple Sync Architecture
 * 
 * Architecture:
 * Device → VPS (Master DB) → Firebase (Live Mirror)
 *    ↓         ↓                ↓
 * Catch-up   Instant        Real-time
 *  Sync      Storage         Mirror
 * 
 * Features:
 * - SQLite master database on VPS
 * - Real-time Firebase mirroring
 * - Triple-sync on every event
 * - Offline resilience
 * - HTTP endpoints for direct access
 */

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json());

// ==========================================
// CONFIGURATION
// ==========================================

const CONFIG = {
  port: 7661, // New port for enhanced server
  dbPath: '/opt/aiclock/aiclockdb.sqlite',
  firebaseUrl: 'https://us-central1-aiclock-82608.cloudfunctions.net/attendanceWebhook',
  devices: {
    'fc4349999': { ip: '192.168.7.4', username: 'admin', password: 'Admin@12345' },
    'admin': { ip: '192.168.7.4', username: 'admin', password: 'Admin@12345' },
    'fc4349998': { ip: '192.168.7.5', username: 'admin', password: 'Admin@12345' }
  },
  syncCooldown: 5 * 60 * 1000, // 5 minutes
  maxRetries: 3
};

// ==========================================
// DATABASE INITIALIZATION
// ==========================================

let db;

function initDatabase() {
  console.log('🗄️ Initializing SQLite database...');
  
  // Create database directory if it doesn't exist
  const dbDir = path.dirname(CONFIG.dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new sqlite3.Database(CONFIG.dbPath, (err) => {
    if (err) {
      console.error('❌ Database connection failed:', err.message);
      process.exit(1);
    }
    console.log('✅ Connected to SQLite database:', CONFIG.dbPath);
  });

  // Create tables
  db.serialize(() => {
    // Events table (master storage)
    db.run(`
      CREATE TABLE IF NOT EXISTS attendance_events (
        id TEXT PRIMARY KEY,
        device_id TEXT NOT NULL,
        employee_id TEXT NOT NULL,
        employee_name TEXT,
        action TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        source TEXT DEFAULT 'webhook',
        firebase_synced BOOLEAN DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(device_id, employee_id, timestamp)
      )
    `);

    // Sync status tracking
    db.run(`
      CREATE TABLE IF NOT EXISTS sync_status (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT NOT NULL,
        last_sync_time TEXT,
        events_synced INTEGER DEFAULT 0,
        last_error TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Firebase sync queue
    db.run(`
      CREATE TABLE IF NOT EXISTS firebase_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT NOT NULL,
        retry_count INTEGER DEFAULT 0,
        last_attempt TEXT,
        status TEXT DEFAULT 'pending',
        error_message TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Database tables initialized');
  });
}

// ==========================================
// CORE EVENT STORAGE
// ==========================================

async function storeEvent(eventData) {
  return new Promise((resolve, reject) => {
    const eventId = uuidv4();
    const timestamp = new Date().toISOString();
    
    const query = `
      INSERT OR IGNORE INTO attendance_events 
      (id, device_id, employee_id, employee_name, action, timestamp, source)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    db.run(query, [
      eventId,
      eventData.deviceId,
      eventData.employeeId,
      eventData.employeeName,
      eventData.action,
      eventData.timestamp || timestamp,
      eventData.source || 'webhook'
    ], function(err) {
      if (err) {
        console.error('❌ Failed to store event:', err.message);
        reject(err);
      } else {
        console.log(`✅ Event stored in VPS: ${eventData.employeeName} ${eventData.action}`);
        resolve({ eventId, changes: this.changes });
      }
    });
  });
}

// ==========================================
// FIREBASE MIRRORING
// ==========================================

async function mirrorToFirebase(eventData) {
  try {
    console.log('🔄 Mirroring to Firebase:', eventData.employeeName);
    
    const response = await axios.post(CONFIG.firebaseUrl, eventData, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });
    
    if (response.status === 200) {
      // Mark as synced in local DB
      db.run(
        'UPDATE attendance_events SET firebase_synced = 1 WHERE device_id = ? AND employee_id = ? AND timestamp = ?',
        [eventData.deviceId, eventData.employeeId, eventData.timestamp]
      );
      
      console.log('✅ Event mirrored to Firebase successfully');
      return true;
    }
  } catch (error) {
    console.error('❌ Firebase mirror failed:', error.message);
    
    // Add to retry queue
    db.run(`
      INSERT INTO firebase_queue (event_id, retry_count, last_attempt, status, error_message)
      VALUES (?, 0, ?, 'failed', ?)
    `, [eventData.deviceId + '_' + eventData.timestamp, new Date().toISOString(), error.message]);
    
    return false;
  }
}

// ==========================================
// DEVICE SYNC (Catch-up)
// ==========================================

async function syncFromDevice(deviceId) {
  const deviceConfig = CONFIG.devices[deviceId];
  if (!deviceConfig) {
    console.error('❌ Device not configured:', deviceId);
    return { success: false, error: 'Device not configured' };
  }

  try {
    console.log(`🔄 Syncing from device ${deviceId}...`);
    
    // Get last 24 hours of events from device
    const endTime = new Date().toISOString();
    const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const auth = Buffer.from(`${deviceConfig.username}:${deviceConfig.password}`).toString('base64');
    const deviceUrl = `http://${deviceConfig.ip}/ISAPI/AccessControl/AcsEvent?format=json&startTime=${startTime}&endTime=${endTime}`;
    
    const response = await axios.get(deviceUrl, {
      headers: { 'Authorization': `Basic ${auth}` },
      timeout: 15000
    });
    
    const events = Array.isArray(response.data) ? response.data : [response.data];
    let syncedCount = 0;
    
    for (const event of events) {
      if (event.employeeNoString) {
        const eventData = {
          deviceId: deviceId,
          employeeId: event.employeeNoString,
          employeeName: event.name || 'Unknown',
          action: event.attendanceStatus === '1' ? 'in' : 'out',
          timestamp: event.time,
          source: 'sync'
        };
        
        const result = await storeEvent(eventData);
        if (result.changes > 0) {
          syncedCount++;
          // Mirror new events to Firebase
          await mirrorToFirebase(eventData);
        }
      }
    }
    
    // Update sync status
    db.run(`
      INSERT OR REPLACE INTO sync_status (device_id, last_sync_time, events_synced)
      VALUES (?, ?, ?)
    `, [deviceId, new Date().toISOString(), syncedCount]);
    
    console.log(`✅ Device sync complete: ${syncedCount} events synced from ${deviceId}`);
    return { success: true, syncedCount };
    
  } catch (error) {
    console.error(`❌ Device sync failed for ${deviceId}:`, error.message);
    return { success: false, error: error.message };
  }
}

// ==========================================
// WEBHOOK RECEIVER
// ==========================================

app.post('/webhook', async (req, res) => {
  try {
    console.log('📨 Webhook received:', req.body);
    
    const eventData = {
      deviceId: req.body.deviceId || 'fc4349999',
      employeeId: req.body.employeeId,
      employeeName: req.body.employeeName,
      action: req.body.action,
      timestamp: req.body.timestamp || new Date().toISOString(),
      source: 'webhook'
    };
    
    // STEP 1: Store in VPS (Master DB)
    const storeResult = await storeEvent(eventData);
    
    // STEP 2: Mirror to Firebase immediately
    const mirrorSuccess = await mirrorToFirebase(eventData);
    
    // STEP 3: Trigger device catch-up sync (background)
    setTimeout(() => {
      syncFromDevice(eventData.deviceId);
    }, 1000);
    
    // STEP 4: Trigger Firebase consistency sync (background)
    setTimeout(() => {
      processFirebaseQueue();
    }, 2000);
    
    res.json({ 
      success: true, 
      eventId: storeResult.eventId,
      mirrored: mirrorSuccess,
      message: 'Event processed with triple-sync'
    });
    
  } catch (error) {
    console.error('❌ Webhook processing failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// MANUAL SYNC ENDPOINTS
// ==========================================

app.post('/sync/:deviceId', async (req, res) => {
  try {
    const deviceId = req.params.deviceId;
    console.log(`🔄 Manual sync triggered for device: ${deviceId}`);
    
    const result = await syncFromDevice(deviceId);
    
    if (result.success) {
      res.json({ 
        success: true, 
        count: result.syncedCount,
        message: `Synced ${result.syncedCount} events from device ${deviceId}`
      });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('❌ Manual sync failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// QUERY ENDPOINTS
// ==========================================

app.get('/events', async (req, res) => {
  try {
    const { deviceId, employeeId, start, end, limit = 100 } = req.query;
    
    let query = 'SELECT * FROM attendance_events WHERE 1=1';
    const params = [];
    
    if (deviceId) {
      query += ' AND device_id = ?';
      params.push(deviceId);
    }
    
    if (employeeId) {
      query += ' AND employee_id = ?';
      params.push(employeeId);
    }
    
    if (start) {
      query += ' AND timestamp >= ?';
      params.push(start);
    }
    
    if (end) {
      query += ' AND timestamp <= ?';
      params.push(end);
    }
    
    query += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(parseInt(limit));
    
    db.all(query, params, (err, rows) => {
      if (err) {
        res.status(500).json({ success: false, error: err.message });
      } else {
        res.json({ success: true, events: rows, count: rows.length });
      }
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/status', (req, res) => {
  db.all('SELECT * FROM sync_status ORDER BY last_sync_time DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ success: false, error: err.message });
    } else {
      res.json({ 
        success: true, 
        server: 'AiClock Enhanced VPS v2.0 - Triple Sync Active',
        syncStatus: rows,
        uptime: process.uptime()
      });
    }
  });
});

// ==========================================
// FIREBASE RETRY QUEUE PROCESSOR
// ==========================================

async function processFirebaseQueue() {
  try {
    db.all(`
      SELECT fq.*, ae.* 
      FROM firebase_queue fq 
      JOIN attendance_events ae ON fq.event_id LIKE ae.device_id || '%' 
      WHERE fq.status = 'failed' AND fq.retry_count < ?
      LIMIT 10
    `, [CONFIG.maxRetries], async (err, rows) => {
      if (err) return;
      
      for (const row of rows) {
        const eventData = {
          deviceId: row.device_id,
          employeeId: row.employee_id,
          employeeName: row.employee_name,
          action: row.action,
          timestamp: row.timestamp,
          source: row.source
        };
        
        const success = await mirrorToFirebase(eventData);
        
        if (success) {
          db.run('UPDATE firebase_queue SET status = "completed" WHERE id = ?', [row.id]);
        } else {
          db.run(`
            UPDATE firebase_queue 
            SET retry_count = retry_count + 1, last_attempt = ? 
            WHERE id = ?
          `, [new Date().toISOString(), row.id]);
        }
      }
    });
  } catch (error) {
    console.error('❌ Firebase queue processing failed:', error);
  }
}

// ==========================================
// HEALTH CHECK
// ==========================================

app.get('/', (req, res) => {
  res.json({
    server: 'AiClock Enhanced VPS Server v2.0',
    status: 'Triple-Sync Architecture Active',
    features: [
      'SQLite Master Database',
      'Real-time Firebase Mirroring', 
      'Device Catch-up Sync',
      'Triple Redundancy',
      'Offline Resilience'
    ],
    timestamp: new Date().toISOString()
  });
});

// ==========================================
// SERVER STARTUP
// ==========================================

function startServer() {
  initDatabase();
  
  app.listen(CONFIG.port, () => {
    console.log(`
🚀 AiClock Enhanced VPS Server v2.0 Started
🌐 Port: ${CONFIG.port}
🗄️ Database: ${CONFIG.dbPath}
🔄 Triple-Sync Architecture Active
📡 Firebase Mirror: ${CONFIG.firebaseUrl}
    `);
  });

  // Start background processes
  setInterval(processFirebaseQueue, 60000); // Process queue every minute
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Enhanced VPS Server...');
  if (db) {
    db.close((err) => {
      if (err) {
        console.error('❌ Database close error:', err.message);
      } else {
        console.log('✅ Database connection closed');
      }
    });
  }
  process.exit(0);
});

// Start the server
startServer();