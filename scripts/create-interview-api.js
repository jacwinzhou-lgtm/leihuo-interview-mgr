/**
 * 新建面试安排 - 纯API版本
 * 用法：node create-interview-api.js --candidate "薛巍" --interviewer "周家杰" --time "明天下午2点" [--round "1"] [--type "video"]
 *
 * --round: 面试轮次，1=业务初面(默认), 2=业务终面, 3=HR面
 * --type: 面试形式，video=牛客网视频(默认), offline=线下
 */

const path = require('path');
const os = require('os');
const fs = require('fs');

const SESSION_PATH = path.join(os.homedir(), '.xiaozhao-session.json');
const BASE_URL = 'https://xiaozhao.leihuo.netease.com';

// 面试轮次映射
const ROUND_MAP = {
  '1': { time: '1', category: '1', name: '业务初面' },
  '2': { time: '2', category: '2', name: '业务终面' },
  '3': { time: '3', category: '3', name: 'HR面' },
};

// 面试形式映射
const TYPE_MAP = {
  'video': '3',    // 牛客网视频
  'offline': '1',  // 线下
  'phone': '2',    // 电话
};

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

function parseNaturalTime(text) {
  if (!text) return null;
  const now = new Date();
  let target = new Date(now);
  let hours = null, minutes = 0;

  const mdMatch = text.match(/(\d{1,2})月(\d{1,2})[日号]/);
  if (mdMatch) { target.setMonth(parseInt(mdMatch[1]) - 1); target.setDate(parseInt(mdMatch[2])); }
  else if (/明天/.test(text)) target.setDate(target.getDate() + 1);
  else if (/后天/.test(text)) target.setDate(target.getDate() + 2);
  else if (/大后天/.test(text)) target.setDate(target.getDate() + 3);

  const weekMap = { 一:1, 二:2, 三:3, 四:4, 五:5, 六:6, 日:0, 天:0 };
  const weekMatch = text.match(/下周([一二三四五六日天])/);
  if (weekMatch) {
    const t = weekMap[weekMatch[1]], c = now.getDay();
    target.setDate(now.getDate() + (((t - c + 7) % 7) || 7));
  }
  const thisWeekMatch = !weekMatch && text.match(/(?<!下)周([一二三四五六日天])/);
  if (thisWeekMatch) {
    const t = weekMap[thisWeekMatch[1]], c = now.getDay();
    let diff = (t - c + 7) % 7;
    if (diff === 0) diff = 7;
    target.setDate(now.getDate() + diff);
  }

  let isPM = /下午|晚上|傍晚/.test(text);
  const colonMatch = text.match(/(\d{1,2}):(\d{2})/);
  if (colonMatch) { hours = parseInt(colonMatch[1]); minutes = parseInt(colonMatch[2]); }
  const pointMatch = text.match(/(\d{1,2})点(?:(\d{1,2})分?|半)?/);
  if (pointMatch && hours === null) {
    hours = parseInt(pointMatch[1]);
    if (text.includes('半')) minutes = 30;
    else if (pointMatch[2]) minutes = parseInt(pointMatch[2]);
  }
  if (isPM && hours !== null && hours < 12) hours += 12;
  if (hours === null) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  target.setHours(hours, minutes, 0, 0);
  return target;
}

function formatForApi(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth()+1).padStart(2,'0');
  const d = String(date.getDate()).padStart(2,'0');
  const hh = String(date.getHours()).padStart(2,'0');
  const mm = String(date.getMinutes()).padStart(2,'0');
  return `${y}-${m}-${d} ${hh}:${mm}`;
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

