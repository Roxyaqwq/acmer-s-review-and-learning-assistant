package handlers

import "testing"

func TestPaginateClampsTheValuesAClientCanSend(t *testing.T) {
	cases := []struct {
		name        string
		page, limit int
		wantLimit   int
		wantOffset  int
	}{
		{"defaults", 1, defaultProblemPageSize, 30, 0},
		{"second page", 2, 30, 30, 30},
		{"limit above the cap", 1, 100000, maxProblemPageSize, 0},
		{"limit zero", 1, 0, defaultProblemPageSize, 0},
		{"negative limit", 3, -5, defaultProblemPageSize, 60},
		{"page zero", 0, 20, 20, 0},
		{"negative page", -4, 20, 20, 0},
		{"page one with cap", 1, 99, 99, 0},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			limit, offset := paginate(tc.page, tc.limit)
			if limit != tc.wantLimit {
				t.Fatalf("limit = %d, want %d", limit, tc.wantLimit)
			}
			if offset != tc.wantOffset {
				t.Fatalf("offset = %d, want %d", offset, tc.wantOffset)
			}
			if offset < 0 {
				t.Fatalf("offset must never be negative, got %d", offset)
			}
		})
	}
}

func TestPageForOffsetRoundTrips(t *testing.T) {
	for page := 1; page <= 5; page++ {
		_, offset := paginate(page, 30)
		if got := pageForOffset(offset, 30); got != page {
			t.Fatalf("pageForOffset(%d, 30) = %d, want %d", offset, got, page)
		}
	}
}
