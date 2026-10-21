# GyaanSetu — Reference Guide

Your companion file for running, demoing and explaining GyaanSetu at the hackathon.
Every number and file name in this guide comes from the working project.

**Contents**

1. [What GyaanSetu is](#1-what-gyaansetu-is)
2. [Run it on your laptop](#2-run-it-on-your-laptop)
3. [Troubleshooting](#3-troubleshooting)
4. [5-minute demo script](#4-5-minute-demo-script)
5. [How a request flows through the code](#5-how-a-request-flows-through-the-code)
6. [File-by-file map](#6-file-by-file-map)
7. [Database tables](#7-database-tables)
8. [Ranking algorithm, with a worked example](#8-ranking-algorithm-with-a-worked-example)
9. [AI features](#9-ai-features)
10. [API cheat sheet](#10-api-cheat-sheet)
11. [Security](#11-security)
12. [Tests](#12-tests)
13. [Questions judges may ask](#13-questions-judges-may-ask)
14. [Glossary](#14-glossary)

---

## 1. What GyaanSetu is

One-line pitch: **"GyaanSetu finds the best learning resource for any topic by ranking videos, PDFs, articles, tutorials and images on relevance, ratings, review sentiment and engagement — and every learner's feedback improves the ranking for everyone."**

| Item | Value |
|---|---|
| Problem | Good educational content is scattered; finding the best one takes too long |
| Workflow | Search topic → Find content → Evaluate quality → Rank → Display best results |
| Backend | Java 17+, Jakarta Servlets 6 on Tomcat 10.1, JDBC |
| Database | H2 (default, no install) or MySQL 8 |
| Frontend | HTML + CSS + vanilla JavaScript, white theme |
| AI | Claude via the official Anthropic Java SDK; offline engine when no API key |
| Data | 46 resources (45 real, 1 sample clickbait for the demo) from 20 trusted sources, 8 subjects, 5 content types |
| Size | 34 Java classes, ~3,400 lines of Java (plus tests), 18 automated tests |

---

## 2. Run it on your laptop

### Fastest way: the run-anywhere zip (only Java needed)

1. Install **Java 17 or newer** if needed → https://adoptium.net ("Temurin 21 LTS").
2. Extract `GyaanSetu.zip` (Windows: right-click → *Extract All*; do not run from inside the zip).
3. Start it:

| Windows | macOS | Linux |
|---|---|---|
| Double-click `START-WINDOWS.bat` | Double-click `Start GyaanSetu (Mac).command` (first time: right-click → *Open*) | `./start-mac-linux.sh` |

The browser opens automatically at **http://localhost:8080** (or 8081, 8082… if 8080 is busy). Keep the window open; stop with **Ctrl + C**.
No Maven, no database install and no internet are needed.

| Folder in the zip | Contents |
|---|---|
| `app/gyaansetu.jar` + `app/lib/` | The compiled backend and its libraries |
| `app/web/` | The frontend (HTML, CSS, JavaScript) |
| `source/` | Full source code (Maven project, tests, build scripts) |
| `docs/` | This guide |
| `Dockerfile` | `docker build -t gyaansetu . && docker run -p 8080:8080 -v gyaansetu-data:/data gyaansetu` |

### From source (developers)

Needs Java 17+ and Maven 3.8+. In the `source/` folder:

| Windows | macOS / Linux |
|---|---|
| `run.bat` | `./run.sh` |

The first build downloads libraries (about 1 minute, needs internet). `./build-dist.sh` rebuilds the run-anywhere zip.

### Accounts

| Account | Email | Password | Use it for |
|---|---|---|---|
| Demo student (has saved items, goals, history) | `demo@gyaansetu.in` | `demo1234` | The main demo |
| Guest | — | — | "Continue as guest" button |
| New account | any email | 6+ characters | Showing sign-up works |

### Optional settings

Set these **before** running `run.sh` / `run.bat`.

| Setting | Windows | macOS / Linux |
|---|---|---|
| Use Claude AI | `set ANTHROPIC_API_KEY=sk-ant-...` | `export ANTHROPIC_API_KEY=sk-ant-...` |
| Different port | `set PORT=9090` | `export PORT=9090` |
| Different Claude model | `set AI_MODEL=claude-sonnet-5-5` | `export AI_MODEL=claude-sonnet-5-5` |
| Use MySQL | `set DB_URL=jdbc:mysql://localhost:3306/gyaansetu` plus `DB_USER`, `DB_PASSWORD` | same with `export` |

For MySQL, create the empty database first: `CREATE DATABASE gyaansetu CHARACTER SET utf8mb4;` — tables and data are created automatically.

### Other ways to run

| Goal | Command |
|---|---|
| Run all tests | `mvn test` |
| Build a WAR for Tomcat | `mvn package` → `target/gyaansetu.war` → copy into `tomcat/webapps/` → open `http://localhost:8080/gyaansetu/` |
| Check the server from a terminal | `curl http://localhost:8080/api/health` |

---

## 3. Troubleshooting

| You see | Cause | Fix |
|---|---|---|
| `java is not recognized` / `command not found` | Java not installed or not on PATH | Install from adoptium.net, reopen the terminal |
| `mvn is not recognized` | Maven not on PATH | Add Maven's `bin` folder to PATH, reopen the terminal |
| `Address already in use` / `BindException` | You set `PORT` to a port that is taken | Pick another port, or unset `PORT` so a free one is chosen automatically |
| `invalid target release: 17` | Java older than 17 | Install Java 21 |
| Page says "Cannot reach the GyaanSetu server" | Server stopped or still starting | Wait for the "is running" line, then reload |
| Want a clean demo (remove your test reviews) | Data persists between runs | Stop the server, delete the folder `gyaansetu-data` in your home folder, start again |
| AI badge says "Offline AI mode" | No API key set | Expected. Set `ANTHROPIC_API_KEY` for Claude answers |
| AI answer shows a yellow note about the AI service | Key invalid, no internet, or rate limit | The offline answer is shown instead; check the key / Wi-Fi |
| Fonts look plain | No internet for Google Fonts | Cosmetic only; the app works |
| Database "locked" error | Two servers using the same database | Stop the other one (only one `run.sh` at a time) |

Where the database file lives: `C:\Users\<you>\gyaansetu-data\` (Windows) or `~/gyaansetu-data/` (macOS / Linux).

---

## 4. 5-minute demo script

Before you start: reset the data (see Troubleshooting), start the server, open the home page, stay **logged out**.

| Time | Do | Say |
|---|---|---|
| 0:00 | Home page | "Learning content is scattered across YouTube, MIT, Khan Academy, Wikipedia… GyaanSetu searches all of it in one place and ranks the best first." |
| 0:30 | Search **machine learning** | "The search understands concepts: it also looks for neural networks and deep learning." Point to the *Also searching related concepts* line. |
| 1:00 | Point to the 14.5M-view video at the **bottom** (score 50, *Fair*) | "This is the most-viewed video, but it's clickbait — 2.9 stars and negative comments. Our ranking puts quality first, so it sinks." |
| 1:30 | Open **Advanced filters & ranking weights**, set every weight to 0 except **Views** | "If we ranked only by views, like most platforms, the clickbait would win. The weights are sent to the Java server and the ranking changes live." Click **Restore default weights**. |
| 2:00 | Click **Build AI learning path** | "AI turns the results into a study order, beginner to advanced." |
| 2:20 | Open **Neural Networks** | "Each resource has a quality score out of 100 with a checklist and the exact formula." Open *How the server calculated this score*. |
| 2:50 | Click **Like** → redirected to login → **Fill in** → **Login** | "Accounts are real: passwords are hashed with PBKDF2." |
| 3:10 | Rate 5★, write *"Really clear and helpful"*, post | "The server scores the sentiment of every review. It's labelled Positive, and the ranking updates for every user — this is stored in the database through JDBC." |
| 3:40 | **AI Assistant** → Upload a PDF (or *Use sample notes*) → Summary → Quiz → answer one question | "Upload notes and get a summary, key points, a quiz and Q&A. PDFs are read on the server with Apache PDFBox." |
| 4:20 | **Dashboard** → *Plan my week with AI*, show **Leaderboard** | "Saved resources, study planner and points that reward helping others." |
| 4:40 | **Community** → open a question → *Draft an answer with AI* | "Students help each other, and AI drafts answers with links to the best resources." |
| 5:00 | Close | "Java Servlets + JDBC backend, 18 automated tests, works on H2 or MySQL, deploys as a WAR. Thank you." |

Backup plan if Wi-Fi fails: everything above works offline (AI uses the offline engine; the badge shows *Offline AI mode*).

---

## 5. How a request flows through the code

Example: a learner searches **"python tutorial"**.

```
Browser (js/app.js)
  search('python tutorial')  →  GET api/resources?q=python+tutorial&log=1
        │
        ▼
ApiFilter                     adds security headers (GET needs no CSRF header)
        │
        ▼
ResourceServlet.search()      reads q, types, subject, level, minRating, minViews, sort, w
   ├─ PlannerDao.addSearch()  saves the query to "searches" (signed-in users only)
   ├─ new RankContext(conn, userId)
   │     ├─ ResourceDao.stats()        views, likes, ratings, helpful votes + review sentiment (SQL GROUP BY)
   │     ├─ EngagementDao.state()      what this user liked / saved / rated
   │     └─ EngagementDao.profile()    subject + tag interests for "For you"
   ├─ Ranker.rank()                    BM25 relevance + 5 quality signals → score
   └─ Views.resource()                 converts each result to JSON
        │
        ▼
Browser renders the ranked list, filters with counts, quality chips and score bars
```

Example: a learner **rates** a resource 5★ → `POST api/resources/la/rate {"stars":5}`:
`ApiFilter` (checks the `X-Requested-With: GyaanSetu` header) → `ResourceServlet.post()` → requires sign-in → opens a **transaction** → `EngagementDao.rating()` (old rating) → `ResourceDao.adjustRating()` (updates `rating_sum`, `rating_count`) → `EngagementDao.setRating()` → `UserDao.addPoints(+2)` → **commit** → returns the re-scored resource.

Startup: Tomcat creates `AppListener` → `Database.init()` (runs `schema.sql`) → `Seeder.seedIfEmpty()` (first run only) → loads resources into `Catalog` (the in-memory search index).

---

## 6. File-by-file map

### Project root

| File | Purpose |
|---|---|
| `pom.xml` | Maven build: dependencies (Servlet API, Tomcat, H2, MySQL driver, Gson, PDFBox, Anthropic SDK, JUnit), WAR packaging, `exec:exec` run config |
| `run.sh` / `run.bat` | One-command start from source (Maven) |
| `build-dist.sh` | Builds the run-anywhere `GyaanSetu.zip` |
| `dist-files/` | Start scripts, README and Dockerfile copied into the zip |
| `README.md` | Overview for GitHub |
| `docs/GyaanSetu-Reference-Guide.md` | This file |

### Java backend — `src/main/java/com/gyaansetu/`

| File | What it does |
|---|---|
| `Launcher.java` | Starts embedded Tomcat (`java -jar` or `mvn exec:exec`), registers the servlets, picks a free port, opens the browser |
| **db/** | |
| `Config.java` | Reads settings (DB_URL, PORT, ANTHROPIC_API_KEY, AI_MODEL) from system properties or environment |
| `Database.java` | Owns the JDBC `DataSource` (H2 connection pool, or DriverManager for MySQL); runs `schema.sql` |
| `Seeder.java` | First run only: inserts 46 resources, 92 reviews, community users, demo account, forum threads |
| **engine/** (pure Java, no database) | |
| `Text.java` | Tokenising, stop words, stemming (`tutorials` → `tutorial`), one-typo matching, sentence/keyword extraction |
| `Sentiment.java` | Lexicon sentiment scorer (-1..1) with negation ("not useful") and intensifiers ("really clear") |
| `Resource.java` | One resource's fixed data plus its index entry (term frequencies) |
| `Catalog.java` | All resources + BM25 index; subject/type names; synonym map; verified sources; trending list |
| `Ranker.java` | **The ranking algorithm**: query parsing, BM25 relevance, quality signals, weighted blend, filters, sorting |
| **dao/** (all SQL lives here) | |
| `ResourceDao.java` | Load resources; read stats with review sentiment aggregates; update views, likes, rating sums, helpful votes |
| `UserDao.java` | Create user, find by id/email, add points, leaderboard |
| `EngagementDao.java` | Likes, saves, completions (toggle), ratings, helpful votes, a user's full state, taste profile |
| `ReviewDao.java` | Add/list reviews, one-per-user replace, review upvotes |
| `PlannerDao.java` | Study goals and search history |
| `ForumDao.java` | Threads, answers, thread votes |
| **ai/** | |
| `ClaudeService.java` | Calls Claude with the Anthropic Java SDK; parses JSON answers; friendly errors |
| `OfflineAi.java` | No-key fallback: extractive summary, key points, fill-in-the-blank quiz, sentence-match Q&A |
| **web/** | |
| `ApiServlet.java` | Base class for every endpoint: JSON output, error handling (400/401/404/500), body parsing, sessions |
| `ApiFilter.java` | Runs on every `/api/*` call: security headers + CSRF header check |
| `AppListener.java` | Startup and shutdown hooks |
| `RankContext.java` | Bundles stats + user state + profile for one request; recommendations; weight parsing |
| `Views.java` | Turns resources and users into the JSON the frontend reads |
| `Passwords.java` | PBKDF2 hashing and verification |
| `ApiException.java` | Error with an HTTP status and a user-safe message |
| **servlet/** (one per API area) | |
| `AuthServlet.java` | `/api/auth/*`: me, signup, login, guest, logout |
| `ResourceServlet.java` | `/api/resources/*`: search, recommended, detail, like/save/complete/rate/feedback/reviews |
| `ReviewServlet.java` | `/api/reviews/{id}/vote` |
| `MetaServlet.java` | `/api/meta`: subjects, types, trending, suggestions, totals, AI mode |
| `DashboardServlet.java` | `/api/dashboard`: stats, history, recommendations, library, goals, leaderboard |
| `GoalServlet.java` | `/api/goals/*`: planner CRUD and AI weekly plan |
| `ForumServlet.java` | `/api/threads/*`: list, create, view, answer, vote, AI draft |
| `AiServlet.java` | `/api/ai/*`: upload (PDFBox), summary, key points, quiz, ask, learning path |
| `HealthServlet.java` | `/api/health` |
| `NotFoundServlet.java` | Any unknown `/api/...` path → JSON 404 |

### Resources and web files

| File | Purpose |
|---|---|
| `src/main/resources/schema.sql` | 14 `CREATE TABLE IF NOT EXISTS` statements, compatible with H2 and MySQL |
| `src/main/resources/seed/resources.json` | The 46 sample resources with their seed reviews |
| `src/main/webapp/index.html` | Page shell, icon set, header, mobile tab bar |
| `src/main/webapp/css/styles.css` | White theme, layouts, responsive rules |
| `src/main/webapp/js/app.js` | All screens, routing (`#search`, `#resource/py`, …) and API calls |
| `src/main/webapp/404.html` | Friendly not-found page |
| `src/main/webapp/WEB-INF/web.xml` | Welcome page, session cookie settings, error page |
| `src/main/webapp/META-INF/context.xml` | SameSite cookie setting for standalone Tomcat |

### Tests — `src/test/java/com/gyaansetu/`

| File | What it checks |
|---|---|
| `EngineTest.java` | 9 unit tests: text processing, sentiment, passwords, ranking rules |
| `ApiIntegrationTest.java` | 9 end-to-end tests: starts Tomcat and calls every API area over real HTTP |

---

## 7. Database tables

| Table | Key columns | Stores |
|---|---|---|
| `users` | id, name, email (unique), password_hash, is_guest, points | Accounts and learning points |
| `resources` | id, title, content_type, subject, difficulty, source, url, tags, views, likes, rating_sum, rating_count, helpful_yes, helpful_no | Catalogue + engagement counters |
| `reviews` | id, resource_id, user_id, author, body, stars, sentiment, upvotes | Reviews with their sentiment score |
| `likes` | (user_id, resource_id) | Who liked what |
| `ratings` | (user_id, resource_id), stars | Each user's star rating |
| `feedback` | (user_id, resource_id), helpful | "Was this helpful?" votes |
| `saved` | (user_id, resource_id) | My Library |
| `completed` | (user_id, resource_id) | Completed resources |
| `review_votes` | (user_id, review_id) | Review upvotes |
| `searches` | user_id, query_text, created_at | Recent searches |
| `goals` | user_id, goal_text, plan_day, done | Study planner |
| `threads` | user_id, author, title, body, subject, votes | Forum questions |
| `answers` | thread_id, author, body, is_ai | Forum answers |
| `thread_votes` | (user_id, thread_id) | Question upvotes |

Why counters are stored on `resources` (instead of counting rows every time): ranking reads 46 rows in one query, so search stays fast. The per-user tables prevent double counting — liking twice removes the like.

---

## 8. Ranking algorithm, with a worked example

**Formula:** `score = Σ (weight × signal) / Σ weights`, each signal between 0 and 1, shown as 0–100.

| Signal | Weight | Calculation (in `Ranker.java`) |
|---|---|---|
| Relevance | 40 | BM25 (k1 = 1.2, b = 0.75) over title ×3, tags ×2, subject ×1.5, source, description, type. Synonyms count at 0.45 weight. Prefix match ×0.7, one-typo match ×0.55. Exact phrase ×1.3. Divided by the best match's score |
| Rating | 20 | Bayesian average `(4.5 × 25 + sum of stars) / (25 + number of ratings)`, mapped from 1–5 to 0–1 |
| Sentiment & feedback | 15 | 0.6 × average review sentiment (mapped to 0–1) + 0.4 × `(yes + 1) / (yes + no + 2)` |
| Likes per view | 15 | `(likes + 20,000 × global like rate) / (views + 20,000)`, divided by the best value |
| Views | 10 | `log10(views + 1) / log10(max views + 1)` |
| For you | 5 | 0.5 × subject match + 0.8 × tag overlap with what the user liked, saved, completed or rated 4+ |

*Relevance* is skipped when there is no search text; *For you* is skipped until the user has activity. Weights are re-normalised over the signals in use.

### Worked example: "Learn Python – Full Course for Beginners", search "python tutorial"

| Signal | Value sᵢ | Weight wᵢ | wᵢ × sᵢ | ÷ 100 total weight = points |
|---|---|---|---|---|
| Relevance | 0.88 | 40 | 35.2 | 35.2 |
| Rating (4.7★ from 8,800) | 0.92 | 20 | 18.5 | 18.5 |
| Sentiment & feedback (67% positive, 93% helpful) | 0.76 | 15 | 11.5 | 11.5 |
| Likes per view (1.1M / 45M) | 0.58 | 15 | 8.7 | 8.7 |
| Views (45M, the most) | 1.00 | 10 | 10.0 | 10.0 |
| **Score** | | **100** | | **≈ 83.9 → "Very good"** |

Quality labels: **85+ Excellent**, **72+ Very good**, **58+ Good**, below that **Fair**.

### Why the clickbait loses ("machine learning")

| Rank | Resource | Score |
|---|---|---|
| 1 | Neural Networks (3Blue1Brown) | 93.2 |
| 2 | A Visual Introduction to Machine Learning | 76.0 |
| 3 | Python Data Science Handbook | 72.1 |
| 4 | Learn Python – Full Course for Beginners | 55.4 |
| 5 | Learn Web Development | 51.4 |
| 6 | Learn Machine Learning in 10 Minutes (No Math!) — 14.5M views | 50.4 |

The clickbait has popularity 0.94 but rating 0.48 (Bayesian 2.92★), sentiment & feedback 0.28 and only 25% "helpful" votes.

---

## 9. AI features

| Feature | Where | Endpoint | With Claude | Offline fallback |
|---|---|---|---|---|
| Summary | AI Assistant | `POST /api/ai/summary` | Overview + key concepts + "Remember" line | Top 4 keyword-dense sentences + key terms |
| Key points | AI Assistant | `/api/ai/keypoints` | Key points, likely exam questions, common mistakes | Top 7 sentences |
| Quiz | AI Assistant | `/api/ai/quiz` | 5 multiple-choice questions with explanations | Fill-in-the-blank from your text |
| Q&A chat | AI Assistant | `/api/ai/ask` | Answers from your material, marks "Beyond your material" | Best-matching sentences |
| PDF upload | AI Assistant | `/api/ai/upload` | Text extracted with Apache PDFBox (first 80 pages, 60,000 characters) | Same |
| Learning path | Search results | `/api/ai/path` | Picks 3–5 results and explains the order | Beginner → Advanced, best score first |
| Weekly plan | Dashboard | `/api/goals/plan` | 5-day plan using top resources | One resource per day |
| Answer draft | Community | `/api/threads/{id}/draft` | Friendly answer + resource suggestions | List of related resources |

Claude setup details (`ClaudeService.java`): official `com.anthropic:anthropic-java` SDK, model from `AI_MODEL` (default `claude-opus-5-5`), effort `low` for fast answers, 90-second timeout, server-side fallback enabled. If any call fails, the user sees the offline result with a short note — the demo never breaks.

---

## 10. API cheat sheet

All responses are JSON. **POST / PUT / DELETE need the header `X-Requested-With: GyaanSetu`.**

```bash
# Health
curl http://localhost:8080/api/health

# Ranked search with filters and custom weights
curl "http://localhost:8080/api/resources?q=calculus&types=video,pdf&minRating=4&sort=best&w=rel:50,pop:0"

# Details of one resource
curl "http://localhost:8080/api/resources/eoc"

# Log in (keeps the session cookie in cookies.txt), then like a resource
curl -c cookies.txt -H "Content-Type: application/json" -H "X-Requested-With: GyaanSetu" \
     -d '{"email":"demo@gyaansetu.in","password":"demo1234"}' http://localhost:8080/api/auth/login
curl -b cookies.txt -X POST -H "X-Requested-With: GyaanSetu" http://localhost:8080/api/resources/eoc/like

# Upload a PDF to the AI assistant
curl -X POST -H "X-Requested-With: GyaanSetu" -F file=@notes.pdf http://localhost:8080/api/ai/upload
```

| Status | Meaning |
|---|---|
| 200 / 201 | OK / created |
| 400 | Invalid input (message explains what to fix) |
| 401 | Sign in required, or wrong email/password |
| 403 | Missing `X-Requested-With` header (CSRF protection) |
| 404 | Unknown resource, thread, goal or API path |
| 409 | Email already registered |
| 413 | Upload larger than 25 MB |
| 500 | Server or database error (details in the server log, not shown to users) |

Full endpoint list: see `README.md` → *API*.

### Points system

| Action | Points |
|---|---|
| Post a review (first time per resource) | +5 |
| Ask a forum question | +5 |
| Answer a forum question | +5 |
| Mark a resource complete | +3 |
| Rate a resource (first time) | +2 |
| Complete a study goal | +1 |
| Use a Claude AI feature | +1 |

---

## 11. Security

| Risk | Protection | Where |
|---|---|---|
| Stolen passwords | PBKDF2-HMAC-SHA256, 120,000 iterations, random salt per user | `Passwords.java` |
| SQL injection | Prepared statements everywhere; table names never from user input | all `dao/` classes |
| Cross-site request forgery | Custom header required on every change; SameSite=Lax cookie | `ApiFilter.java`, `context.xml` |
| Session hijacking | HttpOnly cookie; session id rotated at login | `AuthServlet.java`, `web.xml` |
| Script injection (XSS) | All user text escaped before display | `esc()` in `app.js` |
| Huge uploads / bodies | 25 MB upload limit, 1 MB JSON limit, length limits on every field | `AiServlet.java`, `ApiServlet.java` |
| Leaking internals | Errors return friendly messages; stack traces only in the server log | `ApiServlet.java` |
| Spam reviews | One review per learner per resource (re-posting updates it) | `ReviewDao.deleteByUser` |

---

## 12. Tests

Run: `mvn test` (about 15 seconds after the first build). Expected ending:

```
Tests run: 18, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

What was verified before delivery:

- 18 JUnit tests (unit + full HTTP integration with a real Tomcat and in-memory database)
- A browser test clicking through all 9 screens at desktop (1366 px) and phone (390 px) size: **56/56 checks passed**, no console errors, no horizontal scrolling
- The WAR deployed on a standalone Tomcat 10.1.57 under `/gyaansetu/`: same 56/56 checks passed
- Not tested here: live Claude answers (no API key in the build environment) — test once with your key

---

## 13. Questions judges may ask

**Why not just sort by views or likes?**
Views reward clickbait. Our sample's most-viewed machine-learning video has 2.9★ and negative reviews; quality-weighted ranking puts it last (50.4 vs 93.2 for the best).

**How is relevance calculated?**
BM25, the formula behind classic search engines like Lucene/Elasticsearch, plus our own synonym map and typo tolerance — implemented from scratch in `Ranker.java`.

**What stops a resource with one 5★ rating from beating one with thousands of 4.8★ ratings?**
The Bayesian average: every resource starts with 25 "virtual" ratings at the global mean (≈4.5★), so a few ratings barely move it.

**How does sentiment analysis work?**
A lexicon of ~80 weighted words, with negation flipping the meaning ("not useful") and intensifiers boosting it ("really clear"), squashed to -1..1 with `tanh`. Every review is scored when posted and stored in the `sentiment` column.

**Is the AI required?**
No. Every AI feature has an offline version, so the platform works without internet or an API key. With a key, Claude writes the answers.

**How does it scale beyond 46 resources?**
The index is in memory and BM25 is linear in the number of documents — fine for thousands. For millions, the same design moves to Elasticsearch/OpenSearch for relevance, keeps the quality signals in the database, and caches stats. Counters are already denormalised for fast reads.

**Where does the content come from?**
A curated sample of real open resources (MIT OCW, OpenStax, Khan Academy, freeCodeCamp, 3Blue1Brown, Wikipedia, MDN, Harvard CS50…). Next step: importers for the YouTube Data API, OpenStax and Wikipedia APIs, writing into the same `resources` table.

**Why Servlets and JDBC instead of Spring Boot?**
It shows the fundamentals directly: request handling, sessions, filters, transactions and SQL are all visible in the code. The structure (servlet → DAO → database) maps one-to-one onto Spring controllers and repositories if we migrate.

**Is personalisation a recommendation system?**
A content-based one: we build a profile of subjects and tags from what you like, save, complete and rate 4+, and score other resources by overlap ("For you" signal).

**How do you prevent fake engagement?**
Likes, ratings and votes are one per account (primary keys enforce it), reviews are one per learner per resource, and the Bayesian rating dampens small manipulations. Next step: rate limits and verified-learner badges.

**What would you build next?**
Live content importers, an admin panel to add resources, embeddings-based semantic search, spaced-repetition flashcards from quizzes, and teacher-curated playlists.

---

## 14. Glossary

| Term | Meaning |
|---|---|
| Servlet | A Java class that answers HTTP requests inside a server like Tomcat |
| JDBC | Java's standard API for talking to SQL databases |
| DAO | Data Access Object — a class that holds the SQL for one area |
| Filter | Code that runs before every matching request (here: security checks) |
| WAR | Web ARchive — the packaged app you drop into Tomcat |
| H2 | A small Java SQL database stored in a single file; no install needed |
| BM25 | A standard relevance formula: rewards matching rare words, normalises for length |
| Bayesian average | An average pulled toward the overall mean until enough ratings exist |
| Sentiment analysis | Scoring text as positive, neutral or negative |
| CSRF | Cross-site request forgery: another website trying to act as you |
| PBKDF2 | A slow, salted password-hashing method that resists cracking |
| Session | Server-side memory of who is logged in, linked by a cookie |
