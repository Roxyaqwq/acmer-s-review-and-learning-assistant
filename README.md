# AlgoArena — ACMer's Review & Learning Assistant

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Go](https://img.shields.io/badge/Go-1.22%2B-00ADD8?logo=go)](https://golang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)

A competitive programming training toolbox for Chinese region contest participants. Built by ACMers, for ACMers.

## Features

| Module | Description |
|---|---|
| **Problem Search** | Search Codeforces problems by rating, Chinese-translated tags, or name/ID |
| **Upcoming Contests** | Display upcoming CF + AtCoder contests with countdown timers |
| **Review Manager** | Two-step contest-first workflow: create contest → add problems. Full CRUD with custom 50+ algorithm tags, Markdown notes with KaTeX math and syntax highlighting, status tracking, completion timestamps, per-contest grouping with pagination, Markdown/JSON export and JSON import |
| **Daily Problem** | Picks one problem from your weakest tags, fixed for the day, with 2 server-side swaps and spaced repetition over solved problems (configurable 3–60 day cooldown) |
| **Profile Page** | GitHub-Contribution-style heatmap, CF rating/rank, top-3 mastery tags, statistics, customizable avatar & full-screen background |
| **Snippets** | Personal code snippet library with language tagging and full-text search |
| **Feed** | Activity feed aggregating your own and your friends' review activity |
| **Social** | Friend request/accept/reject system, mutual follows, view friend's review records (opt-in per user, enforced server-side) |
| **Live2D Mascot** | Draggable Cubism 4 mascot in the corner, swappable between bundled models, remembers position and model |
| **Auth** | GitHub OAuth login (state-protected) + Codeforces handle binding |

## Tech Stack

| Layer | Stack |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Radix UI, SWR |
| Backend | Go, Fiber v2, PostgreSQL, sqlx |
| Rendering | react-markdown + remark-gfm/math + rehype-highlight/katex |
| Mascot | Live2D Cubism 4 Web Framework (vendored TypeScript) |
| Theme | Dark mode by default |

## Quick Start

### Prerequisites

- **Go** ≥ 1.22
- **Node.js** ≥ 18.18
- **PostgreSQL** ≥ 16

### 1. Clone & Install

```bash
git clone https://github.com/Roxyaqwq/acmer-s-review-and-learning-assistant.git
cd acmer-s-review-and-learning-assistant
```

### 2. Database

Use Docker (recommended):

```bash
docker compose up -d postgres
```

Or point at an existing PostgreSQL and create the database yourself:

```bash
createdb -U postgres algoarena
```

Migrations run automatically on backend startup — no manual SQL step.

### 3. Configuration

Copy `.env.example` to `.env` and fill in your credentials. Put it at the repo root for `docker compose`, and/or at `backend/.env` for a local `go run` — the backend reads `.env` first and then `../.env`, and the first value it finds wins:

```env
DATABASE_URL=postgres://user:pass@localhost:5432/algoarena?sslmode=disable
JWT_SECRET=your-secret-key-change-this
GITHUB_CLIENT_ID=your-github-oauth-app-client-id
GITHUB_CLIENT_SECRET=your-github-oauth-app-client-secret
GITHUB_REDIRECT_URL=http://localhost:3000/api/auth/github/callback
FRONTEND_URL=http://localhost:3000
PORT=8080
```

> For GitHub OAuth: create an app at [GitHub Developer Settings](https://github.com/settings/developers) with callback URL `http://localhost:3000/api/auth/github/callback`.
>
> `JWT_SECRET` is mandatory: `docker compose` refuses to start without it, and the backend refuses to boot with the built-in development default when `APP_ENV=production`.
>
> `.env` holds a real OAuth client secret. It is gitignored and has never been committed, but it does live in your working tree — don't zip the folder up and hand it to someone.

### 4. Start Backend

```bash
cd backend
go mod download
go run ./cmd/main.go
```

On first startup, the backend will:
- Auto-migrate database tables (versioned, transactional, tracked in `schema_migrations`)
- Seed 36 Chinese tag translations
- Sync ~11,000 Codeforces problems and the contest list in the background

### 5. Start Frontend

```bash
cd frontend
npm ci
npm run dev
```

### 6. Open

Visit `http://localhost:3000`

### One-Click Launch (Windows)

```bash
start.bat
```

`start.bat` → `launcher.js` starts PostgreSQL (Docker), the backend and the frontend in one window, waits for `/api/health`, and writes `launcher.log`. `stop.bat` kills whatever still holds ports 8080/3000.

## Project Structure

```
algoarena/
├── backend/
│   ├── cmd/main.go              # Entry point, routes, startup
│   └── internal/
│       ├── config/              # Environment config, secret checks
│       ├── db/                  # Connection, versioned migrations
│       ├── handlers/            # HTTP handlers (auth, review, daily, social, …)
│       ├── middleware/          # JWT auth (required + optional)
│       ├── models/              # Data models
│       ├── services/            # CF API, AtCoder scraper, tag dictionary, sync, recommender
│       └── utils/               # Response helpers
├── frontend/
│   ├── public/live2d/           # Bundled Cubism models + core runtime (~18 MB)
│   └── src/
│       ├── app/                 # Next.js App Router pages
│       │   ├── problems/        # Problem search
│       │   ├── contests/        # Upcoming contests
│       │   ├── review/          # Review manager
│       │   ├── daily/           # Daily problem
│       │   ├── snippets/        # Snippet library
│       │   ├── feed/            # Activity feed
│       │   ├── profile/[id]/    # User profile
│       │   └── auth/callback/   # OAuth callback
│       ├── components/
│       │   ├── layout/          # Navbar, global overlay
│       │   ├── live2d/          # Mascot component
│       │   └── ui/              # Reusable components (dialog, markdown editor, …)
│       ├── hooks/               # Auth context, debounce, shortcuts
│       └── lib/
│           ├── api.ts           # Typed API client
│           ├── live2d/          # Vendored Cubism framework + lapp runtime
│           └── swr.tsx          # SWR provider
├── docs/                        # Design notes (e.g. UI aesthetic review)
├── scripts/                     # Local-only helper scripts (ignored by git)
├── launcher.js                  # One-click startup script (Node.js)
├── start.bat / stop.bat         # Windows shortcuts
├── docker-compose.yml
└── .env.example
```

## Database Tables

| Table | Purpose |
|---|---|
| `users` | GitHub OAuth users, CF handle, profile and privacy settings |
| `cf_problems` | ~11,000 Codeforces problems with tags |
| `cf_contests` | CF contest metadata |
| `cf_submissions` | Synced CF submission records (for heatmap) |
| `cf_tag_translations` | CF tag → Chinese translation mapping |
| `review_entries` | User review/problem entries |
| `user_contests` | Contest records for the contest-first workflow |
| `daily_problems` | Daily recommended problem assignments |
| `snippets` | Personal code snippet library |
| `relationships` | Follow + friendship edges (one row per direction, `type` = `following`/`friend`) |
| `friend_requests` | Friend request/accept/reject system |
| `schema_migrations` | Applied migration versions |

## API Endpoints

All responses are `{"code": 0, "message": "ok", "data": …}`.

### Auth
| Method | Path | Description |
|---|---|---|
| GET | `/api/auth/github` | GitHub OAuth login redirect |
| GET | `/api/auth/github/callback` | OAuth callback (issues JWT) |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/bind-cf` | Bind Codeforces handle |
| PATCH | `/api/auth/profile` | Update profile / privacy |

### Problems & Contests (public)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/problems/search` | `q`, `min_rating`, `max_rating`, `tags`, `page`, `limit` |
| GET | `/api/problems/tags` | Tag list with Chinese translations |
| GET | `/api/contests/upcoming` | Upcoming CF + AtCoder contests |

### Review (auth required)
| Method | Path | Description |
|---|---|---|
| GET | `/api/review` | List entries; `tag`, `status`, `platform`, `page`, `limit`; without filters returns contest-grouped view |
| GET | `/api/review/tag` | Entries by tag |
| GET | `/api/review/tags/stats` | Per-tag solved counts |
| GET | `/api/review/:id` | Entry detail |
| POST/PUT/DELETE | `/api/review/:id` | Entry CRUD |
| GET/POST | `/api/review/contests` | List/create contests |
| PUT/DELETE | `/api/review/contests/:cid` | Update/delete contest |
| POST | `/api/review/sync-cf` | Sync CF submissions |
| GET | `/api/review/export/markdown` | Export as Markdown |
| GET | `/api/review/export/json` | Export as JSON |
| POST | `/api/review/import/json` | Import from JSON |

### Daily (auth required)
| Method | Path | Description |
|---|---|---|
| GET | `/api/daily` | Today's pick (stored server-side, so it does not change on refresh) |
| POST | `/api/daily/swap` | Trade today's pick for another one, at most twice a day |
| POST | `/api/daily/:id/complete` | Mark today's pick solved |

### Users (public, optional auth)
| Method | Path |
|---|---|
| GET | `/api/users/search?q=` |
| GET | `/api/users/:id` |
| GET | `/api/users/:id/heatmap` |
| GET | `/api/users/:id/stats` |

### Feed & Snippets (auth required)
| Method | Path | Description |
|---|---|---|
| GET | `/api/feed` | Activity feed of you + friends |
| GET/POST | `/api/snippets` | List/create snippets |
| GET/PUT/DELETE | `/api/snippets/:id` | Snippet CRUD |

### Social (auth required)
| Method | Path | Description |
|---|---|---|
| POST/DELETE | `/api/social/follow/:id` | Follow/unfollow |
| GET | `/api/social/status/:id` | Relationship status |
| GET | `/api/social/:id/followers` | Followers list |
| GET | `/api/social/:id/following` | Following list |
| GET | `/api/social/:id/review` | View another user's review (403 unless they enabled it) |
| GET | `/api/social/friends` | Friend list |
| GET | `/api/social/friend-requests` | Incoming pending requests |
| GET | `/api/social/friend-requests/outgoing` | Outgoing pending requests |
| POST | `/api/social/friend-request/:id` | Send request |
| PUT | `/api/social/friend-request/:id/accept` | Accept |
| PUT | `/api/social/friend-request/:id/reject` | Reject |
| DELETE | `/api/social/friends/:id` | Remove friend |

### Misc
| Method | Path | Description |
|---|---|---|
| GET | `/api/tags/custom` | Built-in custom tag dictionary |
| POST | `/api/upload` | Image upload (10 MB, MIME-sniffed) — auth required |
| GET | `/uploads/*` | Uploaded images |
| POST | `/api/admin/sync-cf` | Force a CF sync — admin only |
| GET | `/api/health` | Liveness probe (no DB access) |

## Live2D Mascot

The mascot bundles the official Live2D sample models and the Cubism 4 Web Framework:

- Models live in `frontend/public/live2d/` with their own `LICENSE.md` / `NOTICE.md` — read them before redistributing or using these models commercially.
- The framework under `frontend/src/lib/live2d/framework/` is vendored Cubism SDK code and keeps its upstream license; treat it as a third-party dependency, not project code.

## Development

```bash
# backend
cd backend && gofmt -l . && go vet ./... && go build ./... && go test ./...

# frontend
cd frontend && npx tsc --noEmit && npm run lint && npm test && npm run build
```

CI runs the same commands on every push and pull request (`.github/workflows/ci.yml`).

## Notes for Chinese Developers

- **Go proxy**: Set `GOPROXY=https://goproxy.cn,direct` and `GONOSUMCHECK`/`GONOSUMDB=*` to bypass GFW restrictions on module downloads.
- **PostgreSQL encoding**: The database uses UTF-8. `psql` on Windows PowerShell may display garbled Chinese — this is a terminal code page issue (936/GBK), not a data issue.
- **Next.js version**: 15.5.24 + React 19. The 14.2 line is out of patches and still carries two critical advisories (unauthenticated RCE on Windows-hosted servers, RCE in the Image Optimization API with AVIF); both are fixed in 15.5.24. Coming from 14 the only source change was that `useRef()` now needs an argument under the React 19 types.
- **Windows scripts**: `npm` / `pnpm` invoked from PowerShell can be blocked by the execution policy (`.ps1` shim). Use `npm.cmd`, or run scripts from `cmd.exe` / Git Bash.
