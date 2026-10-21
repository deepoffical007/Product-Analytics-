@echo off
REM Starts GyaanSetu on http://localhost:8080 (embedded Tomcat + H2 database).
REM Optional: set PORT=9090   set ANTHROPIC_API_KEY=...   set DB_URL=jdbc:mysql://...
cd /d "%~dp0"
where java >nul 2>nul || (echo Java 17+ is required: https://adoptium.net & exit /b 1)
where mvn >nul 2>nul || (echo Maven 3.8+ is required: https://maven.apache.org/download.cgi & exit /b 1)
mvn -q -B compile exec:exec
