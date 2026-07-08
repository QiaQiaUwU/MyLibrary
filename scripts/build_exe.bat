@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0\.."
set "LOG=%CD%\build_log.txt"
echo MyLibrary build log > "%LOG%"
echo started %DATE% %TIME% >> "%LOG%"

echo ============================================================
echo   MyLibrary - build standalone EXE
echo   (full output is being saved to build_log.txt)
echo ============================================================
echo.

rem ---- find Python (you already have it since you can run the project) ----
set "PY="
where py >nul 2>&1 && set "PY=py -3"
if not defined PY ( where python >nul 2>&1 && set "PY=python" )
if not defined PY (
  echo   [!] Python not found on PATH. Opening the download page -
  echo       tick "Add Python to PATH" when installing, then run this again.
  echo PYTHON NOT FOUND >> "%LOG%"
  start "" "https://www.python.org/downloads/windows/"
  pause & exit /b 1
)
echo   Using Python: !PY!
echo USING PYTHON: !PY! >> "%LOG%"
%PY% --version >> "%LOG%" 2>&1
echo.

rem ---- install build tool + deps (China mirror first, fall back to PyPI) ----
set "MIRROR=https://pypi.tuna.tsinghua.edu.cn/simple"
echo [1/3] Installing PyInstaller + dependencies ...
echo === pip install (mirror) === >> "%LOG%"
%PY% -m pip install --upgrade pip -i %MIRROR% >> "%LOG%" 2>&1
%PY% -m pip install pyinstaller -r requirements.txt -i %MIRROR% >> "%LOG%" 2>&1
if errorlevel 1 (
  echo   mirror failed, retrying with default source ...
  echo === pip install default === >> "%LOG%"
  %PY% -m pip install pyinstaller -r requirements.txt >> "%LOG%" 2>&1
)
if errorlevel 1 (
  echo   [X] Dependency install failed. Send me build_log.txt - the reason is in there.
  pause & exit /b 1
)

rem ---- build ----
echo.
echo [2/3] Building, about 1 to 3 minutes ...
echo === pyinstaller === >> "%LOG%"
%PY% -m PyInstaller --clean --noconfirm MyLibrary.spec >> "%LOG%" 2>&1
echo pyinstaller exit code: %ERRORLEVEL% >> "%LOG%"

rem ---- check result (goto-based so message parentheses cannot break parsing) ----
echo.
echo [3/3] Checking result ...
if exist "dist\MyLibrary.exe" goto RESULT_OK
echo BUILD FAILED no exe >> "%LOG%"
echo.
echo   [X] dist\MyLibrary.exe was NOT produced - the build did not finish.
echo       Please send me build_log.txt next to main.py; it has the exact error.
goto THE_END

:RESULT_OK
echo BUILD OK exe exists >> "%LOG%"
echo.
echo   DONE.  Your app is here:   dist\MyLibrary.exe
echo   Send THAT ONE FILE to your friend. She double-clicks it; a library folder is
echo   created automatically and the browser opens to MyLibrary. Nothing to install.
echo   First run, Windows may warn about an unknown publisher:
echo   click "More info", then "Run anyway". One time only.

:THE_END
echo.
pause

