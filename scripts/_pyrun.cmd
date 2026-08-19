@echo off
REM Cross-platform Python launcher for AI log hooks (Windows cmd.exe).
REM Tries repo .venv first, then py -3 -> python -> python3.
REM Exits 0 silently if no Python is found - hooks must never block the AI tool.

if exist ".venv\Scripts\python.exe" (
  ".venv\Scripts\python.exe" %*
  exit /b %ERRORLEVEL%
)

if exist ".venv\bin\python" (
  ".venv\bin\python" %*
  exit /b %ERRORLEVEL%
)

where py >nul 2>nul
if %ERRORLEVEL%==0 (
  py -3 %*
  exit /b %ERRORLEVEL%
)

where python >nul 2>nul
if %ERRORLEVEL%==0 (
  python %*
  exit /b %ERRORLEVEL%
)

where python3 >nul 2>nul
if %ERRORLEVEL%==0 (
  python3 %*
  exit /b %ERRORLEVEL%
)

exit /b 0

