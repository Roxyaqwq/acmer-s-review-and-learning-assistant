package config

import (
	"os"
	"testing"
)

func TestGetEnvPrefersTheEnvironment(t *testing.T) {
	t.Setenv("ALGOARENA_TEST_KEY", "from-env")
	if got := getEnv("ALGOARENA_TEST_KEY", "fallback"); got != "from-env" {
		t.Fatalf("got %q, want %q", got, "from-env")
	}
}

func TestGetEnvFallsBackWhenUnset(t *testing.T) {
	os.Unsetenv("ALGOARENA_TEST_KEY")
	if got := getEnv("ALGOARENA_TEST_KEY", "fallback"); got != "fallback" {
		t.Fatalf("got %q, want %q", got, "fallback")
	}
}

func TestGetEnvFallsBackWhenEmpty(t *testing.T) {
	t.Setenv("ALGOARENA_TEST_KEY", "")
	if got := getEnv("ALGOARENA_TEST_KEY", "fallback"); got != "fallback" {
		t.Fatalf("got %q, want %q", got, "fallback")
	}
}
