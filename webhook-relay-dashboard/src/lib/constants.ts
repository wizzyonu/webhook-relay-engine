// src/lib/constants.ts

/** 
 * API base path. 
 * Uses a relative path to ensure same-origin requests in production, 
 * allowing the Nginx reverse proxy to route /api/* seamlessly without CORS issues.
 * In local dev, Vite's proxy configuration (vite.config.ts) handles routing this to localhost:3000.
 */
export const API_BASE_PATH = '/api/v1';

/** Observability platform URL for trace deep-links */
export const OBSERVABILITY_URL = import.meta.env.VITE_OBSERVABILITY_URL || 'https://grafana.internal/explore';

/** Pagination defaults */
export const DEFAULT_PAGE_LIMIT = 50;
export const MAX_PAGE_LIMIT = 100;

/** Virtualizer row height in pixels (h-14 = 56px) */
export const ROW_HEIGHT = 56;

/** Virtualizer overscan (rows rendered outside viewport) */
export const OVERSCAN_COUNT = 10;