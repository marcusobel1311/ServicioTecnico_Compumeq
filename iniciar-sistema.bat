@echo off
title Sistema Compumeq - Iniciando Servicios...
echo ========================================================
echo       INICIANDO SISTEMA SERVICIO TECNICO COMPUMEQ
echo ========================================================
echo.

echo [1/2] Iniciando API de Correos (Puerto 3001)...
start "Api Correo (Puerto 3001)" cmd /k "cd /d C:\Users\PC\Documents\Api correo && npm start"

timeout /t 2 /nobreak >nul

echo [2/2] Iniciando Aplicacion Web (Puerto 3000)...
start "Frontend Compumeq (Puerto 3000)" cmd /k "cd /d C:\Users\PC\Downloads\servicio-técnico-compumeq && npm run dev"

echo.
echo ========================================================
echo   Servicios iniciados con exito:
echo   - En esta PC:     http://localhost:3000
echo   - Celular / Red:  http://192.168.0.105:3000
echo ========================================================
pause
