const path = require('path');
const os = require('os');
const fs = require('fs');

const SESSION_PATH = path.join(os.homedir(), '.xiaozhao-session.json');
const TARGET_URL = 'https://xiaozhao.leihuo.netease.com/select/show#/interview';

/** 加载 session，返回 browser context（如果 session 文件存在） */
async function loadSession(browser, opts = {}) {
  const { viewport = { width: 1440, height: 900 } } = opts;
  if (!fs.existsSync(SESSION_PATH)) {
    return null;
  }
  try {
    const context = await browser.newContext({
      storageState: SESSION_PATH,
      viewport,
    });
    return context;
  } catch (err) {
    console.error('[utils] loadSession failed:', err.message);
    return null;
  }
}

/** 保存 session 到文件 */
async function saveSession(context) {
  const state = await context.storageState();
  fs.writeFileSync(SESSION_PATH, JSON.stringify(state, null, 2));
  console.error('[utils] session saved to', SESSION_PATH);
}

/** 等待元素出现 */
async function waitForElement(page, selector, timeout = 10000) {
  try {
    await page.waitForSelector(selector, { state: 'visible', timeout });
    return await page.$(selector);
  } catch {
    return null;
  }
}

/** 自然语言时间解析 → Date 对象 */
function parseNaturalTime(text) {
  const now = new Date();

  // ISO-like: "2026-04-15T14:00" or "2026-04-15 14:00"
  let match = text.match(/(\d{4})-(\d{1,2})-(\d{1,2})[T\s](\d{1,2}):(\d{2})/);
  if (match) {
    return new Date(
      parseInt(match[1], 10),
      parseInt(match[2], 10) - 1,
      parseInt(match[3], 10),
      parseInt(match[4], 10),
      parseInt(match[5], 10)
    );
  }

  // "明天10点" / "明天上午10点" / "明天下午3点"
  match = text.match(/明天\s*(?:(上午|下午))?\s*(\d{1,2})(?::(\d{2}))?\s*点?/);
  if (match) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    let hour = parseInt(match[2], 10);
    if (match[1] === '下午' && hour < 12) hour += 12;
    if (match[1] === '上午' && hour === 12) hour = 0;
    d.setHours(hour, match[3] ? parseInt(match[3], 10) : 0, 0, 0);
    return d;
  }

  // "后天下午3点"
  match = text.match(/后天\s*(?:(上午|下午))?\s*(\d{1,2})(?::(\d{2}))?\s*点?/);
  if (match) {
    const d = new Date(now);
    d.setDate(d.getDate() + 2);
    let hour = parseInt(match[2], 10);
    if (match[1] === '下午' && hour < 12) hour += 12;
    if (match[1] === '上午' && hour === 12) hour = 0;
    d.setHours(hour, match[3] ? parseInt(match[3], 10) : 0, 0, 0);
    return d;
  }

  // "今天下午2点"
  match = text.match(/今天\s*(?:(上午|下午))?\s*(\d{1,2})(?::(\d{2}))?\s*点?/);
  if (match) {
    const d = new Date(now);
    let hour = parseInt(match[2], 10);
    if (match[1] === '下午' && hour < 12) hour += 12;
    if (match[1] === '上午' && hour === 12) hour = 0;
    d.setHours(hour, match[3] ? parseInt(match[3], 10) : 0, 0, 0);
    return d;
  }

  // "4月15日14:00" / "4月15号下午2点"
  match = text.match(/(\d{1,2})月(\d{1,2})[日号]\s*(?:(上午|下午))?\s*(\d{1,2})(?::(\d{2}))?\s*点?/);
  if (match) {
    const d = new Date(now.getFullYear(), parseInt(match[1], 10) - 1, parseInt(match[2], 10));
    let hour = parseInt(match[4], 10);
    if (match[3] === '下午' && hour < 12) hour += 12;
    if (match[3] === '上午' && hour === 12) hour = 0;
    d.setHours(hour, match[5] ? parseInt(match[5], 10) : 0, 0, 0);
    return d;
  }

  // "下午3点" （默认今天）
  match = text.match(/(?:(上午|下午))?\s*(\d{1,2})(?::(\d{2}))?\s*点/);
  if (match) {
    const d = new Date(now);
    let hour = parseInt(match[2], 10);
    if (match[1] === '下午' && hour < 12) hour += 12;
    if (match[1] === '上午' && hour === 12) hour = 0;
    d.setHours(hour, match[3] ? parseInt(match[3], 10) : 0, 0, 0);
    return d;
  }

  return null;
}

/** sleep */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 解析命令行参数 --key value 形式 */
function parseArgs(argDefs) {
  const args = process.argv.slice(2);
  const result = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--') && args[i + 1] !== undefined) {
      const key = args[i].slice(2);
      result[key] = args[++i];
    }
  }
  return result;
}

/** 输出 JSON 到 stdout 并退出 */
function output(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

/** 格式化 Date 为可读字符串 */
function formatDateTime(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

module.exports = {
  SESSION_PATH,
  TARGET_URL,
  loadSession,
  saveSession,
  waitForElement,
  parseNaturalTime,
  sleep,
  parseArgs,
  output,
  formatDateTime,
};
