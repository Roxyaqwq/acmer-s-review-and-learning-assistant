package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

const defaultJWTSecret = "dev-secret-change-in-production"

type Config struct {
	DatabaseURL        string
	JWTSecret          string
	GithubClientID     string
	GithubClientSecret string
	GithubRedirectURL  string
	FrontendURL        string
	Port               string
}

func Load() *Config {
	godotenv.Load(".env")
	godotenv.Load("../.env")

	jwtSecret := getEnv("JWT_SECRET", defaultJWTSecret)
	if jwtSecret == defaultJWTSecret {
		if os.Getenv("APP_ENV") == "production" {
			log.Fatal("生产环境禁止使用默认 JWT_SECRET，请设置 JWT_SECRET 环境变量")
		}
		log.Println("警告: JWT_SECRET 未设置或使用默认值，生产环境必须设置安全 secret")
	}

	return &Config{
		DatabaseURL:        getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/algoarena?sslmode=disable"),
		JWTSecret:          jwtSecret,
		GithubClientID:     getEnv("GITHUB_CLIENT_ID", ""),
		GithubClientSecret: getEnv("GITHUB_CLIENT_SECRET", ""),
		GithubRedirectURL:  getEnv("GITHUB_REDIRECT_URL", ""),
		FrontendURL:        getEnv("FRONTEND_URL", "http://localhost:3000"),
		Port:               getEnv("PORT", "8080"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
