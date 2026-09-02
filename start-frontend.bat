@echo off
setlocal
REM ============================================================
REM  KrishiMitra - Frontend (React + Vite) on port 3000
REM  Double-click this file, or run  start-frontend.bat  in cmd.
REM  First run installs node_modules with  npm install.
REM  Start the backend first (start-backend.bat).
REM ============================================================
cd /d "%~dp0frontend"

if not exist "node_modules\" (
    echo [setup] Installing frontend dependencies ^(npm install^)...
    call npm install
)

echo.
echo [run] KrishiMitra frontend -^> http://localhost:3000
echo       Press Ctrl+C to stop.
echo.
call npm run dev

endlocal
