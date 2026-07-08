@echo off
cd /d "%~dp0"
title MyLibrary
echo Starting MyLibrary ...
python main.py %*
if errorlevel 1 (
  echo.
  echo Start failed. First time? Run:  pip install -r requirements.txt
  pause
)
