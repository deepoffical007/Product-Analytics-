@echo off
setlocal
title GyaanSetu
cd /d "%~dp0"
set "LOG=%~dp0gyaansetu-log.txt"
echo GyaanSetu start log > "%LOG%"
echo Folder: "%~dp0" >> "%LOG%"

if not exist "app\gyaansetu.jar" goto notextracted

rem 1) Java bundled in this folder, 2) JAVA_HOME, 3) java on PATH
set "JAVA="
if exist "%~dp0runtime\bin\java.exe" set "JAVA=%~dp0runtime\bin\java.exe"
if defined JAVA goto havejava
if not defined JAVA_HOME goto trypath
if exist "%JAVA_HOME%\bin\java.exe" set "JAVA=%JAVA_HOME%\bin\java.exe"
if defined JAVA goto havejava
:trypath
where java >nul 2>nul
if errorlevel 1 goto nojava
set "JAVA=java"

:havejava
echo Java: "%JAVA%" >> "%LOG%"
"%JAVA%" -version 2> "%TEMP%\gyaansetu-java.txt"
type "%TEMP%\gyaansetu-java.txt" >> "%LOG%"
set "JV="
for /f "usebackq tokens=3" %%v in ("%TEMP%\gyaansetu-java.txt") do if not defined JV set "JV=%%~v"
set "JMAJ="
for /f "delims=." %%m in ("%JV%") do set "JMAJ=%%m"
if not defined JMAJ goto run
if "%JMAJ%"=="1" goto oldjava
if %JMAJ% LSS 17 goto oldjava

:run
echo.
echo  Starting GyaanSetu...
echo  Your browser will open automatically. If it does not, open the address shown below.
echo  Keep this window open while you use the site. Close it (or press Ctrl+C) to stop.
echo.
echo Starting server >> "%LOG%"
"%JAVA%" -Dfile.encoding=UTF-8 -jar "app\gyaansetu.jar"
echo Server exited with code %ERRORLEVEL% >> "%LOG%"
echo.
echo  GyaanSetu has stopped.
echo  If this was not on purpose, the reason is printed above. The file gyaansetu-log.txt in this folder has details.
goto end

:notextracted
echo Not extracted: app\gyaansetu.jar missing >> "%LOG%"
echo.
echo  The program files were not found next to this script.
echo  Windows is probably running it from inside the zip.
echo.
echo  Fix: close this window, right-click GyaanSetu-Windows.zip, choose "Extract All",
echo       open the extracted GyaanSetu folder and double-click START-WINDOWS.bat there.
goto end

:nojava
echo No Java found >> "%LOG%"
echo.
echo  Java was not found, and the built-in Java folder "runtime" is missing.
echo  Either download GyaanSetu-Windows.zip again (it includes Java),
echo  or install Java 21 from https://adoptium.net and run this file again.
start "" "https://adoptium.net/temurin/releases/?version=21"
goto end

:oldjava
echo Java too old: %JV% >> "%LOG%"
echo.
echo  Your computer has Java %JV%, but GyaanSetu needs Java 17 or newer.
echo  Install Java 21 from https://adoptium.net and run this file again,
echo  or use GyaanSetu-Windows.zip, which includes the right Java.
start "" "https://adoptium.net/temurin/releases/?version=21"
goto end

:end
echo.
pause
endlocal
