package middleware

import (
	"strings"

	"algoarena/internal/utils"

	jwtware "github.com/gofiber/contrib/jwt"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

const signingMethod = "HS256"

// claimsUserID pulls the subject out of a token. Both middlewares go through it
// so a token that somehow parses without a usable subject turns into a 401/anon
// request instead of a panic on the later `c.Locals("user_id").(string)`.
func claimsUserID(claims jwt.MapClaims) (userID, login string, ok bool) {
	userID, _ = claims["sub"].(string)
	if userID == "" {
		return "", "", false
	}
	login, _ = claims["login"].(string)
	return userID, login, true
}

func AuthRequired(secret string) fiber.Handler {
	return jwtware.New(jwtware.Config{
		SigningKey: jwtware.SigningKey{Key: []byte(secret), JWTAlg: signingMethod},
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			return utils.Error(c, 401, "未登录或登录已过期")
		},
		SuccessHandler: func(c *fiber.Ctx) error {
			token := c.Locals("user").(*jwt.Token)
			claims, isMap := token.Claims.(jwt.MapClaims)
			if !isMap {
				return utils.Error(c, 401, "未登录或登录已过期")
			}
			userID, login, ok := claimsUserID(claims)
			if !ok {
				return utils.Error(c, 401, "未登录或登录已过期")
			}
			c.Locals("user_id", userID)
			c.Locals("github_login", login)
			return c.Next()
		},
	})
}

// OptionalAuth never rejects: it either attaches the caller's identity or lets
// the request through anonymously. The explicit method list matters because the
// keyfunc below hands back a symmetric secret for whatever algorithm the token
// claims.
func OptionalAuth(secret string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		auth := c.Get("Authorization")
		if auth == "" || !strings.HasPrefix(auth, "Bearer ") {
			return c.Next()
		}
		tokenStr := strings.TrimPrefix(auth, "Bearer ")
		token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
			return []byte(secret), nil
		}, jwt.WithValidMethods([]string{signingMethod}))
		if err == nil && token.Valid {
			if claims, isMap := token.Claims.(jwt.MapClaims); isMap {
				if userID, login, ok := claimsUserID(claims); ok {
					c.Locals("user_id", userID)
					c.Locals("github_login", login)
				}
			}
		}
		return c.Next()
	}
}
