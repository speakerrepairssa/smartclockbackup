// Simple script to create basic app icons
const fs = require('fs');
const path = require('path');

// Create a simple SVG icon
const createSVGIcon = (width, height, text) => `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="#3498db"/>
  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" 
        fill="white" font-family="Arial" font-size="${width/8}" font-weight="bold">${text}</text>
</svg>`;

// Create SVG files
const iconSVG = createSVGIcon(1024, 1024, 'AI');
const splashSVG = createSVGIcon(1284, 2778, 'AIClock');

// Ensure assets directory exists
const assetsDir = 'assets';
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Write icon files
fs.writeFileSync(path.join(assetsDir, 'icon.svg'), iconSVG);
fs.writeFileSync(path.join(assetsDir, 'splash.svg'), splashSVG);

console.log('Created basic SVG icons for the app');