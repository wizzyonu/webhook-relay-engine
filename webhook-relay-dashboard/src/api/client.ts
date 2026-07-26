// src/api/client.ts
import { API_BASE_PATH } from '@/lib/constants';

// The management token defined in the backend .env file for RBAC validation
// Fallback to the dev-e2e token if the environment variable is not set
const MANAGEMENT_TOKEN = import.meta.env.VITE_MANAGEMENT_TOKEN || 'dev-e2e-test-token-123';

// Generate W3C Trace Context (traceparent) for OpenTelemetry
const generateTraceParent = (): string => {
  const traceId = crypto.randomUUID().replace(/-/g, '');
  const spanId = crypto.randomUUID().replace(/-/g, '').substring(0, 16);
  return `00-${traceId}-${spanId}-01`;
};

export interface ApiErrorDetails {
  field?: string;
  issue: string;
}

export class ApiError extends Error {
  status: number;
  traceId?: string;
  details?: ApiErrorDetails[];

  constructor(
    message: string, 
    status: number, 
    options?: { traceId?: string; details?: ApiErrorDetails[] }
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    
    // Elite Directive: Explicitly check for undefined to satisfy exactOptionalPropertyTypes
    if (options?.traceId !== undefined) {
      this.traceId = options.traceId;
    }
    if (options?.details !== undefined) {
      this.details = options.details;
    }
  }
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const traceparent = generateTraceParent();
  
  const headers = new Headers(options.headers);
  
  // ✅ CRITICAL FIX: Attach the Bearer token for RBAC validation on all requests
  headers.set('Authorization', `Bearer ${MANAGEMENT_TOKEN}`);
  headers.set('traceparent', traceparent);
  headers.set('Content-Type', 'application/json');

  // Relative path ensures same-origin requests, bypassing CORS preflight
  const url = `${API_BASE_PATH}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'same-origin', 
  });

  if (!response.ok) {
    let errorMessage = `API Error: ${response.statusText}`;
    let errorOptions: { traceId?: string; details?: ApiErrorDetails[] } = {};

    // ✅ Parse the Universal Error Format
    try {
      const errorData = await response.json();
      if (errorData?.error) {
        errorMessage = errorData.error.message || errorMessage;
        
        if (errorData.error.traceId) {
          errorOptions.traceId = errorData.error.traceId;
        }
        
        // Array.isArray guard ensures we never assign undefined to the details property
        if (Array.isArray(errorData.error.details)) {
          errorOptions.details = errorData.error.details;
        }
      }
    } catch {
      // Fallback to default message if response is not JSON (e.g., 502 Bad Gateway from Nginx)
    }

    throw new ApiError(errorMessage, response.status, errorOptions);
  }

  // Handle 204 No Content or empty bodies
  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}