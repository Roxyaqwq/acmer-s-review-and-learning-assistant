package services

import (
	"errors"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/lib/pq"
)

// ErrSyncInProgress is returned when a sync run is already underway. The
// periodic goroutine and the admin endpoint draw on the same Codeforces rate
// budget, so a second run is refused instead of being started in parallel.
var ErrSyncInProgress = errors.New("同步任务已在运行")

// cfSyncMu serialises every CF sync run. Both SyncCFProblemsToDB and
// SyncCFContestsToDB take it, so at most one sync talks to Codeforces at a time
// and two runs can never write the same rows through competing transactions.
var cfSyncMu sync.Mutex

func SyncCFProblemsToDB(db *sqlx.DB) error {
	if !cfSyncMu.TryLock() {
		log.Println("CF 题库同步已在运行，跳过本次")
		return ErrSyncInProgress
	}
	defer cfSyncMu.Unlock()

	log.Println("开始同步 Codeforces 题库...")
	problems, err := FetchCFProblems()
	if err != nil {
		return err
	}

	log.Printf("CF API 返回 %d 道题目", len(problems))
	if len(problems) == 0 {
		return nil
	}

	tx, err := db.Beginx()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	const batch = 1000
	for start := 0; start < len(problems); start += batch {
		end := start + batch
		if end > len(problems) {
			end = len(problems)
		}
		batchProblems := problems[start:end]

		contestIds := make([]int, len(batchProblems))
		problemIndexes := make([]string, len(batchProblems))
		names := make([]string, len(batchProblems))
		ratings := make([]int, len(batchProblems))
		// lib/pq 的 pq.Array 对 [][]string 仅在"矩形"（每行长度相同）时能编码为 text[][]；
		// CF 题目 tags 数量不固定，直接传二维数组会导致 Postgres 端类型不匹配（text[] 期望 text）。
		// 这里将每行 tags 用 '|' 拼接为一维字符串数组，SQL 中再用 string_to_array 还原为 text[]。
		tagsJoined := make([]string, len(batchProblems))
		solvedCounts := make([]int, len(batchProblems))
		for i, p := range batchProblems {
			contestIds[i] = p.ContestID
			problemIndexes[i] = p.ProblemIndex
			names[i] = p.Name
			ratings[i] = p.Rating
			tagsJoined[i] = strings.Join(p.Tags, "|")
			solvedCounts[i] = p.SolvedCount
		}

		_, err := tx.Exec(`
			INSERT INTO cf_problems (contest_id, problem_index, name, rating, tags, solved_count)
			SELECT contest_id, problem_index, name, rating,
				CASE WHEN tags_str IS NULL OR tags_str = '' THEN '{}'::text[]
				     ELSE string_to_array(tags_str, '|') END,
				solved_count
			FROM unnest(
				$1::int[],
				$2::varchar[],
				$3::text[],
				$4::int[],
				$5::text[],
				$6::int[]
			) AS t(contest_id, problem_index, name, rating, tags_str, solved_count)
			ON CONFLICT (contest_id, problem_index) DO UPDATE SET
				name = EXCLUDED.name, rating = EXCLUDED.rating, tags = EXCLUDED.tags, solved_count = EXCLUDED.solved_count
		`, pq.Array(contestIds), pq.Array(problemIndexes), pq.Array(names),
			pq.Array(ratings), pq.Array(tagsJoined), pq.Array(solvedCounts))
		if err != nil {
			return err
		}
	}

	if err := tx.Commit(); err != nil {
		return err
	}
	log.Printf("CF 题库同步完成: %d 题已更新", len(problems))
	return nil
}

func SyncCFContestsToDB(db *sqlx.DB) error {
	if !cfSyncMu.TryLock() {
		log.Println("CF 比赛同步已在运行，跳过本次")
		return ErrSyncInProgress
	}
	defer cfSyncMu.Unlock()

	contests, err := FetchCFContests()
	if err != nil {
		return err
	}
	if len(contests) == 0 {
		return nil
	}

	tx, err := db.Beginx()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	const batch = 500
	for start := 0; start < len(contests); start += batch {
		end := start + batch
		if end > len(contests) {
			end = len(contests)
		}
		batchContests := contests[start:end]

		ids := make([]int, len(batchContests))
		names := make([]string, len(batchContests))
		types := make([]string, len(batchContests))
		phases := make([]string, len(batchContests))
		durations := make([]int, len(batchContests))
		startTimes := make([]time.Time, len(batchContests))
		for i, c := range batchContests {
			ids[i] = c.ID
			names[i] = c.Name
			types[i] = c.Type
			phases[i] = c.Phase
			durations[i] = c.DurationSeconds
			// StartTimeSeconds<=0 的行以 time.Unix(0,0) 哨兵填充（pq.Array 不支持 *time.Time 切片），
			// SQL 中以 CASE 判空转 NULL（INSERT 值行与 UPDATE 行双处生效，防止哨兵落库为 1970 时间戳）
			startTimes[i] = time.Unix(c.StartTimeSeconds, 0)
		}

		_, err := tx.Exec(`
			INSERT INTO cf_contests (id, name, contest_type, phase, duration_seconds, start_time, updated_at)
			SELECT id, name, contest_type, phase, duration_seconds,
				CASE WHEN extract(epoch from start_time) <= 0 THEN NULL ELSE start_time END,
				NOW()
			FROM unnest(
				$1::int[], $2::text[], $3::varchar[], $4::varchar[], $5::int[], $6::timestamptz[]
			) AS t(id, name, contest_type, phase, duration_seconds, start_time)
			ON CONFLICT (id) DO UPDATE SET
				name = EXCLUDED.name,
				phase = EXCLUDED.phase,
				start_time = CASE WHEN extract(epoch from EXCLUDED.start_time) <= 0 THEN NULL ELSE EXCLUDED.start_time END,
				updated_at = NOW()
		`, pq.Array(ids), pq.Array(names), pq.Array(types),
			pq.Array(phases), pq.Array(durations), pq.Array(startTimes))
		if err != nil {
			return err
		}
	}

	if err := tx.Commit(); err != nil {
		return err
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
