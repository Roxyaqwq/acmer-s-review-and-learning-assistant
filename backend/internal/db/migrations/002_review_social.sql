-- Review entries
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

-- Follows
CREATE TABLE IF NOT EXISTS follows (
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    followee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (follower_id, followee_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_followee ON follows(followee_id);

-- Daily problem
CREATE TABLE IF NOT EXISTS daily_problems (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    review_entry_id UUID NOT NULL REFERENCES review_entries(id) ON DELETE CASCADE,
    recommended_at DATE NOT NULL DEFAULT CURRENT_DATE,
    completed BOOLEAN DEFAULT false,
    UNIQUE(user_id, recommended_at)
);

-- Submissions (from CF API)
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
