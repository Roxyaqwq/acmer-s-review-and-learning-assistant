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
	limit, offset := paginate(c.QueryInt("page", 1), c.QueryInt("limit", defaultProblemPageSize))

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
	// 同评分题目非常多，只按 rating 排序时 Postgres 不保证同分行顺序稳定，
	// 翻页会出现重复/漏题，所以补上唯一性 tiebreaker。
	sql := `SELECT * ` + baseSQL +
		fmt.Sprintf(" ORDER BY rating, contest_id, problem_index LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
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
		"page":  pageForOffset(offset, limit),
		"limit": limit,
	})
}

const (
	defaultProblemPageSize = 30
	maxProblemPageSize     = 100
)

// paginate 把外部传入的 page/limit 收进安全区间：page<1 会算出负 OFFSET
// （Postgres 直接报错 500），limit 不设上限则允许一次拉走整个题库。
func paginate(page, limit int) (int, int) {
	if limit < 1 {
		limit = defaultProblemPageSize
	}
	if limit > maxProblemPageSize {
		limit = maxProblemPageSize
	}
	if page < 1 {
		page = 1
	}
	return limit, (page - 1) * limit
}

func pageForOffset(offset, limit int) int {
	if limit <= 0 {
		return 1
	}
	return offset/limit + 1
}

func (h *ProblemHandler) GetTags(c *fiber.Ctx) error {
	var tags []models.TagTranslation
	err := h.DB.Select(&tags, `SELECT * FROM cf_tag_translations ORDER BY tag_zh`)
	if err != nil {
		return utils.Error(c, 500, "failed to fetch tags")
	}
	return utils.Success(c, tags)
}
