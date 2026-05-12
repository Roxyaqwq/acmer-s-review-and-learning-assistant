-- Migration 001: Core tables
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    github_id BIGINT UNIQUE NOT NULL,
    github_login VARCHAR(128) NOT NULL,
    github_avatar_url TEXT,
    cf_handle VARCHAR(64) UNIQUE,
    cf_rating INTEGER DEFAULT 0,
    cf_max_rating INTEGER DEFAULT 0,
    cf_rank VARCHAR(32) DEFAULT 'newbie',
    nickname VARCHAR(128),
    signature TEXT DEFAULT '',
    avatar_url TEXT DEFAULT '',
    background_url TEXT DEFAULT '',
    role VARCHAR(16) DEFAULT 'user',
    allow_view_review BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cf_problems (
    contest_id INTEGER NOT NULL,
    problem_index VARCHAR(4) NOT NULL,
    name TEXT NOT NULL,
    rating INTEGER DEFAULT 0,
    tags TEXT[] DEFAULT '{}',
    solved_count INTEGER DEFAULT 0,
    PRIMARY KEY (contest_id, problem_index)
);

CREATE TABLE IF NOT EXISTS cf_contests (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    contest_type VARCHAR(16) NOT NULL,
    phase VARCHAR(16) NOT NULL,
    duration_seconds INTEGER DEFAULT 0,
    start_time TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cf_tag_translations (
    tag_key VARCHAR(64) PRIMARY KEY,
    tag_zh VARCHAR(64) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cf_problems_rating ON cf_problems(rating);
CREATE INDEX IF NOT EXISTS idx_cf_problems_tags ON cf_problems USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_cf_contests_start ON cf_contests(start_time);

-- Migration 002: Review & Social tables (in code as migration002)
