// /api/_lib/ecpay.js (CommonJS)
const crypto = require('crypto');

function toEcpayUrlEncode(str) {
  return encodeURIComponent(str)
    .toLowerCase()
    .replace(/%2d/g, '-')  // -
    .replace(/%5f/g, '_')  // _
    .replace(/%2e/g, '.')  // .
    .replace(/%21/g, '!')  // !
    .replace(/%2a/g, '*')  // *
    .replace(/%28/g, '(')  // (
    .replace(/%29/g, ')')  // )
    .replace(/%20/g, '+'); // space -> +
}

function genCheckMacValue(params, { HashKey, HashIV }) {
  const entries = Object.entries(params)
    .filter(([k, v]) => k.toLowerCase() !== 'checkmacvalue' && v !== undefined && v !== null)
    .sort((a, b) => a[0].localeCompare(b[0]));
  const qs = entries.map(([k, v]) => `${k}=${v}`).join('&');
  const raw = `HashKey=${HashKey}&${qs}&HashIV=${HashIV}`;
  const encoded = toEcpayUrlEncode(raw);
  const hash = crypto.createHash('sha256').update(encoded).digest('hex').toUpperCase();
  return hash;
}

function verifyCheckMacValue(obj, { HashKey, HashIV }) {
  const posted = String(obj.CheckMacValue || '');
  const computed = genCheckMacValue(obj, { HashKey, HashIV });
  return posted.toUpperCase() === computed.toUpperCase();
}

function getAioCheckOutUrl() {
  const endpoint = process.env.ECPAY_ENDPOINT || 'stage';
  return endpoint === 'prod'
    ? 'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5'
    : 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5';
}

module.exports = { genCheckMacValue, verifyCheckMacValue, getAioCheckOutUrl };
