@echo off
setlocal
REM ============================================================================
REM  KrishiMitra - Backend (Django REST API) on port 5001
REM  Double-click this file, or run  start-backend.bat  in cmd.
REM
REM  IMPORTANT (Windows path length / WinError 206):
REM  The virtual environment is created OUTSIDE the project, at a SHORT path
REM  (default C:\venvs\krishi) -- NOT inside backend\venv. Installing chromadb /
REM  sentence-transformers / torch creates very deeply nested files; a venv kept
REM  deep under the project directory pushes those absolute paths past Windows'
REM  260-character MAX_PATH limit and fails with:
REM      OSError: [WinError 206] The filename or extension is too long
REM  A short root-level venv path keeps every package path well under the limit.
REM
REM  Override the location if you need to:   set KRISHI_VENV=D:\venvs\krishi
REM  Requires Python 3.12 (via the "py -3.12" launcher, or a 3.12 "python").
REM ============================================================================

REM --- Resolve paths (project dir comes from THIS script; nothing hard-coded) --
set "BACKEND_DIR=%~dp0backend"

REM --- Auto-detect existing Conda or dedicated virtual environments ---------------
if defined KRISHI_VENV (
    set "VENV_DIR=%KRISHI_VENV%"
    goto check_env
)

if exist "%USERPROFILE%\miniconda3\envs\krishi_train\python.exe" (
    set "VENV_DIR=%USERPROFILE%\miniconda3\envs\krishi_train"
    goto check_env
)
if exist "%USERPROFILE%\anaconda3\envs\krishi_train\python.exe" (
    set "VENV_DIR=%USERPROFILE%\anaconda3\envs\krishi_train"
    goto check_env
)
if exist "%LOCALAPPDATA%\miniconda3\envs\krishi_train\python.exe" (
    set "VENV_DIR=%LOCALAPPDATA%\miniconda3\envs\krishi_train"
    goto check_env
)

set "VENV_DIR=C:\venvs\krishi"

:check_env
set "VENV_PY=%VENV_DIR%\python.exe"
if not exist "%VENV_PY%" set "VENV_PY=%VENV_DIR%\Scripts\python.exe"

REM --- Reuse the environment if present; otherwise create it with Python 3.12 ---
if exist "%VENV_PY%" (
    echo [venv] Using Python environment: "%VENV_DIR%"
    goto run_direct
)

echo [venv] Creating environment at "%VENV_DIR%" with Python 3.12 ...
set "PY312="
py -3.12 --version >nul 2>&1 && set "PY312=py -3.12"
if not defined PY312 call :find_python312
if not defined PY312 goto no_python312

REM Ensure the PARENT folder exists (e.g. C:\venvs), then create the venv.
for %%I in ("%VENV_DIR%") do if not exist "%%~dpI" mkdir "%%~dpI"
%PY312% -m venv "%VENV_DIR%"
if errorlevel 1 goto venv_failed
set "FRESH_VENV=1"

:activate
if exist "%VENV_DIR%\Scripts\activate.bat" (
    call "%VENV_DIR%\Scripts\activate.bat"
    if errorlevel 1 goto activate_failed
)

REM --- Install requirements only when the venv was just created ----------------
if not defined FRESH_VENV goto run
echo [deps] Installing backend requirements (first run; can take several minutes) ...
"%VENV_PY%" -m pip install --upgrade pip
"%VENV_PY%" -m pip install -r "%BACKEND_DIR%\requirements.txt"
if errorlevel 1 goto install_failed

:run_direct
set "PATH=%VENV_DIR%;%VENV_DIR%\Scripts;%VENV_DIR%\Library\bin;%PATH%"

:run
cd /d "%BACKEND_DIR%"
echo [db] Applying any pending database migrations...
python manage.py migrate
echo.
echo [run] KrishiMitra backend -^> http://localhost:5001  (health: /api/health)
echo       venv: "%VENV_DIR%"   Press Ctrl+C to stop.
echo.
python manage.py runserver 0.0.0.0:5001
goto end

:find_python312
REM Fall back to a "python" on PATH only if it reports version 3.12.x
for /f "tokens=2" %%v in ('python --version 2^>^&1') do echo %%v| findstr /b /c:"3.12" >nul 2>&1 && set "PY312=python"
goto :eof

:no_python312
echo [ERROR] Python 3.12 was not found.
echo         Install Python 3.12 so that "py -3.12" works, or put a 3.12 "python"
echo         on your PATH, then run this script again.
exit /b 1

:venv_failed
echo [ERROR] Failed to create the virtual environment at "%VENV_DIR%".
exit /b 1

:activate_failed
echo [ERROR] Could not activate the virtual environment at "%VENV_DIR%".
exit /b 1

:install_failed
echo [ERROR] Dependency installation failed.
echo         Delete "%VENV_DIR%" and run this script again to retry.
exit /b 1

:end
endlocal
