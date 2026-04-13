const { chromium } = require('playwright');
const { loadSession } = require('./utils');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await loadSession(browser);
  const page = await context.newPage();

  // 拦截所有响应，找任何包含 "15xxxx" 数字的
  page.on('response', async resp => {
    const url = resp.url();
    if (!url.includes('xiaozhao.leihuo.netease.com')) return;
    try {
      const body = await resp.text();
      // 找5-6位数字（plan_id 范围）
      const nums = body.match(/\b15[0-9]{4}\b/g);
      if (nums && nums.length > 0) {
        const unique = [...new Set(nums)];
        console.log(`URL: ${url.split('/').slice(-2).join('/')}`);
        console.log(`Found numbers: ${unique.join(', ')}`);
        // 打印该数字周围的上下文
        unique.forEach(n => {
          const idx = body.indexOf(n);
          if (idx >= 0) console.log(`  Context: ...${body.substring(Math.max(0, idx-30), idx+50)}...`);
        });
      }
    } catch(e) {}
  });

  const TARGET = 'https://xiaozhao.leihuo.netease.com/select/show#/interview';
  await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  // 搜索薛巍
  const nameInput = await page.$('input[placeholder="请输入姓名"]');
  await nameInput.fill('薛巍');
  await page.getByRole('button', { name: '查询' }).click();
  await page.waitForTimeout(3000);

  // 打开面试详情弹窗
  try {
    await page.locator('tbody').getByText('周家杰').first().click();
    await page.waitForTimeout(2000);
    // 点击面试安排
    await page.getByText('面试安排', { exact: true }).click();
    await page.waitForTimeout(2000);
  } catch(e) { console.log('click error:', e.message); }

  console.log('DONE');
  await browser.close();
})().catch(e => console.error(e.message));
