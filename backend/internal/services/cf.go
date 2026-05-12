package services

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

const cfAPIBase = "https://codeforces.com/api"

var cfClient = &http.Client{Timeout: 15 * time.Second}

type CFUserInfo struct {
	Handle string `json:"handle"`
	Rating int    `json:"rating"`
	MaxRating int `json:"maxRating"`
	Rank   string `json:"rank"`
}

type CFProblemResult struct {
	ContestID    int      `json:"contestId"`
	ProblemIndex string   `json:"index"`
	Name         string   `json:"name"`
	Rating       int      `json:"rating"`
	Tags         []string `json:"tags"`
	SolvedCount  int      `json:"solvedCount"`
}

type CFContestResult struct {
	ID              int    `json:"id"`
	Name            string `json:"name"`
	Type            string `json:"type"`
	Phase           string `json:"phase"`
	DurationSeconds int    `json:"durationSeconds"`
	StartTimeSeconds int64 `json:"startTimeSeconds"`
}

type CFSubmissionResult struct {
	ID                  int    `json:"id"`
	ContestID           int    `json:"contestId"`
	Problem             struct {
		ContestID int    `json:"contestId"`
		Index     string `json:"index"`
	} `json:"problem"`
	Verdict  string `json:"verdict"`
	CreationTimeSeconds int64 `json:"creationTimeSeconds"`
	ProgrammingLanguage string `json:"programmingLanguage"`
}

type CFStatusResponse struct {
	Status string `json:"status"`
	Result []CFSubmissionResult `json:"result"`
}

type CFUserResponse struct {
	Status string       `json:"status"`
	Result []CFUserInfo `json:"result"`
}

type CFProblemResponse struct {
	Status string             `json:"status"`
	Result struct {
		Problems          []CFProblemResult `json:"problems"`
		ProblemStatistics []struct {
			ContestID   int    `json:"contestId"`
			ProblemIndex string `json:"index"`
			SolvedCount int    `json:"solvedCount"`
		} `json:"problemStatistics"`
	} `json:"result"`
}

type CFContestResponse struct {
	Status string            `json:"status"`
	Result []CFContestResult `json:"result"`
}

func FetchCFUserInfo(handle string) (*CFUserInfo, error) {
	url := fmt.Sprintf("%s/user.info?handles=%s", cfAPIBase, handle)
	resp, err := cfClient.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var data CFUserResponse
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}
	if data.Status != "OK" || len(data.Result) == 0 {
		return nil, fmt.Errorf("user not found: %s", handle)
	}
	return &data.Result[0], nil
}

func FetchCFProblems() ([]CFProblemResult, error) {
	url := fmt.Sprintf("%s/problemset.problems", cfAPIBase)
	resp, err := cfClient.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var data CFProblemResponse
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}
	if data.Status != "OK" {
		return nil, fmt.Errorf("CF API error")
	}

	problems := make([]CFProblemResult, len(data.Result.Problems))
	for i, p := range data.Result.Problems {
		p.SolvedCount = data.Result.ProblemStatistics[i].SolvedCount
		problems[i] = p
	}
	return problems, nil
}

func FetchCFContests() ([]CFContestResult, error) {
	url := fmt.Sprintf("%s/contest.list?gym=false", cfAPIBase)
	resp, err := cfClient.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var data CFContestResponse
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}
	if data.Status != "OK" {
		return nil, fmt.Errorf("CF API error")
	}
	return data.Result, nil
}

func FetchCFSubmissions(handle string, count int) ([]CFSubmissionResult, error) {
	url := fmt.Sprintf("%s/user.status?handle=%s&from=1&count=%d", cfAPIBase, handle, count)
	resp, err := cfClient.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var data CFStatusResponse
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}
	if data.Status != "OK" {
		return nil, fmt.Errorf("CF API error")
	}
	return data.Result, nil
}
