package services

import (
	"fmt"
	"io"
	"net/http"
	"regexp"
	"time"

	"algoarena/internal/models"
)

var atcoderClient = &http.Client{Timeout: 15 * time.Second}

func FetchAtCoderContests() ([]models.PlatformContest, error) {
	url := "https://atcoder.jp/contests"
	resp, err := atcoderClient.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	html := string(body)

	return parseAtCoderContests(html), nil
}

func parseAtCoderContests(html string) []models.PlatformContest {
	var contests []models.PlatformContest

	// Find "Upcoming Contests" table body
	upcomingRe := regexp.MustCompile(`id="contest-table-upcoming"[^>]*>[\s\S]*?<tbody>([\s\S]*?)</tbody>`)
	upcomingMatch := upcomingRe.FindStringSubmatch(html)
	if len(upcomingMatch) < 2 {
		// Also try "Present Contests" in case structure differs
		presentRe := regexp.MustCompile(`id="contest-table-permanent"[^>]*>[\s\S]*?<tbody>([\s\S]*?)</tbody>`)
		presentMatch := presentRe.FindStringSubmatch(html)
		if len(presentMatch) >= 2 {
			// Skip permanent contests
		}
		// Try daily contests too
		dailyRe := regexp.MustCompile(`id="contest-table-daily"[^>]*>[\s\S]*?<tbody>([\s\S]*?)</tbody>`)
		dailyMatch := dailyRe.FindStringSubmatch(html)
		if len(dailyMatch) >= 2 {
			contests = append(contests, parseAtCoderRows(dailyMatch[1])...)
		}
		contests = append(contests, parseAtCoderRows(html)...)
		return contests
	}

	contests = parseAtCoderRows(upcomingMatch[1])
	return contests
}

func parseAtCoderRows(tbody string) []models.PlatformContest {
	var contests []models.PlatformContest

	// Extract each row
	rowRe := regexp.MustCompile(`<tr>([\s\S]*?)</tr>`)
	rows := rowRe.FindAllStringSubmatch(tbody, -1)

	for _, row := range rows {
		if len(row) < 2 {
			continue
		}
		rowHTML := row[1]

		// Extract time from <time> tag
		timeRe := regexp.MustCompile(`<time[^>]*>([^<]+)</time>`)
		timeMatch := timeRe.FindStringSubmatch(rowHTML)
		if len(timeMatch) < 2 {
			continue
		}
		t, err := time.Parse("2006-01-02 15:04:05-0700", timeMatch[1])
		if err != nil {
			continue
		}

		// Extract href and name from <a> tag
		linkRe := regexp.MustCompile(`<a\s+href="(/contests/[^"]+)"[^>]*>([^<]+)</a>`)
		linkMatch := linkRe.FindStringSubmatch(rowHTML)
		if len(linkMatch) < 3 {
			continue
		}
		href := linkMatch[1]
		name := linkMatch[2]

		// Extract duration from the last <td>
		durationRe := regexp.MustCompile(`<td[^>]*>(\d{2}):(\d{2})</td>`)
		durMatch := durationRe.FindStringSubmatch(rowHTML)
		durationMin := 100
		if len(durMatch) >= 3 {
			hours := 0
			mins := 0
			fmt.Sscanf(durMatch[1], "%d", &hours)
			fmt.Sscanf(durMatch[2], "%d", &mins)
			durationMin = hours*60 + mins
		}

		contests = append(contests, models.PlatformContest{
			Platform:    "AtCoder",
			ContestID:   href,
			ContestName: name,
			StartTime:   t.Format(time.RFC3339),
			EndTime:     t.Add(time.Duration(durationMin) * time.Minute).Format(time.RFC3339),
			Duration:    durationMin,
			URL:         fmt.Sprintf("https://atcoder.jp%s", href),
		})
	}

	return contests
}

func ParseContestURL(rawURL string) (platform, contestID string) {
	patterns := []struct {
		platform string
		re       *regexp.Regexp
	}{
		{"Codeforces", regexp.MustCompile(`codeforces\.com/contest/(\d+)`)},
		{"Codeforces", regexp.MustCompile(`codeforces\.com/gym/(\d+)`)},
		{"AtCoder", regexp.MustCompile(`atcoder\.jp/contests/(\w+)`)},
		{"Luogu", regexp.MustCompile(`luogu\.com\.cn/contest/(\d+)`)},
		{"NowCoder", regexp.MustCompile(`nowcoder\.com/acm/contest/(\d+)`)},
		{"LeetCode", regexp.MustCompile(`leetcode\.cn/contest/([\w-]+)`)},
	}

	for _, p := range patterns {
		m := p.re.FindStringSubmatch(rawURL)
		if len(m) >= 2 {
			return p.platform, m[1]
		}
	}
	return "", ""
}
