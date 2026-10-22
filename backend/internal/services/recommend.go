package services

import (
	"algoarena/internal/models"
	"github.com/jmoiron/sqlx"
	"github.com/lib/pq"
)

func GetDailyRecommendation(db *sqlx.DB, userID string, cooldownDays int) ([]models.ReviewEntry, error) {
	if cooldownDays <= 0 {
		cooldownDays = 7
	}

	type TagFreq struct {
		Tag   string `db:"tag"`
		Count int    `db:"count"`
	}

	var tagFreqs []TagFreq
	err := db.Select(&tagFreqs, `
		SELECT unnest(custom_tags) as tag, COUNT(*) as count
		FROM review_entries
		WHERE user_id = $1
		GROUP BY tag
		ORDER BY count DESC
		LIMIT 10
	`, userID)
	if err != nil || len(tagFreqs) == 0 {
		return nil, err
	}

	seen := make(map[string]bool)
	var candidates []models.ReviewEntry

	for _, tf := range tagFreqs {
		if len(candidates) >= 3 {
			break
		}

		var entry models.ReviewEntry
		err := db.Get(&entry, `
			SELECT * FROM review_entries
			WHERE user_id = $1
			AND custom_tags && $2
			AND (
				status = 'unsolved'
				OR (status = 'solved' AND (completed_at IS NULL OR completed_at < NOW() - INTERVAL '1 day' * $3))
			)
			ORDER BY RANDOM()
			LIMIT 1
		`, userID, pq.Array([]string{tf.Tag}), cooldownDays)
		if err != nil {
			continue
		}

		if !seen[entry.ID] {
			seen[entry.ID] = true
			candidates = append(candidates, entry)
		}
	}

	return candidates, nil
}

func GetTopTags(db *sqlx.DB, userID string, limit int) ([]models.TagStat, error) {
	var stats []models.TagStat
	err := db.Select(&stats, `
		SELECT
			unnest(custom_tags) as tag,
			COUNT(*) as total_count,
			SUM(CASE WHEN status = 'solved' THEN 1 ELSE 0 END)::int as completed_count
		FROM review_entries
		WHERE user_id = $1
		GROUP BY tag
		ORDER BY total_count DESC
		LIMIT $2
	`, userID, limit)
	return stats, err
}
