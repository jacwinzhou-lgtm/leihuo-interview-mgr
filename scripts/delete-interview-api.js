/**
 * 删除面试安排 - 纯API版本
 * 用法：node delete-interview-api.js --candidate "薛巍" --interviewer "周家杰" [--round "1"]
 *
 * --round: 1=业务初面, 2=业务终面, 3=HR面（不指定时列出让用户选）
 */

const path = require('path');
const os = require('os');
const fs = require('fs');

const SESSION_PATH = path.join(os.homedir(), '.xiaozhao-session.json');
const BASE_URL = 'https://xiaozhao.leihuo.netease.com';

const CATEGORY_MAP = { '1': '业务初面', '2': '业务终面', '3': 'HR面' };

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

(async () => {
  const args = parseArgs();
  const candidateName = args.candidate;
  const interviewerName = args.interviewer;
  const roundFilter = args.round; // 可选

  if (!candidateName) {
    console.error('用法: node delete-interview-api.js --candidate "薛巍" --interviewer "周家杰" [--round "1"]');
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
      candidates: list.map(c => ({ name: c.user_name, job: c.job_name, resume_id: c.resume_id }))
    }));
    process.exit(0);
  }

  const resumeId = list[0].resume_id;
  console.error(`✅ 候选人：${list[0].user_name}`);

  // Step 2: 获取面试计划详情（拿 interview_plan_id）
  console.error('[2/3] 获取面试计划...');
  const detailResult = await apiRequest(cookieStr, 'GET', `/api/new/interview/feedback/show?resume_id=${resumeId}`);

  const feedbackList = detailResult.data?.interview_feedback_list || {};
  const allRounds = [];

  for (const rounds of Object.values(feedbackList)) {
    for (const round of rounds) {
      for (const feedback of (round.feedback_list || [])) {
        if (!feedback.interview_plan_id) continue; // 没有 plan_id 的跳过
        allRounds.push({
          interview_plan_id: feedback.interview_plan_id,
          user_id: parseInt(feedback.user_id),
          user_name: feedback.user_name,
          time: round.time,
          day: round.day,
          type: round.type,
          category: round.category,
          category_name: CATEGORY_MAP[round.category] || round.category,
          interview_direction_id: round.interview_direction_id || 1,
          nowcoder_second_camera: round.nowcoder_second_camera || '1',
        });
      }
    }
  }

  if (!allRounds.length) {
    console.log(JSON.stringify({ status: 'not_found', message: '未找到可删除的面试安排' }));
    process.exit(0);
  }

  // 按面试官和轮次筛选
  let targets = allRounds;
  if (interviewerName) targets = targets.filter(r => r.user_name.includes(interviewerName));
  if (roundFilter) targets = targets.filter(r => r.category === roundFilter);

  if (targets.length === 0) {
    console.log(JSON.stringify({
      status: 'not_found',
      message: `未找到符合条件的面试安排`,
      available: allRounds.map(r => ({ interviewer: r.user_name, round: r.category_name, time: r.day, plan_id: r.interview_plan_id }))
    }));
    process.exit(0);
  }

  if (targets.length > 1) {
    console.log(JSON.stringify({
      status: 'multiple',
      message: '找到多个面试安排，请指定 --round 或更精确的 --interviewer',
      options: targets.map(r => ({ interviewer: r.user_name, round: r.category_name, time: r.day, plan_id: r.interview_plan_id }))
    }));
    process.exit(0);
  }

  const target = targets[0];
  console.error(`✅ 目标：${target.user_name} | ${target.category_name} | ${target.day}`);

  // Step 3: 删除
  console.error('[3/3] 执行删除...');
  const deleteResult = await apiRequest(cookieStr, 'POST', '/setting/interviewplan/delete', {
    interview_plan_array: [{
      time: target.time,
      day: target.day,
      type: target.type,
      category: target.category,
      nowcoder_second_camera: target.nowcoder_second_camera,
      interview_direction_id: target.interview_direction_id,
      user_list: [{ user_id: target.user_id, interview_plan_id: target.interview_plan_id }]
    }],
    resume_id: resumeId,
    delete_interview_plan_id_list: [target.interview_plan_id]
  });

  if (deleteResult.status === 200) {
    console.log(JSON.stringify({
      status: 'success',
      message: `✅ 删除成功！`,
      candidate: list[0].user_name,
      interviewer: target.user_name,
      round: target.category_name,
      time: target.day,
      resume_id: resumeId
    }));
  } else {
    console.log(JSON.stringify({ status: 'error', message: deleteResult.msg }));
  }
})().catch(e => {
  console.error('[fatal]', e.message);
  process.exit(1);
});
