#!/bin/bash
# leihuo-interview-mgr 自动更新脚本

SKILL_DIR="$HOME/.claude/skills/leihuo-interview-mgr"
REPO_URL="https://github.com/jacwinzhou-lgtm/leihuo-interview-mgr.git"

echo "正在检查更新..."

if [ ! -d "$SKILL_DIR/.git" ]; then
  echo "首次安装，正在下载..."
  git clone "$REPO_URL" "$SKILL_DIR"
  echo "安装完成！"
else
  cd "$SKILL_DIR"
  git pull origin main
  echo "更新完成！"
fi

echo "正在安装依赖..."
cd "$SKILL_DIR/scripts" && npm install --silent
echo "✅ 全部完成！"
