const { chromium } = require('playwright');
const { loadSession } = require('./utils');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await loadSession(browser);
  const page = await context.newPage();

  page.on('request', req => {
    const url = req.url();
    if (!url.includes('xiaozhao.leihuo.netease.com')) return;
    if (req.method() !== 'GET') {
      console.log(JSON.stringify({ type: 'REQUEST', method: req.method(), url, postData: req.postData()?.substring(0, 3000) || null }));
    }
  });
  page.on('response', async resp => {
    const url = resp.url();
    if (!url.includes('xiaozhao.leihuo.netease.com') || resp.request().method() === 'GET') return;
    try {
      const body = await resp.text();
      console.log(JSON.stringify({ type: 'RESPONSE', status: resp.status(), url, body: body.substring(0, 1000) }));
    } catch(e) {}
  });

  await page.goto('https://xiaozhao.leihuo.netease.com/select/show', { waitUntil: 'domcontentloaded', timeout: 30000 });
  console.error('✅ 就绪，请演示修改笔试截止时间的完整流程');
  await new Promise(r => setTimeout(r, 600000));
  await browser.close();
})().catch(e => console.error(e.message));
