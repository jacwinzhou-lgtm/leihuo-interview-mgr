/**
 * 笔试截止时间修改 - 纯API版本
 * 用法：node update-exam-deadline.js --candidate "施欣妤" --time "后天23:59" [--extend "2"]
 *
 * --time: 直接指定时间（自然语言）
 * --extend: 延后N天（基于当前截止时间推算）
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

function parseNaturalTime(text) {
  if (!text) return null;
  const now = new Date();
  let target = new Date(now);
  let hours = 23, minutes = 59, seconds = 59; // 默认截止时间为当天23:59:59

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

  // 解析时间部分
  let isPM = /下午|晚上|傍晚/.test(text);
  const colonMatch = text.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (colonMatch) {
    hours = parseInt(colonMatch[1]);
    minutes = parseInt(colonMatch[2]);
    seconds = colonMatch[3] ? parseInt(colonMatch[3]) : 59;
  } else {
    const pointMatch = text.match(/(\d{1,2})点(?:(\d{1,2})分?|半)?/);
    if (pointMatch) {
      hours = parseInt(pointMatch[1]);
      if (text.includes('半')) minutes = 30;
      else if (pointMatch[2]) minutes = parseInt(pointMatch[2]);
      else minutes = 59;
      seconds = 59;
    }
  }
  if (isPM && hours < 12) hours += 12;

  target.setHours(hours, minutes, seconds, 0);
  return target;
}

function formatForApi(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth()+1).padStart(2,'0');
  const d = String(date.getDate()).padStart(2,'0');
  const hh = String(date.getHours()).padStart(2,'0');
  const mm = String(date.getMinutes()).padStart(2,'0');
  const ss = String(date.getSeconds()).padStart(2,'0');
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
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
  const timeText = args.time;
  const extendDays = args.extend ? parseInt(args.extend) : null;

  if (!candidateName || (!timeText && !extendDays)) {
    console.error('用法: node update-exam-deadline.js --candidate "施欣妤" --time "后天23:59"');
    console.error('  或: node update-exam-deadline.js --candidate "施欣妤" --extend "2"  (延后2天)');
    process.exit(1);
  }

  const cookieStr = getCookieString();
  if (!cookieStr) { console.error('未找到session'); process.exit(1); }

  // Step 1: 搜索候选人
  console.error(`[1/2] 搜索候选人「${candidateName}」...`);
  const searchResult = await apiRequest(cookieStr, 'POST', '/written_exam/query/filter_list_data', {
    user_name: candidateName, effective_status: [1], pageSize: 50, page: 1
  });

  if (!searchResult.data?.consume_list?.length) {
    console.log(JSON.stringify({ status: 'not_found', message: `未找到候选人「${candidateName}」` }));
    process.exit(0);
  }

  const list = searchResult.data.consume_list;
  if (list.length > 1) {
    console.log(JSON.stringify({
      status: 'multiple_candidates',
      message: `找到 ${list.length} 个候选人，请确认`,
      candidates: list.map(c => ({ name: c.user_name, job: c.job_name, consume_id: c.consume_id }))
    }));
    process.exit(0);
  }

  const candidate = list[0];
  const consumeId = candidate.consume_id;
  const currentDeadlineMap = candidate.test_exam_submit_deadline;
  console.error(`✅ 候选人：${candidate.user_name}（${candidate.job_name}）`);

  if (!currentDeadlineMap || Object.keys(currentDeadlineMap).length === 0) {
    console.log(JSON.stringify({ status: 'error', message: '该候选人暂无笔试截止时间数据' }));
    process.exit(0);
  }

  // 计算新截止时间
  let newTimeStr;
  if (timeText) {
    const newTime = parseNaturalTime(timeText);
    if (!newTime) { console.error('时间格式无法解析:', timeText); process.exit(1); }
    newTimeStr = formatForApi(newTime);
  } else if (extendDays) {
    // 从当前截止时间延后N天
    const firstBatch = Object.values(currentDeadlineMap)[0];
    const firstFile = Object.values(firstBatch)[0];
    const currentDate = new Date(firstFile);
    currentDate.setDate(currentDate.getDate() + extendDays);
    newTimeStr = formatForApi(currentDate);
  }

  console.error(`新截止时间：${newTimeStr}`);

  // 构建新的 deadline map（所有文件统一更新）
  const newDeadlineMap = {};
  for (const [batchId, files] of Object.entries(currentDeadlineMap)) {
    newDeadlineMap[batchId] = {};
    for (const fileName of Object.keys(files)) {
      newDeadlineMap[batchId][fileName] = newTimeStr;
    }
  }

  // 列出题目
  const fileList = Object.entries(currentDeadlineMap).flatMap(([batchId, files]) =>
    Object.keys(files).map(f => `批次${batchId}: ${f}`)
  );
  console.error(`更新题目：${fileList.join('、')}`);

  // Step 2: 更新截止时间
  console.error('[2/2] 提交更新...');
  const updateResult = await apiRequest(cookieStr, 'POST', '/api/new/written_exam/submit_deadline/update', {
    consume_id: consumeId,
    submit_deadline_map: newDeadlineMap
  });

  if (updateResult.status === 200) {
    console.log(JSON.stringify({
      status: 'success',
      message: `✅ 截止时间更新成功！`,
      candidate: candidate.user_name,
      job: candidate.job_name,
      newDeadline: newTimeStr,
      files: fileList,
      consume_id: consumeId
    }));
  } else {
    console.log(JSON.stringify({ status: 'error', message: updateResult.msg }));
  }
})().catch(e => {
  console.error('[fatal]', e.message);
  process.exit(1);
});
