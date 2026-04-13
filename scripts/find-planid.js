const { chromium } = require('playwright');
const { loadSession } = require('./utils');
const TARGET_URL = 'https://xiaozhao.leihuo.netease.com/select/show#/interview';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await loadSession(browser);
  const page = await context.newPage();

  // 拦截所有响应，找包含 plan_id 的
  const planIds = {};
  page.on('response', async resp => {
    const url = resp.url();
    if (!url.includes('xiaozhao.leihuo.netease.com')) return;
    try {
      const body = await resp.text();
      // 找5-6位纯数字ID
      const ids = body.match(/"[^"]*plan_id[^"]*":"([0-9]{5,6})"/g);
      if (ids) {
        console.error(`Found in ${url.split('?')[0].split('/').slice(-2).join('/')}: ${ids.join(', ')}`);
        ids.forEach(m => {
          const match = m.match(/"([^"]+)":"([0-9]+)"/);
          if (match) planIds[match[1]] = planIds[match[1]] || [];
          planIds[match[1]].push(match[2]);
        });
      }
    } catch(e) {}
  });

  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  // 搜索薛巍
  const nameInput = await page.$('input[placeholder="请输入姓名"]');
  await nameInput.fill('薛巍');
  await page.getByRole('button', { name: '查询' }).click();
  await page.waitForTimeout(3000);

  // 点击打开弹窗
  try { await page.locator('tbody').getByText('周家杰').first().click(); } catch(e) {}
  await page.waitForTimeout(2000);

  // 点击面试安排
  try { await page.getByText('面试安排', { exact: true }).click(); } catch(e) {}
  await page.waitForTimeout(2000);

  console.log('Found plan IDs:', JSON.stringify(planIds));
  await browser.close();
})().catch(e => console.error(e.message));
