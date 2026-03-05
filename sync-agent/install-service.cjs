/**
 * Registers sync-agent.cjs as a Windows Service.
 * Run via: node install-service.cjs
 */
const path    = require('path');
const Service = require('node-windows').Service;

const svc = new Service({
  name:        'SmartClock Connector',
  description: 'SmartClock local device sync — automatically syncs Hikvision attendance events to the cloud.',
  script:      path.join(__dirname, 'sync-agent.cjs'),
  nodeOptions: [],
  wait:        2,     // restart delay seconds
  grow:        0.5    // restart backoff factor
});

svc.on('install', () => {
  console.log('[ok] SmartClock Connector service installed.');
  svc.start();
  console.log('[ok] Service started.');
  console.log('     Open setup: http://localhost:7663');
  process.exit(0);
});

svc.on('alreadyinstalled', () => {
  console.log('[ok] Service already installed — restarting...');
  svc.start();
  process.exit(0);
});

svc.on('error', (err) => {
  console.error('[!] Service error:', err);
  process.exit(1);
});

svc.install();
