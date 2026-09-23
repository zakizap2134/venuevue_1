@echo off
setlocal
title VenueVue POS - shutdown

REM ===========================================================================
REM  VenueVue POS - one-click shutdown
REM
REM  Double-click this file when you are finished for the day.
REM
REM  It stops the backend, the frontend and MySQL. It asks MySQL to shut down
REM  through mysqladmin rather than killing the process, because force-killing
REM  a database can leave its crash-recovery log inconsistent and MySQL will
REM  then refuse to start until it is repaired.
REM ===========================================================================

set "XAMPP=C:\xampp"

echo ============================================================
echo    VenueVue POS - shutting down
echo ============================================================
echo.

REM ---------------------------------------------------------------------------
REM 1. The two server windows that RUN-VENUEVUE.bat opened
REM ---------------------------------------------------------------------------
echo [1/3] Closing the backend and frontend windows...
REM The servers are located by the port they are listening on, not by window
REM title. On Windows 11 the console is usually hosted by Windows Terminal, so
REM the window has no title that taskkill can match, and a title-based filter
REM silently kills nothing.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$pids=Get-NetTCPConnection -LocalPort 8000,5173 -State Listen -ErrorAction SilentlyContinue|Select-Object -ExpandProperty OwningProcess -Unique; if(-not $pids){ exit 0 }; foreach($p in $pids){ $par=(Get-CimInstance Win32_Process|Where-Object {$_.ProcessId -eq $p}).ParentProcessId; taskkill /PID $p /T /F 2>&1|Out-Null; if((Get-Process -Id $par -ErrorAction SilentlyContinue).ProcessName -eq 'cmd'){ taskkill /PID $par /T /F 2>&1|Out-Null } }"
echo       done.

REM ---------------------------------------------------------------------------
REM 2. MySQL, the polite way
REM
REM    Never kill mysqld outright. A force-kill leaves its crash-recovery log
REM    inconsistent, and MySQL then refuses to start until it is repaired.
REM    --connect-timeout keeps this from hanging if MySQL is mid-startup
REM    (for example right after you press Start in the XAMPP Control Panel).
REM ---------------------------------------------------------------------------
echo [2/3] Asking MySQL to shut down...
"%XAMPP%\mysql\bin\mysqladmin.exe" -u root --connect-timeout=5 shutdown >nul 2>&1
if errorlevel 1 (
    echo       MySQL is not running, or was busy starting - leaving it alone.
) else (
    echo       MySQL stopped cleanly.
)

REM ---------------------------------------------------------------------------
REM 3. Wait for the ports to actually close
REM ---------------------------------------------------------------------------
echo [3/3] Waiting for everything to finish closing...
set /a TRIES=0
:wait_down
netstat -an | find ":8000 " >nul 2>&1
set "BACKEND_UP=%ERRORLEVEL%"
netstat -an | find ":5173 " >nul 2>&1
set "FRONTEND_UP=%ERRORLEVEL%"
netstat -an | find ":3306 " >nul 2>&1
set "DB_UP=%ERRORLEVEL%"
if %BACKEND_UP% NEQ 0 if %FRONTEND_UP% NEQ 0 if %DB_UP% NEQ 0 goto all_down
set /a TRIES+=1
if %TRIES% GEQ 10 goto still_up
timeout /t 2 /nobreak >nul
goto wait_down

:all_down
echo       everything is stopped.
goto finished

:still_up
echo.
echo [NOTE] Some ports are still open. Either give it a few more seconds, or
echo        close any remaining "VenueVue" windows by hand.

:finished
echo.
echo ============================================================
echo    VenueVue is stopped.
echo    Double-click RUN-VENUEVUE.bat when you want to start again.
echo ============================================================
echo.
pause
