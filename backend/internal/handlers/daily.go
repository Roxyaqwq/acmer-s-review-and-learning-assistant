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
	cooldownDays := c.QueryInt("cooldown_days", 7)
	if cooldownDays < 3 {
		cooldownDays = 3
	}
	if cooldownDays > 60 {
		cooldownDays = 60
	}

	candidates, err := services.GetDailyRecommendation(h.DB, uid, cooldownDays)
	if err != nil || len(candidates) == 0 {
		return utils.Success(c, fiber.Map{"message": "请先在补题模块添加题目", "candidates": []models.ReviewEntry{}})
	}

	return utils.Success(c, fiber.Map{"candidates": candidates})
}

func (h *DailyHandler) MarkComplete(c *fiber.Ctx) error {
	uid := c.Locals("user_id").(string)
	id := c.Params("id") // id 为 review_entry_id

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

	// UPSERT daily_problems 标记完成
	_, err = tx.Exec(`
		INSERT INTO daily_problems (user_id, review_entry_id, completed) VALUES ($1, $2, true)
		ON CONFLICT (user_id, recommended_at) DO UPDATE SET completed = true, review_entry_id = EXCLUDED.review_entry_id
	`, uid, id)
	if err != nil {
		return utils.Error(c, 500, "操作失败")
	}

	if err := tx.Commit(); err != nil {
		return utils.Error(c, 500, "操作失败")
	}
	return utils.Success(c, nil)
}
