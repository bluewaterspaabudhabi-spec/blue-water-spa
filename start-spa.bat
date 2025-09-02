@echo off
setlocal

cd /d "%~dp0backend"
start "backend" cmd /c "npm run dev"

timeout /t 2 >nul

cd /d "%~dp0frontend"
start "frontend" cmd /c "npm run dev"

timeout /t 4 >nul
start "" http://localhost:5173/login

endlocal