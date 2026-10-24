package main

import (
	"errors"
	"fmt"
	"log"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"algoarena/internal/config"
	"algoarena/internal/db"
	"algoarena/internal/handlers"
	"algoarena/internal/middleware"
	"algoarena/internal/services"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/jmoiron/sqlx"
)

func main() {
	cfg := config.Load()

	database, err := db.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("数据库连接失败: %v", err)
	}
	defer database.Close()

	if err := db.RunMigrations(database); err != nil {
		log.Fatalf("数据库迁移失败: %v", err)
	}
	log.Println("数据库迁移完成")

	seedTagTranslations(database)

	// 首次同步错峰：监听就绪后延迟 5s 触发，避免与启动关键路径抢连接池与 CPU
	go func() {
		time.Sleep(5 * time.Second)
		if err := services.SyncCFProblemsToDB(database); err != nil {
			log.Printf("首次同步CF题库失败: %v", err)
		}
		if err := services.SyncCFContestsToDB(database); err != nil {
			log.Printf("首次同步CF比赛失败: %v", err)
		}
	}()
	services.StartPeriodicSync(database, 6*3600*time.Second)

	app := fiber.New(fiber.Config{
		AppName: "AlgoArena",
		// 导入补题记录（最多 500 条含 Markdown 笔记）可能超过默认 4MB 限制
		BodyLimit: 16 << 20,
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			if e, ok := err.(*fiber.Error); ok {
				code = e.Code
			}
			return c.Status(code).JSON(fiber.Map{"code": 1, "message": err.Error()})
		},
	})

	// CORS 白名单：生产环境仅允许配置的 FRONTEND_URL，开发环境额外放行本地前端
	allowedOrigins := cfg.FrontendURL
	if os.Getenv("APP_ENV") != "production" {
		allowedOrigins += ",http://localhost:3000"
	}
	app.Use(cors.New(cors.Config{
		AllowOrigins:     allowedOrigins,
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization",
		AllowMethods:     "GET, POST, PUT, DELETE, PATCH, OPTIONS",
		AllowCredentials: true,
	}))
	// panic 必须被兜住：Fiber 默认不 recover handler 里的 panic，一个 nil
	// 解引用就会把整个进程带走，而不是返回 500。
	app.Use(recover.New())
	app.Use(logger.New())

	api := app.Group("/api")

	// 健康检查：无认证、不查 DB、恒快返回（供 launcher 就绪探测）
	api.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"code": 0, "message": "ok", "data": fiber.Map{"status": "up"}})
	})

	authHandler := handlers.NewAuthHandler(database, cfg)
	authHandler.StartStateCleaner()
	contestHandler := &handlers.ContestHandler{DB: database}
	problemHandler := &handlers.ProblemHandler{DB: database}
	reviewHandler := &handlers.ReviewHandler{DB: database}
	dailyHandler := &handlers.DailyHandler{DB: database}
	userHandler := &handlers.UserHandler{DB: database}
	socialHandler := &handlers.SocialHandler{DB: database}
	feedHandler := &handlers.FeedHandler{DB: database}
	snippetHandler := &handlers.SnippetHandler{DB: database}

	api.Get("/auth/github", authHandler.GithubLogin)
	api.Get("/auth/github/callback", authHandler.GithubCallback)
	api.Get("/auth/me", middleware.AuthRequired(cfg.JWTSecret), authHandler.GetMe)
	api.Post("/auth/bind-cf", middleware.AuthRequired(cfg.JWTSecret), authHandler.BindCF)
	api.Patch("/auth/profile", middleware.AuthRequired(cfg.JWTSecret), authHandler.UpdateProfile)

	api.Get("/contests/upcoming", contestHandler.Upcoming)

	api.Get("/problems/search", problemHandler.Search)
	api.Get("/problems/tags", problemHandler.GetTags)

	review := api.Group("/review", middleware.AuthRequired(cfg.JWTSecret))
	review.Get("/", reviewHandler.List)
	review.Get("/tag", reviewHandler.ListByTag)
	review.Get("/tags/stats", reviewHandler.GetTagStats)
	review.Get("/contests", reviewHandler.ListContests)
	review.Post("/contests", reviewHandler.CreateContest)
	review.Put("/contests/:cid", reviewHandler.UpdateContest)
	review.Delete("/contests/:cid", reviewHandler.DeleteContest)
	review.Get("/:id", reviewHandler.Get)
	review.Post("/", reviewHandler.Create)
	review.Put("/:id", reviewHandler.Update)
	review.Delete("/:id", reviewHandler.Delete)
	review.Post("/sync-cf", reviewHandler.SyncCFSubmissions)
	review.Get("/export/markdown", reviewHandler.ExportMarkdown)
	review.Get("/export/json", reviewHandler.ExportJSON)
	review.Post("/import/json", reviewHandler.ImportJSON)

	daily := api.Group("/daily", middleware.AuthRequired(cfg.JWTSecret))
	daily.Get("/", dailyHandler.GetToday)
	daily.Post("/:id/complete", dailyHandler.MarkComplete)

	users := api.Group("/users")
	users.Get("/search", userHandler.Search)
	users.Get("/:id", middleware.OptionalAuth(cfg.JWTSecret), userHandler.GetPublicProfile)
	users.Get("/:id/heatmap", middleware.OptionalAuth(cfg.JWTSecret), userHandler.GetHeatmap)
	users.Get("/:id/stats", middleware.OptionalAuth(cfg.JWTSecret), userHandler.GetStats)

	feed := api.Group("/feed", middleware.AuthRequired(cfg.JWTSecret))
	feed.Get("/", feedHandler.GetFeed)

	social := api.Group("/social", middleware.AuthRequired(cfg.JWTSecret))
	social.Post("/follow/:id", socialHandler.Follow)
	social.Delete("/follow/:id", socialHandler.Unfollow)
	social.Get("/status/:id", socialHandler.GetRelationshipStatus)
	social.Get("/:id/followers", socialHandler.Followers)
	social.Get("/:id/following", socialHandler.Following)
	social.Get("/:id/review", socialHandler.GetFriendReview)
	social.Get("/friends", socialHandler.GetFriends)
	social.Get("/friend-requests", socialHandler.GetPendingRequests)
	social.Get("/friend-requests/outgoing", socialHandler.GetMyPendingOutgoing)
	social.Post("/friend-request/:id", socialHandler.SendFriendRequest)
	social.Put("/friend-request/:id/accept", socialHandler.AcceptFriendRequest)
	social.Put("/friend-request/:id/reject", socialHandler.RejectFriendRequest)
	social.Delete("/friends/:id", socialHandler.RemoveFriend)

	snippets := api.Group("/snippets", middleware.AuthRequired(cfg.JWTSecret))
	snippets.Get("/", snippetHandler.List)
	snippets.Get("/:id", snippetHandler.Get)
	snippets.Post("/", snippetHandler.Create)
	snippets.Put("/:id", snippetHandler.Update)
	snippets.Delete("/:id", snippetHandler.Delete)

	api.Get("/tags/custom", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"code": 0, "message": "ok", "data": services.CustomTags})
	})

	api.Post("/admin/sync-cf", middleware.AuthRequired(cfg.JWTSecret), func(c *fiber.Ctx) error {
		uid := c.Locals("user_id").(string)
		var role string
		if err := database.Get(&role, `SELECT role FROM users WHERE id = $1`, uid); err != nil || role != "admin" {
			return c.Status(403).JSON(fiber.Map{"code": 1, "message": "权限不足"})
		}
		// 同步是长任务，立刻返回；真正跑起来后由互斥锁保证同一时刻只有一个同步在跑，
		// 并发触发时本次会被跳过（ErrSyncInProgress），这里不当成失败来记日志。
		go func() {
			if err := services.SyncCFProblemsToDB(database); err != nil && !errors.Is(err, services.ErrSyncInProgress) {
				log.Printf("手动同步CF题库失败: %v", err)
			}
			if err := services.SyncCFContestsToDB(database); err != nil && !errors.Is(err, services.ErrSyncInProgress) {
				log.Printf("手动同步CF比赛失败: %v", err)
			}
		}()
		return c.JSON(fiber.Map{"code": 0, "message": "sync started"})
	})

	api.Post("/upload", middleware.AuthRequired(cfg.JWTSecret), handlers.UploadHandler)
	app.Use("/uploads", func(c *fiber.Ctx) error {
		c.Set("X-Content-Type-Options", "nosniff")
		return c.Next()
	})
	app.Static("/uploads", handlers.UploadDir)

	go func() {
		quit := make(chan os.Signal, 1)
		signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
		<-quit
		log.Println("服务器正在关闭...")
		app.Shutdown()
	}()

	// 启动预热：将比赛缓存冷启动拉取成本转移到启动窗口后台
	contestHandler.Warmup()

	log.Printf("AlgoArena 后端启动于端口 %s\n", cfg.Port)
	if err := app.Listen(fmt.Sprintf(":%s", cfg.Port)); err != nil {
		log.Fatalf("服务器启动失败: %v", err)
	}
}

