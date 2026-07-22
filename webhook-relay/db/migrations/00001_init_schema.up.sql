-- 1. Strict FSM Enum (Prevents invalid states at the DB level)
CREATE TYPE webhook_status AS ENUM (
    'INGESTED', 'QUEUED', 'DISPATCHING', 'SUCCESS', 'FAILED', 'DEAD_LETTER'
);

-- 2. Core Events Table
CREATE TABLE webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key UUID NOT NULL UNIQUE,
    target_url TEXT NOT NULL,
    status webhook_status NOT NULL DEFAULT 'INGESTED',
    trace_id TEXT NOT NULL,
    payload JSONB NOT NULL, -- JSONB allows indexing and efficient storage of arbitrary JSON
    headers JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ELITE OPTIMIZATION: Keyset Pagination Index
-- Standard OFFSET pagination causes massive performance hits on large tables.
-- This composite index allows O(log N) lookups for cursor-based pagination.
CREATE INDEX idx_webhook_events_cursor ON webhook_events(status, created_at DESC, id DESC);

-- 3. Delivery Attempts Table (Strict Audit Log)
CREATE TABLE delivery_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES webhook_events(id) ON DELETE CASCADE,
    attempt_number INT NOT NULL,
    status_code INT, -- Nullable for network timeouts
    error_message TEXT,
    duration_ms INT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_delivery_attempts_event_id ON delivery_attempts(event_id);