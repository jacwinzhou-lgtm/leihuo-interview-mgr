/**
 * step-login.js - 登录 / 检查 Session
 *
 * 输入：无参数
 * 输出（JSON stdout）：
 *   { "status": "ok" }
 *   { "status": "need_login", "message": "..." }
 *
 * 如果需要登录，会打开有头浏览器，等待用户在浏览器中完成登录（最长180秒）。
 * 登录成功后保存 session 并输出 { "status": "ok" }。
 */

const { chromium } = require('playwright');
const fs = require('fs');
const { SESSION_PATH, TARGET_URL, loadSession, saveSession, sleep, output } = require('./utils');

const LOGIN_WAIT_TIMEOUT = 180000; // 180秒

(async () => {
  let browser = null;

  try {
    // Phase 1: 检查已有 session 是否有效（用 headless 快速检查）
    if (fs.existsSync(SESSION_PATH)) {
      console.error('[login] found existing session, validating...');
      browser = await chromium.launch({ headless: true });
      const context = await loadSession(browser);

      if (context) {
        const page = await context.newPage();
        try {
          await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await page.waitForTimeout(3000);

          const currentUrl = page.url();
          console.error('[login] current URL:', currentUrl);

          if (currentUrl.includes('xiaozhao.leihuo.netease.com') && !currentUrl.includes('login.netease.com')) {
            // Session 有效
            output({ status: 'ok' });
            await browser.close();
            return;
          }
        } catch (err) {
          console.error('[login] session validation error:', err.message);
        }
        await context.close();
      }

      await browser.close();
      browser = null;
      console.error('[login] session invalid or expired');
    } else {
      console.error('[login] no session file found');
    }

    // Phase 2: 需要手动登录 → 打开有头浏览器
    output({ status: 'need_login', message: '请在浏览器窗口中完成登录，登录成功后回到对话中告诉我即可' });

    browser = await chromium.launch({ headless: false, slowMo: 300 });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    console.error('[login] waiting for manual login (max 180s)...');

    // 轮询等待 URL 变化，说明登录成功
    const startTime = Date.now();
    let loggedIn = false;

    while (Date.now() - startTime < LOGIN_WAIT_TIMEOUT) {
      const url = page.url();
      if (url.includes('xiaozhao.leihuo.netease.com') && !url.includes('login.netease.com')) {
        loggedIn = true;
        break;
      }
      await sleep(1000);
    }

    if (!loggedIn) {
      output({ status: 'error', message: '等待登录超时（180秒）' });
      await browser.close();
      process.exit(1);
    }

    // 登录成功，多等一会让页面完全加载
    await page.waitForTimeout(2000);
    await saveSession(context);
    output({ status: 'ok' });

    await browser.close();

  } catch (err) {
    console.error('[login] fatal error:', err.message);
    output({ status: 'error', message: err.message });
    if (browser) await browser.close().catch(() => {});
    process.exit(1);
  }
})();
