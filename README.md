# 🚀 WebHook 2.0: Idempotent Webhook Relay & Replay Engine

A high-performance, production-grade Webhook Ingestion, Async Dispatch, and Management Dashboard system. WebHook 2.0 guarantees resilient event-driven delivery, idempotency, strict Finite State Machine (FSM) transitions, and real-time observability across inbound webhooks and downstream delivery targets.

---

## 📑 Table of Contents

- [Overview](#-overview)
- [System Architecture & Architecture Diagram](#-system-architecture)
- [Repository Structure](#-repository-structure)
- [Finite State Machine (FSM)](#-finite-state-machine-fsm)
- [Prerequisites](#-prerequisites)
- [Environment Configuration](#-environment-configuration)
- [Quick Start Guide](#-quick-start-guide)
  - [1. Infrastructure Setup](#1-infrastructure-setup)
  - [2. Backend Setup (`webhook-relay`)](#2-backend-setup-webhook-relay)
  - [3. Dashboard Setup (`webhook-relay-dashboard`)](#3-dashboard-setup-webhook-relay-dashboard)
- [Usage & API Guide](#-usage--api-guide)
  - [HMAC Signature Generation](#hmac-signature-generation)
  - [API Endpoints Summary](#api-endpoints-summary)
- [Testing & Quality Assurance](#-testing--quality-assurance)
- [Security & Best Practices](#-security--best-practices)

---

## 🌟 Overview

WebHook 2.0 consists of two core components:

1. **`webhook-relay`**: A Go backend engine built using **Clean (Hexagonal) Architecture**. It provides signature verification (HMAC SHA-256), idempotency checks backed by Redis, asynchronous background dispatch worker pools, keyset-paginated PostgreSQL persistence, and OpenTelemetry tracing.
2. **`webhook-relay-dashboard`**: A modern React + TypeScript + Vite management interface for monitoring event lifecycles, inspecting raw payloads and delivery logs, filtering by event state, and triggering optimistic manual replays.

---

## 🏗️ System Architecture

```
                                  +-----------------------+
                                  | Webhook Event Source  |
                                  +-----------+-----------+
                                              |
                                   POST /webhooks/ingest
                                    (HMAC X-Signature)
                                              v
+-----------------------------------------------------------------------------------+
|                              WEBHOOK 2.0 BACKEND                                  |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  | Gin HTTP Router Layer                                                       |  |
|  | - HMAC SHA-256 Signature Verification                                       |  |
|  | - Rate Limiter (Token Bucket)                                               |  |
|  +-------------------------------------+---------------------------------------+  |
|                                        |                                          |
|                                        v                                          |
|  +-----------------------------------------------------------------------------+  |
|  | Application Core & Use Cases                                                |  |
|  | - IngestWebhook / DispatchWebhook / ReplayEvent / ListEvents                  |  |
|  +--------+----------------------------+-----------------------------+---------+  |
|           |                            |                             |            |
|           v                            v                             v            |
|  +------------------+        +-------------------+         +-------------------+  |
|  | PostgreSQL Store |        | Redis Engine      |         | Background Worker |  |
|  | - Keyset Index   |        | - Idempotency Lock|         | - Concurrent Pool |  |
|  | - Audit Logs     |        | - Task Queue      |         | - HTTP Transmit   |  |
|  +------------------+        +---------+---------+         +---------+---------+  |
|                                        |                             |            |
+----------------------------------------|-----------------------------|------------+
                                         |                             v
                                         v                 +-----------------------+
                            +--------------------------+   | Downstream Target URL |
                            | React Management Console |   +-----------------------+
                            | (webhook-relay-dashboard)|
                            +--------------------------+
```

---

## 📂 Repository Structure

```text
WebHook2.0/
├── webhook-relay/                  # Go Backend Microservice & Dispatch Engine
│   ├── cmd/                        # Application entry points (API server & workers)
│   ├── db/                         # Database schema migrations
│   ├── internal/                   # Domain entities, use cases, ports, & adapters
│   ├── openapi.yaml                # OpenAPI 3.1 specification for backend REST endpoints
│   ├── docker-compose.yml          # Container configuration for PostgreSQL & Redis
│   ├── Dockerfile                  # Production container definition
│   └── Makefile                    # Commands for building, running, and testing
│
└── webhook-relay-dashboard/        # React + TypeScript Frontend Management Dashboard
    ├── src/                        # React components, state stores, and API clients
    ├── public/                     # Static assets
    ├── e2e/                        # End-to-end testing suite
    ├── vite.config.ts              # Vite bundling configuration
    └── package.json                # Frontend dependencies and run scripts
```

---

## 🔄 Finite State Machine (FSM)

Every webhook event strictly follows an immutable lifecycle state machine:

```
[ INGESTED ] ---> [ QUEUED ] ---> [ DISPATCHING ] ---> [ SUCCESS ] (Terminal)
                      ^                   |
                      |                   v
                      +------------- [ FAILED ] ---> [ DEAD_LETTER ] (Terminal)
                         (Replay)
```

| State | Status Type | Description |
| :--- | :--- | :--- |
| `INGESTED` | Initial | Webhook received and HMAC signature successfully validated. |
| `QUEUED` | Pending | Enqueued in Redis queue awaiting worker pickup. |
| `DISPATCHING` | In-Flight | Background worker transmitting payload to target URL. |
| `SUCCESS` | Terminal | Payload successfully delivered to destination (2xx response). |
| `FAILED` | Transient | Delivery attempt failed. Eligible for retry or manual replay. |
| `DEAD_LETTER` | Terminal | Maximum retries exhausted. Requires manual replay action. |

---

## 🛠️ Prerequisites

Before getting started, ensure you have the following installed on your machine:

- **Go**: `v1.22+`
- **Node.js**: `v18+` & `npm`
- **Docker & Docker Compose**: `v2.0+`
- **Make** (optional, for running Makefile shortcuts)

---

## ⚙️ Environment Configuration

> [!IMPORTANT]
> Always use placeholder environment configuration when working locally. Do **not** commit real secrets, private keys, or sensitive database passwords to source control.

### 1. Backend Environment Setup (`webhook-relay/.env`)

Create a `.env` file inside the `webhook-relay/` directory based on the following template:

```ini
# Server Configuration
PORT=3000

# Database Configuration (PostgreSQL)
DATABASE_URL=postgres://<DB_USER>:<DB_PASSWORD>@localhost:5433/<DB_NAME>?sslmode=disable

# Cache & Message Queue Configuration (Redis)
REDIS_URL=redis://:<REDIS_PASSWORD>@localhost:6379/0

# Security (Set a random 32-character secret string for HMAC signature verification)
WEBHOOK_SIGNING_SECRET=<YOUR_WEBHOOK_SIGNING_SECRET>
```

### 2. Dashboard Environment Setup (`webhook-relay-dashboard/.env`)

Create a `.env` file inside the `webhook-relay-dashboard/` directory:

```ini
# Backend API Base URL
VITE_API_URL=http://localhost:3000/api/v1

# Optional Tracing / Observability URL
VITE_OBSERVABILITY_URL=http://localhost:16686

# Auth Token Header (if required by deployment environment)
VITE_AUTH_TOKEN=Bearer <YOUR_CLIENT_TOKEN>
```

---

## 🚀 Quick Start Guide

### 1. Infrastructure Setup

Start the required database (PostgreSQL) and caching layer (Redis) using Docker Compose:

```bash
cd webhook-relay
docker-compose up -d
```

Verify that the containers are healthy:

```bash
docker ps
```

### 2. Backend Setup (`webhook-relay`)

1. Change directory to `webhook-relay`:
   ```bash
   cd webhook-relay
   ```

2. Install dependencies:
   ```bash
   go mod download
   ```

3. Run database migrations (or allow the app to initialize schemas):
   ```bash
   make migrate-up
   ```

4. Start the API server & dispatch worker:
   ```bash
   go run cmd/api/main.go
   ```
   *The server will start listening on `http://localhost:3000`.*

### 3. Dashboard Setup (`webhook-relay-dashboard`)

1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd webhook-relay-dashboard
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:5173`.

---

## 📖 Usage & API Guide

### HMAC Signature Generation

Inbound webhooks sent to `/api/v1/webhooks/ingest` require an HMAC SHA-256 signature in the `X-Webhook-Signature` header to ensure payload authenticity.

**Header Format:**
```text
X-Webhook-Signature: <hex_encoded_hmac_sha256_hash>
```

Example in Node.js:
```javascript
const crypto = require('crypto');

const secret = '<YOUR_WEBHOOK_SIGNING_SECRET>';
const payload = JSON.stringify({ event: 'order.created', amount: 99.99 });
const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
```

### API Endpoints Summary

| Method | Endpoint | Description | Headers / Query Params |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/webhooks/ingest` | Ingest raw webhook event and queue for dispatch | Header: `X-Webhook-Signature` |
| `GET` | `/api/v1/webhooks/events` | List events with keyset (cursor-based) pagination | Query: `cursor`, `limit`, `status` |
| `GET` | `/api/v1/webhooks/events/{eventId}` | Fetch full details & delivery attempt audit logs | Path: `eventId` (UUID) |
| `POST` | `/api/v1/webhooks/events/{eventId}/replay` | Replay a `FAILED` or `DEAD_LETTER` event | Path: `eventId` (UUID) |

---

## 🧪 Testing & Quality Assurance

### Running Backend Tests

Navigate to `webhook-relay` and run unit/integration test suites:

```bash
cd webhook-relay
go test -v -race ./...
```

### Running Dashboard Tests & Linter

Navigate to `webhook-relay-dashboard` and run verification scripts:

```bash
cd webhook-relay-dashboard

# Run ESLint check
npm run lint

# Build production bundle
npm run build
```

---

## 🔒 Security & Best Practices

- **Zero Hardcoded Secrets**: Ensure passwords, secrets, and API credentials are provided exclusively through environment variables.
- **HMAC Verification**: Always validate inbound requests using the `X-Webhook-Signature` header.
- **Rate Limiting**: The system implements token bucket rate limiting on ingest endpoints to prevent Denial of Service (DoS) attacks.
- **Least Privilege Access**: Configure PostgreSQL and Redis credentials with scoped network access and read/write privileges suited for production environments.

---

## 📄 License

This repository is licensed under the [MIT License](LICENSE).
