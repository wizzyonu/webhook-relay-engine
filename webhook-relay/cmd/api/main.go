package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/elite-engineering/webhook-relay/internal/application/usecases"
	cacheredis "github.com/elite-engineering/webhook-relay/internal/infrastructure/cache/redis"
	"github.com/elite-engineering/webhook-relay/internal/infrastructure/config"
	"github.com/elite-engineering/webhook-relay/internal/infrastructure/external/http_client"
	ginrouter "github.com/elite-engineering/webhook-relay/internal/infrastructure/http/gin"
	"github.com/elite-engineering/webhook-relay/internal/infrastructure/http/gin/handlers"
	"github.com/elite-engineering/webhook-relay/internal/infrastructure/messaging/queue"
	appotel "github.com/elite-engineering/webhook-relay/internal/infrastructure/observability/otel"
	"github.com/elite-engineering/webhook-relay/internal/infrastructure/persistence/postgres"
	gouuid "github.com/elite-engineering/webhook-relay/internal/pkg/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"
	"golang.org/x/time/rate"
)

func main() {
	// 0. Load .env file for local development
	_ = godotenv.Load()

	// 1. Load Configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	ctx := context.Background()

	// 2. Initialize Observability (OpenTelemetry)
	tp, err := appotel.InitTracer("webhook-relay-api")
	if err != nil {
		log.Fatalf("Failed to initialize OpenTelemetry: %v", err)
	}

	// 3. Initialize Infrastructure (Postgres & Redis)
	// ELITE FIX: Parse config to explicitly increase the connection pool size
	pgConfig, err := pgxpool.ParseConfig(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Unable to parse database URL: %v", err)
	}
	
	// Increase MaxConns to handle the 200 VUs + background workers without blocking
	pgConfig.MaxConns = 100 
	
	pgPool, err := pgxpool.NewWithConfig(ctx, pgConfig)
	if err != nil {
		log.Fatalf("Unable to connect to Postgres: %v", err)
	}
	defer pgPool.Close()

	// Parse Redis URL using the official go-redis package
	redisOpts, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		log.Fatalf("Invalid Redis URL: %v", err)
	}
	redisClient := redis.NewClient(redisOpts)
	defer redisClient.Close()

	if err := redisClient.Ping(ctx).Err(); err != nil {
		log.Fatalf("Unable to connect to Redis: %v", err)
	}

	// 4. Initialize Adapters (Implementing Domain Ports)
	eventRepo := postgres.NewEventRepository(pgPool)
	idempotencyCache := cacheredis.NewIdempotencyCache(redisClient)
	msgQueue := queue.NewRedisQueue(redisClient, "webhooks")
	dispatcher := http_client.NewHTTPDispatcher()
	uuidGen := gouuid.NewGenerator()

	// 5. Initialize Application Use Cases
	ingestUC := usecases.NewIngestWebhookUseCase(eventRepo, idempotencyCache, msgQueue, uuidGen, cfg.WebhookSigningSecret)
	listUC := usecases.NewListEventsUseCase(eventRepo)
	replayUC := usecases.NewReplayEventUseCase(eventRepo, msgQueue)
	
	dispatchUC := usecases.NewDispatchWebhookUseCase(eventRepo, dispatcher, msgQueue, 5)

	// 6. Start Background Worker (Async Dispatch Engine)
	workerCtx, workerCancel := context.WithCancel(ctx)
	worker := queue.NewWorker(msgQueue, dispatchUC, 10) // 10 concurrent goroutines
	go worker.Start(workerCtx)
	log.Println("Background dispatch worker started.")

	// 7. Setup HTTP Router & Server
	ingestHandler := handlers.NewIngestHandler(ingestUC)
	eventHandler := handlers.NewEventHandler(listUC, replayUC, eventRepo)
	
	// Initialize Rate Limiter (Temporarily set to 2000 for load testing)
	limiter := rate.NewLimiter(10, 20) 

	router := ginrouter.SetupRouter(ingestHandler, eventHandler, limiter)
	
	srv := &http.Server{
		Addr:    fmt.Sprintf(":%d", cfg.Port),
		Handler: router,
	}

	go func() {
		log.Printf("HTTP Server starting on port %d...", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("HTTP server error: %v", err)
		}
	}()

	// 8. Graceful Shutdown (backend_skills.md §4.C)
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down gracefully...")

	shutdownCtx, shutdownCancel := context.WithTimeout(ctx, 10*time.Second)
	defer shutdownCancel()

	// Stop worker first to prevent new dispatches
	workerCancel() 

	// Shutdown HTTP server
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Fatalf("HTTP server forced to shutdown: %v", err)
	}

	// Flush OpenTelemetry traces before exit
	if err := tp.Shutdown(shutdownCtx); err != nil {
		log.Printf("Error shutting down tracer provider: %v", err)
	}

	log.Println("System exited cleanly.")
}