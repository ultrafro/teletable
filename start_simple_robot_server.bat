@echo off
cd /d "%~dp0SimpleRobotServer"
echo Starting Simple Robot Server...
echo.

REM Try uv first, fall back to venv python
where uv >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    uv run simple-robot-server
) else (
    if exist ".venv\Scripts\python.exe" (
        .venv\Scripts\python.exe simple_robot_server.py
    ) else (
        python simple_robot_server.py
    )
)

pause
