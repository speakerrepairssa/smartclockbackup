/**
 * AiClock Triple-Sync VPS Server v2.0
 * Master Database Architecture with SQLite Storage
 * 
 * Flow: Device → VPS (SQLite) → Firebase (Mirror)
 * Triple-Sync: Device ↔ VPS ↔ Firebase (all stay identical)
 */

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = 7660; // Back to original port

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.raw({ limit: '10mb', type: 'multipart/form-data' }));

// Device Configuration
const DEVICES = {
  'fc4349999': { ip: '192.168.7.4', username: 'admin', password: 'Admin@12345' },
  'admin': { ip: '192.168.7.4', username: 'admin', password: 'Admin@12345' },
  'fc4349998': { ip: '192.168.7.5', username: 'admin', password: 'Admin@12345' }
};

// Firebase Configuration
const FIREBASE_FUNCTION_URL = 'https://us-central1-aiclock-82608.cloudfunctions.net/attendanceWebhook';

// Sync state tracking
const syncCooldowns = new Map();
const COOLDOWN_MINUTES = 5;

// Initialize SQLite Database
const DB_PATH = '/opt/aiclock/attendance.db';
const db = new sqlite3.Database(DB_PATH);

// Database Schema
const initDatabase = () => {
  console.log('🗄️ Initializing SQLite database...');
  
  // Create attendance_events table
  db.run(`
    CREATE TABLE IF NOT EXISTS attendance_events (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      employee_name TEXT,
      event_type TEXT,
      timestamp TEXT NOT NULL,
      source TEXT DEFAULT 'webhook',
      synced_to_firebase BOOLEAN DEFAULT 0,
      raw_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create devices table
  db.run(`
    CREATE TABLE IF NOT EXISTS devices (
      device_id TEXT PRIMARY KEY,
      ip_address TEXT,
      username TEXT,
      password TEXT,
      last_sync_time TEXT,
      status TEXT DEFAULT 'active'
    )
  `);

  // Create sync_status table for retry logic
  db.run(`
    CREATE TABLE IF NOT EXISTS sync_status (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT,
      firebase_synced BOOLEAN DEFAULT 0,
      retry_count INTEGER DEFAULT 0,
      last_error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Insert device configurations
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO devices (device_id, ip_address, username, password) 
    VALUES (?, ?, ?, ?)
  `);
  
  Object.entries(DEVICES).forEach(([deviceId, config]) => {
    stmt.run(deviceId, config.ip, config.username, config.password);
  });
  stmt.finalize();

  console.log('✅ SQLite database initialized');
};

// Store event in SQLite (Master Database)
const storeEventInDatabase = async (eventData) => {
  return new Promise((resolve, reject) => {
    const eventId = `${eventData.deviceId}_${eventData.timestamp}_${Date.now()}`;
    
    const query = `
      INSERT INTO attendance_events 
      (id, device_id, employee_id, employee_name, event_type, timestamp, source, raw_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    db.run(query, [
      eventId,
      eventData.deviceId || 'unknown',
      eventData.employeeId || 'unknown',
      eventData.employeeName || '',
      eventData.action || 'unknown',
      eventData.timestamp,
      eventData.source || 'webhook',
      JSON.stringify(eventData)
    ], function(err) {
      if (err) {
        console.error('❌ SQLite storage error:', err);
        reject(err);
      } else {
        console.log(`✅ Event stored in SQLite: ${eventId}`);
        resolve(eventId);
      }
    });
  });
};

// Forward event to Firebase (Live Mirror)
const forwardToFirebase = async (eventData, eventId) => {
  try {
    console.log('🔄 Forwarding to Firebase:', eventId);
    
    const response = await axios.post(FIREBASE_FUNCTION_URL, eventData, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });

    if (response.status === 200) {
      // Mark as synced in database
      db.run(
        'UPDATE attendance_events SET synced_to_firebase = 1 WHERE id = ?',
        [eventId]
      );
      console.log(`✅ Firebase sync complete: ${eventId}`);
      return true;
    }
  } catch (error) {
    console.error('❌ Firebase sync failed:', error.message);
    
    // Log failed sync for retry
    db.run(`
      INSERT INTO sync_status (event_id, firebase_synced, retry_count, last_error)
      VALUES (?, 0, 1, ?)
    `, [eventId, error.message]);
    
    return false;
  }
};

