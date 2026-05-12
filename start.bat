@echo off
cd /d "%~dp0"
title AlgoArena - Ctrl+C to stop
color 0A

"C:\Program Files\nodejs\node.exe" launcher.js
if errorlevel 1 (
    echo.
    echo Launch failed! Press any key...
    pause >nul
)
