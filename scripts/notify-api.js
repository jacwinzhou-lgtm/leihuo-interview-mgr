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

  // Step 4: 面试官邮件通知（逐个发送，避免单个失败影响全体）
  console.error('[4/4] 发送面试官通知邮件...');
  const MODULE_CONTENT = '亲爱的面试官<!--interview_user_name-->您好，\n\n您有以下校招面试安排，请提前做好准备：\n<!--interview_user_plan-->\n\n为确保校招面试质量，请您务必阅读并遵守以下注意事项：\n【面试前准备】\n· 请提前打印简历，评估学生过往经历，查阅笔试/测试题成绩或作品，做好面试问题准备；\n· 提前预定会议室，准备笔记本电脑并提前调试设备，打开摄像头；\n【面试中】\n· 面试中可看到候选人电脑摄像头画面和手机二机位拍摄的面试环境画面，如面试中候选人二机位画面关闭或不合规，请与候选人沟通让其开启或调整二机位，以保证二机位面试有效进行。\n· 通过行为面试法深入挖掘学生过往行为，对疑点进行追问（可登录易Learning系统·雷火校招面试官培训查看）。\n· 如发现候选人面试中有作弊行为，请于当场指出并制止；并于面试后在校招系统-面试评价中标注或反馈给校招HR，校招组将核实并通知同学取消后续面试安排（如有）、拉入黑名单。\n· 关注面试礼仪，尊重候选人，勿告知面试结论等。\n【面试结束后】\n· 请在当天20:00前填写面试评价，请详细填写学生优势/顾虑及面试过程详情，你的评价对面试结果及后续安排非常关键。\n· 如有特殊情况（包括但不仅限于作弊、抄袭、建议转岗等），请及时反馈对接HR。\n\n雷火校招网站链接： http://xiaozhao.leihuo.netease.com\n\n若有问题可以联系对接HR：\n• 雷火UX、测试中心、伏羲：陈婉斯 chenwansi@corp.netease.com\n• 游戏策划（系统、数值、战斗、运营）、营销：张青 zhangqing03@corp.netease.com\n• 游戏程序、TD：余雪 yuxue05@corp.netease.com\n• 游戏美术（动作、特效）、TA、交互、音频部：周家杰 zhoujiajie@corp.netease.com\n• 游戏策划（文案、关卡、任务）、游戏美术（角色、场景、导演）：解绍巍 xieshaowei@corp.netease.com\n• 平台创新中心：吴曼婷 wumanting@corp.netease.com\n• 项目管理：周颖 zhouying17@corp.netease.com\n\nIT资产电脑借用地点：\n一期A1F-严选商店出门左转15m处\n二期3号楼1F-B区北- IT资产服务中心\n\n雷火校招组';
  const interviewerResults = [];
  for (const uid of interviewerUserIds) {
    const r = await apiRequest(cookieStr, 'POST', '/notice/mail/send_notice', {
      module_title: '【重要】雷火校招面试安排请查收！',
      module_content: MODULE_CONTENT,
      module_id: '713',
      receive_type: '2',
      resume_ids: [resumeId],
      user_ids: [uid],
      page_key: 'interview_list'
    });
    interviewerResults.push({ uid, ok: r.status === 200, msg: r.msg, warning: r.data?.warnings?.[0] });
  }
  const interviewerOk = interviewerResults.every(r => r.ok);
  const interviewerMsg = interviewerResults.length === 0 ? '无面试官' :
    interviewerResults.map(r => r.ok ? `✅ ${r.uid} 发送成功` : `❌ ${r.uid} 失败：${r.warning || r.msg}`).join('；');

  const mailOk = mailResult.status === 200;
  const msgOk = msgResult.status === 200;

  console.log(JSON.stringify({
    status: (mailOk && msgOk && interviewerOk) ? 'success' : 'partial',
    mail: mailOk ? '✅ 候选人邮件发送成功' : `❌ 候选人邮件失败：${mailResult.msg}`,
    message: msgOk ? '✅ 候选人消息发送成功' : `❌ 候选人消息失败：${msgResult.msg}`,
    interviewer_mail: interviewerMsg
  }));
})().catch(e => {
  console.error('[fatal]', e.message);
  process.exit(1);
});
