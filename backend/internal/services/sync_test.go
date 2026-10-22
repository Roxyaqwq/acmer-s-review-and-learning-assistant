package services

import (
	"errors"
	"testing"
)

// A sync run holds cfSyncMu for its whole lifetime; the second caller must be
// refused immediately instead of opening a competing transaction and adding
// more load on the Codeforces API.
func TestSyncCFProblemsToDBRefusesConcurrentRun(t *testing.T) {
	cfSyncMu.Lock()
	defer cfSyncMu.Unlock()

	// nil DB is deliberate: a refusal has to happen before the first query.
	err := SyncCFProblemsToDB(nil)
	if !errors.Is(err, ErrSyncInProgress) {
		t.Fatalf("got %v, want ErrSyncInProgress", err)
	}
}

func TestSyncCFContestsToDBRefusesConcurrentRun(t *testing.T) {
	cfSyncMu.Lock()
	defer cfSyncMu.Unlock()

	err := SyncCFContestsToDB(nil)
	if !errors.Is(err, ErrSyncInProgress) {
		t.Fatalf("got %v, want ErrSyncInProgress", err)
	}
}

func TestSyncMutexIsReleasedAfterRefusal(t *testing.T) {
	cfSyncMu.Lock()
	_ = SyncCFProblemsToDB(nil)
	cfSyncMu.Unlock()

	if !cfSyncMu.TryLock() {
		t.Fatal("mutex still held after a refused run returned")
	}
	cfSyncMu.Unlock()
}
