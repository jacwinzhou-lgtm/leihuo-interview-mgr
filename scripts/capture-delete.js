const { chromium } = require('playwright');
const { loadSession } = require('./utils');
const TARGET_URL = 'https://xiaozhao.leihuo.netease.com/select/show#/interview';

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const context = await loadSession(browser);
  const page = await context.newPage();

  page.on('request', req => {
    const url = req.url();
    if (!url.includes('xiaozhao.leihuo.netease.com')) return;
    if (req.method() !== 'GET') {
      console.log(JSON.stringify({ type: 'REQUEST', method: req.method(), url, postData: req.postData()?.substring(0, 2000) || null }));
    }
  });
  page.on('response', async resp => {
    const url = resp.url();
    if (!url.includes('xiaozhao.leihuo.netease.com') || resp.request().method() === 'GET') return;
    try {
      const body = await resp.text();
      console.log(JSON.stringify({ type: 'RESPONSE', status: resp.status(), url, body: body.substring(0, 500) }));
    } catch(e) {}
  });

  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  console.error('✅ 就绪，请找到薛巍 → 打开面试安排 → 删除那个业务初面 → 点确认');

  await new Promise(r => setTimeout(r, 300000));
  await browser.close();
})().catch(e => console.error(e.message));
