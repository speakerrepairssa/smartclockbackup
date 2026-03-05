@echo off
setlocal
title SmartClock Connector Installer

echo.
echo  =====================================================
echo   SmartClock Connector — Windows Installer
echo  =====================================================
echo.

:: Check for Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [!] Node.js is not installed.
    echo      Opening download page...
    echo      Please install Node.js LTS, then run this installer again.
    start https://nodejs.org/en/download
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node --version') do set NODEVER=%%v
echo  [ok] Node.js found: %NODEVER%

:: Install to C:\SmartClockConnector
set INSTALL_DIR=C:\SmartClockConnector
echo.
echo  Installing to: %INSTALL_DIR%

if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

:: Copy files
xcopy /E /Y /I "%~dp0*" "%INSTALL_DIR%\" >nul
echo  [ok] Files copied

:: Install npm dependencies
cd /d "%INSTALL_DIR%"
echo  [..] Installing dependencies (this takes ~30 seconds)...
call npm install --prefer-offline >nul 2>&1
if %errorlevel% neq 0 (
    call npm install >nul 2>&1
)
echo  [ok] Dependencies installed

:: Install as Windows Service
echo  [..] Installing Windows Service...
node install-service.cjs
if %errorlevel% neq 0 (
    echo  [!] Service install failed. Starting manually instead...
    goto startmanual
)

echo  [ok] Windows Service installed (auto-starts on reboot)
goto openbrowser

:startmanual
echo  [..] Starting connector manually...
start "SmartClock Connector" /min cmd /c "cd /d %INSTALL_DIR% && node sync-agent.cjs"

:openbrowser
echo.
echo  =====================================================
echo   Setup almost done!
echo.
echo   1. Your browser will open the Setup page now.
echo   2. Sign in with your SmartClock email + password.
echo   3. Select your attendance device from the list.
echo   4. Done — the connector runs silently in the background.
echo  =====================================================
echo.
timeout /t 3 >nul
start http://localhost:7663
echo  [ok] Setup page opened at http://localhost:7663
echo.
pause
