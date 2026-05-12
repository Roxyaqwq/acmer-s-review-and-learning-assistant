package handlers

import (
	"time"

	"algoarena/internal/models"
	"algoarena/internal/services"
	"algoarena/internal/utils"

	"github.com/gofiber/fiber/v2"
	"github.com/jmoiron/sqlx"
)

type UserHandler struct{ DB *sqlx.DB }

func (h *UserHandler) GetPublicProfile(c *fiber.Ctx) error {
	id := c.Params("id")
	currentUID := ""
	if uid, ok := c.Locals("user_id").(string); ok {
		currentUID = uid
	}

	var user models.User
	err := h.DB.Get(&user, `
		SELECT id, github_login, github_avatar_url, cf_handle, cf_rating, cf_max_rating, cf_rank,
			nickname, signature, avatar_url, background_url, allow_view_review, created_at, updated_at
		FROM users WHERE id = $1
	`, id)
	if err != nil {
		return utils.Error(c, 404, "用户不存在")
	}

	var followerCount, followingCount int
	h.DB.Get(&followerCount, `SELECT COUNT(*) FROM relationships WHERE target_id = $1 AND type IN ('following', 'friend')`, id)
	h.DB.Get(&followingCount, `SELECT COUNT(*) FROM relationships WHERE user_id = $1 AND type IN ('following', 'friend')`, id)

	tagStats, _ := services.GetTopTags(h.DB, id, 3)
	topTags := make([]string, len(tagStats))
	for i, s := range tagStats {
		topTags[i] = s.Tag
	}

	relationship := fiber.Map{
		"is_following":    false,
		"is_friend":       false,
		"pending_request": "none",
	}
	if currentUID != "" && currentUID != id {
		var followingCnt int
		h.DB.Get(&followingCnt, `SELECT COUNT(*) FROM relationships WHERE user_id = $1 AND target_id = $2 AND type = 'following'`, currentUID, id)
		var friendCnt int
		h.DB.Get(&friendCnt, `SELECT COUNT(*) FROM relationships WHERE user_id = $1 AND target_id = $2 AND type = 'friend'`, currentUID, id)

		pending := "none"
		var outCnt int
		h.DB.Get(&outCnt, `SELECT COUNT(*) FROM friend_requests WHERE sender_id = $1 AND receiver_id = $2 AND status = 'pending'`, currentUID, id)
		if outCnt > 0 {
			pending = "outgoing"
		} else {
			var inCnt int
			h.DB.Get(&inCnt, `SELECT COUNT(*) FROM friend_requests WHERE sender_id = $1 AND receiver_id = $2 AND status = 'pending'`, id, currentUID)
			if inCnt > 0 {
				pending = "incoming"
			}
		}

		relationship = fiber.Map{
			"is_following":    followingCnt > 0,
			"is_friend":       friendCnt > 0,
			"pending_request": pending,
		}
	}

	return utils.Success(c, fiber.Map{
		"user":           user,
		"follower_count": followerCount,
		"following_count": followingCount,
		"top_tags":       topTags,
		"relationship":   relationship,
	})
}

func (h *UserHandler) GetHeatmap(c *fiber.Ctx) error {
	id := c.Params("id")

	var cfDays []models.HeatmapDay
	var reviewDays []models.HeatmapDay

	h.DB.Select(&cfDays, `
		SELECT submitted_at::date as submission_date, COUNT(*) as submission_count
		FROM cf_submissions WHERE user_id = $1
		GROUP BY submitted_at::date
		ORDER BY submission_date DESC
		LIMIT 365
	`, id)

	h.DB.Select(&reviewDays, `
		SELECT created_at::date as submission_date, COUNT(*) as submission_count
		FROM review_entries WHERE user_id = $1
		GROUP BY created_at::date
		ORDER BY submission_date DESC
		LIMIT 365
	`, id)

	merged := make(map[string]int)
	for _, d := range cfDays {
		merged[d.Date] += d.Count
	}
	for _, d := range reviewDays {
		merged[d.Date] += d.Count
	}

	type Day struct {
		Date  string `json:"date"`
		Count int    `json:"count"`
	}
	result := make([]Day, 0, len(merged))
	for date, count := range merged {
		result = append(result, Day{Date: date, Count: count})
	}

	return utils.Success(c, result)
}

