#!/usr/bin/env bash
# Cross-platform Python launcher for AI log hooks.
# Tries repo .venv first, then python3, python, and py -3. On Windows/Git Bash, skips broken
# Microsoft Store python aliases and probes common install locations.
# Usage: bash scripts/_pyrun.sh <script> [args...]
#
# Exits 0 silently if no working Python is found. Hooks must never block work.
set -u

PY_CMD=()

if [ -x ".venv/Scripts/python.exe" ] && .venv/Scripts/python.exe --version >/dev/null 2>&1; then
  PY_CMD=(.venv/Scripts/python.exe)
elif [ -x ".venv/bin/python" ] && .venv/bin/python --version >/dev/null 2>&1; then
  PY_CMD=(.venv/bin/python)
elif command -v python3 >/dev/null 2>&1 && python3 --version >/dev/null 2>&1; then
  PY_CMD=(python3)
elif command -v python >/dev/null 2>&1 && python --version >/dev/null 2>&1; then
  PY_CMD=(python)
elif command -v py >/dev/null 2>&1 && py -3 --version >/dev/null 2>&1; then
  PY_CMD=(py -3)
else
  shopt -s nullglob 2>/dev/null || true
  for cand in \
    /c/Users/*/AppData/Local/Programs/Python/Python*/python.exe \
    "/c/Program Files/Python"*/python.exe \
    "/c/Program Files (x86)/Python"*/python.exe \
    /c/Python*/python.exe; do
    if [ -x "$cand" ] && "$cand" --version >/dev/null 2>&1; then
      PY_CMD=("$cand")
      break
    fi
  done
  shopt -u nullglob 2>/dev/null || true
fi

[ "${#PY_CMD[@]}" -gt 0 ] || exit 0
exec "${PY_CMD[@]}" "$@"
