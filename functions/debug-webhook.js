const { onRequest } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");

/**
 * Simple debug webhook to see raw request data
 */
exports.debugWebhook = onRequest(async (req, res) => {
  logger.info("Debug webhook called", {
    method: req.method,
    headers: req.headers,
    url: req.url
  });

  if (req.method !== 'POST') {
    res.status(200).send('Debug webhook ready');
    return;
  }

  // Collect raw body
  let rawBody = '';
  const chunks = [];

  req.on('data', chunk => {
    chunks.push(chunk);
    rawBody += chunk.toString();
  });

  req.on('end', () => {
    const buffer = Buffer.concat(chunks);
    
    logger.info("Raw request data:", {
      contentType: req.headers['content-type'],
      contentLength: req.headers['content-length'],
      bodyLength: buffer.length,
      bodyStart: buffer.slice(0, 500).toString(),
      bodyEnd: buffer.slice(-500).toString(),
      rawHeaders: JSON.stringify(req.headers, null, 2)
    });

    // Try to identify the format
    const bodyStr = buffer.toString();
    if (bodyStr.includes('--MIME_boundary')) {
      logger.info("Detected MIME boundary format");
      
      // Split by boundary and log each part
      const parts = bodyStr.split('--MIME_boundary');
      parts.forEach((part, index) => {
        if (part.trim()) {
          logger.info(`MIME part ${index}:`, part.substring(0, 200));
        }
      });
    }

    res.status(200).json({
      received: true,
      contentType: req.headers['content-type'],
      length: buffer.length,
      preview: buffer.slice(0, 100).toString()
    });
  });

  req.on('error', (err) => {
    logger.error("Request error:", err);
    res.status(500).send('Error receiving data');
  });
});