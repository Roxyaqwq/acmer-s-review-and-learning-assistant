package handlers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"algoarena/internal/config"
	"algoarena/internal/models"
	"algoarena/internal/services"
	"algoarena/internal/utils"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jmoiron/sqlx"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/github"
)

type AuthHandler struct {
	DB         *sqlx.DB
	Config     *config.Config
	OAuthCfg   *oauth2.Config
	oauthState sync.Map // state string → creation time
}

func NewAuthHandler(db *sqlx.DB, cfg *config.Config) *AuthHandler {
	return &AuthHandler{
		DB:     db,
		Config: cfg,
		OAuthCfg: &oauth2.Config{
			ClientID:     cfg.GithubClientID,
			ClientSecret: cfg.GithubClientSecret,
			RedirectURL:  cfg.GithubRedirectURL,
			Scopes:       []string{"read:user"},
			Endpoint:     github.Endpoint,
		},
	}
}

func (h *AuthHandler) GithubLogin(c *fiber.Ctx) error {
	b := make([]byte, 16)
	rand.Read(b)
	state := hex.EncodeToString(b)
	h.oauthState.Store(state, time.Now())
	url := h.OAuthCfg.AuthCodeURL(state, oauth2.AccessTypeOnline)
	return c.Redirect(url, http.StatusTemporaryRedirect)
}

func (h *AuthHandler) GithubCallback(c *fiber.Ctx) error {
	code := c.Query("code")
	state := c.Query("state")
	if code == "" {
		return utils.Error(c, 400, "missing code")
	}

	// Validate OAuth state parameter (CSRF protection)
	if state == "" {
		return utils.Error(c, 400, "missing state")
	}
	val, exists := h.oauthState.LoadAndDelete(state)
	if !exists {
		return utils.Error(c, 400, "invalid state parameter")
	}
	if createdAt, ok := val.(time.Time); ok && time.Since(createdAt) > 5*time.Minute {
		return utils.Error(c, 400, "state parameter expired")
	}

	token, err := h.OAuthCfg.Exchange(context.Background(), code)
	if err != nil {
		return utils.Error(c, 500, "GitHub OAuth exchange failed")
	}

	client := h.OAuthCfg.Client(context.Background(), token)
	resp, err := client.Get("https://api.github.com/user")
	if err != nil {
		return utils.Error(c, 500, "failed to fetch GitHub user")
	}
	defer resp.Body.Close()

	var ghUser struct {
		ID        int64  `json:"id"`
		Login     string `json:"login"`
		AvatarURL string `json:"avatar_url"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&ghUser); err != nil {
		return utils.Error(c, 500, "failed to decode GitHub user")
	}

	var user models.User
	err = h.DB.Get(&user, `SELECT * FROM users WHERE github_id = $1`, ghUser.ID)
	if err != nil {
		_, err = h.DB.Exec(`
			INSERT INTO users (github_id, github_login, github_avatar_url, avatar_url)
			VALUES ($1, $2, $3, $3)
		`, ghUser.ID, ghUser.Login, ghUser.AvatarURL)
		if err != nil {
			return utils.Error(c, 500, "failed to create user")
		}
		err = h.DB.Get(&user, `SELECT * FROM users WHERE github_id = $1`, ghUser.ID)
		if err != nil {
			return utils.Error(c, 500, "failed to fetch user")
		}
	}

	jwtToken := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":   user.ID,
		"login": user.GithubLogin,
		"iat":   time.Now().Unix(),
		"exp":   time.Now().Add(30 * 24 * time.Hour).Unix(),
	})

	tokenStr, err := jwtToken.SignedString([]byte(h.Config.JWTSecret))
	if err != nil {
		return utils.Error(c, 500, "failed to generate token")
	}

	redirectURL := fmt.Sprintf("%s/auth/callback?token=%s", h.Config.FrontendURL, tokenStr)
	return c.Redirect(redirectURL, http.StatusTemporaryRedirect)
}

func (h *AuthHandler) GetMe(c *fiber.Ctx) error {
	uid := c.Locals("user_id").(string)
	var user models.User
	err := h.DB.Get(&user, `SELECT * FROM users WHERE id = $1`, uid)
	if err != nil {
		return utils.Error(c, 404, "user not found")
	}
	user.TopTags = getTopTagNames(h.DB, uid)
	return utils.Success(c, user)
}

func (h *AuthHandler) BindCF(c *fiber.Ctx) error {
	uid := c.Locals("user_id").(string)

	var body struct {
		Handle string `json:"handle"`
	}
	if err := c.BodyParser(&body); err != nil || body.Handle == "" {
		return utils.Error(c, 400, "invalid handle")
	}

	cfUser, err := services.FetchCFUserInfo(body.Handle)
	if err != nil {
		return utils.Error(c, 400, "Codeforces用户不存在: "+body.Handle)
	}

	_, err = h.DB.Exec(`
		UPDATE users SET cf_handle = $1, cf_rating = $2, cf_max_rating = $3, cf_rank = $4, updated_at = NOW()
		WHERE id = $5
	`, cfUser.Handle, cfUser.Rating, cfUser.MaxRating, cfUser.Rank, uid)
	if err != nil {
		return utils.Error(c, 500, "绑定失败，该CF账号可能已被绑定")
	}

	return utils.Success(c, fiber.Map{
		"handle":     cfUser.Handle,
		"rating":     cfUser.Rating,
		"max_rating": cfUser.MaxRating,
		"rank":       cfUser.Rank,
	})
}

func (h *AuthHandler) UpdateProfile(c *fiber.Ctx) error {
	uid := c.Locals("user_id").(string)
	var body models.UserUpdate
	if err := c.BodyParser(&body); err != nil {
		return utils.Error(c, 400, "invalid body")
	}

	// Input validation
	if body.Nickname != nil {
		if len(*body.Nickname) > 50 {
			return utils.Error(c, 400, "昵称不能超过50个字符")
		}
	}
	if body.Signature != nil {
		if len(*body.Signature) > 200 {
			return utils.Error(c, 400, "签名不能超过200个字符")
		}
	}
	validateURL := func(url *string, field string) error {
		if url == nil || *url == "" {
			return nil
		}
		if len(*url) > 500 {
			return utils.Error(c, 400, field+"链接过长")
		}
		if !strings.HasPrefix(*url, "http://") && !strings.HasPrefix(*url, "https://") && !strings.HasPrefix(*url, "/uploads/") {
			return utils.Error(c, 400, field+"必须是有效的URL")
		}
		return nil
	}
	if err := validateURL(body.AvatarURL, "头像"); err != nil {
		return err
	}
	if err := validateURL(body.BackgroundURL, "背景图"); err != nil {
		return err
	}

	_, err := h.DB.Exec(`
		UPDATE users SET
			nickname = COALESCE($1, nickname),
			signature = COALESCE($2, signature),
			avatar_url = COALESCE($3, avatar_url),
			background_url = COALESCE($4, background_url),
			allow_view_review = COALESCE($5, allow_view_review),
			updated_at = NOW()
		WHERE id = $6
	`, body.Nickname, body.Signature, body.AvatarURL, body.BackgroundURL, body.AllowViewReview, uid)
	if err != nil {
		return utils.Error(c, 500, "update failed")
	}
	return utils.Success(c, nil)
}

func getTopTagNames(db *sqlx.DB, uid string) []string {
	tagStats, _ := services.GetTopTags(db, uid, 3)
	names := make([]string, len(tagStats))
	for i, s := range tagStats {
		names[i] = s.Tag
	}
	return names
}
