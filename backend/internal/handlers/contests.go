package handlers

import (
	"fmt"
	"sync"
	"time"

	"algoarena/internal/models"
	"algoarena/internal/services"
	"algoarena/internal/utils"

	"github.com/gofiber/fiber/v2"
	"github.com/jmoiron/sqlx"
)

type ContestHandler struct {
	DB      *sqlx.DB
	CacheMu sync.RWMutex
	Cache   []models.PlatformContest
	CacheT  time.Time
}

func (h *ContestHandler) Upcoming(c *fiber.Ctx) error {
	h.CacheMu.RLock()
	if time.Since(h.CacheT) < 5*time.Minute && len(h.Cache) > 0 {
		cached := h.Cache
		h.CacheMu.RUnlock()
		return utils.Success(c, cached)
	}
	h.CacheMu.RUnlock()

	var contests []models.PlatformContest

	cfContests, err := services.FetchCFContests()
	if err == nil {
		for _, cc := range cfContests {
			if cc.Phase == "BEFORE" {
				t := time.Unix(cc.StartTimeSeconds, 0)
				contests = append(contests, models.PlatformContest{
					Platform:    "Codeforces",
					ContestID:   fmt.Sprintf("%d", cc.ID),
					ContestName: cc.Name,
					StartTime:   t.Format(time.RFC3339),
					EndTime:     t.Add(time.Duration(cc.DurationSeconds) * time.Second).Format(time.RFC3339),
					Duration:    cc.DurationSeconds / 60,
					URL:         fmt.Sprintf("https://codeforces.com/contest/%d", cc.ID),
				})
			}
		}
	}

	atContests, err := services.FetchAtCoderContests()
	if err == nil {
		now := time.Now()
		for _, ac := range atContests {
			t, parseErr := time.Parse(time.RFC3339, ac.StartTime)
			if parseErr == nil && t.After(now) {
				contests = append(contests, ac)
			}
		}
	}

	h.CacheMu.Lock()
	h.Cache = contests
	h.CacheT = time.Now()
	h.CacheMu.Unlock()

	return utils.Success(c, contests)
}