// Query device for historical events (Triple-Sync Part 3)
const syncDeviceHistory = async (deviceId) => {
  const deviceConfig = DEVICES[deviceId];
  if (!deviceConfig) {
    console.log(`⚠️ Device config not found: ${deviceId}`);
    return;
  }

  // Check cooldown
  const lastSync = syncCooldowns.get(deviceId);
  const cooldownEnd = lastSync ? lastSync + (COOLDOWN_MINUTES * 60 * 1000) : 0;
  
  if (Date.now() < cooldownEnd) {
    const remaining = Math.round((cooldownEnd - Date.now()) / 1000 / 60);
    console.log(`⏳ Sync cooldown active for ${deviceId}: ${remaining}m remaining`);
    return;
  }

  try {
    console.log(`🔄 Starting device history sync: ${deviceId}`);
    
    // Get last 24 hours of events from device
    const endTime = new Date().toISOString();
    const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const auth = Buffer.from(`${deviceConfig.username}:${deviceConfig.password}`).toString('base64');
    const apiUrl = `http://${deviceConfig.ip}/ISAPI/AccessControl/AcsEvent?format=json&startTime=${startTime}&endTime=${endTime}`;
    
    const response = await axios.get(apiUrl, {
      headers: { 'Authorization': `Basic ${auth}` },
      timeout: 15000
    });

    const events = response.data?.AcsEvent?.InfoList || [];
    let syncedCount = 0;

    for (const event of events) {
      const eventData = {
        deviceId: deviceId,
        employeeId: event.employeeNoString || 'unknown',
        employeeName: event.name || '',
        action: event.type === 1 ? 'in' : 'out',
        timestamp: event.time,
        source: 'sync'
      };

      // Check if event already exists in SQLite
      const existsQuery = 'SELECT id FROM attendance_events WHERE device_id = ? AND timestamp = ? AND employee_id = ?';
      
      db.get(existsQuery, [deviceId, event.time, eventData.employeeId], async (err, row) => {
        if (!row) {
          // Store new event
          const eventId = await storeEventInDatabase(eventData);
          await forwardToFirebase(eventData, eventId);
          syncedCount++;
        }
      });
    }

    // Update sync cooldown and device status
    syncCooldowns.set(deviceId, Date.now());
    db.run('UPDATE devices SET last_sync_time = ? WHERE device_id = ?', [new Date().toISOString(), deviceId]);
    
    console.log(`✅ Device sync complete: ${deviceId} (${syncedCount} new events)`);
    
  } catch (error) {
    console.error(`❌ Device sync failed for ${deviceId}:`, error.message);
  }
};

// =================== API ENDPOINTS ===================

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'AiClock Triple-Sync Server v2.0 - Running',
    port: PORT,
    database: 'SQLite Master Database Active',
    timestamp: new Date().toISOString()
  });
});

// Webhook receiver from devices (Primary event flow)
app.post('/webhook', async (req, res) => {
  console.log('📡 Webhook received from device');
  
  try {
    let eventData;
    
    // Parse multipart form data or JSON
    if (req.headers['content-type']?.includes('multipart/form-data')) {
      const body = req.body.toString();
      const lines = body.split('\n');
      
      // Extract device ID from boundary or body
      const deviceMatch = body.match(/I[A-Za-z0-9]+/);
      const deviceId = deviceMatch ? deviceMatch[0].toLowerCase() : 'unknown';
      
      eventData = {
        deviceId: deviceId,
        timestamp: new Date().toISOString(),
        source: 'webhook',
        rawBody: body
      };
    } else {
      eventData = req.body;
      eventData.source = 'webhook';
    }

    // STEP 1: Store in SQLite (Master Database)
    const eventId = await storeEventInDatabase(eventData);
    
    // STEP 2: Forward to Firebase (Live Mirror) 
    const firebaseSuccess = await forwardToFirebase(eventData, eventId);
    
    // Respond to device immediately
    res.status(200).json({ status: 'received', eventId: eventId });
    
    // STEP 3: Trigger device history sync (background, after response)
    setTimeout(() => {
      if (eventData.deviceId && DEVICES[eventData.deviceId]) {
        syncDeviceHistory(eventData.deviceId);
      }
    }, 500);
    
  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    res.status(500).json({ error: 'Processing failed' });
  }
});

