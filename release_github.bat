@echo off
setlocal
cd /d "%~dp0"
title MyLibrary - Release New Version

echo ============================================
echo   MyLibrary - Release New Version (auto-builds exe)
echo ============================================
echo.
echo Tip: run update_github.bat first to push your code,
echo then use this one to tag a release.
echo.

set "ver="
set /p ver=Version number, e.g. 4.6.18, no v prefix: 
if "%ver%"=="" goto noversion

git tag v%ver%
git push origin v%ver%

echo.
echo ============================================
echo   Tag v%ver% pushed.
echo   Check the Actions tab on GitHub for build progress;
echo   once it finishes, the Releases page will have the exe.
echo ============================================
pause
goto :eof

:noversion
echo No version number entered, exiting.
pause


