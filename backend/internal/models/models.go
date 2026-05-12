package models

import (
	"time"
	"github.com/lib/pq"
)

type User struct {
	ID            string         `json:"id" db:"id"`
	GithubID      int64          `json:"github_id" db:"github_id"`
	GithubLogin   string         `json:"github_login" db:"github_login"`
	GithubAvatar  string         `json:"github_avatar_url" db:"github_avatar_url"`
	CFHandle      *string        `json:"cf_handle" db:"cf_handle"`
	CFRating      int            `json:"cf_rating" db:"cf_rating"`
	CFMaxRating   int            `json:"cf_max_rating" db:"cf_max_rating"`
	CFRank        string         `json:"cf_rank" db:"cf_rank"`
	Nickname      *string        `json:"nickname" db:"nickname"`
	Signature     string         `json:"signature" db:"signature"`
	AvatarURL     string         `json:"avatar_url" db:"avatar_url"`
	BackgroundURL string         `json:"background_url" db:"background_url"`
	Role          string         `json:"role" db:"role"`
	AllowViewReview bool         `json:"allow_view_review" db:"allow_view_review"`
	CreatedAt     time.Time      `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at" db:"updated_at"`
	FollowerCount int            `json:"follower_count,omitempty" db:"-"`
	FollowingCount int           `json:"following_count,omitempty" db:"-"`
	TopTags       []string       `json:"top_tags,omitempty" db:"-"`
	TagStats      []TagStat      `json:"tag_stats,omitempty" db:"-"`
}

type UserPublic struct {
	ID            string  `json:"id"`
	Nickname      string  `json:"nickname"`
	CFHandle      *string `json:"cf_handle"`
	CFRating      int     `json:"cf_rating"`
	CFMaxRating   int     `json:"cf_max_rating"`
	CFRank        string  `json:"cf_rank"`
	Signature     string  `json:"signature"`
	AvatarURL     string  `json:"avatar_url"`
	BackgroundURL string  `json:"background_url"`
	CreatedAt     time.Time `json:"created_at"`
	FollowerCount int     `json:"follower_count"`
	FollowingCount int    `json:"following_count"`
	TopTags       []string `json:"top_tags,omitempty"`
}

type UserUpdate struct {
	Nickname        *string `json:"nickname"`
	Signature       *string `json:"signature"`
	AvatarURL       *string `json:"avatar_url"`
	BackgroundURL   *string `json:"background_url"`
	AllowViewReview *bool   `json:"allow_view_review"`
}

type TagStat struct {
	Tag          string `json:"tag" db:"tag"`
	TotalCount   int    `json:"total_count" db:"total_count"`
	CompletedCount int  `json:"completed_count" db:"completed_count"`
}

type CFProblem struct {
	ContestID    int            `json:"contest_id" db:"contest_id"`
	ProblemIndex string         `json:"problem_index" db:"problem_index"`
	Name         string         `json:"name" db:"name"`
	Rating       int            `json:"rating" db:"rating"`
	Tags         pq.StringArray `json:"tags" db:"tags"`
	SolvedCount  int            `json:"solved_count" db:"solved_count"`
}

type CFContest struct {
	ID              int       `json:"id" db:"id"`
	Name            string    `json:"name" db:"name"`
	ContestType     string    `json:"contest_type" db:"contest_type"`
	Phase           string    `json:"phase" db:"phase"`
	DurationSeconds int       `json:"duration_seconds" db:"duration_seconds"`
	StartTime       *time.Time `json:"start_time" db:"start_time"`
	UpdatedAt       time.Time `json:"updated_at" db:"updated_at"`
}

