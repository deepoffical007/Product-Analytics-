GyaanSetu - educational content discovery platform
==================================================

QUICK START (only Java is needed - no Maven, no database, no internet)

  1. Install Java 17 or newer if you do not have it: https://adoptium.net  (Temurin 21 LTS)
  2. Extract this zip.
  3. Start:
       Windows : double-click  START-WINDOWS.bat
       macOS   : double-click  "Start GyaanSetu (Mac).command"
                 (first time: right-click > Open, because it was downloaded from the internet)
       Linux   : ./start-mac-linux.sh
  4. Your browser opens automatically. If not, open the address shown in the window
     (normally http://localhost:8080). Keep the window open while you use the site.

  Demo login:  demo@gyaansetu.in  /  demo1234

  If port 8080 is busy, the next free port (8081, 8082, ...) is used automatically.
  Stop the server with Ctrl+C or by closing the window.

WHAT IS IN THIS FOLDER

  app/gyaansetu.jar      the application (Java Servlets + JDBC on embedded Tomcat)
  app/lib/               libraries it needs (Tomcat, H2, MySQL driver, PDFBox, Gson, Anthropic SDK)
  app/web/               the frontend (index.html, css/styles.css, js/app.js)
  source/                full source code: backend + frontend + tests (Maven project)
  docs/                  reference guide: run steps, demo script, file map, ranking maths, judge Q&A
  Dockerfile             run in Docker or deploy to a cloud host

OPTIONAL SETTINGS (set before starting)

  Claude AI answers   Windows: set ANTHROPIC_API_KEY=sk-ant-...     macOS/Linux: export ANTHROPIC_API_KEY=sk-ant-...
  Fixed port          set PORT=9090                                  export PORT=9090
  MySQL database      set DB_URL=jdbc:mysql://localhost:3306/gyaansetu   (plus DB_USER and DB_PASSWORD)
  Do not open browser set NO_BROWSER=1                               export NO_BROWSER=1

  Without an API key, all AI features still work using the built-in offline engine.

DATA

  The database is created automatically on first start in your home folder:
    Windows: C:\Users\<you>\gyaansetu-data      macOS/Linux: ~/gyaansetu-data
  To reset the demo data, stop the server and delete that folder.

DOCKER

  docker build -t gyaansetu .
  docker run -p 8080:8080 -v gyaansetu-data:/data gyaansetu

REBUILD FROM SOURCE (needs Maven 3.8+)

  cd source
  mvn package            (runs 18 tests and builds target/gyaansetu.war for standalone Tomcat)
  ./build-dist.sh        (rebuilds this whole folder)
