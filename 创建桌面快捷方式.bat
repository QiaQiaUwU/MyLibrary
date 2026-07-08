@echo off
setlocal
cd /d "%~dp0"
title Create Desktop Shortcut for MyLibrary

rem --- Find pythonw (no console) then python. Only accept real .exe paths, so a
rem --- stray "Active code page: 65001" line (from a chcp in your cmd AutoRun) is ignored. ---
set "PYW="
for /f "delims=" %%i in ('where pythonw 2^>nul') do @if /i "%%~xi"==".exe" if not defined PYW set "PYW=%%i"
if not defined PYW for /f "delims=" %%i in ('where python 2^>nul') do @if /i "%%~xi"==".exe" if not defined PYW set "PYW=%%i"
if not defined PYW (
  echo.
  echo Python not found. Install Python 3.9+ and tick "Add Python to PATH":
  echo   https://www.python.org/downloads/
  echo.
  pause
  exit /b 1
)

set "HERE=%~dp0"
set "WDIR=%HERE:~0,-1%"
set "ICON=%HERE%app.ico"

rem --- Create the .lnk via PowerShell (no temp .vbs, avoids Windows Script Host "insufficient resources") ---
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
 "$W=New-Object -ComObject WScript.Shell; $d=$W.SpecialFolders('Desktop'); $s=$W.CreateShortcut((Join-Path $d 'MyLibrary.lnk')); $s.TargetPath='%PYW%'; $s.Arguments='main.py'; $s.WorkingDirectory='%WDIR%'; $s.WindowStyle=7; $s.Description='MyLibrary'; if(Test-Path '%ICON%'){$s.IconLocation='%ICON%'}; $s.Save()"
set "RC=%ERRORLEVEL%"

echo.
if "%RC%"=="0" (
  echo OK - A shortcut "MyLibrary.lnk" was created on your Desktop.
  echo It launches:  "%PYW%" main.py     ^(no console window^)
  echo Right-click - Properties - Change Icon if you want a different icon.
) else (
  echo Could not create the shortcut automatically ^(error %RC%^).
  echo Create one by hand:  Target = "%PYW%" main.py     Start in = "%WDIR%"
  echo Or just use the file "MyLibrary.bat" in this folder to start it.
)
echo.
pause


