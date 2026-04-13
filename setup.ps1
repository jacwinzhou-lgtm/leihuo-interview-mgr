# 面试改期工具 - PowerShell 安装脚本（Windows）
# 使用方法：右键 → 用 PowerShell 运行

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "==============================" -ForegroundColor Cyan
Write-Host " 面试改期工具 - 环境初始化" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan

# 检查 Node.js
try {
    $nodeVersion = node --version
    Write-Host "[OK] Node.js $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "[错误] 未找到 Node.js，请先安装：https://nodejs.org" -ForegroundColor Red
    pause
    exit 1
}

# 获取脚本目录
$skillDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$scriptsDir = Join-Path $skillDir "scripts"

# 安装 npm 依赖
Write-Host "`n正在安装依赖..." -ForegroundColor Yellow
Set-Location $scriptsDir
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "[错误] npm install 失败" -ForegroundColor Red
    pause
    exit 1
}
Write-Host "[OK] 依赖安装完成" -ForegroundColor Green

# 下载 Playwright 浏览器
Write-Host "`n正在下载浏览器（约 300MB）..." -ForegroundColor Yellow
npx playwright install chromium
if ($LASTEXITCODE -ne 0) {
    Write-Host "[错误] 浏览器下载失败，请检查网络后重试" -ForegroundColor Red
    pause
    exit 1
}
Write-Host "[OK] 浏览器下载完成" -ForegroundColor Green

# 首次登录
Write-Host "`n==============================" -ForegroundColor Cyan
Write-Host " 首次登录校招系统" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan
Write-Host "即将打开浏览器，请在浏览器中完成登录（账号密码 + 动态验证码）"
Write-Host "登录成功后浏览器会自动关闭，Session 自动保存"
Write-Host ""
Read-Host "按回车键继续"

node (Join-Path $scriptsDir "step-login.js")

Write-Host "`n==============================" -ForegroundColor Green
Write-Host "[完成] 安装成功！" -ForegroundColor Green
Write-Host "==============================" -ForegroundColor Green
Write-Host "`n使用方法：在 Claude/OpenClaw 中直接说「把XXX的面试改到明天下午3点」`n"
pause
