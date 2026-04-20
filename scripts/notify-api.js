/**
 * 发送面试通知 - 纯API版本
 * 用法（单个）：node notify-api.js --resume_id "xxx"
 * 用法（批量）：node notify-api.js --resume_ids "id1,id2,id3"
 *
 * 批量模式下，候选人通知逐个发送，面试官通知按面试官聚合（一封邮件包含所有候选人）
 */

const path = require('path');
const os = require('os');
const fs = require('fs');

const SESSION_PATH = path.join(os.homedir(), '.xiaozhao-session.json');
const BASE_URL = 'https://xiaozhao.leihuo.netease.com';

const MODULE_CONTENT_INTERVIEWER = '亲爱的面试官<!--interview_user_name-->您好，\n\n您有以下校招面试安排，请提前做好准备：\n<!--interview_user_plan-->\n\n为确保校招面试质量，请您务必阅读并遵守以下注意事项：\n【面试前准备】\n· 请提前打印简历，评估学生过往经历，查阅笔试/测试题成绩或作品，做好面试问题准备；\n· 提前预定会议室，准备笔记本电脑并提前调试设备，打开摄像头；\n【面试中】\n· 面试中可看到候选人电脑摄像头画面和手机二机位拍摄的面试环境画面，如面试中候选人二机位画面关闭或不合规，请与候选人沟通让其开启或调整二机位，以保证二机位面试有效进行。\n· 通过行为面试法深入挖掘学生过往行为，对疑点进行追问（可登录易Learning系统·雷火校招面试官培训查看）。\n· 如发现候选人面试中有作弊行为，请于当场指出并制止；并于面试后在校招系统-面试评价中标注或反馈给校招HR，校招组将核实并通知同学取消后续面试安排（如有）、拉入黑名单。\n· 关注面试礼仪，尊重候选人，勿告知面试结论等。\n【面试结束后】\n· 请在当天20:00前填写面试评价，请详细填写学生优势/顾虑及面试过程详情，你的评价对面试结果及后续安排非常关键。\n· 如有特殊情况（包括但不仅限于作弊、抄袭、建议转岗等），请及时反馈对接HR。\n\n雷火校招网站链接： http://xiaozhao.leihuo.netease.com\n\n若有问题可以联系对接HR：\n• 雷火UX、测试中心、伏羲：陈婉斯 chenwansi@corp.netease.com\n• 游戏策划（系统、数值、战斗、运营）、营销：张青 zhangqing03@corp.netease.com\n• 游戏程序、TD：余雪 yuxue05@corp.netease.com\n• 游戏美术（动作、特效）、TA、交互、音频部：周家杰 zhoujiajie@corp.netease.com\n• 游戏策划（文案、关卡、任务）、游戏美术（角色、场景、导演）：解绍巍 xieshaowei@corp.netease.com\n• 平台创新中心：吴曼婷 wumanting@corp.netease.com\n• 项目管理：周颖 zhouying17@corp.netease.com\n\nIT资产电脑借用地点：\n一期A1F-严选商店出门左转15m处\n二期3号楼1F-B区北- IT资产服务中心\n\n雷火校招组';

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
  return session.cookies.filter(c => c.domain.includes('netease.com')).map(c => `${c.name}=${c.value}`).join('; ');
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

// 获取某个候选人的所有面试官 user_id
async function getInterviewerIds(cookieStr, resumeId) {
  const detail = await apiRequest(cookieStr, 'GET', `/api/new/interview/feedback/show?resume_id=${resumeId}`);
  const feedbackList = detail.data?.interview_feedback_list || {};
  const ids = [];
  for (const rounds of Object.values(feedbackList)) {
    for (const round of rounds) {
      for (const fb of (round.feedback_list || [])) {
        if (fb.user_id && !ids.includes(String(fb.user_id))) {
          ids.push(String(fb.user_id));
        }
      }
    }
  }
  return ids;
}

