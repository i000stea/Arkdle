@echo off
REM ============================================================
REM Arkdle one-click build + deploy package generator
REM
REM Current scope: Dev refactor (Vue3 build output + data + changelog)
REM Future: extend to full site deploy (root / SetQuestion / screenshot server)
REM
REM Usage: double-click, or run: build-deploy.bat
REM Output: .\arkdle-deploy\ folder and .\arkdle-deploy.zip
REM ============================================================

setlocal
cd /d "%~dp0"

echo [1/3] Building Vue project (type-check + bundle)...
cd /d "%~dp0Dev"
if exist "dist" rmdir /s /q "dist"
call npm run build
if errorlevel 1 (
    echo.
    echo [ERROR] Build failed. Check output above.
    pause
    exit /b 1
)
cd /d "%~dp0"

echo.
echo [2/3] Cleaning old deploy folder...
set "DEPLOY=%~dp0arkdle-deploy"
if exist "%DEPLOY%" (
    rmdir /s /q "%DEPLOY%" 2>nul
    if exist "%DEPLOY%" (
        echo [WARN] Old folder is locked; falling back to overwrite-update.
        if exist "%DEPLOY%\assets" del /q "%DEPLOY%\assets\*" 2>nul
        if exist "%DEPLOY%\resource" del /q "%DEPLOY%\resource\*" 2>nul
        del /q "%DEPLOY%\index.html" "%DEPLOY%\CHANGELOG.md" 2>nul
    )
)
if not exist "%DEPLOY%\assets" mkdir "%DEPLOY%\assets"
if not exist "%DEPLOY%\resource" mkdir "%DEPLOY%\resource"

echo.
echo [3/3] Copying deploy files...
copy /y "Dev\dist\index.html" "%DEPLOY%\index.html" >nul
copy /y "Dev\dist\assets\*" "%DEPLOY%\assets\" >nul
copy /y "resource\config_version.json" "%DEPLOY%\resource\" >nul
copy /y "resource\data_Operators.json" "%DEPLOY%\resource\" >nul
copy /y "resource\data_FuzzyItem.json" "%DEPLOY%\resource\" >nul
copy /y "resource\arkdle-icon.png" "%DEPLOY%\resource\" >nul
if not exist "%DEPLOY%\resource\icon" mkdir "%DEPLOY%\resource\icon"
copy /y "resource\icon\*.svg" "%DEPLOY%\resource\icon\" >nul
copy /y "CHANGELOG.md" "%DEPLOY%\CHANGELOG.md" >nul

echo.
echo Creating zip for one-click upload...
powershell -NoProfile -Command "Compress-Archive -Path '%DEPLOY%\*' -DestinationPath '%~dp0arkdle-deploy.zip' -Force" >nul 2>nul

echo.
echo Deploy package ready:
echo   %DEPLOY%\
echo   %~dp0arkdle-deploy.zip
echo.
echo Upload arkdle-deploy contents to server /Dev path.
if not "%~1"=="nopause" pause
endlocal
