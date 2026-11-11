@echo off
title HnS Royale - play with friends
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is needed: install it from https://nodejs.org and run this again. & pause & exit /b 1)
node scripts\update.mjs
if not exist node_modules call npm install
node scripts\play-with-friends.mjs
pause
