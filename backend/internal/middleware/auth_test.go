package middleware

import (
	"encoding/json"
	"io"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

const testSecret = "test-secret"

// locals mirrors what a downstream handler can see. Reading c.Locals after
// app.Test returns is not allowed (fasthttp recycles the request context), so
// the echo handler is the only place allowed to touch it.
type locals struct {
	UserID *string `json:"user_id"`
	Login  *string `json:"login"`
}

func sign(t *testing.T, method jwt.SigningMethod, claims jwt.MapClaims) string {
	t.Helper()
	token := jwt.NewWithClaims(method, claims)
	signed, err := token.SignedString([]byte(testSecret))
	if err != nil {
		t.Fatalf("signing failed: %v", err)
	}
	return signed
}

func validClaims() jwt.MapClaims {
	return jwt.MapClaims{"sub": "user-1", "login": "octocat"}
}

// call runs handler and reports the status code plus the locals it produced.
func call(t *testing.T, handler fiber.Handler, token string) (int, locals) {
	t.Helper()
	app := fiber.New()
	app.Get("/", handler, func(c *fiber.Ctx) error {
		out := locals{}
		if v, ok := c.Locals("user_id").(string); ok {
			out.UserID = &v
		}
		if v, ok := c.Locals("github_login").(string); ok {
			out.Login = &v
		}
		return c.JSON(out)
	})

	req := httptest.NewRequest("GET", "/", nil)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	res, err := app.Test(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	body, err := io.ReadAll(res.Body)
	if err != nil {
		t.Fatalf("reading body failed: %v", err)
	}
	got := locals{}
	if len(body) > 0 && res.StatusCode == 200 {
		if err := json.Unmarshal(body, &got); err != nil {
			t.Fatalf("decoding body %q failed: %v", body, err)
		}
	}
	return res.StatusCode, got
}

func TestAuthRequiredAcceptsAnHS256Token(t *testing.T) {
	status, got := call(t, AuthRequired(testSecret), sign(t, jwt.SigningMethodHS256, validClaims()))
	if status != 200 {
		t.Fatalf("status = %d, want 200", status)
	}
	if got.UserID == nil || *got.UserID != "user-1" {
		t.Fatalf("user_id = %v, want user-1", got.UserID)
	}
	if got.Login == nil || *got.Login != "octocat" {
		t.Fatalf("login = %v, want octocat", got.Login)
	}
}

// A token signed with a different HMAC algorithm must not be accepted just
// because the same secret verifies it.
func TestAuthRequiredRejectsAnotherAlgorithmFamily(t *testing.T) {
	status, _ := call(t, AuthRequired(testSecret), sign(t, jwt.SigningMethodHS512, validClaims()))
	if status != 401 {
		t.Fatalf("status = %d, want 401", status)
	}
}

func TestAuthRequiredRejectsATokenWithoutSubject(t *testing.T) {
	token := sign(t, jwt.SigningMethodHS256, jwt.MapClaims{"login": "octocat"})
	status, _ := call(t, AuthRequired(testSecret), token)
	if status != 401 {
		t.Fatalf("status = %d, want 401", status)
	}
}

func TestOptionalAuthAttachesIdentity(t *testing.T) {
	status, got := call(t, OptionalAuth(testSecret), sign(t, jwt.SigningMethodHS256, validClaims()))
	if status != 200 {
		t.Fatalf("status = %d, want 200", status)
	}
	if got.UserID == nil || *got.UserID != "user-1" {
		t.Fatalf("user_id = %v, want user-1", got.UserID)
	}
}

func TestOptionalAuthTreatsUnknownTokenAsAnonymous(t *testing.T) {
	status, got := call(t, OptionalAuth(testSecret), sign(t, jwt.SigningMethodHS512, validClaims()))
	if status != 200 {
		t.Fatalf("status = %d, want 200", status)
	}
	if got.UserID != nil {
		t.Fatalf("user_id = %v, want nil for an anonymous request", *got.UserID)
	}
}

func TestOptionalAuthWithoutHeaderIsAnonymous(t *testing.T) {
	status, got := call(t, OptionalAuth(testSecret), "")
	if status != 200 {
		t.Fatalf("status = %d, want 200", status)
	}
	if got.UserID != nil {
		t.Fatalf("user_id = %v, want nil", *got.UserID)
	}
}
