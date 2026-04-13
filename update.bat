@echo off
:: leihuo-interview-mgr 自动更新脚本（Windows）
set SKILL_DIR=%APPDATA%\LobsterAI\SKILLs\leihuo-interview-mgr
set REPO_URL=https://github.com/jacwinzhou-lgtm/leihuo-interview-mgr.git

echo 正在检查更新...

if not exist "%SKILL_DIR%\.git" (
  echo 首次安装，正在下载...
  git clone %REPO_URL% "%SKILL_DIR%"
  echo 安装完成！
) else (
  cd /d "%SKILL_DIR%"
  git pull origin main
  echo 更新完成！
)

echo 正在安装依赖...
cd /d "%SKILL_DIR%\scripts" && npm install --silent
echo 全部完成！
pause
