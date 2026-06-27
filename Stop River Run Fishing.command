#!/bin/bash
# ============================================================
#   River Run Fishing - macOS Stop Script
#   Double-click this file in Finder to stop the game's dev server.
#   This script does NOT modify any game code.
# ============================================================

cd "$(dirname "$0")" || exit 1

echo ""
echo "  ============================================"
echo "      STOPPING RIVER RUN FISHING"
echo "  ============================================"
echo ""

# The dev server listens on port 5173 (set in vite.config.ts). Find any
# process listening on that port and stop it. This avoids touching
# unrelated Node.js programs you might have running.
PIDS=$(lsof -ti tcp:5173 2>/dev/null)

if [ -z "$PIDS" ]; then
    echo "  No running game server was found on port 5173."
    echo "  It may already be stopped, or you can simply close the"
    echo "  launcher window."
else
    echo "  [..] Stopping the game server..."
    # Try a graceful stop first, then force if still alive.
    for PID in $PIDS; do
        kill "$PID" 2>/dev/null
    done
    sleep 1
    STILL=$(lsof -ti tcp:5173 2>/dev/null)
    if [ -n "$STILL" ]; then
        for PID in $STILL; do
            kill -9 "$PID" 2>/dev/null
        done
    fi
    echo "  [OK] The game has been stopped successfully."
fi

echo ""
echo "  Press any key to close this window."
read -n 1 -s
echo ""
