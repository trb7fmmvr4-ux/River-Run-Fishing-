#!/bin/bash
# ============================================================
#   River Run Fishing - macOS Launcher
#   Double-click this file in Finder to start the game.
#   This script does NOT modify any game code.
# ============================================================

# Always run from the folder this script lives in (the project root),
# no matter where it was launched from.
cd "$(dirname "$0")" || exit 1

echo ""
echo "  ============================================"
echo "      RIVER RUN FISHING - STARTING UP"
echo "  ============================================"
echo ""

# ----- Step 1: make sure Node.js is installed -----
if ! command -v node >/dev/null 2>&1; then
    echo "  [X] Node.js was not found on this computer."
    echo ""
    echo "      River Run Fishing needs Node.js to run."
    echo "      1) Go to https://nodejs.org"
    echo "      2) Download and install the \"LTS\" version."
    echo "      3) Restart your Mac, then double-click this file again."
    echo ""
    echo "  Press any key to close this window."
    read -n 1 -s
    exit 1
fi

echo "  [OK] Node.js found (version $(node --version))."
echo ""

# ----- Step 2: install dependencies the first time -----
if [ ! -d "node_modules" ]; then
    echo "  [..] First-time setup: installing the game's building blocks."
    echo "       This can take a few minutes. Please wait..."
    echo ""
    if ! npm install; then
        echo ""
        echo "  [X] Setup failed while installing dependencies."
        echo "      Please check your internet connection and try again."
        echo ""
        echo "  Press any key to close this window."
        read -n 1 -s
        exit 1
    fi
    echo ""
    echo "  [OK] Setup complete."
    echo ""
else
    echo "  [OK] Game files already installed."
    echo ""
fi

# ----- Step 3: start the development server -----
echo "  ============================================"
echo "      LAUNCHING THE GAME"
echo "  ============================================"
echo ""
echo "  The game will open in your web browser at:"
echo ""
echo "        http://localhost:5173"
echo ""
echo "  IMPORTANT: Keep THIS window open while you play."
echo "  To stop the game, close this window or run"
echo "  \"Stop River Run Fishing.command\"."
echo ""

# Give the server a moment to boot, then open the browser automatically.
( sleep 4; open "http://localhost:5173" ) &

# Run the dev server in the foreground so its log stays visible and the
# window stays open. Closing this window (or Ctrl+C) stops the server.
npm run dev

echo ""
echo "  The game server has stopped."
echo "  You can close this window now."
echo ""
