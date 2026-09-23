@echo off
setlocal
title VenueVue POS - launcher

REM ===========================================================================
REM  VenueVue POS - one-click launcher
REM
REM  Just double-click this file. It will:
REM    1. Start MySQL (if it is not already running)
REM    2. Start the PHP backend  on port 8000
REM    3. Start the React frontend on port 5173
REM    4. Open your browser at the login screen
REM
REM  To STOP VenueVue: close the two windows titled
REM  "VenueVue backend" and "VenueVue frontend".
REM ===========================================================================

REM %~dp0 is this file's folder, and it ends with a backslash. Strip that
REM trailing backslash: a path ending in \" makes Windows mis-read the quote.
set "PROJECT=%~dp0"
set "PROJECT=%PROJECT:~0,-1%"

set "XAMPP=C:\xampp"

echo ============================================================
echo    VenueVue POS - starting up
echo ============================================================
echo.
echo    Project folder: %PROJECT%
echo.

if not exist "%XAMPP%\php\php.exe" (
    echo [ERROR] Cannot find %XAMPP%\php\php.exe
    echo         XAMPP does not appear to be installed in C:\xampp
    echo.
    pause
    exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js was not found on your PATH.
    echo         Install the LTS build from https://nodejs.org/ then run this file again.
    echo.
    pause
    exit /b 1
)

REM First run only: the frontend packages have to be downloaded once.
if not exist "%PROJECT%\node_modules" (
    echo First run detected - installing the frontend packages...
    echo ^(this downloads from the internet once and takes a minute^)
    echo.
    pushd "%PROJECT%"
    call npm install
    popd
    if not exist "%PROJECT%\node_modules" (
        echo.
        echo [ERROR] npm install did not complete successfully.
        echo         Open a command prompt in %PROJECT% , run "npm install",
        echo         and read the error it prints.
        echo.
        pause
        exit /b 1
    )
)

REM ---------------------------------------------------------------------------
REM 1. MySQL
REM ---------------------------------------------------------------------------
tasklist /FI "IMAGENAME eq mysqld.exe" 2>nul | find /I "mysqld.exe" >nul
if errorlevel 1 (
    echo [1/3] Starting MySQL...
    start "" "%XAMPP%\mysql\bin\mysqld.exe" --defaults-file="%XAMPP%\mysql\bin\my.ini" --standalone
) else (
    echo [1/3] MySQL is already running.
)

REM Poll until the database actually answers. A fixed sleep is not enough: if
REM MySQL fails to start, the two servers below would still come up and then
REM every login would fail with a confusing error.
set /a MYSQL_TRIES=0
:wait_mysql
"%XAMPP%\mysql\bin\mysqladmin.exe" -u root --silent ping >nul 2>&1
if not errorlevel 1 goto mysql_ready
set /a MYSQL_TRIES+=1
if %MYSQL_TRIES% GEQ 25 goto mysql_failed
timeout /t 2 /nobreak >nul
goto wait_mysql

:mysql_ready
echo       database is ready.

REM ---------------------------------------------------------------------------
REM 2. PHP backend
REM ---------------------------------------------------------------------------
echo [2/3] Starting the backend on http://127.0.0.1:8000 ...
start "VenueVue backend" cmd /k ""%XAMPP%\php\php.exe" -S 0.0.0.0:8000 -t "%PROJECT%""

REM ---------------------------------------------------------------------------
REM 3. React frontend
REM ---------------------------------------------------------------------------
echo [3/3] Starting the frontend on http://localhost:5173 ...
start "VenueVue frontend" cmd /k "cd /d "%PROJECT%" && npm run dev"

echo.
echo    Waiting for both servers to come up...
timeout /t 12 /nobreak >nul

REM ---------------------------------------------------------------------------
REM 4. Open the browser
REM ---------------------------------------------------------------------------
start "" "http://localhost:5173"

echo.
echo ============================================================
echo    VenueVue should now be open in your browser.
echo.
echo    Sign in with:
echo      owner@venuevue.local    /  Owner#2026      (OWNER)
echo      barista@venuevue.local  /  Barista#2026    (BARISTA)
echo.
echo    From a tablet on the same Wi-Fi, use:
echo      http://192.168.137.1:5173
echo.
echo    To stop VenueVue, run STOP-VENUEVUE.bat in this same folder.
echo    Closing the two server windows works too, but the stop script also
echo    shuts MySQL down properly so the database stays healthy.
echo ============================================================
echo.
pause
exit /b 0

REM ---------------------------------------------------------------------------
REM  Reached only via "goto mysql_failed" above.
REM ---------------------------------------------------------------------------
:mysql_failed
echo.
echo [ERROR] MySQL did not come up within 50 seconds.
echo.
echo         The reason is usually the last few lines of:
echo           C:\xampp\mysql\data\mysql_error.log
echo.
echo         Quickest fix: open the XAMPP Control Panel, press Start next to
echo         MySQL, then run this file again.
echo.
pause
exit /b 1
