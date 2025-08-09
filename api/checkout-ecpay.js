// /api/checkout-ecpay.js (CommonJS)
const { supabaseAdmin } = require('./_lib/supabaseAdmin.js');
const { genCheckMacValue, getAioCheckOutUrl } = require('./_lib/ecpay.js');
const { parseBody } = require('./_lib/body.js');

function pad2(n){ return String(n).padStart(2, '0'); }
function ymdHis(d){
  const yy = d.getFullYear();
  const mm = pad2(d.getMonth()+1);
  const dd = pad2(d.getDate());
  const HH = pad2(d.getHours());
  const MM = pad2(d.getMinutes());
  const SS = pad2(d.getSeconds());
  return `${yy}/${mm}/${dd} ${HH}:${MM}:${SS}`;
}
function makeTradeNo(){
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i=0;i<20;i++) s += chars[Math.floor(Math.random()*chars.length)];
  return s;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405; return res.end('Method Not Allowed');
  }
  try {
    const body = await parseBody(req);
    const {
      items = [],
      email = '',
      name = '',
      user_id = null,
      return_url = process.env.SITE_URL ? `${process.env.SITE_URL}/api/ecpay-client` : '',
    } = body || {};

    if (!process.env.ECPAY_MERCHANT_ID) throw new Error('Missing ECPAY_MERCHANT_ID');
    if (!process.env.ECPAY_HASH_KEY) throw new Error('Missing ECPAY_HASH_KEY');
    if (!process.env.ECPAY_HASH_IV) throw new Error('Missing ECPAY_HASH_IV');
    if (!process.env.SITE_URL) throw new Error('Missing SITE_URL (your https domain)');
    if (!Array.isArray(items) || !items.length) { res.statusCode=400; return res.end('Cart is empty'); }

    const amount = items.reduce((sum, it) => sum + (it.price||0) * (it.qty||1), 0);

    const { data: order, error: orderErr } = await supabaseAdmin
      .from('orders')
      .insert({ total_amount: amount, status: 'pending', user_id })
      .select()
      .single();
    if (orderErr) throw orderErr;

    const orderItems = items.map(it => ({
      order_id: order.id,
      product_id: it.product_id || null,
      name: it.name,
      quantity: it.qty || 1,
      unit_price: it.price || 0
    }));
    if (orderItems.length) {
      const { error: oiErr } = await supabaseAdmin.from('order_items').insert(orderItems);
      if (oiErr) console.warn('Insert order_items error:', oiErr);
    }

    const MerchantTradeNo = makeTradeNo();
    await supabaseAdmin.from('orders').update({ gateway_order_no: MerchantTradeNo }).eq('id', order.id);
    await supabaseAdmin.from('payments').insert({ order_id: order.id, gateway: 'ecpay', gateway_order_no: MerchantTradeNo, status: 'INIT', raw: {} });

    const params = {
      MerchantID: process.env.ECPAY_MERCHANT_ID,
      MerchantTradeNo,
      MerchantTradeDate: ymdHis(new Date()),
      PaymentType: 'aio',
      TotalAmount: amount,
      TradeDesc: `Order ${order.id}`,
      ItemName: items.map(it => `${it.name} x ${it.qty||1}`).join('#'),
      ReturnURL: `${process.env.SITE_URL}/api/ecpay-return`,
      OrderResultURL: return_url,
      ChoosePayment: 'Credit',
      EncryptType: 1,
      CustomField1: order.id
    };

    const CheckMacValue = genCheckMacValue(params, { HashKey: process.env.ECPAY_HASH_KEY, HashIV: process.env.ECPAY_HASH_IV });
    const action = getAioCheckOutUrl();

    const inputs = Object.entries({ ...params, CheckMacValue })
      .map(([k,v]) => `<input type="hidden" name="${k}" value="${String(v).replace(/"/g,'&quot;')}" />`)
      .join('\n');

    const html = `<!doctype html><html lang="zh-TW"><head><meta charset="utf-8"><title>Redirecting to ECPay...</title></head>
<body>
  <p>正在前往綠界付款頁面，請稍候…</p>
  <form id="__ecpayForm" method="POST" action="${action}">
    ${inputs}
    <noscript><button type="submit">前往綠界付款</button></noscript>
  </form>
  <script>document.getElementById('__ecpayForm').submit();</script>
</body></html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.statusCode = 200;
    return res.end(html);
  } catch (err) {
    console.error(err);
    res.statusCode = 500;
    return res.end(String(err?.message || err));
  }
};
