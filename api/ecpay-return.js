// /api/ecpay-return.js (CommonJS)
const { supabaseAdmin } = require('./_lib/supabaseAdmin.js');
const { verifyCheckMacValue } = require('./_lib/ecpay.js');
const { parseBody } = require('./_lib/body.js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.statusCode=405; return res.end('Method Not Allowed'); }
  try {
    const data = await parseBody(req);
    const ok = verifyCheckMacValue(data, { HashKey: process.env.ECPAY_HASH_KEY, HashIV: process.env.ECPAY_HASH_IV });
    if (!ok) {
      console.warn('ECPay ReturnURL CheckMacValue mismatch', data);
      res.statusCode = 400; return res.end('0|CheckMacValue Error');
    }

    const rtnCode = Number(data.RtnCode || 0);
    const orderId = data.CustomField1 || null;
    const MerchantTradeNo = data.MerchantTradeNo || null;

    await supabaseAdmin.from('payments').insert({
      order_id: orderId,
      gateway: 'ecpay',
      gateway_order_no: MerchantTradeNo,
      status: String(rtnCode),
      raw: data
    });

    if (orderId) {
      if (rtnCode === 1) {
        await supabaseAdmin.from('orders').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', orderId);
      } else {
        await supabaseAdmin.from('orders').update({ status: 'failed' }).eq('id', orderId);
      }
    }

    res.statusCode = 200;
    return res.end('1|OK');
  } catch (e) {
    console.error(e);
    res.statusCode = 500;
    return res.end('0|ERROR');
  }
};
