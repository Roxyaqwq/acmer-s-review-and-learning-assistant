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
	tags := c.Query("tags")
	status := c.Query("status")
	platform := c.Query("platform")
	page := c.QueryInt("page", 1)
	if page < 1 {
		page = 1
	}

	// 有筛选（tags/status/platform）：按题目分页（扁平表格视图）
	if tags != "" || status != "" || platform != "" {
		limit := c.QueryInt("limit", 50)
		if limit > 100 {
			limit = 100
		}
		offset := (page - 1) * limit

		sql := `SELECT * FROM review_entries WHERE user_id = $1`
		args := []interface{}{uid}
		argIdx := 2

		if tags != "" {
			tagList := strings.Split(tags, ",")
			sql += fmt.Sprintf(" AND custom_tags @> $%d", argIdx)
			args = append(args, pq.Array(tagList))
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

		sql += fmt.Sprintf(" ORDER BY CASE status WHEN 'unsolved' THEN 0 WHEN 'attempted' THEN 1 ELSE 2 END, completed_at ASC NULLS FIRST, created_at DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
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

	// 无筛选：按比赛分页（分组卡片视图，一个比赛的所有题目在同一页）
	limit := c.QueryInt("limit", 10)
	if limit > 50 {
		limit = 50
	}
	offset := (page - 1) * limit

	// 1. 分组总数（user_contests 与 review_entries 孤立组的并集）
	var total int
	if err := h.DB.Get(&total, `
		SELECT COUNT(*) FROM (
			SELECT platform, contest_id FROM user_contests WHERE user_id = $1
			UNION
			SELECT platform, contest_id FROM review_entries WHERE user_id = $1
		) t`, uid); err != nil {
		return utils.Error(c, 500, "query failed")
	}

	// 2. SQL 层分页取当前页的组，避免全量内存排序（取两源 MAX(created_at)，最近活跃的比赛靠前）
	type GroupInfo struct {
		Platform  string    `db:"platform"`
		ContestID string    `db:"contest_id"`
		SortTime  time.Time `db:"sort_time"`
	}
	var pageGroups []GroupInfo
	if err := h.DB.Select(&pageGroups, `
		SELECT platform, contest_id, MAX(created_at) AS sort_time FROM (
			SELECT platform, contest_id, created_at FROM user_contests WHERE user_id = $1
			UNION ALL
			SELECT platform, contest_id, created_at FROM review_entries WHERE user_id = $1
		) t GROUP BY platform, contest_id ORDER BY sort_time DESC LIMIT $2 OFFSET $3`,
		uid, limit, offset); err != nil {
		return utils.Error(c, 500, "query failed")
	}

	// 3. 构建 (platform, contest_id) OR 条件，供后续多条查询复用（只针对当前页的组）
	groupCond := ""
	condArgs := []interface{}{}
	argIdx := 2
	for i, g := range pageGroups {
		if i > 0 {
			groupCond += " OR "
		}
		groupCond += fmt.Sprintf("(platform = $%d AND contest_id = $%d)", argIdx, argIdx+1)
		condArgs = append(condArgs, g.Platform, g.ContestID)
		argIdx += 2
	}

	// userContestMap 供 pageContests 直接取 id，避免逐条查询；
	// entryAggMap 为不在 user_contests 的组提供名称/链接兑底信息
	userContestMap := make(map[string]models.UserContest, len(pageGroups))
	type AggGroup struct {
		Platform    string `db:"platform"`
		ContestID   string `db:"contest_id"`
		ContestName string `db:"contest_name"`
		ContestURL  string `db:"contest_url"`
	}
	entryAggMap := make(map[string]AggGroup, len(pageGroups))

	if len(pageGroups) > 0 {
		var ucs []models.UserContest
		if err := h.DB.Select(&ucs, `SELECT * FROM user_contests WHERE user_id = $1 AND (`+groupCond+`)`,
			append([]interface{}{uid}, condArgs...)...); err != nil {
			return utils.Error(c, 500, "query failed")
		}
		for _, uc := range ucs {
			userContestMap[uc.Platform+"-"+uc.ContestID] = uc
		}

		var aggGroups []AggGroup
		if err := h.DB.Select(&aggGroups, `
			SELECT platform, contest_id, MAX(contest_name) AS contest_name, MAX(contest_url) AS contest_url
			FROM review_entries WHERE user_id = $1 AND (`+groupCond+`)
			GROUP BY platform, contest_id`,
			append([]interface{}{uid}, condArgs...)...); err != nil {
			return utils.Error(c, 500, "query failed")
		}
		for _, g := range aggGroups {
			entryAggMap[g.Platform+"-"+g.ContestID] = g
		}
	}

	// 4. 查当前页组下的所有 entries（一个比赛的题目不会被分页切开）
	var entries []models.ReviewEntry
	if len(pageGroups) > 0 {
		sql := `SELECT * FROM review_entries WHERE user_id = $1 AND (` + groupCond + `) ORDER BY CASE status WHEN 'unsolved' THEN 0 WHEN 'attempted' THEN 1 ELSE 2 END, completed_at ASC NULLS FIRST, created_at DESC`
		if err := h.DB.Select(&entries, sql, append([]interface{}{uid}, condArgs...)...); err != nil {
			return utils.Error(c, 500, "query failed")
		}
	}

	// 5. 构建当前页的 contests 列表（前端用于显示分组卡片，保持后端排序顺序）
	type PageContest struct {
		ID          string `json:"id"`
		Platform    string `json:"platform"`
		ContestID   string `json:"contest_id"`
		ContestName string `json:"contest_name"`
		ContestURL  string `json:"contest_url"`
	}
	pageContests := make([]PageContest, 0, len(pageGroups))
	for _, g := range pageGroups {
		key := g.Platform + "-" + g.ContestID
		pc := PageContest{Platform: g.Platform, ContestID: g.ContestID}
		if uc, ok := userContestMap[key]; ok {
			pc.ID = uc.ID
			pc.ContestName = uc.ContestName
			pc.ContestURL = uc.ContestURL
		}
		if agg, ok := entryAggMap[key]; ok {
			if pc.ContestName == "" {
				pc.ContestName = agg.ContestName
			}
			if pc.ContestURL == "" {
				pc.ContestURL = agg.ContestURL
			}
		}
		pageContests = append(pageContests, pc)
	}

	return utils.Success(c, fiber.Map{
		"items":         entries,
		"page_contests": pageContests,
		"total":         total,
		"page":          page,
		"limit":         limit,
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
		err := h.DB.Get(&entry, fmt.Sprintf(`
			UPDATE review_entries SET
				status = COALESCE($1, status),
				solution_url = COALESCE($2, solution_url),
				notes = COALESCE($3, notes),
				problem_index = COALESCE($%d, problem_index),
				problem_name = COALESCE($%d, problem_name),
				problem_url = COALESCE($%d, problem_url),
				contest_name = COALESCE($%d, contest_name),
				contest_url = COALESCE($%d, contest_url),
				platform = COALESCE($%d, platform),
				contest_id = COALESCE($%d, contest_id),
				custom_tags = $%d,
				completed_at = CASE WHEN $1 = 'solved' THEN $4 WHEN $1 IS NULL THEN completed_at ELSE NULL END,
				updated_at = NOW()
			WHERE id = $5 AND user_id = $6
			RETURNING *
		`, 7, 8, 9, 10, 11, 12, 13, 14),
			body.Status, body.SolutionURL, body.Notes, completedAt, id, uid,
			body.ProblemIndex, body.ProblemName, body.ProblemURL,
			body.ContestName, body.ContestURL, body.Platform, body.ContestID,
			pq.Array(body.CustomTags))
		if err != nil {
			return utils.Error(c, 404, "not found")
		}
		return utils.Success(c, entry)
	}
	err := h.DB.Get(&entry, fmt.Sprintf(`
		UPDATE review_entries SET
			status = COALESCE($1, status),
			solution_url = COALESCE($2, solution_url),
			notes = COALESCE($3, notes),
			problem_index = COALESCE($%d, problem_index),
			problem_name = COALESCE($%d, problem_name),
			problem_url = COALESCE($%d, problem_url),
			contest_name = COALESCE($%d, contest_name),
			contest_url = COALESCE($%d, contest_url),
			platform = COALESCE($%d, platform),
			contest_id = COALESCE($%d, contest_id),
			completed_at = CASE WHEN $1 = 'solved' THEN $4 WHEN $1 IS NULL THEN completed_at ELSE NULL END,
			updated_at = NOW()
		WHERE id = $5 AND user_id = $6
		RETURNING *
	`, 7, 8, 9, 10, 11, 12, 13),
		body.Status, body.SolutionURL, body.Notes, completedAt, id, uid,
		body.ProblemIndex, body.ProblemName, body.ProblemURL,
		body.ContestName, body.ContestURL, body.Platform, body.ContestID)
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
		`SELECT * FROM review_entries WHERE user_id = $1 AND $2 = ANY(custom_tags) ORDER BY created_at DESC LIMIT 500`,
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

	if len(subs) == 0 {
		return utils.Success(c, fiber.Map{"synced": 0})
	}

	tx, err := h.DB.Beginx()
	if err != nil {
		return utils.Error(c, 500, "开启事务失败")
	}
	defer tx.Rollback()

	const batch = 500
	for start := 0; start < len(subs); start += batch {
		end := start + batch
		if end > len(subs) {
			end = len(subs)
		}
		batchSubs := subs[start:end]

		ids := make([]int64, len(batchSubs))
		contestIds := make([]int, len(batchSubs))
		problemIndexes := make([]string, len(batchSubs))
		verdicts := make([]string, len(batchSubs))
		submittedAts := make([]time.Time, len(batchSubs))
		languages := make([]string, len(batchSubs))
		for i, s := range batchSubs {
			ids[i] = int64(s.ID)
			contestIds[i] = s.ContestID
			problemIndexes[i] = s.Problem.Index
			verdicts[i] = s.Verdict
			submittedAts[i] = time.Unix(s.CreationTimeSeconds, 0)
			languages[i] = s.ProgrammingLanguage
		}

		_, err := tx.Exec(`
			INSERT INTO cf_submissions (id, user_id, contest_id, problem_index, verdict, submitted_at, programming_language)
			SELECT id, $1, contest_id, problem_index, verdict, submitted_at, programming_language
			FROM unnest(
				$2::bigint[],
				$3::int[],
				$4::varchar[],
				$5::varchar[],
				$6::timestamptz[],
				$7::varchar[]
			) AS t(id, contest_id, problem_index, verdict, submitted_at, programming_language)
			ON CONFLICT (id) DO NOTHING
		`, uid, pq.Array(ids), pq.Array(contestIds), pq.Array(problemIndexes),
			pq.Array(verdicts), pq.Array(submittedAts), pq.Array(languages))
		if err != nil {
			return utils.Error(c, 500, "批量写入失败")
		}
	}

	if err := tx.Commit(); err != nil {
		return utils.Error(c, 500, "提交事务失败")
	}

	return utils.Success(c, fiber.Map{"synced": len(subs)})
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

func (h *ReviewHandler) ExportJSON(c *fiber.Ctx) error {
	uid := c.Locals("user_id").(string)
	var entries []models.ReviewEntry
	err := h.DB.Select(&entries, `SELECT * FROM review_entries WHERE user_id = $1 ORDER BY created_at DESC`, uid)
	if err != nil {
		return utils.Error(c, 500, "查询失败")
	}
	return utils.Success(c, entries)
}

func (h *ReviewHandler) ImportJSON(c *fiber.Ctx) error {
	uid := c.Locals("user_id").(string)
	var entries []models.ReviewEntryCreate
	if err := c.BodyParser(&entries); err != nil {
		return utils.Error(c, 400, "请求格式错误")
	}
	if len(entries) == 0 {
		return utils.Error(c, 400, "没有数据")
	}
	if len(entries) > 500 {
		return utils.Error(c, 400, "单次最多导入 500 条")
	}

	// 应用层预校验
	type failure struct {
		Index  int    `json:"index"`
		Reason string `json:"reason"`
	}
	var failures []failure
	for i, e := range entries {
		if e.Platform == "" || e.ContestID == "" || e.ProblemIndex == "" {
			failures = append(failures, failure{Index: i, Reason: "platform/contest_id/problem_index 不能为空"})
		}
	}
	if len(failures) > 0 {
		return utils.Success(c, fiber.Map{"imported": 0, "total": len(entries), "failures": failures})
	}

	// 规范化 status
	for i := range entries {
		if entries[i].Status == "" {
			entries[i].Status = "unsolved"
		}
	}

	tx, err := h.DB.Beginx()
	if err != nil {
		return utils.Error(c, 500, "开启事务失败")
	}
	defer tx.Rollback()

	n := len(entries)
	platforms := make([]string, n)
	contestIds := make([]string, n)
	contestNames := make([]string, n)
	contestUrls := make([]string, n)
	problemIndexes := make([]string, n)
	problemNames := make([]string, n)
	problemUrls := make([]string, n)
	customTagsArr := make([][]string, n)
	statuses := make([]string, n)
	solutionUrls := make([]string, n)
	notesArr := make([]string, n)
	for i, e := range entries {
		platforms[i] = e.Platform
		contestIds[i] = e.ContestID
		contestNames[i] = e.ContestName
		contestUrls[i] = e.ContestURL
		problemIndexes[i] = e.ProblemIndex
		problemNames[i] = e.ProblemName
		problemUrls[i] = e.ProblemURL
		customTagsArr[i] = e.CustomTags
		statuses[i] = e.Status
		solutionUrls[i] = e.SolutionURL
		notesArr[i] = e.Notes
	}

	_, err = tx.Exec(`
		INSERT INTO review_entries (user_id, platform, contest_id, contest_name, contest_url, problem_index, problem_name, problem_url, custom_tags, status, solution_url, notes)
		SELECT $1, platform, contest_id, contest_name, contest_url, problem_index, problem_name, problem_url, custom_tags, status, solution_url, notes
		FROM unnest(
			$2::varchar[], $3::varchar[], $4::text[], $5::text[], $6::varchar[], $7::text[], $8::text[], $9::text[][], $10::varchar[], $11::text[], $12::text[]
		) AS t(platform, contest_id, contest_name, contest_url, problem_index, problem_name, problem_url, custom_tags, status, solution_url, notes)
	`, uid, pq.Array(platforms), pq.Array(contestIds), pq.Array(contestNames), pq.Array(contestUrls),
		pq.Array(problemIndexes), pq.Array(problemNames), pq.Array(problemUrls), pq.Array(customTagsArr),
		pq.Array(statuses), pq.Array(solutionUrls), pq.Array(notesArr))
	if err != nil {
		return utils.Error(c, 500, "导入失败")
	}

	if err := tx.Commit(); err != nil {
		return utils.Error(c, 500, "提交事务失败")
	}

	return utils.Success(c, fiber.Map{"imported": n, "total": n})
}

func (h *ReviewHandler) ExportMarkdown(c *fiber.Ctx) error {
	uid := c.Locals("user_id").(string)
	var entries []models.ReviewEntry
	err := h.DB.Select(&entries, `SELECT * FROM review_entries WHERE user_id = $1 ORDER BY platform, contest_id, problem_index`, uid)
	if err != nil {
		return utils.Error(c, 500, "查询失败")
	}

	type contestKey struct {
		Platform  string
		ContestID string
	}
	grouped := make(map[contestKey][]models.ReviewEntry)
	var order []contestKey
	for _, e := range entries {
		k := contestKey{e.Platform, e.ContestID}
		if _, exists := grouped[k]; !exists {
			order = append(order, k)
		}
		grouped[k] = append(grouped[k], e)
	}

	now := time.Now().Format("2006-01-02 15:04")
	var md strings.Builder
	md.WriteString("# AlgoArena 补题记录\n\n")
	md.WriteString(fmt.Sprintf("导出时间: %s\n\n", now))

	for _, k := range order {
		problems := grouped[k]
		contestName := k.ContestID
		if len(problems) > 0 && problems[0].ContestName != "" {
			contestName = problems[0].ContestName
		}
		md.WriteString(fmt.Sprintf("## %s - %s\n\n", k.Platform, contestName))

		for _, p := range problems {
			statusLabel := map[string]string{"solved": "✅ 已解决", "attempted": "🔄 尝试过", "unsolved": "❌ 未解决"}[p.Status]
			if statusLabel == "" {
				statusLabel = p.Status
			}

			md.WriteString(fmt.Sprintf("### %s - %s\n", p.ProblemIndex, p.ProblemName))
			if p.ProblemURL != "" {
				md.WriteString(fmt.Sprintf("- 题目链接: %s\n", p.ProblemURL))
			}
			md.WriteString(fmt.Sprintf("- 状态: %s\n", statusLabel))
			if len(p.CustomTags) > 0 {
				md.WriteString(fmt.Sprintf("- 标签: %s\n", strings.Join(p.CustomTags, ", ")))
			}
			if p.SolutionURL != "" {
				md.WriteString(fmt.Sprintf("- 题解: %s\n", p.SolutionURL))
			}
			if p.CompletedAt != nil {
				md.WriteString(fmt.Sprintf("- 完成时间: %s\n", p.CompletedAt.Format("2006-01-02 15:04")))
			}
			if p.Notes != "" {
				// 笔记是用户编写的 Markdown，必须保持原始格式：
				// 缩进会破坏其内部的标题/代码块围栏/列表等语法，导致导出文件在 Typora 中排版错乱
				md.WriteString("\n**笔记:**\n")
				md.WriteString(p.Notes)
				if !strings.HasSuffix(p.Notes, "\n") {
					md.WriteString("\n")
				}
			}
			md.WriteString("\n")
		}
	}

	c.Set("Content-Type", "text/markdown; charset=utf-8")
	c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=algoarena-review-%s.md", time.Now().Format("20060102")))
	return c.SendString(md.String())
}
