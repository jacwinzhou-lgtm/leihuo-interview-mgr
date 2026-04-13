#!/bin/bash
# 面试改期工具 - 一键安装脚本
# 使用方法：将整个「面试改期」文件夹放入 ~/.claude/skills/ 目录，然后运行此脚本

set -e

SKILL_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SCRIPTS_DIR="$SKILL_DIR/scripts"

echo "=============================="
echo " 面试改期工具 - 环境初始化"
echo "=============================="

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 未找到 Node.js，请先安装 Node.js (https://nodejs.org)"
    exit 1
fi
echo "✅ Node.js $(node --version)"

# 安装依赖
echo ""
echo "正在安装依赖（playwright）..."
cd "$SCRIPTS_DIR"
npm install
npx playwright install chromium
echo "✅ 依赖安装完成"

# 首次登录
echo ""
echo "=============================="
echo " 首次登录校招系统"
echo "=============================="
echo "即将打开浏览器，请在浏览器中完成登录（账号密码 + 动态验证码）"
echo "登录成功后 session 会自动保存，后续使用无需再次登录"
echo ""
read -p "按回车键继续..."

node "$SCRIPTS_DIR/step-login.js" 2>/dev/null

echo ""
echo "=============================="
echo "✅ 安装完成！"
echo "=============================="
echo ""
echo "使用方法："
echo "  在 Claude Code 中说：「薛巍，改到明天下午3点」"
echo "  或使用斜杠命令：/面试改期"
echo ""
