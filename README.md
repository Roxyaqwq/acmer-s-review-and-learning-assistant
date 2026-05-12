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
| **Review Manager** | Two-step contest-first workflow: create contest → add problems. Full CRUD with custom 50+ algorithm tags, Markdown notes, status tracking, completion timestamps |
| **Daily Problem** | Smart recommendation based on your top-3 weak tags with 30-day spaced repetition |
| **Profile Page** | GitHub-Contribution-style heatmap, CF rating display, top-3 mastery tags, customizable avatar & full-screen background |
| **Social** | Friend request/accept/reject system, mutual follows, view friend's review records (with permission) |
| **Auth** | GitHub OAuth login + Codeforces handle binding |

## Tech Stack

| Layer | Stack |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, Radix UI |
| Backend | Go, Fiber, PostgreSQL, sqlx |
| Theme | Dark mode by default |

## Quick Start

### Prerequisites

- **Go** ≥ 1.22
- **Node.js** ≥ 18
- **PostgreSQL** ≥ 16

### 1. Clone & Install

```bash
git clone https://github.com/Roxyaqwq/acmer-s-review-and-learning-assistant.git
cd acmer-s-review-and-learning-assistant
```

### 2. Database

Create a PostgreSQL database:

```bash
createdb -U postgres algoarena
```

or use Docker:

```bash
docker compose up -d postgres redis
```

### 3. Configuration

Copy `.env.example` to `.env` and fill in your credentials:

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/algoarena?sslmode=disable
JWT_SECRET=your-random-secret-here
GITHUB_CLIENT_ID=your-github-oauth-app-client-id
GITHUB_CLIENT_SECRET=your-github-oauth-app-client-secret
GITHUB_REDIRECT_URL=http://localhost:3000/api/auth/github/callback
FRONTEND_URL=http://localhost:3000
PORT=8080
```

> For GitHub OAuth: create an app at [GitHub Developer Settings](https://github.com/settings/developers) with callback URL `http://localhost:3000/api/auth/github/callback`.

### 4. Start Backend

```bash
cd backend
go mod tidy
go build -o main.exe ./cmd/main.go
main.exe
```

On first startup, the backend will:
- Auto-migrate database tables
- Seed 36 Chinese tag translations
- Sync ~11,000 Codeforces problems to local database

### 5. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

### 6. Open

Visit `http://localhost:3000`

### One-Click Launch (Windows)

```bash
start.bat
```

This script starts PostgreSQL, backend, and frontend automatically. Close the window to stop all services.

## Project Structure

```
algoarena/
├── backend/
│   ├── cmd/main.go              # Entry point, routes, startup
│   └── internal/
│       ├── config/              # Environment config
│       ├── db/                  # Connection, migrations
│       ├── handlers/            # HTTP handlers
│       ├── middleware/          # JWT auth middleware
│       ├── models/              # Data models
│       ├── services/            # CF API, AtCoder scraper, tags, sync
│       └── utils/               # Response helpers
├── frontend/
│   └── src/
│       ├── app/                 # Next.js App Router pages
│       │   ├── problems/        # Problem search
│       │   ├── contests/        # Upcoming contests
│       │   ├── review/          # Review manager
│       │   ├── daily/           # Daily problem
│       │   ├── profile/[id]/    # User profile
│       │   └── auth/callback/   # OAuth callback
│       ├── components/
│       │   ├── layout/          # Navbar
│       │   └── ui/              # Reusable components
│       ├── hooks/               # Auth context
│       └── lib/                 # API client, utilities
├── launcher.js                  # One-click startup script (Node.js)
├── start.bat                    # Windows shortcut
├── stop.bat                     # Force stop
├── docker-compose.yml
└── .env.example
```

## Database Tables

| Table | Purpose |
|---|---|
| `users` | GitHub OAuth users, CF handle, profile settings |
| `cf_problems` | ~11,000 Codeforces problems with tags |
| `cf_contests` | CF contest metadata |
| `cf_submissions` | Synced CF submission records (for heatmap) |
| `cf_tag_translations` | CF tag → Chinese translation mapping |
| `review_entries` | User review/problem entries |
| `user_contests` | Contest records for the contest-first workflow |
| `daily_problems` | Daily recommended problem assignments |
| `follows` | Follow/follower relationships |
| `friend_requests` | Friend request/accept/reject system |

## API Endpoints

### Auth
| Method | Path | Description |
|---|---|---|
| GET | `/api/auth/github` | GitHub OAuth login redirect |
| GET | `/api/auth/github/callback` | OAuth callback |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/bind-cf` | Bind Codeforces handle |
| PATCH | `/api/auth/profile` | Update profile |

### Problems (`GET`)
| Path | Query Params |
|---|---|
| `/api/problems/search` | `q`, `min_rating`, `max_rating`, `tags`, `page`, `limit` |
| `/api/problems/tags` | — |

### Contests
| Method | Path |
|---|---|
| GET | `/api/contests/upcoming` |

### Review (auth required)
| Method | Path | Description |
|---|---|---|
| GET | `/api/review` | List entries (supports `tag`, `status`, `platform` filters) |
| GET/POST/PUT/DELETE | `/api/review/:id` | Entry CRUD |
| POST | `/api/review/sync-cf` | Sync CF submissions |
| GET/POST | `/api/review/contests` | List/create contests |
| DELETE | `/api/review/contests/:cid` | Delete contest |

### Users
| Method | Path |
|---|---|
| GET | `/api/users/search?q=` |
| GET | `/api/users/:id` |
| GET | `/api/users/:id/heatmap` |

### Social (auth required)
| Method | Path | Description |
|---|---|---|
| POST/DELETE | `/api/social/follow/:id` | Follow/unfollow |
| GET | `/api/social/:id/followers` | Followers list |
| GET | `/api/social/:id/following` | Following list |
| GET | `/api/social/:id/review` | View friend's review |
| GET | `/api/social/friends` | Friend list |
| GET | `/api/social/friend-requests` | Pending requests |
| POST | `/api/social/friend-request/:id` | Send request |
| PUT | `/api/social/friend-request/:id/accept` | Accept |
| PUT | `/api/social/friend-request/:id/reject` | Reject |
| DELETE | `/api/social/friends/:id` | Remove friend |

## Notes for Chinese Developers

- **Go proxy**: Set `GOPROXY=https://goproxy.cn,direct` and `GONOSUMDB=*` to bypass GFW restrictions on module downloads.
- **PostgreSQL encoding**: The database uses UTF-8. `psql` on Windows PowerShell may display garbled Chinese — this is a terminal encoding issue, not a data issue.
- **Next.js version**: v14.2.0 is intentionally chosen for stability. Upgrade to 15+ requires breaking changes to the app router config.
