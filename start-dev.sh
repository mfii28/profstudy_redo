#!/usr/bin/env bash
# ============================================================
# Profs Training Solutions — Development Starter
# Starts both the Python backend and Next.js frontend concurrently.
# Usage:   bash start-dev.sh
# ============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

# ── Colour helpers ──────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'
BOLD='\033[1m'; NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
err()   { echo -e "${RED}[ERROR]${NC} $*"; }

cleanup() {
    echo ""
    info "Shutting down services …"
    [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null && wait "$BACKEND_PID" 2>/dev/null
    [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null && wait "$FRONTEND_PID" 2>/dev/null
    ok "All services stopped."
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# ── Pre-flight checks ───────────────────────────────────────
command -v python >/dev/null 2>&1 || { err "Python not found."; exit 1; }
command -v node   >/dev/null 2>&1 || { err "Node.js not found."; exit 1; }
command -v npm    >/dev/null 2>&1 || { err "npm not found."; exit 1; }

# ── 1. Backend (FastAPI) ────────────────────────────────────
info "Starting backend …"
cd "$BACKEND_DIR"

if [ -d ".venv" ]; then
    VENV_PYTHON=".venv/Scripts/python"
    if [ ! -f "$VENV_PYTHON" ]; then
        VENV_PYTHON=".venv/bin/python"   # Linux/macOS fallback
    fi
    if [ -f ".venv/Scripts/activate" ]; then
        source ".venv/Scripts/activate"
    elif [ -f ".venv/bin/activate" ]; then
        source ".venv/bin/activate"
    fi
    PYTHON="$VENV_PYTHON"
else
    PYTHON="python"
fi

$PYTHON -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# Wait for backend to be healthy (up to 15 seconds)
info "Waiting for backend to be ready …"
for i in $(seq 1 15); do
    if curl -s http://127.0.0.1:8000/health 2>/dev/null | grep -q "online"; then
        ok "Backend healthy at http://localhost:8000  (PID $BACKEND_PID)"
        break
    fi
    if [ "$i" -eq 15 ]; then
        err "Backend health check failed after 15s. Check backend/.env and database connection."
        exit 1
    fi
    sleep 1
done

# ── 2. Frontend (Next.js) ───────────────────────────────────
info "Starting frontend …"
cd "$FRONTEND_DIR"

npm install --silent 2>/dev/null || true   # ensure deps

npx next dev --port 3000 &
FRONTEND_PID=$!
sleep 3
if kill -0 "$FRONTEND_PID" 2>/dev/null; then
    ok "Frontend running at http://localhost:3000  (PID $FRONTEND_PID)"
else
    err "Frontend failed to start."
    exit 1
fi

# ── Ready ───────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}============================================${NC}"
echo -e "${BOLD}${GREEN}  Both services are running!                ${NC}"
echo -e "${BOLD}${GREEN}  Frontend → http://localhost:3000          ${NC}"
echo -e "${BOLD}${GREEN}  Backend   → http://localhost:8000          ${NC}"
echo -e "${BOLD}${GREEN}  Health    → http://localhost:8000/health   ${NC}"
echo -e "${BOLD}${GREEN}  Press Ctrl+C to stop both.                ${NC}"
echo -e "${BOLD}${GREEN}============================================${NC}"
echo ""

# Wait for either process to exit
wait $FRONTEND_PID $BACKEND_PID
