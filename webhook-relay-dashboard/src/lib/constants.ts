// src/lib/constants.ts

/** API base URL from environment */
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

/** Observability platform URL for trace deep-links */
export const OBSERVABILITY_URL = import.meta.env.VITE_OBSERVABILITY_URL || 'https://grafana.internal/explore';

/** Pagination defaults */
export const DEFAULT_PAGE_LIMIT = 50;
export const MAX_PAGE_LIMIT = 100;

/** Virtualizer row height in pixels (h-14 = 56px) */
export const ROW_HEIGHT = 56;

/** Virtualizer overscan (rows rendered outside viewport) */
export const OVERSCAN_COUNT = 10;