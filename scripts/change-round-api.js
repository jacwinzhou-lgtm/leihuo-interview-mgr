/**
 * 修改面试轮次 - V1.1新增
 * 用法：node change-round-api.js --candidate "薛巍" --interviewer "余雪" --round "3"
 *
 * --round: 1=业务初面, 2=业务终面, 3=HR面
 */

const path = require('path');
const os = require('os');
const fs = require('fs');

const SESSION_PATH = path.join(os.homedir(), '.xiaozhao-session.json');
const BASE_URL = 'https://xiaozhao.leihuo.netease.com';

const ROUND_MAP = {
  '1': { category: '1', name: '业务初面' },
  '2': { category: '2', name: '业务终面' },
  '3': { category: '3', name: 'HR面' },
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

function getCookieString() {
  if (!fs.existsSync(SESSION_PATH)) return null;
  const session = JSON.parse(fs.readFileSync(SESSION_PATH, 'utf-8'));
  return session.cookies.filter(c => c.domain.includes('netease.com')).map(c => `${c.name}=${c.value}`).join('; ');
}

async function apiRequest(cookieStr, method, p, body = null) {
  const resp = await fetch(`${BASE_URL}${p}`, {
    method,
    headers: { 'Cookie': cookieStr, 'Content-Type': 'application/json', 'Referer': `${BASE_URL}/select/show` },
    body: body ? JSON.stringify(body) : undefined
  });
  return resp.json();
}

(async () => {
  const args = parseArgs();
  const candidateName = args.candidate;
  const interviewerName = args.interviewer;
  const round = args.round;

  if (!candidateName || !interviewerName || !round) {
    console.error('用法: node change-round-api.js --candidate "薛巍" --interviewer "余雪" --round "3"');
    process.exit(1);
  }

  const roundInfo = ROUND_MAP[round];
  if (!roundInfo) {
    console.log(JSON.stringify({ status: 'error', message: `无效轮次「${round}」，可选：1=业务初面, 2=业务终面, 3=HR面` }));
    process.exit(1);
  }

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

  // Step 2: 获取现有面试计划
  console.error('[2/3] 获取面试计划...');
  const detailResult = await apiRequest(cookieStr, 'GET', `/api/new/interview/feedback/show?resume_id=${resumeId}`);
  const feedbackList = detailResult.data?.interview_feedback_list || {};

  const allPlans = [];
  let targetFound = false;
  let oldRoundName = '';

  for (const rounds of Object.values(feedbackList)) {
    for (const round of rounds) {
      for (const fb of (round.feedback_list || [])) {
        const isTarget = fb.user_name && fb.user_name.includes(interviewerName);
        if (isTarget) {
          targetFound = true;
          oldRoundName = round.category === '1' ? '业务初面' : round.category === '2' ? '业务终面' : 'HR面';
        }
        allPlans.push({
          time: round.time,
          day: round.day,
          type: round.type,
          category: isTarget ? roundInfo.category : round.category,
          nowcoder_second_camera: round.nowcoder_second_camera || '1',
          interview_direction_id: round.interview_direction_id || 1,
          user_list: [{ user_id: parseInt(fb.user_id), interview_plan_id: fb.interview_plan_id }]
        });
      }
    }
  }

  if (!targetFound) {
    console.log(JSON.stringify({
      status: 'interviewer_not_found',
      message: `未找到面试官「${interviewerName}」的面试记录`,
      available: allPlans.map(p => p.user_list[0])
    }));
    process.exit(0);
  }

  // Step 3: 提交
  console.error(`[3/3] 修改轮次：${oldRoundName} → ${roundInfo.name}`);
  const result = await apiRequest(cookieStr, 'POST', '/setting/interviewplan/update', {
    interview_plan_array: allPlans,
    resume_id: resumeId
  });

  if (result.status === 200) {
    console.log(JSON.stringify({
      status: 'success',
      message: `✅ 轮次修改成功！`,
      candidate: candidate.user_name,
      job: candidate.job_name,
      interviewer: interviewerName,
      oldRound: oldRoundName,
      newRound: roundInfo.name,
      resume_id: resumeId
    }));
  } else {
    console.log(JSON.stringify({ status: 'error', message: result.msg, detail: result }));
  }
})().catch(e => {
  console.error('[fatal]', e.message);
  process.exit(1);
});
