package handlers

import (
	"algoarena/internal/models"
	"algoarena/internal/services"
	"algoarena/internal/utils"

	"github.com/gofiber/fiber/v2"
	"github.com/jmoiron/sqlx"
)

type DailyHandler struct{ DB *sqlx.DB }

func (h *DailyHandler) GetToday(c *fiber.Ctx) error {
	uid := c.Locals("user_id").(string)

	var dp models.DailyProblem
	err := h.DB.Get(&dp, `
		SELECT * FROM daily_problems WHERE user_id = $1 AND recommended_at = CURRENT_DATE
	`, uid)
	if err == nil {
		h.DB.Get(&dp.ReviewEntry, `SELECT * FROM review_entries WHERE id = $1`, dp.ReviewEntryID)
		return utils.Success(c, dp)
	}

	entry, err := services.GetDailyRecommendation(h.DB, uid)
	if err != nil || entry == nil {
		return utils.Success(c, fiber.Map{"message": "请先在补题模块添加题目"})
	}

	h.DB.Get(&dp, `
		INSERT INTO daily_problems (user_id, review_entry_id)
		VALUES ($1, $2) RETURNING *
	`, uid, entry.ID)
	dp.ReviewEntry = entry
	return utils.Success(c, dp)
}

func (h *DailyHandler) MarkComplete(c *fiber.Ctx) error {
	uid := c.Locals("user_id").(string)
	id := c.Params("id")

	var dp models.DailyProblem
	err := h.DB.Get(&dp, `SELECT * FROM daily_problems WHERE id = $1 AND user_id = $2`, id, uid)
	if err != nil {
		return utils.Error(c, 404, "not found")
	}

	h.DB.Exec(`UPDATE daily_problems SET completed = true WHERE id = $1`, id)
	h.DB.Exec(`
		UPDATE review_entries SET status = 'solved', completed_at = NOW(), updated_at = NOW()
		WHERE id = $1 AND status != 'solved'
	`, dp.ReviewEntryID)

	return utils.Success(c, nil)
}
