package handlers

import (
	"testing"
	"time"
)

// The daily row is keyed by the date the learner wakes up in, not by UTC. The
// interesting moment is 00:00–08:00 in UTC+8: the date has already rolled over
// locally while UTC still says yesterday.
func TestDailyDateUsesTheLearningTimezone(t *testing.T) {
	cases := []struct {
		name string
		now  time.Time
		want string
	}{
		{"just after local midnight", time.Date(2026, 10, 22, 16, 5, 0, 0, time.UTC), "2026-10-23"},
		{"just before UTC midnight", time.Date(2026, 10, 22, 15, 59, 0, 0, time.UTC), "2026-10-22"},
		{"local noon", time.Date(2026, 10, 22, 4, 0, 0, 0, time.UTC), "2026-10-22"},
		{"year boundary", time.Date(2026, 12, 31, 16, 30, 0, 0, time.UTC), "2027-01-01"},
	}
	for _, tc := range cases {
		if got := dailyDate(tc.now); got != tc.want {
			t.Errorf("%s: dailyDate(%s) = %q, want %q", tc.name, tc.now, got, tc.want)
		}
	}
}

func TestDailyDateIsStableRegardlessOfHostZone(t *testing.T) {
	// Same instant, expressed in two zones; the answer must not depend on which
	// one the caller's clock happens to use.
	utc := time.Date(2026, 10, 22, 17, 0, 0, 0, time.UTC)
	local := utc.In(time.FixedZone("UTC+8", 8*60*60))
	if dailyDate(utc) != dailyDate(local) {
		t.Fatalf("dailyDate depends on the location of its argument: %q vs %q", dailyDate(utc), dailyDate(local))
	}
}

func TestClampCooldownDays(t *testing.T) {
	cases := map[int]int{
		-5:   minCooldownDays,
		0:    minCooldownDays,
		1:    minCooldownDays,
		3:    3,
		7:    7,
		60:   60,
		1000: maxCooldownDays,
	}
	for in, want := range cases {
		if got := clampCooldownDays(in); got != want {
			t.Errorf("clampCooldownDays(%d) = %d, want %d", in, got, want)
		}
	}
}

func TestSwapsLeftNeverGoesNegative(t *testing.T) {
	cases := map[int]int{
		-3: maxDailySwaps,
		0:  maxDailySwaps,
		1:  1,
		2:  0,
		9:  0,
	}
	for skipped, want := range cases {
		if got := swapsLeft(skipped); got != want {
			t.Errorf("swapsLeft(%d) = %d, want %d", skipped, got, want)
		}
	}
}
