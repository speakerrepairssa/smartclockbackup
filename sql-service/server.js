// Simple SQL Backend Service for AiClock Device Integration
// Runs independently on port 3001
// Can be started/stopped without affecting the main application

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

class AiClockSQLService {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3001;
    this.pool = null;
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json({ limit: '10mb' }));
    
    // Request logging
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
      next();
    });
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        service: 'AiClock SQL Service',
        timestamp: new Date().toISOString(),
        database: this.pool ? 'connected' : 'disconnected'
      });
    });

    // Initialize database connection
    this.app.post('/init', async (req, res) => {
      try {
        const { connectionString } = req.body;
        await this.initDatabase(connectionString);
        res.json({ success: true, message: 'Database initialized' });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Bulk insert events
    this.app.post('/events/bulk', async (req, res) => {
      try {
        const { events, source } = req.body;
        
        if (!this.pool) {
          return res.status(503).json({ error: 'Database not connected' });
        }

        const result = await this.insertEvents(events, source);
        res.json({
          success: true,
          inserted: result.rowCount,
          source: source || 'unknown'
        });
      } catch (error) {
        console.error('Bulk insert failed:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Get events
    this.app.get('/events', async (req, res) => {
      try {
        const { businessId, startDate, endDate, limit = 100 } = req.query;
        
        if (!this.pool) {
          return res.status(503).json({ error: 'Database not connected' });
        }

        const events = await this.getEvents({ businessId, startDate, endDate, limit });
        res.json({ events, count: events.length });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Test database connection
    this.app.get('/test-connection', async (req, res) => {
      try {
        if (!this.pool) {
          return res.status(503).json({ error: 'Database not initialized' });
        }

        const result = await this.pool.query('SELECT NOW() as timestamp');
        res.json({
          success: true,
          timestamp: result.rows[0].timestamp,
          message: 'Database connection successful'
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  async initDatabase(connectionString) {
    try {
      // Initialize PostgreSQL connection
      this.pool = new Pool({
        connectionString: connectionString,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });

      // Test connection
      await this.pool.query('SELECT NOW()');
      console.log('✅ Database connected successfully');

      // Create tables if they don't exist
      await this.createTables();
      
      return true;
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    }
  }

  async createTables() {
    const createTablesSQL = `
      -- Businesses table
      CREATE TABLE IF NOT EXISTS businesses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- Employees table
      CREATE TABLE IF NOT EXISTS employees (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        employee_id VARCHAR(100) NOT NULL,
        email VARCHAR(255),
        face_encoding TEXT,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(business_id, employee_id)
      );

      -- Attendance events table
      CREATE TABLE IF NOT EXISTS attendance_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
        employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
        event_type VARCHAR(50) NOT NULL,
        timestamp TIMESTAMP NOT NULL,
        device_id VARCHAR(100),
        device_name VARCHAR(255),
        confidence FLOAT,
        source VARCHAR(100) DEFAULT 'device',
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_attendance_events_business_id ON attendance_events(business_id);
      CREATE INDEX IF NOT EXISTS idx_attendance_events_employee_id ON attendance_events(employee_id);
      CREATE INDEX IF NOT EXISTS idx_attendance_events_timestamp ON attendance_events(timestamp);
      CREATE INDEX IF NOT EXISTS idx_attendance_events_device_id ON attendance_events(device_id);
    `;

    await this.pool.query(createTablesSQL);
    console.log('✅ Database tables created/verified');
  }

  async insertEvents(events, source = 'device') {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      const insertPromises = events.map(event => {
        const query = `
          INSERT INTO attendance_events (
            business_id, employee_id, event_type, timestamp, 
            device_id, device_name, confidence, source, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `;

        const values = [
          event.businessId || null,
          event.employeeId || null,
          event.eventType,
          event.timestamp,
          event.deviceId,
          event.deviceName,
          event.confidence || null,
          source,
          JSON.stringify(event.metadata || {})
        ];

        return client.query(query, values);
      });

      const results = await Promise.all(insertPromises);
      await client.query('COMMIT');

      console.log(`✅ Inserted ${events.length} events to SQL database`);
      return { rowCount: events.length };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getEvents({ businessId, startDate, endDate, limit = 100 }) {
    let query = `
      SELECT 
        ae.*,
        e.name as employee_name,
        e.employee_id as employee_number
      FROM attendance_events ae
      LEFT JOIN employees e ON ae.employee_id = e.id
      WHERE 1=1
    `;
    
    const values = [];
    let paramIndex = 1;

    if (businessId) {
      query += ` AND ae.business_id = $${paramIndex}`;
      values.push(businessId);
      paramIndex++;
    }

    if (startDate) {
      query += ` AND ae.timestamp >= $${paramIndex}`;
      values.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND ae.timestamp <= $${paramIndex}`;
      values.push(endDate);
      paramIndex++;
    }

    query += ` ORDER BY ae.timestamp DESC LIMIT $${paramIndex}`;
    values.push(limit);

    const result = await this.pool.query(query, values);
    return result.rows;
  }

  start() {
    this.app.listen(this.port, () => {
      console.log(`🚀 AiClock SQL Service running on port ${this.port}`);
      console.log(`📋 Health check: http://localhost:${this.port}/health`);
      console.log(`🔗 Ready for device integration`);
    });
  }

  async stop() {
    if (this.pool) {
      await this.pool.end();
      console.log('📴 Database connection closed');
    }
  }
}

// Start service if run directly
if (require.main === module) {
  const service = new AiClockSQLService();
  service.start();

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down SQL service...');
    await service.stop();
    process.exit(0);
  });
}

module.exports = AiClockSQLService;