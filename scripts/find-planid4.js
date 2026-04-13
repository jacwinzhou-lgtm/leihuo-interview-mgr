const { chromium } = require('playwright');
const { loadSession } = require('./utils');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 400 });
  const context = await loadSession(browser);
  const page = await context.newPage();

  await page.goto('https://xiaozhao.leihuo.netease.com/select/show#/interview', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  // 搜索薛巍
  await page.fill('input[placeholder="请输入姓名"]', '薛巍');
  await page.getByRole('button', { name: '查询' }).click();
  await page.waitForTimeout(3000);

  // 打开面试详情弹窗
  try {
    await page.$eval('div.name-list', el => el.click());
    await page.waitForTimeout(2000);
    // 点击面试安排
    await page.getByText('面试安排', { exact: true }).click();
    await page.waitForTimeout(2000);
  } catch(e) { console.error('dialog open error:', e.message); }

  // 读 Vue 组件 originalList
  const planData = await page.evaluate(() => {
    // 找包含 originalList 或 interview_plan_list 的 Vue 实例
    const all = document.querySelectorAll('*');
    for (const el of all) {
      const v = el.__vue__;
      if (!v) continue;
      if (v.$data && v.$data.originalList) {
        return JSON.stringify(v.$data.originalList, null, 2).substring(0, 3000);
      }
      if (v.originalList) {
        return JSON.stringify(v.originalList, null, 2).substring(0, 3000);
      }
    }
    // 递归搜索 $children
    function findInChildren(vm) {
      if (vm.$data && vm.$data.originalList) return JSON.stringify(vm.$data.originalList).substring(0, 2000);
      for (const child of (vm.$children || [])) {
        const r = findInChildren(child);
        if (r) return r;
      }
      return null;
    }
    const root = document.querySelector('#app')?.__vue__;
    if (root) return findInChildren(root);
    return 'not found';
  });

  console.log('Plan data:', planData);
  await browser.close();
})().catch(e => console.error(e.message));
