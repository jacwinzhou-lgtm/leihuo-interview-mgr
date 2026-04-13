@echo off
chcp 65001 > nul
echo ==============================
echo  面试改期工具 - Windows 安装
echo ==============================

:: 检查 Node.js
where node > nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到 Node.js，请先安装：https://nodejs.org
    pause
    exit /b 1
)
echo [OK] Node.js 已安装

:: 获取脚本所在目录
set SKILL_DIR=%~dp0
set SCRIPTS_DIR=%SKILL_DIR%scripts

:: 安装 npm 依赖
echo.
echo 正在安装依赖...
cd /d "%SCRIPTS_DIR%"
call npm install
if %errorlevel% neq 0 (
    echo [错误] npm install 失败
    pause
    exit /b 1
)

:: 下载 Playwright 浏览器
echo.
echo 正在下载浏览器（约 300MB，请耐心等待）...
call npx playwright install chromium
if %errorlevel% neq 0 (
    echo [错误] 浏览器下载失败，请检查网络
    pause
    exit /b 1
)

echo.
echo ==============================
echo  首次登录校招系统
echo ==============================
echo 即将打开浏览器，请在浏览器中完成登录
echo 登录成功后浏览器会自动关闭
echo.
pause

node "%SCRIPTS_DIR%\step-login.js"

echo.
echo ==============================
echo [完成] 安装成功！
echo ==============================
echo.
echo 使用方法：在 Claude/OpenClaw 中说「把XXX的面试改到明天下午3点」
echo.
pause
