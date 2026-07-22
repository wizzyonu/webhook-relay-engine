package config

import (
	"fmt"
	"github.com/caarlos0/env/v10"
)

// Config holds all environment-driven configuration.
type Config struct {
	// Server
	Port int `env:"PORT" envDefault:"3000"`

	// PostgreSQL
	DatabaseURL string `env:"DATABASE_URL,required"`

	// Redis
	RedisURL string `env:"REDIS_URL,required"`

	// Security
	WebhookSigningSecret string `env:"WEBHOOK_SIGNING_SECRET,required"`
}

// Load parses environment variables into the Config struct.
func Load() (*Config, error) {
	cfg := &Config{}
	if err := env.Parse(cfg); err != nil {
		return nil, fmt.Errorf("failed to parse config: %w", err)
	}
	return cfg, nil
}