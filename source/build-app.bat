@echo off
setlocal
rem Rebuilds GyaanSetu after you change the source, runs the tests, and updates ..\app
rem Needs a Java JDK 17+ (not just the runtime) and Maven: https://adoptium.net  https://maven.apache.org
cd /d "%~dp0"
where mvn >nul 2>nul
if errorlevel 1 goto nomvn
echo Building and testing... (the first build downloads libraries and takes a few minutes)
call mvn -q -B package
if errorlevel 1 goto failed
if not exist "..\app\gyaansetu.jar" goto notdist
copy /y "target\gyaansetu-app.jar" "..\app\gyaansetu.jar" >nul
robocopy "target\lib" "..\app\lib" /mir /njh /njs /nfl /ndl >nul
robocopy "src\main\webapp" "..\app\web" /mir /xd WEB-INF META-INF /njh /njs /nfl /ndl >nul
echo.
echo  Done. The app in ..\app is updated. Start it again with START-WINDOWS.bat.
goto end

:notdist
echo.
echo  Built target\gyaansetu-app.jar and target\gyaansetu.war (no ..\app folder found to update).
goto end

:nomvn
echo.
echo  Maven was not found. Install it from https://maven.apache.org/download.cgi,
echo  add its bin folder to PATH, install a Java JDK 17+ from https://adoptium.net, and run this again.
goto end

:failed
echo.
echo  The build or a test failed. The reason is printed above.

:end
echo.
pause
endlocal
