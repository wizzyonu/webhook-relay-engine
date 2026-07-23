// e2e/helpers/api.ts
import { APIRequestContext, expect } from '@playwright/test';
import * as crypto from 'crypto';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'dev-secret-key';

function computeHMAC(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

// ✅ MUST HAVE 'export' KEYWORD
export async function seedFailedWebhook(request: APIRequestContext) {
  const bodyObj = {
    event_type: 'payment.success',
    target_url: 'https://httpbin.org/status/500',
    payload: { amount: 100, currency: 'USD', order_id: 'e2e-test-order' },
  };
  const bodyString = JSON.stringify(bodyObj);
  const signature = computeHMAC(bodyString, WEBHOOK_SECRET);

  const response = await request.post(`${BACKEND_URL}/api/v1/webhooks/ingest`, {
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature,
    },
    data: bodyObj,
  });

  expect(response.status()).toBe(202);
  const responseBody = await response.json();
  expect(responseBody.event_id).toBeTruthy();
  expect(responseBody.idempotency_key).toBeTruthy();
  return responseBody;
}

// ✅ MUST HAVE 'export' KEYWORD
export async function waitForFailedStatus(request: APIRequestContext, eventId: string) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const res = await request.get(`${BACKEND_URL}/api/v1/webhooks/events/${eventId}`);
    if (res.ok()) {
      const event = await res.json();
      if (event.status === 'FAILED' || event.status === 'DEAD_LETTER') return event;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Event ${eventId} did not reach FAILED within 15s`);
}