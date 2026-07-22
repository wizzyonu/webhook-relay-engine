# 🚀 Webhook Relay & Replay Engine

A high-performance, idempotent, production-grade Webhook Ingestion, Async Dispatch, and Management Engine built in Go following **Clean Architecture (Hexagonal Architecture)** principles.

This repository implements a resilient event-driven relay system capable of processing, verifying, queuing, dispatching, and replaying webhooks at scale with full auditability, open observability, and zero state corruption.

---

## 📋 Table of Contents

- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Finite State Machine (FSM)](#-finite-state-machine-fsm)
- [Database Schema & Keyset Pagination](#-database-schema--keyset-pagination)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment Variables](#environment-variables)
  - [Spinning Up Infrastructure](#spinning-up-infrastructure)
  - [Running the Application](#running-the-application)
- [API Reference](#-api-reference)
  - [Ingest Webhook](#1-ingest-webhook)
  - [List Events (Cursor Paginated)](#2-list-events-cursor-paginated)
  - [Get Event Details](#3-get-event-details)
  - [Replay Failed Event](#4-replay-failed-event)
- [Background Worker & Async Dispatch](#-background-worker--async-dispatch)
- [Observability & Security](#-observability--security)
- [Testing & Load Testing](#-testing--load-testing)
- [Development Commands](#-development-commands)

---

## ✨ Key Features

- **Strict Cryptographic Signature Verification**: Validates inbound payloads using HMAC SHA-256 (`X-Webhook-Signature`).
- **Distributed Idempotency Engine**: Enforces exactly-once ingestion guarantees backed by Redis caching to prevent duplicate processing.
- **Strict Event Lifecycle FSM**: Prevents race conditions and illegal state transitions across ingestion, queueing, dispatching, and failures.
- **Async Concurrent Dispatch Worker**: Background worker pool consuming from Redis queue with delayed retry capabilities.
- **Keyset (Cursor-Based) Pagination**: Optimized composite index database queries `O(log N)` for virtualized frontend data grids handling 100k+ events without offset latency penalties.
- **Full Auditability**: Logs every single delivery attempt with status codes, latency in milliseconds, error messages, and timestamps.
- **Dead-Letter Queue & Optimistic Replays**: Instant transition of failed or dead-lettered events back into queued state via REST endpoints.
- **OpenTelemetry Tracing**: Built-in OpenTelemetry trace propagation across the full request lifecycle.
- **Graceful Shutdown**: Handles OS signals (`SIGINT`, `SIGTERM`), allowing in-flight worker tasks and HTTP requests to drain cleanly within a configurable timeout.

---

## System Architecture

The project adheres to **Clean Architecture** (Hexagonal Architecture), separating business rules from infrastructure details.

```
                      +------------------------+
                      | Inbound Webhook Source |
                      +-----------+------------+
                                  |
                        POST /webhooks/ingest
                                  v
+-------------------------------------------------------------------+
|                     GIN HTTP ADAPTER LAYER                        |
|   - Rate Limiter (Token Bucket)                                   |
|   - HMAC Signature Verification                                   |
+---------------------------------+---------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------+
|                     APPLICATION USE CASES                         |
|   - IngestWebhookUseCase                                          |
|   - DispatchWebhookUseCase                                        |
|   - ReplayEventUseCase                                            |
|   - ListEventsUseCase                                             |
+--------+------------------------+------------------------+--------+
         |                        |                        |
         v                        v                        v
+------------------+     +------------------+     +------------------+
|  DOMAIN ENTITY   |     | REDIS ADAPTER    |     | POSTGRES ADAPTER |
|  - WebhookEvent  |     | - Idempotency    |     | - EventRepo      |
|  - Strict FSM    |     | - Message Queue  |     | - Audit Logs     |
+------------------+     +--------+---------+     +------------------+
                                  |
                                  v
                         +------------------+
                         | DISPATCH WORKER  |
                         | - Concurrent Pool|
                         | - HTTP Client    |
                         +--------+---------+
                                  |
                                  v
                      +-----------------------+
                      | Downstream Target URL |
                      +-----------------------+
```

---

## 🔄 Finite State Machine (FSM)

Every `WebhookEvent` follows a strict Finite State Machine defined in [`internal/domain/entities/fsm.go`](file:///c:/Users/MableTech/projects/WebHook2.0/webhook-relay/internal/domain/entities/fsm.go). Invalid state transitions are rejected at both the domain code and database levels.

```
[ INGESTED ] ---> [ QUEUED ] ---> [ DISPATCHING ] ---> [ SUCCESS ] (Terminal)
                      ^                   |
                      |                   v
                      +------------- [ FAILED ] ---> [ DEAD_LETTER ] (Terminal)
                         (Replay)
```

| Current State | Allowed Next States | Description |
| :--- | :--- | :--- |
| `INGESTED` | `QUEUED` | Webhook accepted and signature verified. |
| `QUEUED` | `DISPATCHING` | Event enqueued in Redis queue awaiting worker processing. |
| `DISPATCHING` | `SUCCESS`, `FAILED` | Worker currently transmitting payload to target URL. |
| `FAILED` | `QUEUED`, `DEAD_LETTER` | Delivery attempt failed; can be retried/replayed or marked dead. |
| `SUCCESS` | *None* | Event delivered successfully (Terminal State). |
| `DEAD_LETTER` | *None* | Event failed max retries and moved to Dead Letter Queue (Terminal State). |

---

## 🗄️ Database Schema & Keyset Pagination

PostgreSQL is configured with strict ENUM types and composite indexes for high-throughput queries.

### Schema (`db/migrations/00001_init_schema.up.sql`)

```sql
CREATE TYPE webhook_status AS ENUM (
    'INGESTED', 'QUEUED', 'DISPATCHING', 'SUCCESS', 'FAILED', 'DEAD_LETTER'
);

CREATE TABLE webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key UUID NOT NULL UNIQUE,
    target_url TEXT NOT NULL,
    status webhook_status NOT NULL DEFAULT 'INGESTED',
    trace_id TEXT NOT NULL,
    payload JSONB NOT NULL,
    headers JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Keyset Pagination Index for high-performance cursor queries
CREATE INDEX idx_webhook_events_cursor ON webhook_events(status, created_at DESC, id DESC);

CREATE TABLE delivery_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES webhook_events(id) ON DELETE CASCADE,
    attempt_number INT NOT NULL,
    status_code INT, -- NULL on network timeouts
    error_message TEXT,
    duration_ms INT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 📁 Project Structure

```
webhook-relay/
├── cmd/
│   └── api/
│       └── main.go                 # Server entry point & dependency wiring
├── internal/
│   ├── domain/                     # Pure Domain Entities & Port Interfaces
│   │   ├── entities/
│   │   │   ├── webhook_event.go    # Aggregate root (WebhookEvent, DeliveryAttempt)
│   │   │   └── fsm.go              # Strict Finite State Machine rules
│   │   └── ports/
│   │       ├── inbound.go          # Application Input Ports
│   │       └── outbound.go         # Adapters & Repository Interfaces
│   ├── application/                # Business Use Cases
│   │   └── usecases/
│   │       ├── ingest_webhook.go   # HMAC check, idempotency check, queueing
│   │       ├── dispatch_webhook.go # HTTP dispatch execution & attempt recording
│   │       ├── list_events.go      # Keyset paginated event list
│   │       └── replay_event.go     # Transition state back to QUEUED & re-enqueue
│   └── infrastructure/             # Driven Adapters & Infrastructure Implementations
│       ├── cache/redis/            # Redis Idempotency Cache
│       ├── config/                 # Environment Configuration loader
│       ├── external/http_client/   # Resilient HTTP Dispatcher
│       ├── http/gin/               # Gin REST Router & Middleware
│       │   ├── handlers/           # HTTP Handlers (Ingest, Events)
│       │   └── middleware/         # Signature check & Rate limiting
│       ├── messaging/queue/        # Redis Queue & Background Worker Pool
│       ├── observability/otel/     # OpenTelemetry Tracing setup
│       ├── persistence/postgres/   # PGX Event Repository
│       └── pkg/                    # Core Utilities (UUID Generator, Validator)
├── db/
│   └── migrations/                 # PostgreSQL Up/Down Migration SQL scripts
├── tests/
│   ├── integration/                # Testcontainers integration tests
│   └── load/                       # K6 load testing scripts
├── openapi.yaml                    # OpenAPI 3.1.0 API Contract
├── docker-compose.yml              # PostgreSQL 16 & Redis 7 stack setup
├── .env                            # Local development environment configuration
├── .air.toml                       # Live reload config for Air
├── makefile                        # Build and test commands
└── go.mod                          # Go module dependencies
```

---

## 🛠️ Getting Started

### Prerequisites

- **Go**: Version `1.26+`
- **Docker & Docker Compose**: For local PostgreSQL and Redis containers
- **Air** *(Optional)*: For live-reloading during local development (`go install github.com/air-verse/air@latest`)

### Environment Variables

Create or update your `.env` file in the root directory:

```env
PORT=3000
DATABASE_URL=postgres://elite_relay:Enuguonu20@localhost:5433/webhook_relay?sslmode=disable
REDIS_URL=redis://:secure_redis_pass@localhost:6379/0
WEBHOOK_SIGNING_SECRET=UX2mIQWtej46BIE4EYv/Z2ymoQbcO9hCu85sBh8/y7Y=
```

### Spinning Up Infrastructure

Launch the PostgreSQL and Redis containers via Docker Compose:

```bash
docker compose up -d
```

Verify services are healthy:
- **PostgreSQL**: Listening on port `5433`
- **Redis**: Listening on port `6379`

### Running the Application

Using **Make**:
```bash
# Run with live reload (Air)
make run

# Build binary
make build

# Run unit tests
make test
```

Or using **Go CLI**:
```bash
go run ./cmd/api/main.go
```

---

## 📡 API Reference

Complete OpenAPI 3.1 contract available in [`openapi.yaml`](file:///c:/Users/MableTech/projects/WebHook2.0/webhook-relay/openapi.yaml).

### 1. Ingest Webhook

Ingests raw payload, validates HMAC signature, checks idempotency, and enqueues event for async delivery.

- **URL**: `POST /api/v1/webhooks/ingest`
- **Headers**:
  - `Content-Type: application/json`
  - `X-Webhook-Signature: sha256=<hmac_hex_digest>` *(Required)*
  - `X-Target-URL: https://target.example.com/webhook` *(Optional)*

**Example Request:**
```bash
curl -X POST http://localhost:3000/api/v1/webhooks/ingest \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: sha256=a1b2c3..." \
  -H "X-Target-URL: https://httpbin.org/post" \
  -d '{"event": "user.created", "user_id": "12345"}'
```

**Response (`202 Accepted`):**
```json
{
  "event_id": "c1f7a8b4-93e1-4c6e-8d5f-2a3b4c5d6e7f",
  "idempotency_key": "e3b0c442-98fc-1c14-9afbf-4c8996fb9242",
  "status": "QUEUED"
}
```

---

### 2. List Events (Cursor Paginated)

Retrieves a paginated list of events using cursor-based pagination.

- **URL**: `GET /api/v1/webhooks/events`
- **Query Parameters**:
  - `cursor`: Opaque cursor for next page.
  - `limit`: Integer (Default `50`, Max `100`).
  - `status`: Filter by status (`INGESTED`, `QUEUED`, `DISPATCHING`, `SUCCESS`, `FAILED`, `DEAD_LETTER`).

**Response (`200 OK`):**
```json
{
  "items": [
    {
      "id": "c1f7a8b4-93e1-4c6e-8d5f-2a3b4c5d6e7f",
      "idempotency_key": "e3b0c442-98fc-1c14-9afbf-4c8996fb9242",
      "target_url": "https://httpbin.org/post",
      "status": "SUCCESS",
      "trace_id": "0af7651916cd43dd8448eb211c80319c",
      "payload": { "event": "user.created" },
      "created_at": "2026-07-21T06:00:00Z",
      "updated_at": "2026-07-21T06:00:02Z"
    }
  ],
  "next_cursor": "eyJpZCI6ImMxZjdhOGI0Li4uIn0=",
  "has_more": true
}
```

---

### 3. Get Event Details

Fetches full details for a specific webhook event including all historical delivery attempts.

- **URL**: `GET /api/v1/webhooks/events/{eventId}`

**Response (`200 OK`):**
```json
{
  "id": "c1f7a8b4-93e1-4c6e-8d5f-2a3b4c5d6e7f",
  "status": "FAILED",
  "target_url": "https://httpbin.org/status/500",
  "delivery_attempts": [
    {
      "attempt_number": 1,
      "status_code": 500,
      "error_message": "Internal Server Error from downstream target",
      "duration_ms": 230,
      "timestamp": "2026-07-21T06:01:00Z"
    }
  ]
}
```

---

### 4. Replay Failed Event

Transitions a `FAILED` or `DEAD_LETTER` event back to `QUEUED` and enqueues it for immediate redelivery.

- **URL**: `POST /api/v1/webhooks/events/{eventId}/replay`

**Response (`202 Accepted`):**
```json
{
  "id": "c1f7a8b4-93e1-4c6e-8d5f-2a3b4c5d6e7f",
  "status": "QUEUED",
  "updated_at": "2026-07-21T06:05:00Z"
}
```

---

## ⚡ Background Worker & Async Dispatch

When an event enters `QUEUED` state, it is published to a Redis queue. 

- **Worker Pool**: `cmd/api/main.go` spawns 10 concurrent worker goroutines.
- **Delivery Workflow**:
  1. Worker pulls `event_id` from Redis queue.
  2. Sets event status to `DISPATCHING`.
  3. Sends HTTP POST request to `target_url` containing original headers and payload.
  4. Records `DeliveryAttempt` log entry in Postgres (including response code and duration).
  5. Updates event status to `SUCCESS` if status code is `2xx`, or `FAILED` if downstream fails/times out.
  6. Supports delayed re-queueing for retries.

---

## 🛡️ Observability & Security

- **OpenTelemetry**: Integrated stdout tracer provider (`go.opentelemetry.io/otel`) propagates trace IDs through context.
- **Rate Limiting**: Integrated token-bucket rate limiter (`golang.org/x/time/rate`) set to 10 req/s (burst of 20) protecting ingestion endpoints.
- **HMAC Signatures**: Prevents forged payload submissions by computing SHA-256 HMAC digest against `WEBHOOK_SIGNING_SECRET`.

---

## 🧪 Testing & Load Testing

### Unit & Integration Testing

Run tests with Go test runner:

```bash
go test -v ./...
```

*Note: Integration tests in `tests/integration/` utilize `Testcontainers` to spin up real PostgreSQL and Redis containers on demand.*

### Load Testing with K6

Load test scripts are stored under `tests/load/`:
- `gateway_only_test.js`: Ingestion benchmark.
- `fullstack_test.js`: End-to-end ingestion and dispatch throughput test.

To run K6 load tests:

```bash
k6 run tests/load/gateway_only_test.js
```

---

## 📜 Development Commands

| Command | Action |
| :--- | :--- |
| `make run` | Starts the application with live-reloading enabled (via Air). |
| `make build` | Compiles production binary to `bin/webhook-relay.exe`. |
| `make test` | Runs all tests recursively with verbose output. |
| `docker compose up -d` | Starts PostgreSQL & Redis containers in background. |
| `docker compose down -v` | Tears down local containers and removes persistent volumes. |

---

## 📄 License

Internal Proprietary Codebase — Developed by Elite Engineering Team.
