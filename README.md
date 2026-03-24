## Job Application Tracker (MVP)

Beginner-friendly MVP for tracking job applications locally.

### Tech Stack
- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Prisma
- SQLite
- Tauri 2 (optional desktop shell)

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and set variables (see `.env.example` for comments):
   ```env
   DATABASE_URL="file:./dev.db"
   OPENAI_API_KEY="your_openai_api_key_here"
   ```
   `OPENAI_API_KEY` powers **Discover** (OpenAI web search) and **AI analysis**. Without it, Discover falls back to DuckDuckGo HTML search only (often unreliable).
3. Run Prisma migration:
   ```bash
   npx prisma migrate dev
   ```
4. (Optional) Open Prisma Studio:
   ```bash
   npx prisma studio
   ```

### Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Deploy on Railway (web app, SQLite)

This app runs as a **Node** service with **`next start`**. Prisma uses **SQLite** (`better-sqlite3`); the database file must live on a **persistent volume** or data is lost on redeploy.

#### 1. Create a project and service

1. Create a new project on [Railway](https://railway.app) and add a **GitHub repo** (or deploy from the CLI).
2. **Do not** add a Postgres plugin for this app unless you plan to migrate later.

#### 2. Add a volume (required for SQLite persistence)

1. Open your **service** → **Settings** → **Volumes**.
2. Add a volume and mount it at a path such as **`/data`** (absolute path).
3. Railway **automatically sets** `RAILWAY_VOLUME_MOUNT_PATH` to that mount path at **runtime** (volumes are not available during the build phase).

The app resolves the DB path like this:

| Priority | What it uses |
|----------|----------------|
| 1 | `DATABASE_URL` if set (full `file:…` URL, e.g. `file:/data/app.db`) |
| 2 | Else `RAILWAY_VOLUME_MOUNT_PATH` or `SQLITE_DATA_DIR` + `SQLITE_DATABASE_NAME` (default `app.db`) |
| 3 | Else local dev default `file:./dev.db` |

#### 3. Environment variables

Set in the service **Variables** tab:

| Variable | Required | Notes |
|----------|----------|--------|
| `OPENAI_API_KEY` | Recommended | Discover + AI features; omit only if you accept fallbacks. |
| `DATABASE_URL` | Optional | **Either** set this to a full SQLite URL, **or** rely on a mounted volume + `RAILWAY_VOLUME_MOUNT_PATH` (see above). Example: `file:/data/app.db` when the volume is mounted at `/data`. |
| `SQLITE_DATABASE_NAME` | Optional | Defaults to `app.db`; only used when resolving from `RAILWAY_VOLUME_MOUNT_PATH` / `SQLITE_DATA_DIR` without `DATABASE_URL`. |
| `NODE_ENV` | Auto | Railway sets `production` for deploys. |

**`PORT`** is set by Railway; Next.js reads it automatically.

#### 4. Build and start commands

Railway’s **Nixpacks** (default) will run **`npm install`** (or `npm ci`) and **`npm run build`**.

Use these explicitly if you configure a custom build/start:

| Phase | Command |
|-------|---------|
| **Build** | `npm ci` then `npm run build` (runs `prisma generate && next build`) |
| **Start** | `npm start` (runs `prisma migrate deploy && next start`) |

Migrations run **at container start** on the **persistent** SQLite file so the schema matches before the server accepts traffic.

#### 5. First deploy checklist

- [ ] Volume mounted (e.g. `/data`) and service redeployed so it picks up the volume.
- [ ] Either `DATABASE_URL=file:/data/app.db` (matching your mount path) **or** no `DATABASE_URL` so `RAILWAY_VOLUME_MOUNT_PATH` + default `app.db` is used.
- [ ] `OPENAI_API_KEY` set if you want Discover/AI features.

#### 6. Local development unchanged

`npm run dev` still uses `.env` with `DATABASE_URL="file:./dev.db"` by default. The `start` script runs migrations against whatever URL is resolved; **local dev** continues to use `npx prisma migrate dev` for schema changes.

### Desktop app (Tauri)

The web UI is unchanged. This project uses **Next.js `output: "standalone"`** so Server Actions and Prisma keep working. The **official Tauri + Next.js static export** path is not used here because this app is not a static site.

- **Desktop dev:** `npm run tauri:dev` — runs the Next dev server with `TAURI_DEV=1` (for asset URLs) and opens the native window. The Rust app loads the dev server at `http://localhost:3000` from `tauri.conf.json` (`devUrl`).
- **Desktop build:** `npm run tauri:build` — runs `next build`, copies the standalone server into `src-tauri/resources/next-server`, then compiles the Tauri app. On launch, the Rust shell starts the bundled Next server with **system `node`** on `http://127.0.0.1:14587` and `prisma db push` against a SQLite file in the OS app data folder. **Node.js must be installed** on the machine for the packaged app to start the server.
- **Prisma + Next bundle:** Turbopack can emit `require("@prisma/client-<hash>")` in server chunks; that id is not a real package. `tauri:prepare-bundle` scans `.next/server`, writes small shim packages under `next-server/node_modules/@prisma/client-<hash>/` that re-export `@prisma/client`, and verifies `require()` from the bundle root before finishing.
- **CI / Cursor:** If `CI=1` is set, `tauri build` can fail with an invalid `--ci` flag. The `tauri:build` script clears `CI` automatically.
- **macOS `.app` vs DMG:** The default bundle target is **`app`** only so `tauri build` produces **`Job Application Tracker.app`** under `src-tauri/target/release/bundle/macos/` without running DMG creation (which can fail in some environments). To try a **DMG** as well, run: `npm run tauri:build -- --bundles dmg` (or `app,dmg` for both). Open the app with: `open "src-tauri/target/release/bundle/macos/Job Application Tracker.app"`.
- **Window / white screen:** The shell waits until the Next server returns HTTP (dev: `http://localhost:3000`, release: `http://127.0.0.1:14587`) before opening the window; it augments `PATH` so GUI launches can find **Homebrew Node**, streams `[next-server]` logs, and shows an in-app error page if startup fails. Logs use the `[desktop]` / `[next-server]` prefixes.
- **Runtime errors:** The app uses **dynamic rendering**, **safe cache revalidation** (revalidate failures are logged, not thrown), a **single Prisma client** with a longer SQLite busy timeout, **`app/error.tsx`**, and **`[server-error]`** logging. Page data failures show an inline message instead of a blank 500.

**Prerequisites (desktop):**

- [Rust](https://www.rust-lang.org/tools/install) (stable) and Cargo
- **Tauri system dependencies** — follow [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS (macOS: Xcode Command Line Tools; Linux: webkit/gtk; Windows: WebView2 / MSVC).
- **Node.js** (for the desktop build and for running the bundled Next server in the packaged app)

**macOS note:** GUI apps often do not inherit shell environment variables. If you need `OPENAI_API_KEY` in the packaged app, launch it from a terminal where `.env` is loaded, or configure the key in your environment another way.

### App routes

| Path | What you’ll find |
|------|------------------|
| `/` | **Dashboard** — top skills needed & missing (from analyzed jobs), apply-next list, jobs needing analysis/fetch, deadlines, recommended preview |
| `/tracker` | **Jobs tracker** — add a job, search/filter/sort, **table** on desktop plus full job cards below for fetch/analyze/edit |
| `/discover` | **Discover jobs** — search form (keyword, location, level, work mode), **Find Jobs**, filtered results, save to tracker |
| `/profile` | **My profile** — form used by discovery and future fit features |

Use the top navigation bar to switch pages.

### AI Job Analysis (Manual Trigger)

- Add your OpenAI key in `.env` as `OPENAI_API_KEY`.
- In the jobs list, click **Analyze** on a job card.
- If there is no successful fetched page text yet, **Analyze** tries a one-time **Fetch Content** first (best-effort), then runs the model. If fetch fails, analysis still runs using your manual fields and URL.
- The app saves structured AI insights directly on that job:
  - role category, seniority, fit label, recommendation, urgency
  - skills needed, missing skills, summary, reasoning
- If the key is missing or the request fails, a friendly message is shown in the UI.

### Fetch + Analyze (one click)

- **Fetch + Analyze** fetches the job URL when you do not already have stored extracted text (`fetchStatus` success with non-empty content). If content is already stored, fetch is **skipped** so you do not re-download every time — use **Fetch Content** alone when you want a fresh pull after editing the URL.
- Then it runs the same AI analysis as **Analyze**.
- If fetching fails, analysis still runs (same fallback as above).

### Recommended Jobs (simple rules)

- The **Recommended Jobs** section groups saved (`SAVED`) jobs using AI labels and deadlines. It is **computed in memory** (not stored in the database).
- **Priority score** (for sorting and highlights) adds points for high fit/urgency, soon deadlines, and subtracts for missing skills or statuses past “saved”. Tune rules in `lib/job-recommendations.ts`.
- Each job appears in **at most one** group, in this order: **Top matches** → **Apply soon** → **Maybe** → **Low priority / Skip**.

### Discover Jobs (OpenAI web search + fallback)

**Form inputs (on `/discover`):**

- **Keyword / role** — main search terms (defaults from profile target role if left blank when you submit).
- **Location** — city/region (defaults from profile preferred location if blank).
- **Level** — any, internship, working student, junior, mid (adds phrases like “Werkstudent” / “junior” to the query).
- **Work mode** — any, remote, hybrid, on-site (adds to the query).

With **`OPENAI_API_KEY` set**, **Find Jobs** runs **server-side** OpenAI **Responses** with the built-in **`web_search`** tool. The model returns structured JSON (title, URL, snippet, etc.); the app validates URLs, deduplicates, and shows up to ~15 results. Quality depends on **what is publicly findable on the web** for your query — the model does not have a private job database.

If OpenAI returns no usable postings or errors, the app **falls back** to the older **DuckDuckGo HTML** pipeline (merge queries, then **filter/rank** in `lib/discover-quality.ts`). **Nothing is stored** until you click **Save** on a row; URLs already in your tracker show **In tracker**.

**Result-quality filtering (limitations):**

- The model is asked to prefer **single job postings** and direct career/ATS pages, not generic hubs — you may still see occasional noise.
- On the **DuckDuckGo fallback**, HTML search often returns **aggregate pages**. The app scores each result and **drops** very low scores. DuckDuckGo may block or change HTML; this is **not** a job board API.

**When discover returns nothing:**

- Missing **`OPENAI_API_KEY`**: Discover uses only DuckDuckGo; the UI explains when the key is absent.
- DuckDuckGo often responds with a **bot-check / CAPTCHA page** (HTTP 202) instead of real SERP HTML — the app detects this and explains it in the UI.
- The `/discover` page shows a **status line** and a **technical summary** (expand “Technical summary”) with query count, merged link count, and outcome.
- **Server logs:** concise `[discover]` / `[discover][openai]` lines for debugging.

Saved jobs get `source: discover`, `status: SAVED`, URL/title from the result, snippet in **notes**, and a **company** guess when the title looks like “Role at Company”.

### Dashboard skill aggregation

- **Top skills needed** and **Top missing skills** count strings from `aiSkillsNeeded` / `aiMissingSkills` across jobs that already have **AI analysis** (case-insensitive merge; badge shows how many postings mention each skill). See `lib/dashboard-insights.ts`.
- Other sections list jobs that still need **analysis** or **fetch**, high-priority **apply next** candidates, and **deadlines** in the next 14 days.

### Job Content Fetching

- Click **Fetch Content** on a job to fetch and extract readable text from the job URL.
- The app stores:
  - page title
  - extracted text (trimmed to a practical size)
  - fetch status and errors
  - fetch timestamp
- AI analysis now prefers fetched content (when available) for better results.
- Some job sites block scraping, require login, or load content heavily with JavaScript. In those cases, fetch may fail or return limited text.

### Current database model

- `Job` model with fields:
  - `id`, `url`, `company`, `title`, `location`, `status`
  - `appliedAt`, `deadline`, `notes`, `source`
  - `skillsNeeded`, `fitScore`, `aiSummary`
  - `createdAt`, `updatedAt`
- `JobStatus` enum values:
  - `SAVED`, `APPLIED`, `HEARD_BACK`, `INTERVIEW`, `REJECTED`, `OFFER`

No auth. Discover prefers OpenAI (requires `OPENAI_API_KEY`); without it, or when OpenAI yields no results, DuckDuckGo HTML search is used as fallback.