func seedTagTranslations(db *sqlx.DB) {
	translations := [][2]string{
		{"2-sat", "2-SAT"}, {"binary search", "二分查找"}, {"bitmasks", "位运算"},
		{"brute force", "暴力枚举"}, {"chinese remainder theorem", "中国剩余定理"},
		{"combinatorics", "组合数学"}, {"constructive algorithms", "构造"},
		{"data structures", "数据结构"}, {"dfs and similar", "DFS"}, {"divide and conquer", "分治"},
		{"dp", "动态规划"}, {"dsu", "并查集"}, {"expression parsing", "表达式解析"},
		{"fft", "FFT/NTT"}, {"flows", "网络流"}, {"games", "博弈论"}, {"geometry", "计算几何"},
		{"graph matchings", "二分图匹配"}, {"graphs", "图论"}, {"greedy", "贪心"},
		{"hashing", "哈希"}, {"implementation", "模拟"}, {"interactive", "交互题"},
		{"math", "数学"}, {"matrices", "矩阵"}, {"meet-in-the-middle", "折半搜索"},
		{"number theory", "数论"}, {"probabilities", "概率期望"}, {"schedules", "调度"},
		{"shortest paths", "最短路"}, {"sortings", "排序"}, {"string suffix structures", "后缀数据结构"},
		{"strings", "字符串"}, {"ternary search", "三分法"}, {"trees", "树"}, {"two pointers", "双指针"},
	}
	// 单语句批量写入：36 行 VALUES 一次 Exec，替代逐条 36 次 DB 往返
	var sb strings.Builder
	sb.WriteString(`INSERT INTO cf_tag_translations (tag_key, tag_zh) VALUES `)
	args := make([]interface{}, 0, len(translations)*2)
	for i, kv := range translations {
		if i > 0 {
			sb.WriteString(",")
		}
		sb.WriteString(fmt.Sprintf("($%d,$%d)", i*2+1, i*2+2))
		args = append(args, kv[0], kv[1])
	}
	sb.WriteString(` ON CONFLICT (tag_key) DO NOTHING`)
	db.Exec(sb.String(), args...)
}
