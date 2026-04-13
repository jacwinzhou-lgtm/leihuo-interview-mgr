@echo off
:: leihuo-interview-mgr 自动更新脚本（Windows，无需 git）
set SKILL_DIR=%APPDATA%\LobsterAI\SKILLs\leihuo-interview-mgr
set ZIP_URL=https://github.com/jacwinzhou-lgtm/leihuo-interview-mgr/archive/refs/heads/main.zip
set TMP_ZIP=%TEMP%\leihuo-interview-mgr.zip
set TMP_DIR=%TEMP%\leihuo-interview-mgr-tmp

echo 正在下载最新版本...
powershell -Command "Invoke-WebRequest -Uri '%ZIP_URL%' -OutFile '%TMP_ZIP%'"

if not exist "%TMP_ZIP%" (
  echo 下载失败，请检查网络连接
  pause
  exit /b 1
)

echo 正在解压...
if exist "%TMP_DIR%" rmdir /s /q "%TMP_DIR%"
powershell -Command "Expand-Archive -Path '%TMP_ZIP%' -DestinationPath '%TMP_DIR%' -Force"

echo 正在更新文件...
if not exist "%SKILL_DIR%" mkdir "%SKILL_DIR%"
xcopy /e /y /q "%TMP_DIR%\leihuo-interview-mgr-main\*" "%SKILL_DIR%\"

echo 正在安装依赖...
cd /d "%SKILL_DIR%\scripts" && npm install --silent

echo 清理临时文件...
del "%TMP_ZIP%"
rmdir /s /q "%TMP_DIR%"

echo.
echo 更新完成！
pause
