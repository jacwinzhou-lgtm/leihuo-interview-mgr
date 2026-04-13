const { chromium } = require('playwright');
const { loadSession } = require('./utils');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await loadSession(browser);
  const page = await context.newPage();

  // 所有请求都记录（含GET），找弹窗加载接口
  page.on('request', req => {
    const url = req.url();
    if (!url.includes('xiaozhao.leihuo.netease.com')) return;
    const postData = req.postData();
    if (req.method() !== 'GET' || url.includes('written_exam') || url.includes('deadline')) {
      console.log(JSON.stringify({ type: 'REQUEST', method: req.method(), url: url.split('?')[0], postData: postData?.substring(0, 500) || null }));
    }
  });
  page.on('response', async resp => {
    const url = resp.url();
    if (!url.includes('xiaozhao.leihuo.netease.com')) return;
    if (!url.includes('written_exam') && !url.includes('deadline') && !url.includes('exam')) return;
    try {
      const body = await resp.text();
      console.log(JSON.stringify({ type: 'RESPONSE', method: resp.request().method(), status: resp.status(), url: url.split('?')[0], body: body.substring(0, 2000) }));
    } catch(e) {}
  });

  await page.goto('https://xiaozhao.leihuo.netease.com/select/show#/exam', { waitUntil: 'domcontentloaded', timeout: 30000 });
  console.error('✅ 就绪：搜索候选人 → 点开「修改截止时间」弹窗（不用保存）');
  await new Promise(r => setTimeout(r, 300000));
  await browser.close();
})().catch(e => console.error(e.message));