// GetStats — GET /users/:id/stats
// Returns review entry statistics for a user.
func (h *UserHandler) GetStats(c *fiber.Ctx) error {
	id := c.Params("id")

	type TagCount struct {
		Tag   string `json:"tag" db:"tag"`
		Count int    `json:"count" db:"count"`
	}

	type PlatformCount struct {
		Platform string `json:"platform" db:"platform"`
		Count    int    `json:"count" db:"count"`
	}

	// Total counts
	var totalSolved, totalAttempted, totalEntries int
	h.DB.Get(&totalSolved, `SELECT COUNT(*) FROM review_entries WHERE user_id = $1 AND status = 'solved'`, id)
	h.DB.Get(&totalAttempted, `SELECT COUNT(*) FROM review_entries WHERE user_id = $1 AND status = 'attempted'`, id)
	h.DB.Get(&totalEntries, `SELECT COUNT(*) FROM review_entries WHERE user_id = $1`, id)

	// Platform breakdown
	var platforms []PlatformCount
	h.DB.Select(&platforms, `
		SELECT platform, COUNT(*) as count FROM review_entries
		WHERE user_id = $1 AND status = 'solved'
		GROUP BY platform ORDER BY count DESC
	`, id)
	if platforms == nil {
		platforms = []PlatformCount{}
	}

	// Top tags (solved entries)
	var topTags []TagCount
	h.DB.Select(&topTags, `
		SELECT unnest(custom_tags) AS tag, COUNT(*) AS count
		FROM review_entries WHERE user_id = $1 AND status = 'solved'
		GROUP BY tag ORDER BY count DESC LIMIT 10
	`, id)
	if topTags == nil {
		topTags = []TagCount{}
	}

	// Recent solves (last 7 days)
	var recentSolves int
	h.DB.Get(&recentSolves, `
		SELECT COUNT(*) FROM review_entries
		WHERE user_id = $1 AND status = 'solved' AND completed_at > NOW() - INTERVAL '7 days'
	`, id)

	// Streak: consecutive days with at least one solve
	type DateRow struct {
		Date string `db:"d"`
	}
	var dates []DateRow
	h.DB.Select(&dates, `
		SELECT DISTINCT completed_at::date AS d FROM review_entries
		WHERE user_id = $1 AND status = 'solved' AND completed_at IS NOT NULL
		ORDER BY d DESC LIMIT 100
	`, id)

	streak := 0
	if len(dates) > 0 {
		// Check if today or yesterday has a solve (to count an active streak)
		today := time.Now().UTC().Format("2006-01-02")
		yesterday := time.Now().UTC().AddDate(0, 0, -1).Format("2006-01-02")
		if dates[0].Date == today || dates[0].Date == yesterday {
			streak = 1
			for i := 1; i < len(dates); i++ {
				prev := dates[i-1].Date
				curr := dates[i].Date
				// Check if curr is exactly 1 day before prev
				t, _ := time.Parse("2006-01-02", prev)
				expected := t.AddDate(0, 0, -1).Format("2006-01-02")
				if curr == expected {
					streak++
				} else {
					break
				}
			}
		}
	}

	return utils.Success(c, fiber.Map{
		"total_solved":    totalSolved,
		"total_attempted": totalAttempted,
		"total_entries":   totalEntries,
		"platforms":       platforms,
		"top_tags":        topTags,
		"recent_solves":   recentSolves,
		"streak_days":     streak,
	})
}

func (h *UserHandler) Search(c *fiber.Ctx) error {
	q := c.Query("q")
	if q == "" {
		return utils.Success(c, []interface{}{})
	}

	var users []models.UserPublic
	h.DB.Select(&users, `
		SELECT id, nickname, cf_handle, cf_rating, cf_max_rating, cf_rank, signature, avatar_url, background_url, created_at
		FROM users WHERE cf_handle ILIKE $1 OR github_login ILIKE $1 OR nickname ILIKE $1
		LIMIT 20
	`, "%"+q+"%")
	return utils.Success(c, users)
}