(async () => {
  const args = parseArgs();
  const candidateName = args.candidate;
  const interviewerName = args.interviewer;
  const timeText = args.time;
  const round = args.round || '1';
  const typeKey = args.type || 'video';

  if (!candidateName || !interviewerName || !timeText) {
    console.error('用法: node create-interview-api.js --candidate "薛巍" --interviewer "周家杰" --time "明天下午2点" [--round 1] [--type video]');
    process.exit(1);
  }

  const newTime = parseNaturalTime(timeText);
  if (!newTime) { console.error('时间格式无法解析:', timeText); process.exit(1); }

  const timeStr = formatForApi(newTime);
  const roundInfo = ROUND_MAP[round] || ROUND_MAP['1'];
  const typeCode = TYPE_MAP[typeKey] || '3';

  console.error(`\n新建面试：${candidateName} | ${interviewerName} | ${timeStr} | ${roundInfo.name}\n`);

  const cookieStr = getCookieString();
  if (!cookieStr) { console.error('未找到session'); process.exit(1); }

  // Step 1: 搜索候选人
  console.error('[1/3] 搜索候选人...');
  const searchResult = await apiRequest(cookieStr, 'POST', '/interview/list/data', {
    user_name: candidateName, effective_status: [1], pageSize: 50, page: 1
  });

  if (!searchResult.data?.interview_list?.length) {
    console.log(JSON.stringify({ status: 'not_found', message: `未找到候选人「${candidateName}」` }));
    process.exit(0);
  }

  const list = searchResult.data.interview_list;
  if (list.length > 1) {
    console.log(JSON.stringify({
      status: 'multiple_candidates',
      message: `找到 ${list.length} 个候选人，请确认`,
      candidates: list.map(c => ({ name: c.user_name, job: c.job_name, resume_id: c.resume_id }))
    }));
    process.exit(0);
  }

  const candidate = list[0];
  const resumeId = candidate.resume_id;
  console.error(`✅ 候选人：${candidate.user_name}（${candidate.job_name}）`);

  // Step 2: 搜索面试官 user_id
  console.error('[2/3] 搜索面试官...');
  const userResult = await apiRequest(cookieStr, 'GET', `/permission/user/search?key_word=${encodeURIComponent(interviewerName)}`);

  if (!userResult.data?.length) {
    console.log(JSON.stringify({ status: 'interviewer_not_found', message: `未找到面试官「${interviewerName}」` }));
    process.exit(0);
  }

  const users = userResult.data;
  const exactMatch = users.find(u => u.user_name === interviewerName);
  const targetUser = exactMatch || users[0];

  if (!exactMatch && users.length > 1) {
    console.log(JSON.stringify({
      status: 'multiple_interviewers',
      message: `搜索到多个「${interviewerName}」，请确认`,
      users: users.map(u => ({ user_id: u.user_id, name: u.user_name, email: u.user_email }))
    }));
    process.exit(0);
  }

  console.error(`✅ 面试官：${targetUser.user_name}（user_id=${targetUser.user_id}）`);

  // Step 3: 获取现有面试计划，避免全量覆盖
  console.error('[3/4] 获取现有面试计划...');
  const detailResult = await apiRequest(cookieStr, 'GET', `/api/new/interview/feedback/show?resume_id=${resumeId}`);
  const feedbackList = detailResult.data?.interview_feedback_list || {};
  const existingPlans = [];
  for (const rounds of Object.values(feedbackList)) {
    for (const round of rounds) {
      for (const feedback of (round.feedback_list || [])) {
        existingPlans.push({
          time: round.time,
          day: round.day,
          type: round.type,
          category: round.category,
          nowcoder_second_camera: round.nowcoder_second_camera || '1',
          interview_direction_id: round.interview_direction_id || 1,
          user_list: [{ user_id: parseInt(feedback.user_id), interview_plan_id: feedback.interview_plan_id }]
        });
      }
    }
  }
  console.error(`已有 ${existingPlans.length} 场面试，追加新场次后提交`);

  // Step 4: 创建面试（追加到现有计划）
  console.error('[4/4] 创建面试安排...');
  const interview_plan_array = [
    ...existingPlans,
    {
      time: '',
      day: timeStr,
      type: typeCode,
      category: roundInfo.category,
      nowcoder_second_camera: '1',
      interview_direction_id: 1,
      user_list: [{ user_id: targetUser.user_id, interview_plan_id: '' }]
    }
  ];
  const createResult = await apiRequest(cookieStr, 'POST', '/setting/interviewplan/update', {
    interview_plan_array,
    resume_id: resumeId
  });

  if (createResult.status === 200) {
    console.log(JSON.stringify({
      status: 'success',
      message: `✅ 面试创建成功！`,
      candidate: candidate.user_name,
      job: candidate.job_name,
      interviewer: targetUser.user_name,
      time: timeStr,
      round: roundInfo.name,
      resume_id: resumeId
    }));
  } else {
    console.log(JSON.stringify({ status: 'error', message: createResult.msg, detail: createResult }));
  }
})().catch(e => {
  console.error('[fatal]', e.message);
  process.exit(1);
});
