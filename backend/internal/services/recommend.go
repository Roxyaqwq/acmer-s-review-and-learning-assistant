package services

import (
	"math/rand"

	"algoarena/internal/models"
	"github.com/jmoiron/sqlx"
)

func GetDailyRecommendation(db *sqlx.DB, userID string) (*models.ReviewEntry, error) {
	type TagFreq struct {
		Tag   string `db:"tag"`
		Count int    `db:"count"`
	}

	// 1. Get top N tags from user's review entries
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

	// 2. Try top tags in descending order
	for i := 1; i <= len(tagFreqs); i++ {
		topTags := make([]string, i)
		for j := 0; j < i; j++ {
			topTags[j] = tagFreqs[j].Tag
		}

		var entry models.ReviewEntry
		err := db.Get(&entry, `
			SELECT * FROM review_entries
			WHERE user_id = $1
			AND custom_tags && $2
			AND (
				status = 'unsolved'
				OR (status = 'solved' AND (completed_at IS NULL OR completed_at < NOW() - INTERVAL '30 days'))
			)
			ORDER BY RANDOM()
			LIMIT 1
		`, userID, topTags)
		if err == nil {
			return &entry, nil
		}
	}

	return nil, nil
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

func init() {
	rand.Intn(1)
}
