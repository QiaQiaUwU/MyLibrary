@echo off
setlocal
cd /d "%~dp0"
title MyLibrary

rem --- Find Python (python first, then the py launcher) ---
set "PY=python"
where python >nul 2>&1 || set "PY=py"
%PY% --version >nul 2>&1
if errorlevel 1 (
  echo.
  echo Python not found. Install Python 3.9+ and tick "Add Python to PATH":
  echo   https://www.python.org/downloads/
  echo.
  pause
  exit /b 1
)

rem --- First run installs dependencies once (marker file .deps_ok) ---
if not exist ".deps_ok" (
  echo First launch: installing dependencies once, please wait...
  %PY% -m pip install -r requirements.txt
  if errorlevel 1 (
    echo.
    echo Dependency install failed. Run manually:  %PY% -m pip install -r requirements.txt
    echo.
    pause
    exit /b 1
  )
  echo ok> ".deps_ok"
)

echo.
echo   ============================================
echo     MyLibrary is starting ...
echo     A separate app window will pop up shortly.
echo     (Big library = a few seconds. Please wait.)
echo     Keep this black window open = the server.
echo     Close it = quit MyLibrary.
echo   ============================================
echo.
%PY% main.py %*

if errorlevel 1 (
  echo.
  echo Start failed. If dependencies look broken, delete the file .deps_ok and run again to reinstall.
  echo.
  pause
)

