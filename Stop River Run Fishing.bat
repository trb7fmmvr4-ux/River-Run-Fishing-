@echo off
setlocal enabledelayedexpansion
title River Run Fishing - Stop Server

REM ============================================================
REM   River Run Fishing - Windows Stop Script
REM   Double-click this file to stop the game's dev server.
REM   This script does NOT modify any game code.
REM ============================================================

cd /d "%~dp0"

echo.
echo  ============================================
echo      STOPPING RIVER RUN FISHING
echo  ============================================
echo.

REM The dev server listens on port 5173 (set in vite.config.ts). Find any
REM process listening on that port and stop it. This avoids touching
REM unrelated Node.js programs you might have running.
set FOUND=0
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":5173" ^| findstr "LISTENING"') do (
    set PID=%%p
    if not "!PID!"=="0" (
        echo  [..] Stopping the game server (process !PID!^)...
        taskkill /PID !PID! /F >nul 2>nul
        if errorlevel 1 (
            echo  [!] Could not stop process !PID! automatically.
        ) else (
            echo  [OK] Stopped.
            set FOUND=1
        )
    )
)

echo.
if "!FOUND!"=="1" (
    echo  The game has been stopped successfully.
) else (
    echo  No running game server was found on port 5173.
    echo  It may already be stopped, or you can simply close the
    echo  launcher window.
)
echo.
pause
endlocal
