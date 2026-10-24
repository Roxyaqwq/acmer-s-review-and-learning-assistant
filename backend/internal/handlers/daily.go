package handlers

import (
	"database/sql"
	"errors"
	"time"

	"algoarena/internal/models"
	"algoarena/internal/services"
	"algoarena/internal/utils"

	"github.com/gofiber/fiber/v2"
	"github.com/jmoiron/sqlx"
)

const (
	defaultCooldownDays = 7
	minCooldownDays     = 3
	maxCooldownDays     = 60

	// maxDailySwaps is how many fresh picks a user may ask for per day. This
	// used to be a browser counter, so it reset with localStorage.
	maxDailySwaps = 2
)

type DailyHandler struct{ DB *sqlx.DB }

// dailyDate is "today" in the learning timezone. A daily row is identified by
// this date, so it must not come from the database session timezone (UTC) or
// from the browser, or the pick flips over at the wrong moment.
func dailyDate(now time.Time) string {
	return now.In(activityLocation).Format("2006-01-02")
}

func clampCooldownDays(days int) int {
	if days < minCooldownDays {
		return minCooldownDays
	}
	if days > maxCooldownDays {
		return maxCooldownDays
	}
	return days
}

func swapsLeft(skipped int) int {
	if skipped < 0 {
		skipped = 0
	}
	left := maxDailySwaps - skipped
	if left < 0 {
		return 0
	}
	return left
}