(async () => {
  const args = parseArgs();

  // 支持 --resume_id（单个）和 --resume_ids（逗号分隔批量）
  let resumeIds = [];
  if (args.resume_ids) {
    resumeIds = args.resume_ids.split(',').map(s => s.trim()).filter(Boolean);
  } else if (args.resume_id) {
    resumeIds = [args.resume_id];
  }

  if (!resumeIds.length) {
    console.error('用法: node notify-api.js --resume_id "xxx"\n      node notify-api.js --resume_ids "id1,id2"');
    process.exit(1);
  }

  const cookieStr = getCookieString();
  if (!cookieStr) { console.error('未找到session，请先登录'); process.exit(1); }

  const isBatch = resumeIds.length > 1;
  console.error(`模式：${isBatch ? `批量（${resumeIds.length} 个候选人）` : '单个候选人'}`);

  // Step 1: 候选人邮件（逐个发）
  console.error('[1/3] 发送候选人邮件...');
  const mailResults = [];
  for (const rid of resumeIds) {
    const r = await apiRequest(cookieStr, 'POST', '/notice/mail/send_notice', {
      module_title: '【网易游戏雷火】面试邀请函',
      module_content: '<!--此模板不可使用-->',
      module_id: '733',
      receive_type: '1',
      resume_ids: [rid],
      page_key: 'interview_list',
      extend_data: { pageKey: 'interview_list' }
    });
    mailResults.push({ rid, ok: r.status === 200, msg: r.msg });
  }

  // Step 2: 候选人消息（逐个发）
  console.error('[2/3] 发送候选人消息...');
  const msgResults = [];
  for (const rid of resumeIds) {
    const r = await apiRequest(cookieStr, 'POST', '/notice/message/send_notice', {
      module_title: '',
      module_content: '亲爱的<!--employee_name-->同学，您好！\n感谢您参加网易游戏雷火事业群校招，恭喜您进入<!--position_name-->岗位视频面试环节。具体面试安排可至您的<!--employee_mail-->邮箱查看，如有问题请邮件联系campusleihuo@163.com，预祝面试顺利！',
      module_id: '734',
      receive_type: '1',
      resume_ids: [rid],
      page_key: 'interview_list',
      extend_data: { pageKey: 'interview_list' }
    });
    msgResults.push({ rid, ok: r.status === 200, msg: r.msg });
  }

  // Step 3: 面试官邮件（按面试官聚合，每个面试官一封，包含所有候选人）
  console.error('[3/3] 发送面试官通知邮件...');

  // 并行获取所有候选人的面试官列表
  const interviewerMap = {}; // uid -> [resumeId, ...]
  const allInterviewerIds = await Promise.all(resumeIds.map(rid => getInterviewerIds(cookieStr, rid)));
  resumeIds.forEach((rid, i) => {
    for (const uid of allInterviewerIds[i]) {
      if (!interviewerMap[uid]) interviewerMap[uid] = [];
      interviewerMap[uid].push(rid);
    }
  });

  const interviewerResults = [];
  for (const [uid, rids] of Object.entries(interviewerMap)) {
    const r = await apiRequest(cookieStr, 'POST', '/notice/mail/send_notice', {
      module_title: '【重要】雷火校招面试安排请查收！',
      module_content: MODULE_CONTENT_INTERVIEWER,
      module_id: '713',
      receive_type: '2',
      resume_ids: rids,
      user_ids: [uid],
      page_key: 'interview_list'
    });
    const ok = r.status === 200;
    interviewerResults.push({ uid, rids, ok, msg: r.msg, warning: r.data?.warnings?.[0] });
    console.error(`  面试官 ${uid}（${rids.length} 个候选人）：${ok ? '✅' : '❌ ' + (r.data?.warnings?.[0] || r.msg)}`);
  }

  const allMailOk = mailResults.every(r => r.ok);
  const allMsgOk = msgResults.every(r => r.ok);
  const allInterviewerOk = interviewerResults.every(r => r.ok);

  console.log(JSON.stringify({
    status: (allMailOk && allMsgOk && allInterviewerOk) ? 'success' : 'partial',
    candidate_count: resumeIds.length,
    mail: allMailOk ? `✅ 候选人邮件已发（${resumeIds.length} 人）` : `❌ 部分失败：${mailResults.filter(r=>!r.ok).map(r=>r.rid).join(',')}`,
    message: allMsgOk ? `✅ 候选人消息已发（${resumeIds.length} 人）` : `❌ 部分失败：${msgResults.filter(r=>!r.ok).map(r=>r.rid).join(',')}`,
    interviewer_mail: interviewerResults.length === 0 ? '无面试官' :
      interviewerResults.map(r => r.ok
        ? `✅ 面试官 ${r.uid}（聚合 ${r.rids.length} 名候选人）`
        : `❌ 面试官 ${r.uid} 失败：${r.warning || r.msg}`
      ).join('；')
  }));
})().catch(e => {
  console.error('[fatal]', e.message);
  process.exit(1);
});
