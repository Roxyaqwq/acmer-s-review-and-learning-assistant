package handlers

import (
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"algoarena/internal/models"
	"algoarena/internal/services"
	"algoarena/internal/utils"

	"github.com/gofiber/fiber/v2"
	"github.com/jmoiron/sqlx"
)

// refreshFailBackoff 刷新全失败后的退避窗口：窗口内不重复触发外部 API 拉取
const refreshFailBackoff = 30 * time.Second

type ContestHandler struct {
	DB         *sqlx.DB
	CacheMu    sync.RWMutex
	Cache      []models.PlatformContest
	CacheT     time.Time
	lastFailAt time.Time
	refreshing atomic.Bool
}

func (h *ContestHandler) Upcoming(c *fiber.Ctx) error {
	h.CacheMu.RLock()
	fresh := time.Since(h.CacheT) < 5*time.Minute && len(h.Cache) > 0
	hasCache := len(h.Cache) > 0
	cached := h.Cache
	lastFailAt := h.lastFailAt
	h.CacheMu.RUnlock()

	if fresh {
		return utils.Success(c, cached)
	}

	// 过期且有旧缓存：立即返回旧值，后台异步刷新（singleflight 去重）
	if hasCache {
		if h.refreshing.CompareAndSwap(false, true) {
			go h.refreshCache()
		}
		return utils.Success(c, cached)
	}

	// 冷启动无缓存：立即返回空数组，不阻塞请求线程
	// 全失败退避窗口内不重复触发刷新（避免外部 API 不可达时每请求反复阻塞）
	if time.Since(lastFailAt) < refreshFailBackoff {
		return utils.Success(c, []models.PlatformContest{})
	}
	if h.refreshing.CompareAndSwap(false, true) {
		go h.refreshCache()
	}
	return utils.Success(c, []models.PlatformContest{})
}

// Warmup 启动预热：将冷启动拉取成本转移到启动窗口后台执行
func (h *ContestHandler) Warmup() {
	go h.refreshCache()
}

func (h *ContestHandler) refreshCache() {
	defer h.refreshing.Store(false)

	var contests []models.PlatformContest
	anySuccess := false

	cfContests, err := services.FetchCFContests()
	if err == nil {
		anySuccess = true
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
		anySuccess = true
		now := time.Now()
		for _, ac := range atContests {
			t, parseErr := time.Parse(time.RFC3339, ac.StartTime)
			if parseErr == nil && t.After(now) {
				contests = append(contests, ac)
			}
		}
	}

	h.CacheMu.Lock()
	if anySuccess {
		// ≥1 平台成功即视为缓存有效（部分成功语义与既有行为保持一致）
		h.Cache = contests
		h.CacheT = time.Now()
		h.lastFailAt = time.Time{}
	} else {
		// 全部失败：不推进缓存时间戳（不当作正常空结果缓存），记录失败时刻用于退避
		h.lastFailAt = time.Now()
	}
	h.CacheMu.Unlock()
}
