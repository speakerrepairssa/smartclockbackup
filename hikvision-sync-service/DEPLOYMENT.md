# Hikvision WebSDK Device Sync - Deployment Guide

## 🚀 Deployment to Hostinger VPS

### Prerequisites
- VPS with Node.js 18+ installed
- Network access to Hikvision device (192.168.0.114)
- PM2 for process management

### 1. Upload Files to VPS
```bash
# Upload the entire hikvision-sync-service folder to your VPS
scp -r hikvision-sync-service/ user@your-vps-ip:/home/user/
```

### 2. Install Dependencies
```bash
cd /home/user/hikvision-sync-service/
npm install
```

### 3. Start the Service

#### Option A: Direct Start (for testing)
```bash
npm run websdk
```

#### Option B: Production Start with PM2
```bash
# Install PM2 globally
npm install -g pm2

# Start the WebSDK service
pm2 start websdk-server.js --name "hikvision-websdk"

# Save PM2 configuration
pm2 save
pm2 startup
```

### 4. Configure Nginx (Optional)
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location /hikvision-sync/ {
        proxy_pass http://localhost:3002/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 5. Test Deployment
```bash
# Test health endpoint
curl http://your-vps-ip:3002/health

# Test device extraction
curl http://your-vps-ip:3002/device/extract

# Access WebSDK interface
http://your-vps-ip:3002/interface
```

## 🔧 Configuration

### Environment Variables
```bash
export DEVICE_IP=192.168.0.114
export DEVICE_PORT=80
export DEVICE_USERNAME=admin
export DEVICE_PASSWORD=Azam198419880001
export SERVICE_PORT=3002
```

### Update AiClock Dashboard
Update the VPS URL in your business dashboard to:
```
http://your-vps-ip:3002
```
Or with Nginx:
```
http://your-domain.com/hikvision-sync
```

## 📊 Service Endpoints

- **Health Check**: `GET /health`
- **Extract Events**: `GET /device/extract`
- **WebSDK Interface**: `GET /interface`
- **Device Login**: `POST /device/login`
- **Device Logout**: `POST /device/logout`

## 🔍 Troubleshooting

### Check Service Status
```bash
pm2 status
pm2 logs hikvision-websdk
```

### Check Network Connectivity
```bash
ping 192.168.0.114
curl -k -u admin:password http://192.168.0.114/SDK/capabilities
```

### Restart Service
```bash
pm2 restart hikvision-websdk
```

## 📝 Notes

- The service automatically falls back to simulated data if device API calls fail
- Real device integration requires the VPS to be on the same network as the Hikvision device
- WebSDK files are served statically from `/websdk` endpoint
- All API calls include proper authentication and error handling

## 🎯 Next Steps

1. Deploy to your VPS
2. Test device connectivity from VPS
3. Update AiClock dashboard VPS URL
4. Test end-to-end sync workflow