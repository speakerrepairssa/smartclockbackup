# AiClock SQL Device Integration

Optional SQL backend service for enhanced device integration with PostgreSQL database.

## Features

- **Non-breaking**: Works alongside existing Firestore functionality
- **Optional**: Can be enabled/disabled without affecting core features  
- **Dual Storage**: Saves to both SQL and Firestore when enabled
- **Device Sync**: Real-time sync from Hikvision devices
- **Graceful Fallback**: Falls back to Firestore-only if SQL unavailable

## Quick Start

### 1. Install SQL Service Dependencies

```bash
cd sql-service
npm install
```

### 2. Setup PostgreSQL Database

You can use any PostgreSQL database:
- Local PostgreSQL instance
- Google Cloud SQL
- AWS RDS PostgreSQL
- Heroku Postgres

### 3. Start SQL Service

```bash
cd sql-service
npm start
```

The service will run on http://localhost:3001

### 4. Initialize Database Connection

Send a POST request to initialize the database:

```bash
curl -X POST http://localhost:3001/init \
  -H "Content-Type: application/json" \
  -d '{"connectionString": "postgresql://username:password@localhost:5432/aiclock"}'
```

### 5. Deploy Updated Dashboard

```bash
firebase deploy --only hosting
```

## How It Works

1. **Module Loading**: The SQL integration module loads optionally in the dashboard
2. **Auto-Detection**: System automatically detects if SQL service is available
3. **Dual Save**: When enabled, events save to both SQL and Firestore
4. **Graceful Degradation**: If SQL service is down, continues with Firestore only
5. **No Dependencies**: Existing functionality works exactly the same

## API Endpoints

- `GET /health` - Service health check
- `POST /init` - Initialize database connection  
- `POST /events/bulk` - Bulk insert attendance events
- `GET /events` - Query attendance events
- `GET /test-connection` - Test database connection

## Configuration

The SQL integration can be configured in the dashboard:

```javascript
// Optional configuration
await window.sqlDeviceIntegration.initialize({
  sqlEndpoint: 'http://localhost:3001',  // SQL service URL
  syncInterval: 30000,                   // Sync every 30 seconds
  retryAttempts: 3,                      // Retry failed requests
  deviceTimeout: 5000                    // Device connection timeout
});
```

## Benefits

- **Enhanced Performance**: SQL queries for complex reports
- **Better Scalability**: PostgreSQL handles large datasets efficiently  
- **Advanced Analytics**: SQL joins and aggregations
- **Data Backup**: Dual storage provides redundancy
- **Future-Proof**: Easy to migrate to SQL-first architecture later

## Status Indicator

When SQL integration is active, you'll see a green indicator in the top-right corner of the dashboard:

📊 SQL Integration: Active

## Troubleshooting

### SQL Service Won't Start
- Check PostgreSQL is running
- Verify connection string format
- Check port 3001 is available

### Dashboard Shows Firestore Only
- Verify SQL service is running on port 3001
- Check browser console for connection errors
- Test health endpoint: http://localhost:3001/health

### Events Not Syncing to SQL
- Check SQL service logs
- Verify database tables were created
- Test connection endpoint

## Production Deployment

For production, deploy the SQL service to:
- Heroku
- Google Cloud Run  
- AWS Lambda
- Any Node.js hosting

Update the `sqlEndpoint` configuration to point to your production URL.

---

**Note**: This is an optional enhancement. The existing AiClock system works perfectly without SQL integration.