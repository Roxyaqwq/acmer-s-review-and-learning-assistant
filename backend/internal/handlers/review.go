package handlers

import (
	"fmt"
	"strings"
	"time"

	"algoarena/internal/models"
	"algoarena/internal/services"
	"algoarena/internal/utils"

	"github.com/gofiber/fiber/v2"
	"github.com/jmoiron/sqlx"
	"github.com/lib/pq"
)

type ReviewHandler struct {
	DB *sqlx.DB
}

func (h *ReviewHandler) List(c *fiber.Ctx) error {
	uid := c.Locals("user_id").(string)
	tag := c.Query("tag")
	status := c.Query("status")
	platform := c.Query("platform")
	page := c.QueryInt("page", 1)
	limit := c.QueryInt("limit", 50)
	if limit > 100 { limit = 100 }
	if page < 1 { page = 1 }
	offset := (page - 1) * limit

	sql := `SELECT * FROM review_entries WHERE user_id = $1`
	args := []interface{}{uid}
	argIdx := 2

	if tag != "" {
		sql += fmt.Sprintf(" AND $%d = ANY(custom_tags)", argIdx)
		args = append(args, tag)
		argIdx++
	}
	if status != "" {
		sql += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, status)
		argIdx++
	}
	if platform != "" {
		sql += fmt.Sprintf(" AND platform = $%d", argIdx)
		args = append(args, platform)
		argIdx++
	}

	var total int
	countSQL := `SELECT COUNT(*) ` + strings.Replace(sql, "SELECT *", "", 1)
	h.DB.Get(&total, countSQL, args...)

	sql += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, limit, offset)

	var entries []models.ReviewEntry
	err := h.DB.Select(&entries, sql, args...)
	if err != nil {
		return utils.Error(c, 500, "query failed")
	}
	return utils.Success(c, fiber.Map{
		"items": entries,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

func (h *ReviewHandler) Get(c *fiber.Ctx) error {
	uid := c.Locals("user_id").(string)
	id := c.Params("id")

	var entry models.ReviewEntry
	err := h.DB.Get(&entry, `SELECT * FROM review_entries WHERE id = $1 AND user_id = $2`, id, uid)
	if err != nil {
		return utils.Error(c, 404, "not found")
	}
	return utils.Success(c, entry)
}

func (h *ReviewHandler) Create(c *fiber.Ctx) error {
	uid := c.Locals("user_id").(string)
	var body models.ReviewEntryCreate
	if err := c.BodyParser(&body); err != nil {
		return utils.Error(c, 400, "invalid body")
	}

	if body.Platform == "" || body.ContestID == "" || body.ProblemIndex == "" {
		return utils.Error(c, 400, "platform, contest_id, problem_index are required")
	}
	if len(body.CustomTags) == 0 {
		return utils.Error(c, 400, "至少需要选择一个题型标签")
	}

	var entry models.ReviewEntry
	err := h.DB.Get(&entry, `
		INSERT INTO review_entries (user_id, platform, contest_id, contest_name, contest_url,
			problem_index, problem_name, problem_url, custom_tags, status, solution_url, notes)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING *
	`, uid, body.Platform, body.ContestID, body.ContestName, body.ContestURL,
		body.ProblemIndex, body.ProblemName, body.ProblemURL, pq.Array(body.CustomTags),
		body.Status, body.SolutionURL, body.Notes)
	if err != nil {
		return utils.Error(c, 500, "create failed")
	}
	return utils.Success(c, entry)
}

func (h *ReviewHandler) Update(c *fiber.Ctx) error {
	uid := c.Locals("user_id").(string)
	id := c.Params("id")

	var body models.ReviewEntryUpdate
	if err := c.BodyParser(&body); err != nil {
		return utils.Error(c, 400, "invalid body")
	}

	now := time.Now()
	var completedAt *time.Time

	if body.Status != nil && *body.Status == "solved" {
		completedAt = &now
	}

	var entry models.ReviewEntry
	if len(body.CustomTags) > 0 {
		err := h.DB.Get(&entry, `
			UPDATE review_entries SET
				status = COALESCE($1, status),
				solution_url = COALESCE($2, solution_url),
				notes = COALESCE($3, notes),
				custom_tags = $7,
				completed_at = CASE WHEN $1 = 'solved' AND completed_at IS NULL THEN $4 ELSE completed_at END,
				updated_at = NOW()
			WHERE id = $5 AND user_id = $6
			RETURNING *
		`, body.Status, body.SolutionURL, body.Notes, completedAt, id, uid, pq.Array(body.CustomTags))
		if err != nil {
			return utils.Error(c, 404, "not found")
		}
		return utils.Success(c, entry)
	}
	err := h.DB.Get(&entry, `
		UPDATE review_entries SET
			status = COALESCE($1, status),
			solution_url = COALESCE($2, solution_url),
			notes = COALESCE($3, notes),
			completed_at = CASE WHEN $1 = 'solved' AND completed_at IS NULL THEN $4 ELSE completed_at END,
			updated_at = NOW()
		WHERE id = $5 AND user_id = $6
		RETURNING *
	`, body.Status, body.SolutionURL, body.Notes, completedAt, id, uid)
	if err != nil {
		return utils.Error(c, 404, "not found")
	}
	return utils.Success(c, entry)
}

func (h *ReviewHandler) Delete(c *fiber.Ctx) error {
	uid := c.Locals("user_id").(string)
	id := c.Params("id")

	result, err := h.DB.Exec(`DELETE FROM review_entries WHERE id = $1 AND user_id = $2`, id, uid)
	if err != nil {
		return utils.Error(c, 500, "delete failed")
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return utils.Error(c, 404, "not found")
	}
	return utils.Success(c, nil)
}

func (h *ReviewHandler) GetTagStats(c *fiber.Ctx) error {
	uid := c.Locals("user_id").(string)
	stats, err := services.GetTopTags(h.DB, uid, 20)
	if err != nil {
		return utils.Error(c, 500, "query failed")
	}
	return utils.Success(c, stats)
}

func (h *ReviewHandler) ListByTag(c *fiber.Ctx) error {
	uid := c.Locals("user_id").(string)
	tag := c.Query("tag")
	if tag == "" {
		return utils.Error(c, 400, "tag is required")
	}

	var entries []models.ReviewEntry
	err := h.DB.Select(&entries,
		`SELECT * FROM review_entries WHERE user_id = $1 AND $2 = ANY(custom_tags) ORDER BY created_at DESC`,
		uid, tag)
	if err != nil {
		return utils.Error(c, 500, "query failed")
	}

	grouped := make(map[string][]models.ReviewEntry)
	for _, e := range entries {
		key := e.Platform + "-" + e.ContestID
		grouped[key] = append(grouped[key], e)
	}

	return utils.Success(c, fiber.Map{
		"entries": entries,
		"grouped": grouped,
	})
}

func (h *ReviewHandler) SyncCFSubmissions(c *fiber.Ctx) error {
	uid := c.Locals("user_id").(string)

	var user models.User
	if err := h.DB.Get(&user, `SELECT cf_handle FROM users WHERE id = $1`, uid); err != nil || user.CFHandle == nil {
		return utils.Error(c, 400, "请先绑定 CF 账号")
	}

	subs, err := services.FetchCFSubmissions(*user.CFHandle, 1000)
	if err != nil {
		return utils.Error(c, 500, "CF API调用失败")
	}

	inserted := 0
	for _, s := range subs {
		_, err := h.DB.Exec(`
			INSERT INTO cf_submissions (id, user_id, contest_id, problem_index, verdict, submitted_at, programming_language)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
			ON CONFLICT (id) DO NOTHING
		`, s.ID, uid, s.ContestID, s.Problem.Index, s.Verdict,
			time.Unix(s.CreationTimeSeconds, 0), s.ProgrammingLanguage)
		if err == nil {
			inserted++
		}
	}

	return utils.Success(c, fiber.Map{"synced": inserted})
}

func (h *ReviewHandler) ListContests(c *fiber.Ctx) error {
	uid := c.Locals("user_id").(string)
	var contests []models.UserContest
	err := h.DB.Select(&contests, `SELECT * FROM user_contests WHERE user_id = $1 ORDER BY created_at DESC`, uid)
	if err != nil {
		return utils.Error(c, 500, "query failed")
	}
	return utils.Success(c, contests)
}

func (h *ReviewHandler) CreateContest(c *fiber.Ctx) error {
	uid := c.Locals("user_id").(string)
	var body models.UserContestCreate
	if err := c.BodyParser(&body); err != nil || body.Platform == "" || body.ContestID == "" {
		return utils.Error(c, 400, "platform and contest_id are required")
	}
	var contest models.UserContest
	err := h.DB.Get(&contest, `
		INSERT INTO user_contests (user_id, platform, contest_id, contest_name, contest_url)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (user_id, platform, contest_id) DO UPDATE SET contest_name = $4, contest_url = $5, updated_at = NOW()
		RETURNING *
	`, uid, body.Platform, body.ContestID, body.ContestName, body.ContestURL)
	if err != nil {
		return utils.Error(c, 500, "create contest failed")
	}
	return utils.Success(c, contest)
}

func (h *ReviewHandler) DeleteContest(c *fiber.Ctx) error {
	uid := c.Locals("user_id").(string)
	id := c.Params("cid")
	result, err := h.DB.Exec(`DELETE FROM user_contests WHERE id = $1 AND user_id = $2`, id, uid)
	if err != nil {
		return utils.Error(c, 500, "delete failed")
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return utils.Error(c, 404, "not found")
	}
	return utils.Success(c, nil)
}

func (h *ReviewHandler) UpdateContest(c *fiber.Ctx) error {
	uid := c.Locals("user_id").(string)
	id := c.Params("cid")
	var body models.UserContestCreate
	if err := c.BodyParser(&body); err != nil {
		return utils.Error(c, 400, "invalid body")
	}
	var contest models.UserContest
	err := h.DB.Get(&contest, `
		UPDATE user_contests SET contest_name = $1, contest_url = $2, updated_at = NOW()
		WHERE id = $3 AND user_id = $4
		RETURNING *
	`, body.ContestName, body.ContestURL, id, uid)
	if err != nil {
		return utils.Error(c, 404, "not found")
	}
	return utils.Success(c, contest)
}
