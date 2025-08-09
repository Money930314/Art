// /api/_lib/body.js
const querystring = require('querystring');

async function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8') || '';
        const ct = (req.headers['content-type'] || '').toLowerCase();
        if (ct.includes('application/json')) {
          resolve(raw ? JSON.parse(raw) : {});
        } else if (ct.includes('application/x-www-form-urlencoded')) {
          resolve(querystring.parse(raw));
        } else {
          try { resolve(JSON.parse(raw)); }
          catch { resolve(querystring.parse(raw)); }
        }
      } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

module.exports = { parseBody };
