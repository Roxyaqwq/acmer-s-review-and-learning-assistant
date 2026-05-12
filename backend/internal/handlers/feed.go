package handlers

import (
	"time"

	"algoarena/internal/utils"

	"github.com/gofiber/fiber/v2"
	"github.com/jmoiron/sqlx"
)

type FeedHandler struct{ DB *sqlx.DB }

type FeedItem struct {
	Type      string      `json:"type"` // "solve" or "cf_accept"
	User      FeedUser    `json:"user"`
	Detail    interface{} `json:"detail"`
	CreatedAt time.Time   `json:"created_at"`
}

type FeedUser struct {
	ID        string  `json:"id"`
	Nickname  *string `json:"nickname"`
	CFHandle  *string `json:"cf_handle"`
	AvatarURL string  `json:"avatar_url"`
}

type SolveDetail struct {
	Platform     string   `json:"platform"`
	ContestID    string   `json:"contest_id"`
	ProblemIndex string   `json:"problem_index"`
	ProblemName  string   `json:"problem_name"`
	Tags         []string `json:"tags"`
}

type CFAcceptDetail struct {
	ContestID    int    `json:"contest_id"`
	ProblemIndex string `json:"problem_index"`
	Language     string `json:"language"`
}

// GetFeed — GET /feed/
// Returns recent activities from users the current user follows or is friends with.
func (h *FeedHandler) GetFeed(c *fiber.Ctx) error {
	uid := c.Locals("user_id").(string)

	// Get IDs of users I follow or am friends with
	var relatedIDs []string
	err := h.DB.Select(&relatedIDs, `
		SELECT target_id FROM relationships WHERE user_id = $1 AND type IN ('following', 'friend')
	`, uid)
	if err != nil || len(relatedIDs) == 0 {
		return utils.Success(c, []FeedItem{})
	}

	// Recent solves from review_entries (last 7 days)
	type reviewRow struct {
		UserID       string    `db:"user_id"`
		Nickname     *string   `db:"nickname"`
		CFHandle     *string   `db:"cf_handle"`
		AvatarURL    string    `db:"avatar_url"`
		Platform     string    `db:"platform"`
		ContestID    string    `db:"contest_id"`
		ProblemIndex string    `db:"problem_index"`
		ProblemName  string    `db:"problem_name"`
		Tags         []string  `db:"tags"`
		CompletedAt  time.Time `db:"completed_at"`
	}

	var reviewSolves []reviewRow
	h.DB.Select(&reviewSolves, `
		SELECT re.user_id, u.nickname, u.cf_handle, u.avatar_url,
			re.platform, re.contest_id, re.problem_index, re.problem_name, re.custom_tags AS tags, re.completed_at
		FROM review_entries re
		JOIN users u ON re.user_id = u.id
		WHERE re.user_id = ANY($1)
			AND re.status = 'solved'
			AND re.completed_at IS NOT NULL
			AND re.completed_at > NOW() - INTERVAL '7 days'
		ORDER BY re.completed_at DESC
		LIMIT 50
	`, relatedIDs)

	items := make([]FeedItem, 0, len(reviewSolves))
	for _, r := range reviewSolves {
		items = append(items, FeedItem{
			Type: "solve",
			User: FeedUser{ID: r.UserID, Nickname: r.Nickname, CFHandle: r.CFHandle, AvatarURL: r.AvatarURL},
			Detail: SolveDetail{
				Platform: r.Platform, ContestID: r.ContestID,
				ProblemIndex: r.ProblemIndex, ProblemName: r.ProblemName, Tags: r.Tags,
			},
			CreatedAt: r.CompletedAt,
		})
	}

	// Recent CF AC submissions (last 7 days, deduplicated by contest+problem)
	type cfRow struct {
		UserID       string    `db:"user_id"`
		Nickname     *string   `db:"nickname"`
		CFHandle     *string   `db:"cf_handle"`
		AvatarURL    string    `db:"avatar_url"`
		ContestID    int       `db:"contest_id"`
		ProblemIndex string    `db:"problem_index"`
		Language     string    `db:"programming_language"`
		SubmittedAt  time.Time `db:"submitted_at"`
	}

	var cfAccepts []cfRow
	h.DB.Select(&cfAccepts, `
		SELECT DISTINCT ON (cs.user_id, cs.contest_id, cs.problem_index)
			cs.user_id, u.nickname, u.cf_handle, u.avatar_url,
			cs.contest_id, cs.problem_index, cs.programming_language, cs.submitted_at
		FROM cf_submissions cs
		JOIN users u ON cs.user_id = u.id
		WHERE cs.user_id = ANY($1)
			AND cs.verdict = 'OK'
			AND cs.submitted_at > NOW() - INTERVAL '7 days'
		ORDER BY cs.user_id, cs.contest_id, cs.problem_index, cs.submitted_at DESC
		LIMIT 50
	`, relatedIDs)

	for _, r := range cfAccepts {
		items = append(items, FeedItem{
			Type: "cf_accept",
			User: FeedUser{ID: r.UserID, Nickname: r.Nickname, CFHandle: r.CFHandle, AvatarURL: r.AvatarURL},
			Detail: CFAcceptDetail{
				ContestID: r.ContestID, ProblemIndex: r.ProblemIndex, Language: r.Language,
			},
			CreatedAt: r.SubmittedAt,
		})
	}

	// Sort all items by time descending (simple insertion since already mostly sorted)
	for i := 1; i < len(items); i++ {
		j := i
		for j > 0 && items[j].CreatedAt.After(items[j-1].CreatedAt) {
			items[j], items[j-1] = items[j-1], items[j]
			j--
		}
	}

	// Limit to 50
	if len(items) > 50 {
		items = items[:50]
	}

	return utils.Success(c, items)
}