type ReviewEntry struct {
	ID           string         `json:"id" db:"id"`
	UserID       string         `json:"user_id" db:"user_id"`
	Platform     string         `json:"platform" db:"platform"`
	ContestID    string         `json:"contest_id" db:"contest_id"`
	ContestName  string         `json:"contest_name" db:"contest_name"`
	ContestURL   string         `json:"contest_url" db:"contest_url"`
	ProblemIndex string         `json:"problem_index" db:"problem_index"`
	ProblemName  string         `json:"problem_name" db:"problem_name"`
	ProblemURL   string         `json:"problem_url" db:"problem_url"`
	CustomTags   pq.StringArray `json:"custom_tags" db:"custom_tags"`
	Status       string         `json:"status" db:"status"`
	SolutionURL  string         `json:"solution_url" db:"solution_url"`
	Notes        string         `json:"notes" db:"notes"`
	CreatedAt    time.Time      `json:"created_at" db:"created_at"`
	CompletedAt  *time.Time     `json:"completed_at" db:"completed_at"`
	UpdatedAt    time.Time      `json:"updated_at" db:"updated_at"`
}

type ReviewEntryCreate struct {
	Platform     string   `json:"platform"`
	ContestID    string   `json:"contest_id"`
	ContestName  string   `json:"contest_name"`
	ContestURL   string   `json:"contest_url"`
	ProblemIndex string   `json:"problem_index"`
	ProblemName  string   `json:"problem_name"`
	ProblemURL   string   `json:"problem_url"`
	CustomTags   []string `json:"custom_tags"`
	Status       string   `json:"status"`
	SolutionURL  string   `json:"solution_url"`
	Notes        string   `json:"notes"`
}

type ReviewEntryUpdate struct {
	Status      *string  `json:"status"`
	SolutionURL *string  `json:"solution_url"`
	Notes       *string  `json:"notes"`
	CustomTags  []string `json:"custom_tags,omitempty"`
}

type DailyProblem struct {
	ID            string    `json:"id" db:"id"`
	UserID        string    `json:"user_id" db:"user_id"`
	ReviewEntryID string    `json:"review_entry_id" db:"review_entry_id"`
	RecommendedAt string    `json:"recommended_at" db:"recommended_at"`
	Completed     bool      `json:"completed" db:"completed"`
	ReviewEntry   *ReviewEntry `json:"review_entry,omitempty" db:"-"`
}

type CFSubmission struct {
	ID            int64     `json:"id" db:"id"`
	UserID        string    `json:"user_id" db:"user_id"`
	ContestID     int       `json:"contest_id" db:"contest_id"`
	ProblemIndex  string    `json:"problem_index" db:"problem_index"`
	Verdict       string    `json:"verdict" db:"verdict"`
	SubmittedAt   time.Time `json:"submitted_at" db:"submitted_at"`
	Language      string    `json:"programming_language" db:"programming_language"`
}

type Relationship struct {
	UserID    string    `json:"user_id" db:"user_id"`
	TargetID  string    `json:"target_id" db:"target_id"`
	Type      string    `json:"type" db:"type"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

type RelationshipStatus struct {
	IsFollowing    bool   `json:"is_following"`
	IsFriend       bool   `json:"is_friend"`
	PendingRequest string `json:"pending_request"` // "none" | "incoming" | "outgoing"
}

type TagTranslation struct {
	TagKey string `json:"tag_key" db:"tag_key"`
	TagZh  string `json:"tag_zh" db:"tag_zh"`
}

type PlatformContest struct {
	Platform     string `json:"platform"`
	ContestID    string `json:"contest_id"`
	ContestName  string `json:"contest_name"`
	StartTime    string `json:"start_time"`
	EndTime      string `json:"end_time"`
	Duration     int    `json:"duration"`
	URL          string `json:"url"`
}

type HeatmapDay struct {
	Date  string `json:"date" db:"submission_date"`
	Count int    `json:"count" db:"submission_count"`
}

type UserContest struct {
	ID          string    `json:"id" db:"id"`
	UserID      string    `json:"user_id" db:"user_id"`
	Platform    string    `json:"platform" db:"platform"`
	ContestID   string    `json:"contest_id" db:"contest_id"`
	ContestName string    `json:"contest_name" db:"contest_name"`
	ContestURL  string    `json:"contest_url" db:"contest_url"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

type UserContestCreate struct {
	Platform    string `json:"platform"`
	ContestID   string `json:"contest_id"`
	ContestName string `json:"contest_name"`
	ContestURL  string `json:"contest_url"`
}
