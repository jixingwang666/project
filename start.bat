@echo off
title Metro Simulation Platform

REM ============================================
REM  Subway Disaster Simulation - Startup Script
REM  Log: startup_log.txt
REM ============================================

set "ROOT=%~dp0"
set "LOG=%ROOT%startup_log.txt"
echo %date% %time% START > "%LOG%"

echo.
echo ============================================
echo   Subway Disaster Simulation Platform
echo   Starting all services...
echo ============================================
echo.

REM ====== 0. Check Node.js ======
echo [0/5] Check Node.js...
echo [0] Node.js check >> "%LOG%"

where node >nul 2>nul
if errorlevel 1 (
    echo  X Node.js not found!
    echo  X Node.js not found >> "%LOG%"
    pause
    exit /b 1
)
for /f %%i in ('node -v') do echo  OK Node.js %%i

where npm >nul 2>nul
if errorlevel 1 (
    echo  X npm not found!
    pause
    exit /b 1
)
echo  OK Environment OK
echo.

REM ====== 1. MySQL ======
echo [1/5] Check MySQL...
echo [1] MySQL check >> "%LOG%"

set "MYSQL_SVC="
for %%s in (MySQL94 MySQL80 MySQL57 MySQL MySQL8 MySQL5) do (
    sc query %%s >nul 2>nul
    if not errorlevel 1 if "%MYSQL_SVC%"=="" set "MYSQL_SVC=%%s"
)

if "%MYSQL_SVC%"=="" (
    echo  - MySQL service not found, skip
    echo  - MySQL service not found >> "%LOG%"
) else (
    sc query "%MYSQL_SVC%" | find "RUNNING" >nul
    if errorlevel 1 (
        echo  - MySQL not running, starting...
        net start "%MYSQL_SVC%" >> "%LOG%" 2>&1
    )
    echo  OK MySQL ^(%MYSQL_SVC%^)
)
echo.

REM ====== 2. Middleware ======
echo [2/5] Start Middleware ^(port 3100^)...
echo [2] Middleware start >> "%LOG%"

set "MW=%ROOT%MIDDLEWARE\server"
if not exist "%MW%" (
    echo  X Directory not found: %MW%
    echo  X Directory not found: %MW% >> "%LOG%"
    pause
    exit /b 1
)

if not exist "%MW%\node_modules" (
    echo  - Installing deps...
    cd /d "%MW%"
    call npm install >> "%LOG%" 2>&1
    if errorlevel 1 (
        echo  X npm install failed, see %LOG%
        pause
        exit /b 1
    )
)

cd /d "%MW%"
start "Middleware-3100" cmd /k "title Middleware-3100 && npm start"
echo  OK Middleware window opened
echo [2] Middleware started >> "%LOG%"
echo.

REM ====== 3. Signaling Server ======
echo [3/5] Start Signaling Server ^(port 8080/8888^)...
echo [3] Signaling start >> "%LOG%"

set "FE=%ROOT%FRONT_UE\frontend\WebServers\SignallingWebServer"
if not exist "%FE%" (
    echo  X Directory not found: %FE%
    echo  X Directory not found: %FE% >> "%LOG%"
    pause
    exit /b 1
)

if not exist "%FE%\node_modules" (
    echo  - Installing deps...
    cd /d "%FE%"
    call npm install >> "%LOG%" 2>&1
    if errorlevel 1 (
        echo  X npm install failed, see %LOG%
        pause
        exit /b 1
    )
)

cd /d "%FE%"
start "Signaling-8080" cmd /k "title Signaling-8080 && npm start"
echo  OK Signaling window opened
echo [3] Signaling started >> "%LOG%"
echo.

REM ====== 4. Mock Backend ======
echo [4/5] Start Mock Backend ^(port 3200^)...
echo [4] Mock Backend >> "%LOG%"

set "MK=%ROOT%MOCK_SERVICES"
if not exist "%MK%" (
    echo  - MOCK_SERVICES not found, skip
    echo  - MOCK_SERVICES not found >> "%LOG%"
    goto :after_mock
)

if not exist "%MK%\node_modules" (
    echo  - Installing mock deps...
    cd /d "%MK%"
    call npm install --cache "%TEMP%\npm-cache-temp" >> "%LOG%" 2>&1
)

cd /d "%MK%"
start "MockBackend-3200" cmd /k "title MockBackend-3200 && echo Mock Backend :3200 starting... && node src/mock-backend.js"
echo  OK Mock Backend window opened
echo [4] Mock Backend started >> "%LOG%"
:after_mock
echo.

REM ====== 5. Health Check ======
echo [5/5] Wait for services ^(max 30s^)...
echo [5] Health check >> "%LOG%"

cd /d "%ROOT%"
set "MW_OK=0"
set "FE_OK=0"

echo  Check middleware :3100...
for /l %%i in (1,1,30) do (
    powershell -NoProfile -Command "try{$null=Invoke-WebRequest 'http://127.0.0.1:3100/healthz' -TimeoutSec 2 -UseBasicParsing;exit 0}catch{exit 1}" >nul 2>&1
    if not errorlevel 1 goto mw_pass
    timeout /t 1 /nobreak >nul
)
goto mw_done
:mw_pass
set "MW_OK=1"
:mw_done

if "%MW_OK%"=="1" (
    echo  OK Middleware ready
    echo  OK Middleware :3100 >> "%LOG%"
) else (
    echo  -- Middleware NOT ready, check its window
    echo  -- Middleware :3100 timeout >> "%LOG%"
)

echo  Check signaling :8080...
for /l %%i in (1,1,15) do (
    powershell -NoProfile -Command "try{$null=Invoke-WebRequest 'http://127.0.0.1:8080/' -TimeoutSec 2 -UseBasicParsing;exit 0}catch{exit 1}" >nul 2>&1
    if not errorlevel 1 goto fe_pass
    timeout /t 1 /nobreak >nul
)
goto fe_done
:fe_pass
set "FE_OK=1"
:fe_done

if "%FE_OK%"=="1" (
    echo  OK Signaling ready
    echo  OK Signaling :8080 >> "%LOG%"
) else (
    echo  -- Signaling NOT ready, check its window
    echo  -- Signaling :8080 timeout >> "%LOG%"
)

echo.
echo ============================================
echo   Startup Complete
echo.
echo   Middleware : http://localhost:3100  [%MW_OK%]
echo   Frontend   : http://localhost:8080  [%FE_OK%]
echo   Streaming  : ws://localhost:8888
echo ============================================
echo.
echo   Next: Open http://localhost:8080/
echo   Log:  %LOG%
echo.
echo %date% %time% DONE MW=%MW_OK% FE=%FE_OK% >> "%LOG%"
pause
