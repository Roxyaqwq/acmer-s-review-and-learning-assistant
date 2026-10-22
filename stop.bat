@echo off
chcp 65001 >nul
echo [清理] 停止 AlgoArena 所有进程...

for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":8080"') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3000"') do taskkill /f /pid %%a >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq AlgoArena*" >nul 2>&1

echo [✓] 已停止
timeout /t 2 >nul