// dailyRow reads the day's row, returning nil when it does not exist yet.
// recommended_at goes through to_char because scanning a DATE into a string
// yields a timestamp ("2026-10-23T00:00:00Z"), not the date the client keys on.
func (h *DailyHandler) dailyRow(userID, day string) (*models.DailyProblem, error) {
	var row models.DailyProblem
	err := h.DB.Get(&row, `
		SELECT id, user_id, review_entry_id,
		       to_char(recommended_at, 'YYYY-MM-DD') AS recommended_at,
		       COALESCE(completed, false) AS completed,
		       skipped, cooldown_days, seen_ids
		FROM daily_problems
		WHERE user_id = $1 AND recommended_at = $2::date
	`, userID, day)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func (h *DailyHandler) isSolved(userID, entryID string) (*models.ReviewEntry, error) {
	var entry models.ReviewEntry
	err := h.DB.Get(&entry, `
		SELECT * FROM review_entries WHERE id = $1 AND user_id = $2
	`, entryID, userID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &entry, nil
}

func (h *DailyHandler) pickOne(userID string, cooldownDays int, exclude []string) (*models.ReviewEntry, error) {
	entries, err := services.GetDailyRecommendation(h.DB, userID, cooldownDays, exclude)
	if err != nil || len(entries) == 0 {
		return nil, err
	}
	return &entries[0], nil
}

// ensureToday returns today's row, creating it on first visit. The pick used to
// be recomputed on every request, so refreshing the page rerolled the problem.
func (h *DailyHandler) ensureToday(userID, day string, cooldownDays int) (*models.DailyProblem, error) {
	row, err := h.dailyRow(userID, day)
	if err != nil {
		return nil, err
	}
	if row != nil {
		// Changing the cooldown should take effect immediately, but only while
		// the pick is still the untouched first one of the day.
		shouldRepick := row.CooldownDays != cooldownDays && row.Skipped == 0 && !row.Completed
		if !shouldRepick {
			return row, nil
		}
		entry, err := h.pickOne(userID, cooldownDays, row.SeenIDs)
		if err != nil {
			return nil, err
		}
		if entry != nil {
			if _, err := h.DB.Exec(`
				UPDATE daily_problems SET review_entry_id = $1, cooldown_days = $2 WHERE id = $3
			`, entry.ID, cooldownDays, row.ID); err != nil {
				return nil, err
			}
			return h.dailyRow(userID, day)
		}
		return row, nil
	}

	entry, err := h.pickOne(userID, cooldownDays, nil)
	if err != nil {
		return nil, err
	}
	if entry == nil {
		return nil, nil
	}

	// Two tabs can race to create the row; the unique index makes the loser a
	// no-op and both end up reading the same pick.
	if _, err := h.DB.Exec(`
		INSERT INTO daily_problems (user_id, review_entry_id, recommended_at, cooldown_days)
		VALUES ($1, $2, $3::date, $4)
		ON CONFLICT (user_id, recommended_at) DO NOTHING
	`, userID, entry.ID, day, cooldownDays); err != nil {
		return nil, err
	}
	return h.dailyRow(userID, day)
}

func dailyPayload(row *models.DailyProblem, entry *models.ReviewEntry, day string) fiber.Map {
	payload := fiber.Map{
		"problem":        entry,
		"completed":      row.Completed,
		"swaps_left":     swapsLeft(row.Skipped),
		"recommended_at": day,
		"cooldown_days":  row.CooldownDays,
	}
	if entry == nil {
		payload["message"] = "请先在补题模块添加题目"
	}
	return payload
}

func (h *DailyHandler) GetToday(c *fiber.Ctx) error {
	uid := c.Locals("user_id").(string)
	cooldownDays := clampCooldownDays(c.QueryInt("cooldown_days", defaultCooldownDays))
	day := dailyDate(time.Now())

	row, err := h.ensureToday(uid, day, cooldownDays)
	if err != nil {
		return utils.Error(c, 500, "操作失败")
	}
	if row == nil {
		return utils.Success(c, fiber.Map{
			"problem":        nil,
			"message":        "请先在补题模块添加题目",
			"swaps_left":     maxDailySwaps,
			"recommended_at": day,
			"cooldown_days":  cooldownDays,
		})
	}

	entry, err := h.isSolved(uid, row.ReviewEntryID)
	if err != nil {
		return utils.Error(c, 500, "操作失败")
	}
	return utils.Success(c, dailyPayload(row, entry, day))
}

// Swap trades today's pick for another one, up to maxDailySwaps times. The
// entries already shown are remembered on the row so a swap never repeats one.
func (h *DailyHandler) Swap(c *fiber.Ctx) error {
	uid := c.Locals("user_id").(string)
	cooldownDays := clampCooldownDays(c.QueryInt("cooldown_days", defaultCooldownDays))
	day := dailyDate(time.Now())

	row, err := h.ensureToday(uid, day, cooldownDays)
	if err != nil {
		return utils.Error(c, 500, "操作失败")
	}
	if row == nil {
		return utils.Error(c, 400, "请先在补题模块添加题目")
	}
	if row.Completed {
		return utils.Error(c, 400, "今天这道已经做完了")
	}
	if swapsLeft(row.Skipped) == 0 {
		return utils.Error(c, 400, "今天的换题次数用完了")
	}

	exclude := make([]string, 0, len(row.SeenIDs)+1)
	exclude = append(exclude, row.SeenIDs...)
	exclude = append(exclude, row.ReviewEntryID)

	next, err := h.pickOne(uid, row.CooldownDays, exclude)
	if err != nil {
		return utils.Error(c, 500, "操作失败")
	}
	if next == nil {
		return utils.Error(c, 400, "暂时没有别的题目了")
	}

	if _, err := h.DB.Exec(`
		UPDATE daily_problems
		SET review_entry_id = $1, skipped = skipped + 1, seen_ids = array_append(seen_ids, $2)
		WHERE id = $3
	`, next.ID, row.ReviewEntryID, row.ID); err != nil {
		return utils.Error(c, 500, "操作失败")
	}

	updated, err := h.dailyRow(uid, day)
	if err != nil || updated == nil {
		return utils.Error(c, 500, "操作失败")
	}
	return utils.Success(c, dailyPayload(updated, next, day))
}

func (h *DailyHandler) MarkComplete(c *fiber.Ctx) error {
	uid := c.Locals("user_id").(string)
	id := c.Params("id") // id 为 review_entry_id
	day := dailyDate(time.Now())

	tx, err := h.DB.Beginx()
	if err != nil {
		return utils.Error(c, 500, "操作失败")
	}
	defer tx.Rollback()

	// 先更新 review_entries 并校验存在性
	res, err := tx.Exec(`
		UPDATE review_entries SET status = 'solved', completed_at = NOW(), updated_at = NOW()
		WHERE id = $1 AND user_id = $2 AND status != 'solved'
	`, id, uid)
	if err != nil {
		return utils.Error(c, 500, "操作失败")
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		var cnt int
		tx.Get(&cnt, `SELECT COUNT(*) FROM review_entries WHERE id = $1 AND user_id = $2`, id, uid)
		if cnt == 0 {
			return utils.Error(c, 404, "题目不存在")
		}
	}

	// The date is passed explicitly: relying on the column default meant the row
	// landed on the database's CURRENT_DATE, which is UTC, so anything finished
	// between 00:00 and 08:00 was filed under yesterday.
	_, err = tx.Exec(`
		INSERT INTO daily_problems (user_id, review_entry_id, recommended_at, completed)
		VALUES ($1, $2, $3::date, true)
		ON CONFLICT (user_id, recommended_at) DO UPDATE
		SET completed = true, review_entry_id = EXCLUDED.review_entry_id
	`, uid, id, day)
	if err != nil {
		return utils.Error(c, 500, "操作失败")
	}

	if err := tx.Commit(); err != nil {
		return utils.Error(c, 500, "操作失败")
	}
	return utils.Success(c, nil)
}
