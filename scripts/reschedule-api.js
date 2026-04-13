/**
 * 面试改期 - 纯API版本（不操控浏览器UI）
 * 用法：node reschedule-api.js --candidate "薛巍" --interviewer "周颖" --time "周日12点"
 */

const { chromium } = require('playwright');
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
    const diff = ((t - c + 7) % 7) || 7;
    target.setDate(now.getDate() + diff);
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
  return `${y}-${m}-${d} ${hh}:${mm}:00`;
}

// 从 session 文件提取 cookie 字符串
function getCookieString() {
  if (!fs.existsSync(SESSION_PATH)) return null;
  const session = JSON.parse(fs.readFileSync(SESSION_PATH, 'utf-8'));
  return session.cookies
    .filter(c => c.domain.includes('xiaozhao.leihuo.netease.com') || c.domain.includes('netease.com'))
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
  const data = await resp.json();
  return data;
}

(async () => {
  const args = parseArgs();
  const candidateName = args.candidate;
  const interviewerName = args.interviewer;
  const timeText = args.time;

  if (!candidateName || !timeText) {
    console.error('用法: node reschedule-api.js --candidate "薛巍" --interviewer "周颖" --time "周日12点"');
    process.exit(1);
  }

  const newTime = parseNaturalTime(timeText);
  if (!newTime) { console.error('时间格式无法解析:', timeText); process.exit(1); }
  const newTimeStr = formatForApi(newTime);
  console.error(`\n目标：「${candidateName}」${interviewerName ? `（${interviewerName}那场）` : ''} 改期到 ${newTimeStr}\n`);

  // 获取 cookie
  let cookieStr = getCookieString();
  if (!cookieStr) {
    console.error('未找到 session，需要先登录...');
    // 启动浏览器登录
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/select/show#/interview`);
    console.error('请在浏览器中登录，登录后回到对话告知我');
    await page.waitForURL(url => url.includes('xiaozhao') && !url.includes('login'), { timeout: 180000 });
    await context.storageState({ path: SESSION_PATH });
    await browser.close();
    cookieStr = getCookieString();
  }

  // Step 1: 搜索候选人
  console.error(`[1/4] 搜索候选人「${candidateName}」...`);
  const searchResult = await apiRequest(cookieStr, 'POST', '/interview/list/data', {
    user_name: candidateName, effective_status: [1], pageSize: 50, page: 1
  });

  if (searchResult.status !== 200 || !searchResult.data?.interview_list?.length) {
    console.log(JSON.stringify({ status: 'not_found', message: `未找到候选人「${candidateName}」` }));
    process.exit(1);
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
  console.error(`✅ 找到：${candidate.user_name}（${candidate.job_name}），resume_id=${resumeId}`);

  // Step 2: 获取面试计划详情
  console.error(`[2/4] 获取面试计划详情...`);
  const detailResult = await apiRequest(cookieStr, 'GET', `/api/new/interview/feedback/show?resume_id=${resumeId}`);

  if (detailResult.status !== 200) {
    console.log(JSON.stringify({ status: 'error', message: '获取面试详情失败' }));
    process.exit(1);
  }

  // 解析面试计划列表（first_interview, second_interview 等）
  const feedbackList = detailResult.data?.interview_feedback_list || {};
  const allRounds = [];

  for (const [roundKey, rounds] of Object.entries(feedbackList)) {
    for (const round of rounds) {
      for (const feedback of (round.feedback_list || [])) {
        allRounds.push({
          roundKey,
          time: round.time,
          day: round.day,
          type: round.type,
          category: round.category,
          nowcoder_second_camera: round.nowcoder_second_camera || '1',
          interview_direction_id: round.interview_direction_id || 1,
          user_id: parseInt(feedback.user_id),
          user_name: feedback.user_name,
          interview_plan_id: feedback.interview_plan_id,
        });
      }
    }
  }

  console.error(`找到 ${allRounds.length} 个面试场次:`, allRounds.map(r => `${r.user_name}(${r.day})`).join(', '));

  // Step 3: 找目标面试官并更新时间
  console.error(`[3/4] 查找目标面试官...`);

  let targetRound = null;
  if (interviewerName) {
    targetRound = allRounds.find(r => r.user_name.includes(interviewerName));
    if (!targetRound) {
      console.log(JSON.stringify({
        status: 'interviewer_not_found',
        message: `未找到面试官「${interviewerName}」`,
        available: allRounds.map(r => r.user_name)
      }));
      process.exit(0);
    }
  } else if (allRounds.length === 1) {
    targetRound = allRounds[0];
  } else {
    console.log(JSON.stringify({
      status: 'multiple_interviewers',
      message: '有多个面试官，请指定 --interviewer',
      available: allRounds.map(r => ({ name: r.user_name, time: r.day }))
    }));
    process.exit(0);
  }

  console.error(`✅ 目标：${targetRound.user_name}，当前时间：${targetRound.day} → 新时间：${newTimeStr}`);

  // 构建完整的 interview_plan_array（所有场次，只改目标那场的时间）
  const interview_plan_array = allRounds.map(r => ({
    time: r.time,
    day: r.user_id === targetRound.user_id ? newTimeStr : r.day,
    type: r.type,
    category: r.category,
    nowcoder_second_camera: r.nowcoder_second_camera,
    interview_direction_id: r.interview_direction_id,
    user_list: [{ user_id: r.user_id, interview_plan_id: r.interview_plan_id }]
  }));

  // Step 4: 调用更新接口
  console.error(`[4/4] 提交改期请求...`);
  const updateResult = await apiRequest(cookieStr, 'POST', '/setting/interviewplan/update', {
    interview_plan_array, resume_id: resumeId
  });

  if (updateResult.status === 200) {
    console.log(JSON.stringify({
      status: 'success',
      message: `✅ 改期成功！${targetRound.user_name} 的面试已改到 ${newTimeStr}`,
      candidate: candidateName,
      job: candidate.job_name,
      interviewer: targetRound.user_name,
      oldTime: targetRound.day,
      newTime: newTimeStr,
      resume_id: resumeId
    }));
  } else {
    console.log(JSON.stringify({
      status: 'error',
      message: `改期失败：${updateResult.msg}`,
      detail: updateResult
    }));
  }

})().catch(e => {
  console.error('[fatal]', e.message);
  process.exit(1);
});
