#!/bin/bash
# Direct VPS deployment - bypasses SSH keys, uses password only

echo "🚀 Uploading relay file to VPS..."

# Upload file (password-only, no keys)
/usr/local/bin/sshpass -p 'Azam198419880001#' scp \
  -o PreferredAuthentications=password \
  -o PubkeyAuthentication=no \
  -o StrictHostKeyChecking=no \
  vps/http-relay-with-sync.js root@69.62.109.168:/root/

if [ $? -eq 0 ]; then
  echo "✅ File uploaded successfully"
else
  echo "❌ Upload failed"
  exit 1
fi

echo ""
echo "🔄 Restarting PM2 service..."

# Restart service (password-only, no keys)
/usr/local/bin/sshpass -p 'Azam198419880001#' ssh \
  -o PreferredAuthentications=password \
  -o PubkeyAuthentication=no \
  -o StrictHostKeyChecking=no \
  root@69.62.109.168 \
  'ls -lh /root/http-relay-with-sync.js && pm2 restart all && sleep 2 && curl http://localhost:7660/health'

echo ""
echo "🧪 Testing from external..."
curl -s http://69.62.109.168:7660/health | head -200

echo ""
echo "✅ Done! If health returns JSON with 'sync' endpoint, it worked!"
