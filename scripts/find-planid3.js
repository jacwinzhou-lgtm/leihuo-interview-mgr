const { chromium } = require('playwright');
const { loadSession } = require('./utils');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 400 });
  const context = await loadSession(browser);
  const page = await context.newPage();

  // 拦截所有 XHR，完整记录
  const allResponses = {};
  page.on('response', async resp => {
    const url = resp.url();
    if (!url.includes('xiaozhao.leihuo.netease.com')) return;
    try {
      const body = await resp.text();
      allResponses[url] = body;
    } catch(e) {}
  });

  await page.goto('https://xiaozhao.leihuo.netease.com/select/show#/interview', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  // 搜索薛巍
  await page.fill('input[placeholder="请输入姓名"]', '薛巍');
  await page.getByRole('button', { name: '查询' }).click();
  await page.waitForTimeout(3000);

  // 点击打开面试详情
  try {
    await page.$eval('div.name-list', el => el.click());
    await page.waitForTimeout(2000);
  } catch(e) { console.error('open dialog error:', e.message); }

  // 从所有响应中搜索 plan_id 相关内容
  for (const [url, body] of Object.entries(allResponses)) {
    if (body.includes('interview_plan_id') || body.includes('plan_id')) {
      const short = url.split('/').slice(-3).join('/');
      const context = body.match(/"[^"]*plan_id[^"]*"[^,}]*/g);
      if (context) console.log(`${short}: ${context.slice(0, 5).join(', ')}`);
    }
  }

  // 尝试从 Vue 实例读取数据
  const vueData = await page.evaluate(() => {
    // Vue 2
    const el = document.querySelector('[class*="interview-detail"], .el-dialog__wrapper');
    if (el && el.__vue__) {
      const data = el.__vue__.$data;
      return JSON.stringify(data, null, 2).substring(0, 2000);
    }
    // 找所有有 __vue__ 的元素
    const all = document.querySelectorAll('*');
    for (const e of all) {
      if (e.__vue__ && e.__vue__.$data && JSON.stringify(e.__vue__.$data).includes('plan')) {
        return JSON.stringify(e.__vue__.$data, null, 2).substring(0, 2000);
      }
    }
    return 'no vue data found';
  });

  console.log('Vue data:', vueData.substring(0, 500));
  await browser.close();
})().catch(e => console.error(e.message));
