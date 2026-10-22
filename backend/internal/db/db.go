package db

import (
	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
)

func Connect(dsn string) (*sqlx.DB, error) {
	db, err := sqlx.Connect("postgres", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	return db, nil
}

func RunMigrations(db *sqlx.DB) error {
	// 版本表由迁移机制自身创建，不占版本号
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
		version TEXT PRIMARY KEY,
		applied_at TIMESTAMPTZ DEFAULT NOW()
	)`); err != nil {
		return err
	}

	// 载入已应用版本集合：已记录的跳过，避免每次启动全量重跑
	var applied []string
	if err := db.Select(&applied, `SELECT version FROM schema_migrations`); err != nil {
		return err
	}
	done := make(map[string]bool, len(applied))
	for _, v := range applied {
		done[v] = true
	}

	migrations := []struct {
		version string
		sql     string
	}{
		{"001", migration001},
		{"002", migration002},
		{"003", migration003},
		{"004", migration004},
		{"005", migration005},
		{"006", migration006},
		{"007", migration007},
		{"008", migration008},
	}
	for _, m := range migrations {
		if done[m.version] {
			continue
		}
		// "执行迁移 + 记录版本"在同一事务内，保证原子性
		tx, err := db.Beginx()
		if err != nil {
			return err
		}
		if _, err := tx.Exec(m.sql); err != nil {
			tx.Rollback()
			return err
		}
		if _, err := tx.Exec(`INSERT INTO schema_migrations (version) VALUES ($1)`, m.version); err != nil {
			tx.Rollback()
			return err
		}
		if err := tx.Commit(); err != nil {
			return err
		}
	}
	return nil
}
