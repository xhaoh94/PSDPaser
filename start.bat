@echo off
title PSD Parser
echo Starting PSD Parser...

:: Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)

:: Open browser
start http://localhost:5173

:: Start Dev Server
echo Starting development server...
npm run dev
