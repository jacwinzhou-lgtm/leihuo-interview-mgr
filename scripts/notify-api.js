/**
 * 发送面试通知 - 纯API版本
 * 用法：node notify-api.js --resume_id "5520260323165810385"
 */

const path = require('path');
const os = require('os');
const fs = require('fs');

const SESSION_PATH = path.join(os.homedir(), '.xiaozhao-session.json');
const BASE_URL = 'https://xiaozhao.leihuo.netease.com';

function parseArgs() {
  const args = {};
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i].startsWith('--')) {
      args[process.argv[i].slice(2)] = process.argv[i + 1] || '';
      i++;
    }
  }
  return args;
}

function getCookieString() {
  if (!fs.existsSync(SESSION_PATH)) return null;
  const session = JSON.parse(fs.readFileSync(SESSION_PATH, 'utf-8'));
  return session.cookies
    .filter(c => c.domain.includes('netease.com'))
    .map(c => `${c.name}=${c.value}`)
    .join('; ');
}

async function apiRequest(cookieStr, method, path, body = null) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    'Cookie': cookieStr,
    'Content-Type': 'application/json',
    'Referer': `${BASE_URL}/select/show`,
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  };
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);
  const resp = await fetch(url, options);
  return await resp.json();
}

(async () => {
  const args = parseArgs();
  const resumeId = args.resume_id;

  if (!resumeId) {
    console.error('用法: node notify-api.js --resume_id "xxx"');
    process.exit(1);
  }

  const cookieStr = getCookieString();
  if (!cookieStr) { console.error('未找到session，请先登录'); process.exit(1); }

  const notifyBody = (moduleId, moduleTitle, moduleContent) => ({
    module_title: moduleTitle,
    module_content: moduleContent,
    module_id: moduleId,
    receive_type: '1',
    resume_ids: [resumeId],
    page_key: 'interview_list',
    extend_data: { pageKey: 'interview_list' }
  });

  console.error('[1/2] 发送邮件通知...');
  const mailResult = await apiRequest(cookieStr, 'POST', '/notice/mail/send_notice',
    notifyBody('733', '【网易游戏雷火】面试邀请函', '<!--此模板不可使用-->')
  );

  console.error('[2/2] 发送短信/消息通知...');
  const msgResult = await apiRequest(cookieStr, 'POST', '/notice/message/send_notice',
    notifyBody('734', '',
      '亲爱的<!--employee_name-->同学，您好！\n感谢您参加网易游戏雷火事业群校招，恭喜您进入<!--position_name-->岗位视频面试环节。具体面试安排可至您的<!--employee_mail-->邮箱查看，如有问题请邮件联系campusleihuo@163.com，预祝面试顺利！'
    )
  );

  const mailOk = mailResult.status === 200;
  const msgOk = msgResult.status === 200;

  console.log(JSON.stringify({
    status: (mailOk && msgOk) ? 'success' : 'partial',
    mail: mailOk ? '✅ 邮件发送成功' : `❌ 邮件失败：${mailResult.msg}`,
    message: msgOk ? '✅ 消息发送成功' : `❌ 消息失败：${msgResult.msg}`
  }));
})().catch(e => {
  console.error('[fatal]', e.message);
  process.exit(1);
});
