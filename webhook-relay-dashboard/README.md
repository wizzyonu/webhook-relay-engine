# 💻 Webhook Relay Dashboard — Frontend Architecture & Developer Guide

Welcome to the **Webhook Relay Dashboard** codebase! This document is designed specifically for frontend engineers joining or contributing to the project. It provides a complete technical blueprint of how this frontend application was designed, structured, and built.

---

## 📑 Table of Contents

- [Architectural Highlights](#-architectural-highlights)
- [Technology Stack](#-technology-stack)
- [Directory & Feature-Sliced Architecture](#-directory--feature-sliced-architecture)
- [Core Frontend Engineering Concepts](#-core-frontend-engineering-concepts)
  - [1. Data Fetching & Keyset Pagination (React Query)](#1-data-fetching--keyset-pagination-react-query)
  - [2. Virtualized High-Performance Grid (React Virtual)](#2-virtualized-high-performance-grid-react-virtual)
  - [3. Global UI State Management (Zustand)](#3-global-ui-state-management-zustand)
  - [4. Finite State Machine Guard (XState)](#4-finite-state-machine-guard-xstate)
  - [5. OpenAPI Type Generation & Contract-First Development](#5-openapi-type-generation--contract-first-development)
  - [6. Optimistic UI Replay Action](#6-optimistic-ui-replay-action)
- [Design Tokens & Styling System](#-design-tokens--styling-system)
- [Development Workflow & Scripts](#-development-workflow--scripts)
- [Environment Configuration](#-environment-configuration)
- [Testing & Quality Assurance](#-testing--quality-assurance)

---

## ⚡ Architectural Highlights

The Webhook Relay Dashboard is built to handle enterprise-scale webhook management with zero performance degradation. Key architectural goals include:

- **100k+ Event Rendering**: Uses DOM virtualization so scrolling through tens of thousands of event logs consumes minimal memory and maintains 60 FPS.
- **Contract-First Type Safety**: TypeScript interfaces are automatically generated directly from the backend's `openapi.yaml` schema.
- **Optimistic Replays**: Instant visual feedback when triggering event replays before backend response confirmation.
- **Client FSM Mirroring**: Mirrors backend state transition validation on the client side using **XState** to disable invalid user actions before network requests are dispatched.

---

## 🛠️ Technology Stack

| Layer / Concern | Technology | Purpose |
| :--- | :--- | :--- |
| **Framework** | **React 19** + **TypeScript 5** | Core UI library & strict static typing. |
| **Build Tool** | **Vite 8** | Ultra-fast HMR and ESM-native production bundling. |
| **Styling** | **Tailwind CSS v4** + `clsx` + `tailwind-merge` | Utility-first styling with custom design tokens. |
| **Server State** | **TanStack React Query v5** | Caching, polling, keyset cursor pagination, & mutations. |
| **List Virtualization** | **TanStack React Virtual v3** | Dynamic element virtualization for large data grids. |
| **Client UI State** | **Zustand v5** | Lightweight store for drawer visibility, active filters, and theme preference. |
| **State Machine** | **XState v5** | Finite State Machine enforcement matching backend FSM logic. |
| **Type Generation** | **openapi-typescript** | Generates `./src/api/generated/schema.d.ts` from OpenAPI specs. |
| **Mock Server** | **Stoplight Prism CLI** | Runs local mock backend on port `4010` during offline development. |
| **Testing** | **Playwright** | End-to-end browser automation & UI component testing. |

---

## 📂 Directory & Feature-Sliced Architecture

The codebase follows **Feature-Sliced Design** principles to keep code modular and decoupled:

```text
src/
├── api/                            # API Layer
│   ├── client.ts                   # Fetch/Axios configured client with auth interceptors
│   ├── query-keys.ts               # Centralized React Query key factories
│   ├── generated/
│   │   └── schema.d.ts             # Auto-generated TypeScript types from openapi.yaml
│   └── hooks/                      # Custom hooks wrapping React Query (e.g., useEvents, useReplay)
│
├── components/                     # Atomic Shared UI Components
│   ├── ui/                         # Base buttons, badges, modals, drawers, code viewers
│   ├── layout/                     # Header, main container, grid wrappers
│   ├── data-display/               # JSON syntax highlighter, status pill indicators
│   └── error/                      # React ErrorBoundary components
│
├── domain/                         # Core Domain Logic
│   └── fsm.ts                      # XState finite state machine definitions
│
├── features/                       # Modular Feature Modules
│   ├── webhook-grid/               # Virtualized data grid, status filter pills, search input
│   ├── webhook-detail/             # Slide-over drawer displaying raw payload, headers, attempts
│   ├── replay-action/              # Optimistic replay trigger button & mutation logic
│   ├── settings/                   # Configuration & theme settings modal
│   └── documentation/              # Embedded API documentation viewer
│
├── store/                          # Global Client UI Stores
│   └── ui-store.ts                 # Zustand store for drawer state, selected event, theme
│
├── styles/                         # CSS Tokens & Tailwind Theme Configurations
├── workers/                        # Web Workers for off-main-thread payload formatting
├── App.tsx                         # Main layout wrapper, QueryClientProvider & ErrorBoundary
├── main.tsx                        # React DOM root entry
└── vite-env.d.ts                  # Vite env TypeScript type declarations
```

---

## 💡 Core Frontend Engineering Concepts

### 1. Data Fetching & Keyset Pagination (React Query)

Instead of traditional offset-based pagination (`page=1`), the backend uses cursor-based keyset pagination for $O(\log N)$ performance.

- In `src/api/hooks/useEvents.ts`, we use React Query's `useInfiniteQuery` with the `next_cursor` parameter.
- Automatic background refetching and window focus polling can be toggled in `App.tsx`.

```typescript
// Example React Query hook usage pattern
const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteEvents({
  status: activeStatusFilter,
  limit: 50,
});
```

### 2. Virtualized High-Performance Grid (React Virtual)

Standard HTML table rendering stutters when dealing with thousands of items. The grid component (`src/features/webhook-grid/WebhookGrid.tsx`) utilizes `@tanstack/react-virtual`:

- Only DOM nodes visible within the viewport are mounted.
- Dynamic row heights are measured automatically to support wrapped payload previews seamlessly.

### 3. Global UI State Management (Zustand)

Client-only UI state (such as opening the event inspection drawer or toggling dark mode) is handled in `src/store/ui-store.ts` via Zustand.

- **Theme state** is persisted to `localStorage`.
- **Transient UI state** (selected event ID, drawer open/close) is kept in-memory to prevent stale drawer state across sessions.

```typescript
import { useUIStore } from '@/store/ui-store';

// Inside any component:
const { isDetailDrawerOpen, selectedEventId, openDetailDrawer, closeDetailDrawer } = useUIStore();
```

### 4. Finite State Machine Guard (XState)

To guarantee that users cannot attempt illegal state transitions (for example, attempting to replay an event that is currently `DISPATCHING` or `SUCCESS`), the client mirrors the backend FSM in `src/domain/fsm.ts` using XState:

```
[ INGESTED ] ---> [ QUEUED ] ---> [ DISPATCHING ] ---> [ SUCCESS ] (Terminal)
                      ^                   |
                      |                   v
                      +------------- [ FAILED ] ---> [ DEAD_LETTER ] (Terminal)
                         (Replay)
```

- Replay buttons are automatically disabled for terminal (`SUCCESS`) or active (`DISPATCHING`) states.

### 5. OpenAPI Type Generation & Contract-First Development

We follow a contract-first API design. The backend's OpenAPI specification (`openapi.yaml`) is the single source of truth for types.

To update frontend types whenever backend endpoints change, run:
```bash
npm run codegen
```
This generates standard TypeScript interfaces in `src/api/generated/schema.d.ts`.

### 6. Optimistic UI Replay Action

When a developer clicks "Replay Event" on a failed event:
1. React Query's `useMutation` instantly updates the cache, setting the event's status to `QUEUED`.
2. A toast notification informs the user that the replay was enqueued.
3. If the network call fails, React Query automatically rolls back the cache to `FAILED` / `DEAD_LETTER` and displays an error boundary alert.

---

## 🎨 Design Tokens & Styling System

The application uses **Tailwind CSS v4** configured with custom tokens:

- **Canvas Background**: `bg-canvas-parchment` / `bg-canvas`
- **Typography**: `font-display` for headers, `font-text` for UI copy, `font-mono` for JSON payloads.
- **Status Pills**:
  - `SUCCESS` ➔ Emerald green (`bg-emerald-50 text-emerald-700 border-emerald-200`)
  - `FAILED` / `DEAD_LETTER` ➔ Rose red (`bg-rose-50 text-rose-700 border-rose-200`)
  - `QUEUED` / `DISPATCHING` ➔ Amber yellow (`bg-amber-50 text-amber-700 border-amber-200`)
- **Borders & Dividers**: `border-hairline` for clean high-density layout borders.

---

## 📜 Development Workflow & Scripts

Here are the key commands to run during frontend development:

```bash
# 1. Install dependencies
npm install

# 2. Start Vite local dev server (http://localhost:5173)
npm run dev

# 3. Spin up local mock API server (http://localhost:4010)
npm run mock:api

# 4. Regenerate TypeScript interfaces from backend openapi.yaml
npm run codegen

# 5. Execute ESLint code checks
npm run lint

# 6. Typecheck and build production assets (dist/)
npm run build

# 7. Preview production build locally
npm run preview
```

---

## ⚙️ Environment Configuration

Create a `.env` file in the root of `webhook-relay-dashboard/`:

```ini
# Backend API Gateway URL
VITE_API_URL=http://localhost:3000/api/v1

# Optional Tracing / Jaeger Observability dashboard link
VITE_OBSERVABILITY_URL=http://localhost:16686

# Client Authorization Token (if gateway authentication is enabled)
VITE_AUTH_TOKEN=Bearer <YOUR_CLIENT_TOKEN>
```

> [!TIP]
> For offline development without a running Go backend, create `.env.local` setting `VITE_API_URL=http://localhost:4010/api/v1` and run `npm run mock:api` to mock all backend responses.

---

## 🧪 Testing & Quality Assurance

### End-to-End (E2E) Testing with Playwright

Playwright is configured in `e2e/` to test full user journeys (filtering webhooks, opening details drawer, triggering replays, changing themes):

```bash
# Install Playwright browser dependencies (first time only)
npm run test:e2e:install

# Run E2E tests in headless mode
npm run test:e2e

# Run E2E tests in interactive UI mode
npm run test:e2e:ui

# View latest test run HTML report
npm run test:e2e:report
```
