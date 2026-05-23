package db

var migration001 = `
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
`

var migration002 = `
CREATE TABLE IF NOT EXISTS review_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform VARCHAR(32) NOT NULL,
    contest_id VARCHAR(64) NOT NULL,
    contest_name TEXT NOT NULL DEFAULT '',
    contest_url TEXT DEFAULT '',
    problem_index VARCHAR(8) NOT NULL,
    problem_name TEXT NOT NULL DEFAULT '',
    problem_url TEXT DEFAULT '',
    custom_tags TEXT[] NOT NULL DEFAULT '{}',
    status VARCHAR(16) NOT NULL DEFAULT 'unsolved',
    solution_url TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_user_id ON review_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_review_user_tags ON review_entries USING GIN(custom_tags);
CREATE INDEX IF NOT EXISTS idx_review_status ON review_entries(user_id, status);
CREATE INDEX IF NOT EXISTS idx_review_completed ON review_entries(user_id, completed_at);

CREATE TABLE IF NOT EXISTS follows (
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    followee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (follower_id, followee_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_followee ON follows(followee_id);

CREATE TABLE IF NOT EXISTS daily_problems (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    review_entry_id UUID NOT NULL REFERENCES review_entries(id) ON DELETE CASCADE,
    recommended_at DATE NOT NULL DEFAULT CURRENT_DATE,
    completed BOOLEAN DEFAULT false,
    UNIQUE(user_id, recommended_at)
);

CREATE TABLE IF NOT EXISTS cf_submissions (
    id BIGINT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contest_id INTEGER,
    problem_index VARCHAR(4),
    verdict VARCHAR(32),
    submitted_at TIMESTAMPTZ,
    programming_language VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_submissions_user ON cf_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_date ON cf_submissions(user_id, submitted_at);
`

var migration003 = `
CREATE TABLE IF NOT EXISTS friend_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(sender_id, receiver_id)
);

CREATE INDEX IF NOT EXISTS idx_fr_receiver ON friend_requests(receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_fr_sender ON friend_requests(sender_id, status);
`

var migration004 = `
CREATE TABLE IF NOT EXISTS user_contests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform VARCHAR(32) NOT NULL,
    contest_id VARCHAR(64) NOT NULL,
    contest_name TEXT NOT NULL DEFAULT '',
    contest_url TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, platform, contest_id)
);

CREATE INDEX IF NOT EXISTS idx_uc_user ON user_contests(user_id);
`

var migration005 = `
-- Create new relationships table
CREATE TABLE IF NOT EXISTS relationships (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(16) NOT NULL DEFAULT 'following',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, target_id),
    CHECK (user_id != target_id)
);

CREATE INDEX IF NOT EXISTS idx_rel_target ON relationships(target_id, type);
CREATE INDEX IF NOT EXISTS idx_rel_user ON relationships(user_id, type);

-- Migrate existing follows data as 'following'
INSERT INTO relationships (user_id, target_id, type, created_at)
SELECT follower_id, followee_id, 'following', created_at
FROM follows
ON CONFLICT DO NOTHING;

-- Migrate accepted friend_requests as 'friend' (bidirectional)
INSERT INTO relationships (user_id, target_id, type, created_at)
SELECT fr.sender_id, fr.receiver_id, 'friend', fr.updated_at
FROM friend_requests fr
WHERE fr.status = 'accepted'
ON CONFLICT DO NOTHING;

INSERT INTO relationships (user_id, target_id, type, created_at)
SELECT fr.receiver_id, fr.sender_id, 'friend', fr.updated_at
FROM friend_requests fr
WHERE fr.status = 'accepted'
ON CONFLICT DO NOTHING;

-- Clean up friend_requests: delete rejected, keep only pending
DELETE FROM friend_requests WHERE status != 'pending';

-- Drop old follows table
DROP TABLE IF EXISTS follows;

-- Recreate friend_requests without status column (only pending now)
-- We keep the table but remove the check constraint since we only store pending
ALTER TABLE friend_requests DROP CONSTRAINT IF EXISTS friend_requests_status_check;
`

var migration006 = `
UPDATE review_entries re SET contest_url = uc.contest_url
FROM user_contests uc
WHERE re.user_id = uc.user_id AND re.platform = uc.platform AND re.contest_id = uc.contest_id
AND (re.contest_url IS NULL OR re.contest_url = '')
AND uc.contest_url IS NOT NULL AND uc.contest_url != '';
`
