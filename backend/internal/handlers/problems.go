package handlers

import (
	"fmt"

	"algoarena/internal/models"
	"algoarena/internal/services"
	"algoarena/internal/utils"

	"github.com/gofiber/fiber/v2"
	"github.com/jmoiron/sqlx"
)

type ProblemHandler struct {
	DB *sqlx.DB
}

func (h *ProblemHandler) Search(c *fiber.Ctx) error {
	query := c.Query("q")
	minRating := c.QueryInt("min_rating", 0)
	maxRating := c.QueryInt("max_rating", 3500)
	tags := c.Query("tags")
	page := c.QueryInt("page", 1)
	limit := c.QueryInt("limit", 30)
	offset := (page - 1) * limit

	baseSQL := `FROM cf_problems WHERE 1=1`
	args := []interface{}{}
	argIdx := 1

	if query != "" {
		baseSQL += fmt.Sprintf(" AND (name ILIKE '%%' || $%d || '%%' OR $%d::text = contest_id::text || problem_index)", argIdx, argIdx)
		args = append(args, query)
		argIdx++
	}

	if minRating > 0 {
		baseSQL += fmt.Sprintf(" AND rating >= $%d", argIdx)
		args = append(args, minRating)
		argIdx++
	}
	if maxRating < 3500 {
		baseSQL += fmt.Sprintf(" AND rating <= $%d", argIdx)
		args = append(args, maxRating)
		argIdx++
	}

	if tags != "" {
		baseSQL += fmt.Sprintf(" AND tags @> ARRAY[$%d]", argIdx)
		args = append(args, tags)
		argIdx++
	}

	var total int
	countSQL := `SELECT COUNT(*) ` + baseSQL
	h.DB.Get(&total, countSQL, args...)

	var problems []models.CFProblem
	sql := `SELECT * ` + baseSQL + fmt.Sprintf(" ORDER BY rating LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, limit, offset)
	err := h.DB.Select(&problems, sql, args...)
	if err != nil {
		return utils.Error(c, 500, "query failed")
	}

	for i := range problems {
		problems[i].Tags = services.TranslateTags(problems[i].Tags)
	}

	return utils.Success(c, fiber.Map{
		"items": problems,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

func (h *ProblemHandler) GetTags(c *fiber.Ctx) error {
	var tags []models.TagTranslation
	err := h.DB.Select(&tags, `SELECT * FROM cf_tag_translations ORDER BY tag_zh`)
	if err != nil {
		return utils.Error(c, 500, "failed to fetch tags")
	}
	return utils.Success(c, tags)
}
