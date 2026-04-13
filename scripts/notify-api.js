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

  // Step 1: 获取面试计划，拿到面试官 user_id 列表
  console.error('[1/4] 获取面试官列表...');
  const detailResult = await apiRequest(cookieStr, 'GET', `/api/new/interview/feedback/show?resume_id=${resumeId}`);
  const feedbackList = detailResult.data?.interview_feedback_list || {};
  const interviewerUserIds = [];
  for (const rounds of Object.values(feedbackList)) {
    for (const round of rounds) {
      for (const fb of (round.feedback_list || [])) {
        if (fb.user_id && !interviewerUserIds.includes(String(fb.user_id))) {
          interviewerUserIds.push(String(fb.user_id));
        }
      }
    }
  }
  console.error(`面试官 user_ids: ${interviewerUserIds.join(', ')}`);

  // Step 2: 候选人邮件通知
  console.error('[2/4] 发送候选人邮件...');
  const mailResult = await apiRequest(cookieStr, 'POST', '/notice/mail/send_notice', {
    module_title: '【网易游戏雷火】面试邀请函',
    module_content: '<!--此模板不可使用-->',
    module_id: '733',
    receive_type: '1',
    resume_ids: [resumeId],
    page_key: 'interview_list',
    extend_data: { pageKey: 'interview_list' }
  });

  // Step 3: 候选人消息通知
  console.error('[3/4] 发送候选人消息...');
  const msgResult = await apiRequest(cookieStr, 'POST', '/notice/message/send_notice', {
    module_title: '',
    module_content: '亲爱的<!--employee_name-->同学，您好！\n感谢您参加网易游戏雷火事业群校招，恭喜您进入<!--position_name-->岗位视频面试环节。具体面试安排可至您的<!--employee_mail-->邮箱查看，如有问题请邮件联系campusleihuo@163.com，预祝面试顺利！',
    module_id: '734',
    receive_type: '1',
    resume_ids: [resumeId],
    page_key: 'interview_list',
    extend_data: { pageKey: 'interview_list' }
  });

  // Step 4: 面试官邮件通知（module_id 713，receive_type 2，含 user_ids）
  console.error('[4/4] 发送面试官通知邮件...');
  let interviewerMailResult = { status: 200 };
  if (interviewerUserIds.length > 0) {
    interviewerMailResult = await apiRequest(cookieStr, 'POST', '/notice/mail/send_notice', {
      module_title: '【重要】雷火校招面试安排请查收！',
      module_content: '',
      module_id: '713',
      receive_type: '2',
      resume_ids: [resumeId],
      user_ids: interviewerUserIds,
      page_key: 'interview_list'
    });
  }

  const mailOk = mailResult.status === 200;
  const msgOk = msgResult.status === 200;
  const interviewerOk = interviewerMailResult.status === 200;

  console.log(JSON.stringify({
    status: (mailOk && msgOk && interviewerOk) ? 'success' : 'partial',
    mail: mailOk ? '✅ 候选人邮件发送成功' : `❌ 候选人邮件失败：${mailResult.msg}`,
    message: msgOk ? '✅ 候选人消息发送成功' : `❌ 候选人消息失败：${msgResult.msg}`,
    interviewer_mail: interviewerOk ? '✅ 面试官通知邮件发送成功' : `❌ 面试官邮件失败：${interviewerMailResult.msg}`
  }));
})().catch(e => {
  console.error('[fatal]', e.message);
  process.exit(1);
});
