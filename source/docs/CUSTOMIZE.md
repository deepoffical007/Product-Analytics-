# Customizing GyaanSetu

Everything here runs outside Claude with no subscription. All paths below are inside the `source/` folder
unless they start with `app/` or `demo-website/`.

## The three ways to run it

| What | How | Needs |
|---|---|---|
| **Full app** (Java backend + database + frontend) | `START-WINDOWS.bat` (Windows) or `start-mac-linux.sh` | Nothing on Windows (Java is included in `runtime/`); Java 17+ on Mac/Linux |
| **Demo website** (one file, runs in the browser) | Double-click `demo-website/index.html` | Any browser |
| **From source** (to change Java code) | `source/run.bat` or `source/run.sh` | Java 17+ and Maven |

The demo website stores likes, reviews and posts in the visitor's browser. The full app stores them in a real database shared by everyone using that server.

## Two kinds of change

**Frontend only (look, text, layout): no rebuild needed.**
Edit the files in `app/web/` (the running copy) or `source/src/main/webapp/` (the source copy), then refresh the browser.
Keep both copies in sync, or edit the source copy and run the rebuild script below.

**Backend (Java, data, ranking): rebuild needed.**
Install Maven (https://maven.apache.org/download.cgi), edit files in `source/`, then:

| Windows | Mac / Linux |
|---|---|
| `source\build-app.bat` | `cd source && ./build-dist.sh` |

`build-app.bat` compiles, runs all 18 tests, and copies the new app into `app/`. Then start the app again.

## Common changes

### Rename the site / change the logo text
- `source/src/main/webapp/index.html`: the `<title>` and the `<b>Gyaan<span>Setu</span></b>` brand text
- `source/src/main/webapp/js/app.js`: search for `GyaanSetu` to change headings and footer text

### Change colours
`source/src/main/webapp/css/styles.css`, at the top in the `:root { ... }` block:

| Token | Used for |
|---|---|
| `--accent` | Buttons, links, highlights (default royal blue `#3346e0`) |
| `--accent-soft` / `--tint` | Light blue backgrounds behind active items |
| `--bg`, `--surface` | Page and card backgrounds (white) |
| `--ink`, `--muted` | Main and secondary text |
| `--good`, `--warn`, `--bad` | Green, amber and red states |
| `--t-video`, `--t-pdf`, `--t-article`, `--t-tutorial`, `--t-image` | Content type tag colours |

### Add, remove or edit learning resources
1. Edit `source/src/main/resources/seed/resources.json`. Each entry looks like this (the `//` notes are explanations only; do not copy them into the file):
   ```json
   {
    "id": "react",                       // short unique id, letters/numbers
    "title": "React Tutorial",
    "type": "tutorial",                  // video | pdf | article | tutorial | image
    "subject": "cs",                     // cs | math | physics | chemistry | biology | language | economics | history
    "level": "Beginner",                 // Beginner | Intermediate | Advanced
    "source": "react.dev",
    "url": "https://react.dev/learn",
    "len": "12 lessons",
    "date": "2026-01-15",                // YYYY-MM-DD
    "desc": "One or two sentences describing the resource.",
    "tags": ["react", "javascript", "web development"],
    "views": 1200000, "likes": 45000,    // starting numbers
    "rating": 4.7, "ratings": 900,       // average stars and how many ratings
    "hy": 300, "hn": 12,                 // "was this helpful" yes / no
    "comments": ["Very clear and practical.", "Great examples."]
   }
   ```
2. Rebuild (`build-app.bat`).
3. **Reset the database** so the new list is loaded: stop the app, delete the folder `gyaansetu-data` in your home folder
   (`C:\Users\<you>\gyaansetu-data`), start again. The sample data is only loaded into an empty database.
4. To show a source as "verified", add its name to `VERIFIED` in `source/src/main/java/com/gyaansetu/engine/Catalog.java`.

For the demo website, the same list is the `const ITEMS = [ ... ]` block in `demo-website/index.html` (same fields, JavaScript syntax).

### Add a subject
- Backend: `SUBJECTS.put("art", new String[]{"Art", "700"});` in `Catalog.java` (key, display name, Dewey number)
- Frontend: add `art: { color: '#...', icon: '<svg paths>' }` to `SUBJ` at the top of `app.js`
- Then use `"subject": "art"` in `resources.json`

### Change how results are ranked
- Default weights: `DEFAULT_WEIGHTS` in `source/src/main/java/com/gyaansetu/engine/Ranker.java`
  and `DEFAULT_W` near the top of `app.js` (keep them the same)
- Rating strictness: `RATING_M = 25` in `Ranker.java` (higher = new resources need more ratings to rank high)
- Quality labels (Excellent / Very good / Good / Fair): `quality()` at the end of `Ranker.java`
- Search synonyms (e.g. `ml` also finds machine learning): the `syn` string in `Catalog.java`
- Trending searches on the home page: `TRENDING` in `Catalog.java`

### Change sentiment words
`source/src/main/java/com/gyaansetu/engine/Sentiment.java`: the `pos` and `neg` lists (`word:weight`). Negative words use negative weights.

### Change the demo account
`DEMO_EMAIL` and `DEMO_PASSWORD` in `source/src/main/java/com/gyaansetu/db/Seeder.java`, plus the demo login box text in `app.js`
(search for `demo1234`). Reset the database afterwards.

### Change learning points
Search the servlets for `addPoints(`: `ResourceServlet.java` (rate +2, review +5, complete +3), `ForumServlet.java` (question/answer +5),
`GoalServlet.java` (goal done +1), `AiServlet.java` (AI use +1).

### Turn on Claude AI (optional, pay-as-you-go, not a subscription)
Get an API key at https://console.anthropic.com, then before starting:
- Windows: `set ANTHROPIC_API_KEY=sk-ant-...` then `START-WINDOWS.bat` in the same window
- Mac/Linux: `export ANTHROPIC_API_KEY=sk-ant-...`

Without a key every AI feature still works using the built-in offline engine. Prompts are in `AiServlet.java`, `GoalServlet.java` and `ForumServlet.java`;
the model is set with `AI_MODEL` (default `claude-opus-5-5`).

### Use MySQL instead of the built-in database
```
CREATE DATABASE gyaansetu CHARACTER SET utf8mb4;
```
Then set `DB_URL=jdbc:mysql://localhost:3306/gyaansetu`, `DB_USER` and `DB_PASSWORD` before starting. Tables and data are created automatically.

### Add a new API endpoint
1. Create a class in `source/src/main/java/com/gyaansetu/servlet/` that `extends ApiServlet` and overrides `get` / `post` / `put` / `delete`.
2. Add `@WebServlet("/api/yourpath/*")` (used when deployed as a WAR on Tomcat).
3. Register it in `Launcher.java` in the `api.put(...)` list (used by the start scripts), above the `"/api/*"` line.
4. Call it from `app.js` with `api('api/yourpath')`.

## Where each screen lives in app.js

| Screen | Function |
|---|---|
| Home | `renderHome` |
| Search results + filters | `renderResults`, `resultHTML`, `bindResults` |
| Resource details | `renderDetail`, `bindDetail` |
| AI Study Assistant | `renderAssistant`, `panelHTML`, `runTask`, `ask` |
| Dashboard / planner / leaderboard | `renderDashboard`, `bindDashboard` |
| Community | `renderCommunity`, `bindThread` |
| Login / sign up | `renderLogin` |

## Host it online

| Option | What you get | Steps |
|---|---|---|
| Demo website on GitHub Pages / Netlify | Free public link, no server | Upload `demo-website/index.html` (GitHub Pages: repo Settings → Pages; Netlify: drag the `demo-website` folder onto https://app.netlify.com/drop) |
| Full app on Render | Free public link with the Java backend | Push the whole folder to GitHub, then on https://render.com: New → Blueprint → pick the repo (uses `render.yaml` + `Dockerfile`) |
| Full app with Docker | Runs on any server | `docker build -t gyaansetu .` then `docker run -p 8080:8080 gyaansetu` |
