package services

import (
	"log"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/lib/pq"
)

func SyncCFProblemsToDB(db *sqlx.DB) error {
	log.Println("开始同步 Codeforces 题库...")
	problems, err := FetchCFProblems()
	if err != nil {
		return err
	}

	log.Printf("CF API 返回 %d 道题目", len(problems))
	inserted := 0
	for _, p := range problems {
		_, err := db.Exec(`
			INSERT INTO cf_problems (contest_id, problem_index, name, rating, tags, solved_count)
			VALUES ($1, $2, $3, $4, $5, $6)
			ON CONFLICT (contest_id, problem_index) DO UPDATE SET
				name = $3, rating = $4, tags = $5, solved_count = $6
		`, p.ContestID, p.ProblemIndex, p.Name, p.Rating, pq.Array(p.Tags), p.SolvedCount)
		if err == nil {
			inserted++
		}
	}
	log.Printf("CF 题库同步完成: %d 题已更新", inserted)
	return nil
}

func SyncCFContestsToDB(db *sqlx.DB) error {
	contests, err := FetchCFContests()
	if err != nil {
		return err
	}

	for _, c := range contests {
		var startTime *time.Time
		if c.StartTimeSeconds > 0 {
			t := time.Unix(c.StartTimeSeconds, 0)
			startTime = &t
		}
		db.Exec(`
			INSERT INTO cf_contests (id, name, contest_type, phase, duration_seconds, start_time, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, NOW())
			ON CONFLICT (id) DO UPDATE SET
				name = $2, phase = $4, start_time = $6, updated_at = NOW()
		`, c.ID, c.Name, c.Type, c.Phase, c.DurationSeconds, startTime)
	}
	log.Printf("CF 比赛列表同步完成: %d 场", len(contests))
	return nil
}

func StartPeriodicSync(db *sqlx.DB, interval time.Duration) {
	go func() {
		for {
			time.Sleep(interval)
			if err := SyncCFProblemsToDB(db); err != nil {
				log.Printf("CF 题库同步失败: %v", err)
			}
			if err := SyncCFContestsToDB(db); err != nil {
				log.Printf("CF 比赛同步失败: %v", err)
			}
		}
	}()
}
