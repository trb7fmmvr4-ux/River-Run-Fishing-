@echo off
setlocal enabledelayedexpansion
title River Run Fishing - Game Launcher

REM ============================================================
REM   River Run Fishing - Windows Launcher
REM   Double-click this file to start the game.
REM   This script does NOT modify any game code.
REM ============================================================

REM Always run from the folder this script lives in (the project root),
REM no matter where it was launched from.
cd /d "%~dp0"

echo.
echo  ============================================
echo      RIVER RUN FISHING - STARTING UP
echo  ============================================
echo.

REM ----- Step 1: make sure Node.js is installed -----
where node >nul 2>nul
if errorlevel 1 (
    echo  [X] Node.js was not found on this computer.
    echo.
    echo      River Run Fishing needs Node.js to run.
    echo      1^) Go to https://nodejs.org
    echo      2^) Download and install the "LTS" version.
    echo      3^) Restart your computer, then double-click this file again.
    echo.
    pause
    exit /b 1
)

for /f "delims=" %%v in ('node --version') do set NODE_VERSION=%%v
echo  [OK] Node.js found (version !NODE_VERSION!^).
echo.

REM ----- Step 2: install dependencies the first time -----
if not exist "node_modules" (
    echo  [..] First-time setup: installing the game's building blocks.
    echo       This can take a few minutes. Please wait...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo  [X] Setup failed while installing dependencies.
        echo      Please check your internet connection and try again.
        echo.
        pause
        exit /b 1
    )
    echo.
    echo  [OK] Setup complete.
    echo.
) else (
    echo  [OK] Game files already installed.
    echo.
)

REM ----- Step 3: start the development server -----
echo  ============================================
echo      LAUNCHING THE GAME
echo  ============================================
echo.
echo  The game will open in your web browser at:
echo.
echo        http://localhost:5173
echo.
echo  IMPORTANT: Keep THIS window open while you play.
echo  To stop the game, close this window or run
echo  "Stop River Run Fishing.bat".
echo.

REM Give the server a moment to boot, then open the browser automatically.
start "" /b cmd /c "timeout /t 4 /nobreak >nul & start "" http://localhost:5173"

REM Remember this window's process id so the Stop script can find the server.
echo %ERRORLEVEL% >nul

REM Run the dev server in the foreground so its log stays visible and the
REM window stays open. Closing this window stops the server.
call npm run dev

echo.
echo  The game server has stopped.
echo  You can close this window now.
echo.
pause
endlocal
