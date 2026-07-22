// src/api/client.ts
import { API_BASE_URL } from '@/lib/constants';

// Generate W3C Trace Context (traceparent) for OpenTelemetry
const generateTraceParent = (): string => {
  const traceId = crypto.randomUUID().replace(/-/g, '');
  const spanId = crypto.randomUUID().replace(/-/g, '').substring(0, 16);
  return `00-${traceId}-${spanId}-01`;
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const traceparent = generateTraceParent();
  const headers = new Headers(options.headers);
  
  // ✅ FIX: Inject Authorization header from environment
  const authToken = import.meta.env.VITE_AUTH_TOKEN;
  if (authToken) {
    headers.set('Authorization', authToken);
  }

  // ✅ FIX: Inject Observability header
  headers.set('traceparent', traceparent);
  headers.set('Content-Type', 'application/json');

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    // Parse the backend's JSON error message if available
    let errorMessage = `API Error: ${response.statusText}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorMessage;
    } catch {
      // Ignore if response is not JSON
    }
    throw new ApiError(errorMessage, response.status);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}