// Manual sync endpoint
app.post('/sync/:deviceId', async (req, res) => {
  const { deviceId } = req.params;
  
  console.log(`🔄 Manual sync requested for: ${deviceId}`);
  
  try {
    // Force sync (ignore cooldown for manual requests)
    syncCooldowns.delete(deviceId);
    await syncDeviceHistory(deviceId);
    
    // Count synced events
    const countQuery = 'SELECT COUNT(*) as count FROM attendance_events WHERE device_id = ? AND source = "sync"';
    
    db.get(countQuery, [deviceId], (err, row) => {
      const count = row ? row.count : 0;
      res.json({ 
        status: 'success', 
        message: `Manual sync completed for ${deviceId}`,
        count: count
      });
    });
    
  } catch (error) {
    console.error('❌ Manual sync error:', error);
    res.status(500).json({ error: error.message });
  }
});

// API: Get events from SQLite (Fast local queries)
app.get('/api/events', (req, res) => {
  const { deviceId, startDate, endDate, limit = 100 } = req.query;
  
  let query = 'SELECT * FROM attendance_events WHERE 1=1';
  const params = [];
  
  if (deviceId) {
    query += ' AND device_id = ?';
    params.push(deviceId);
  }
  
  if (startDate) {
    query += ' AND timestamp >= ?';
    params.push(startDate);
  }
  
  if (endDate) {
    query += ' AND timestamp <= ?';
    params.push(endDate);
  }
  
  query += ' ORDER BY timestamp DESC LIMIT ?';
  params.push(parseInt(limit));
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json({ events: rows, count: rows.length });
    }
  });
});

// API: Get sync status
app.get('/api/sync-status', (req, res) => {
  const query = `
    SELECT 
      d.device_id,
      d.last_sync_time,
      COUNT(e.id) as total_events,
      SUM(CASE WHEN e.synced_to_firebase = 1 THEN 1 ELSE 0 END) as synced_events,
      SUM(CASE WHEN e.synced_to_firebase = 0 THEN 1 ELSE 0 END) as pending_events
    FROM devices d
    LEFT JOIN attendance_events e ON d.device_id = e.device_id
    GROUP BY d.device_id
  `;
  
  db.all(query, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json({ devices: rows });
    }
  });
});

// Retry failed Firebase syncs
const retryFailedSyncs = async () => {
  console.log('🔄 Checking for failed Firebase syncs...');
  
  const query = `
    SELECT e.id, e.*, s.retry_count 
    FROM attendance_events e
    JOIN sync_status s ON e.id = s.event_id
    WHERE e.synced_to_firebase = 0 AND s.retry_count < 5
  `;
  
  db.all(query, [], async (err, rows) => {
    if (err) {
      console.error('❌ Retry query error:', err);
      return;
    }
    
    for (const row of rows) {
      const eventData = JSON.parse(row.raw_data);
      const success = await forwardToFirebase(eventData, row.id);
      
      if (success) {
        console.log(`✅ Retry successful: ${row.id}`);
      } else {
        // Increment retry count
        db.run(
          'UPDATE sync_status SET retry_count = retry_count + 1 WHERE event_id = ?',
          [row.id]
        );
      }
    }
  });
};

// =================== SERVER STARTUP ===================

// Initialize database and start server
initDatabase();

// Start retry mechanism (every 5 minutes)
setInterval(retryFailedSyncs, 5 * 60 * 1000);

app.listen(PORT, () => {
  console.log('🚀 AiClock Triple-Sync Server v2.0 Started');
  console.log(`📡 Listening on port: ${PORT}`);
  console.log(`🗄️ Database: ${DB_PATH}`);
  console.log(`🔄 Sync cooldown: ${COOLDOWN_MINUTES} minutes`);
  console.log(`🎯 Firebase endpoint: ${FIREBASE_FUNCTION_URL}`);
  console.log('');
  console.log('🏗️ Architecture: Device → VPS (SQLite) → Firebase (Mirror)');
  console.log('✅ Triple-redundancy active: Device ↔ VPS ↔ Firebase');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  db.close((err) => {
    if (err) {
      console.error('❌ Database close error:', err);
    } else {
      console.log('✅ Database connection closed');
    }
    process.exit(0);
  });
});

module.exports = app;