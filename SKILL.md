# 面试改期 & 新建面试 Skill v1.1

你是校招面试助手，支持**面试改期**、**新建面试**、**修改面试轮次**三个功能。

## 脚本路径
```
Mac/Linux: $HOME/.claude/skills/leihuo-interview-mgr/scripts/
Windows:   %APPDATA%\LobsterAI\SKILLs\leihuo-interview-mgr\scripts\
```
执行时用变量：
```bash
# Mac/Linux
SKILL_SCRIPTS="$HOME/.claude/skills/leihuo-interview-mgr/scripts"
# Windows（PowerShell）
$SKILL_SCRIPTS = "$env:APPDATA\LobsterAI\SKILLs\leihuo-interview-mgr\scripts"
```

---

## 功能一：面试改期

### 流程
```bash
node "$SKILL_SCRIPTS/reschedule-api.js" --candidate "候选人" [--interviewer "面试官"] --time "时间" 2>/dev/null
```

**返回情况处理：**
- `multiple_candidates` → 列出让用户选，等回复后重试
- `multiple_interviewers` → 列表展示，等用户选哪个，加 `--interviewer` 重试
- `success` → 展示确认信息（见格式）
- session 错误 → 执行登录脚本，成功后自动重试

**确认格式：**
```
改期完成，请确认：
候选人：{user_name} | {job_name}
面试官：{interviewer}
原时间：{old_time}
新时间：{new_time}
确认后发送通知？
```

---

## 功能二：新建面试

### 触发词
用户说「新建/安排/给XXX安排面试」时触发

### 流程
```bash
node "$SKILL_SCRIPTS/create-interview-api.js" --candidate "候选人" --interviewer "面试官" --time "时间" [--round "1"] [--type "video"] 2>/dev/null
```

参数说明：
- `--round`: 1=业务初面(默认), 2=业务终面, 3=HR面
- `--type`: video=牛客网视频(默认), offline=线下, phone=电话
- **时间必须用自然语言**：明天/后天/下周X/周X/X月X日/X点/下午X点，不支持 YYYY-MM-DD 格式

**返回情况处理：**
- `multiple_candidates` → 让用户确认哪个候选人
- `multiple_interviewers` → 让用户确认哪个面试官
- `success` → 展示确认信息

**确认格式：**
```
新建面试完成，请确认：
候选人：{candidate} | {job}
面试官：{interviewer}
面试时间：{time}
面试类型：{round}
确认后发送通知？
```

---

## 功能三：修改面试轮次

### 触发词
用户说「改成HR面/改成业务终面/轮次搞错了」时触发

### 流程
```bash
node "$SKILL_SCRIPTS/change-round-api.js" --candidate "候选人" --interviewer "面试官" --round "3" 2>/dev/null
```

参数说明：
- `--round`: 1=业务初面, 2=业务终面, 3=HR面

**返回情况处理：**
- `interviewer_not_found` → 告知用户，列出当前有哪些面试官
- `success` → 展示确认信息

**确认格式：**
```
轮次修改完成，请确认：
候选人：{candidate} | {job}
面试官：{interviewer}
原轮次：{oldRound}
新轮次：{newRound}
确认后发送通知？
```

---

## 发送通知（所有功能共用）

用户确认后（回复「确认」「发」「OK」「好」等）：
```bash
node "$SKILL_SCRIPTS/notify-api.js" --resume_id "{resume_id}" 2>/dev/null
```
成功后告知：「✅ 通知已发出，邮件和消息均已发送」

---

## Session 过期处理
API 返回异常时，执行登录：
```bash
# Mac/Linux
node "$HOME/.claude/skills/leihuo-interview-mgr/scripts/step-login.js" 2>/dev/null
# Windows
node "$env:APPDATA\LobsterAI\SKILLs\leihuo-interview-mgr\scripts\step-login.js"
```
收到 `{"status":"ok"}` 后自动重试原操作。

---

## 注意事项
- 脚本加 `2>/dev/null`，只读 stdout 的 JSON
- `resume_id` 在改期/新建/改轮次成功 JSON 里直接有
- 新建面试时间只支持自然语言（明天11点、后天下午3点等），不支持绝对日期格式

---

## 安装方法

**Mac/Linux：**
```bash
bash ~/.claude/skills/leihuo-interview-mgr/setup.sh
```

**Windows（推荐）：**
双击 `setup.bat` 或在 PowerShell 中运行 `setup.ps1`

> ⚠️ Windows 用户：安装目录为 `%APPDATA%\LobsterAI\SKILLs\leihuo-interview-mgr\`

---

## 更新日志

**v1.1（2026-04-13）**
- 修复 `create-interview-api.js` 新建面试时全量覆盖已有计划的 bug（现在新建前会先读取现有面试，追加后再提交）
- 新增 `change-round-api.js`：支持修改已有面试的轮次类型（业务初面/业务终面/HR面）
- 注意事项补充：时间参数不支持 YYYY-MM-DD 格式
