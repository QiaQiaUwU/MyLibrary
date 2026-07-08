@echo off
setlocal
cd /d "%~dp0"
title MyLibrary - Sync to GitHub

echo ============================================
echo   MyLibrary - Sync to GitHub
echo ============================================
echo.

git status --short
echo.

set "msg="
set /p msg=What changed this time, Enter for default: 
if "%msg%"=="" set "msg=Update"

git add -A
git commit -m "%msg%"

git push

echo.
echo ============================================
echo   Done. Refresh the GitHub page to check.
echo ============================================
pause
