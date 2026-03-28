# Job Application Tracker

A local-first web app (with optional desktop shell) that helps you manage your job search in one place. You add jobs, the app fetches the posting, AI analyzes the role against your profile, and your dashboard surfaces which jobs to prioritize, what skills you're missing, and what deadlines are coming up — all stored privately on your machine.

---

## Features

- **Jobs Tracker** — add jobs manually or via Discover, track status from Saved → Applied → Interview → Offer/Rejected, set deadlines, write notes
- **AI Analysis** — one click runs OpenAI on a job posting: extracts required skills, scores fit, flags urgency, and explains the recommendation
- **Discover Jobs** — searches for live job postings using OpenAI web search (with DuckDuckGo fallback), filtered by role, location, level, and work mode
- **Dashboard** — aggregated view of top skills needed, skills you're missing across all analyzed jobs, what to apply to next, and upcoming deadlines
- **My Profile** — stores your target roles, skills, location preferences, and degree info so AI analysis and Discover queries are personalized
- **Desktop App (optional)** — wraps the web UI in a native macOS/Windows/Linux window via Tauri, with the database stored in your OS app data folder

---

## Tech Stack

- [Next.js](https://nextjs.org) (App Router, Server Actions)
- TypeScript
- Tailwind CSS
- Prisma + SQLite (`better-sqlite3`)
- [Tauri 2](https://v2.tauri.app) (optional desktop shell)
- OpenAI API (Discover + AI analysis)

---

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set environment variables** — copy `.env.example` to `.env`:
   ```env
   DATABASE_URL="file:./dev.db"
   OPENAI_API_KEY="your_openai_api_key_here"
   ```
   `OPENAI_API_KEY` powers Discover (OpenAI web search) and AI analysis. Without it, Discover falls back to DuckDuckGo HTML search only (often unreliable).

3. **Run Prisma migration:**
   ```bash
   npx prisma migrate dev
   ```

4. *(Optional)* **Open Prisma Studio** to inspect your database:
   ```bash
   npx prisma studio
   ```

---

## Running the App

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## App Pages

| Path | What you'll find |
|------|-----------------|
| `/` | **Dashboard** — skills gap, apply-next list, jobs needing analysis, upcoming deadlines |
| `/tracker` | **Jobs Tracker** — add, search, filter, sort, fetch content, analyze, edit jobs |
| `/discover` | **Discover Jobs** — search by keyword, location, level, and work mode; save results to tracker |
| `/profile` | **My Profile** — your background, target roles, skills, and location preferences |

---

## AI Features

### Job Analysis
Click **Analyze** on any job card. If no page content has been fetched yet, it attempts a one-time fetch first. The model returns:
- Role category, seniority level, fit label, fit reasoning
- Skills needed and skills you're missing
- Action recommendation and urgency rating

### Fetch + Analyze
Fetches the job URL and runs analysis in one click. If the page fetch fails, analysis still runs using your manually entered fields.

### Discover Jobs
Uses OpenAI's built-in `web_search` tool to find live postings matching your query. Falls back to DuckDuckGo HTML if OpenAI returns nothing. Results are not saved until you click **Save** on a row.

---

## Deployment (Railway)

This app runs as a Node service with `next start`. Prisma uses SQLite; the database file must live on a persistent volume.

### 1. Create a project and service

Create a new project on [Railway](https://railway.app) and connect your GitHub repo. Do **not** add a Postgres plugin unless you plan to migrate.

### 2. Add a volume

Go to **Service → Settings → Volumes**, add a volume, and mount it at `/data`. Railway sets `RAILWAY_VOLUME_MOUNT_PATH` automatically at runtime.

The app resolves the database path in this order:

| Priority | What it uses |
|----------|-------------|
| 1 | `DATABASE_URL` if set (e.g. `file:/data/app.db`) |
| 2 | `RAILWAY_VOLUME_MOUNT_PATH` or `SQLITE_DATA_DIR` + `SQLITE_DATABASE_NAME` |
| 3 | Local dev default `file:./dev.db` |

### 3. Environment variables

| Variable | Required | Notes |
|----------|----------|-------|
| `OPENAI_API_KEY` | Recommended | Discover + AI features |
| `DATABASE_URL` | Optional | Full SQLite URL, or rely on volume + `RAILWAY_VOLUME_MOUNT_PATH` |
| `SQLITE_DATABASE_NAME` | Optional | Defaults to `app.db` |

### 4. Build and start commands

| Phase | Command |
|-------|---------|
| **Build** | `npm ci` then `npm run build` (runs `prisma generate && next build`) |
| **Start** | `npm start` (runs `prisma migrate deploy && next start`) |

### 5. Deploy checklist

- [ ] Volume mounted at `/data` and service redeployed
- [ ] `DATABASE_URL=file:/data/app.db` set (or leave unset to use `RAILWAY_VOLUME_MOUNT_PATH`)
- [ ] `OPENAI_API_KEY` set for Discover and AI features

---

## Desktop App (Tauri)

The Tauri shell wraps the Next.js server in a native window. This is **not** a static export — Server Actions and Prisma keep working.

| Command | What it does |
|---------|-------------|
| `npm run tauri:dev` | Runs the Next dev server and opens the native window |
| `npm run tauri:build` | Builds the standalone Next server, bundles it into the Tauri app |

**Bundled server details:** The packaged app starts the Next server on `http://127.0.0.1:14587` using system Node, and runs `prisma db push` against a SQLite file in the OS app data folder. **Node.js must be installed** on the target machine.

**macOS app:** The default bundle produces `Job Application Tracker.app` under `src-tauri/target/release/bundle/macos/`. To also build a DMG: `npm run tauri:build -- --bundles dmg`.

**macOS note:** GUI apps often don't inherit shell environment variables. To use `OPENAI_API_KEY` in the packaged app, launch it from a terminal where your `.env` is loaded.

**Prerequisites:**
- [Rust](https://www.rust-lang.org/tools/install) (stable) and Cargo
- Tauri system dependencies — see [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS
- Node.js (required on the machine for the packaged app to run)

---

## Database Model

**`Job`** — one row per application:
- Core: `url`, `company`, `title`, `location`, `status`, `appliedAt`, `deadline`, `notes`, `source`
- AI fields: `aiRoleCategory`, `aiSeniority`, `aiSkillsNeeded`, `aiMissingSkills`, `aiFitLabel`, `aiFitReasoning`, `aiActionRecommendation`, `aiUrgency`, `aiSummary`, `aiLastAnalyzedAt`
- Fetch fields: `fetchedTitle`, `fetchedContentText`, `fetchStatus`, `fetchError`, `fetchedAt`

**`Profile`** — single row (id=1), stores your name, headline, university, target roles, skills, tools, preferred locations, and work preferences.

**`JobStatus` enum:** `SAVED` → `APPLIED` → `HEARD_BACK` → `INTERVIEW` → `REJECTED` / `OFFER`

No authentication — single-user, local-first by design.

---

## Future Features

These are the next logical improvements for the app:

### Application Management
- **Kanban / timeline view** — drag-and-drop board view of applications by status stage, as an alternative to the table
- **Follow-up reminders** — set a "follow up by" date per job and surface overdue follow-ups on the dashboard
- **Application notes templates** — pre-fill the notes field with a structured template (e.g. "Why interested / Key points / Questions to ask")
- **Bulk status updates** — select multiple jobs and update their status at once

### AI Enhancements
- **Cover letter generator** — given a job's AI analysis and your profile, generate a tailored cover letter draft
- **Resume tailoring suggestions** — based on `aiMissingSkills`, suggest which resume bullet points to add or reword for a specific job
- **Interview prep** — generate a list of likely interview questions and suggested talking points based on the job posting
- **AI email drafts** — one-click drafts for follow-up emails, thank-you notes, and withdrawal messages

### Importing & Saving Jobs
- **Browser extension / bookmarklet** — save a job directly from any job board page without opening the app
- **LinkedIn / Indeed URL import** — paste a LinkedIn or Indeed job URL and auto-fill company, title, location from their structured data
- **CSV import/export** — import a spreadsheet of jobs, or export your full tracker to CSV for backups or sharing

### Analytics & Insights
- **Application stats page** — response rate, average time to hear back, offer rate by source/role/location
- **Skills progress tracker** — track which missing skills you've been working on (e.g. link to a course) and see them move off your gap list over time
- **Salary range tracking** — add a salary range field per job and compare across your pipeline

### Multi-user & Sync
- **Multi-profile support** — useful if helping others with their job search, or switching between different role tracks
- **Cloud sync** — optional Postgres backend (swap SQLite) so the app is accessible from multiple devices without Railway
- **Auth** — simple email/password or passkey login to support the above

### Notifications
- **Deadline alerts** — local OS notifications (via Tauri) or browser notifications when a deadline or follow-up date is approaching
- **Weekly digest** — a scheduled summary of your pipeline: what to apply to, what's overdue, how your skill gaps are changing
