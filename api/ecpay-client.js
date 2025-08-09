// /api/ecpay-client.js (CommonJS)
const { verifyCheckMacValue } = require('./_lib/ecpay.js');
const { parseBody } = require('./_lib/body.js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode=200;
    return res.end('<!doctype html><meta charset="utf-8"><title>ECPay</title><p>請由綠界導回本頁。</p>');
  }
  const data = await parseBody(req);
  const ok = verifyCheckMacValue(data, { HashKey: process.env.ECPAY_HASH_KEY, HashIV: process.env.ECPAY_HASH_IV });
  const success = ok && Number(data.RtnCode||0) === 1;

  const html = `<!doctype html><html lang="zh-TW"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1"><title>付款結果</title>
  <style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft JhengHei',sans-serif;padding:24px;line-height:1.7}
  .card{max-width:560px;margin:40px auto;border:1px solid #e5e5e5;border-radius:12px;padding:24px}
  .ok{color:#0a0}.fail{color:#a00}</style></head><body>
  <div class="card">
    <h2 class="${success?'ok':'fail'}">${success?'付款成功 ✅':'付款未完成 ❌'}</h2>
    <div>交易序號(綠界)：<b>${data.TradeNo||''}</b></div>
    <div>訂單編號(商店)：<b>${data.MerchantTradeNo||''}</b></div>
    <div>金額：<b>${data.TradeAmt||data.Amount||''}</b></div>
    <hr/>
    <p>＊以伺服器通知（ReturnURL）為準；若頁面顯示與訂單狀態不符，請稍後重新整理訂單頁。</p>
    <p><a href="${process.env.SITE_URL || '/'}">回到商店</a></p>
  </div></body></html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.statusCode=200;
  return res.end(html);
};
