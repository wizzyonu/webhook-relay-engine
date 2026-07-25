// e2e/helpers/api.ts
import { APIRequestContext, expect } from '@playwright/test';
import * as crypto from 'crypto';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const WEBHOOK_SECRET = process.env.TEST_WEBHOOK_SECRET || 'UX2mIQWtej46BIE4EYv/Z2ymoQbcO9hCu85sBh8/y7Y=';

// 🎯 THE MISSING PIECE: The exact token from your backend .env file
const MANAGEMENT_TOKEN = process.env.API_AUTH_TOKEN || 'dev-e2e-test-token-123';

export async function seedFailedWebhook(request: APIRequestContext) {
  const targetUrl = 'https://httpbin.org/status/500';
  const payloadObj = {
    event_type: 'payment.success',
    payload: { amount: 100, currency: 'USD', order_id: `e2e-test-order-${Date.now()}` },
  };
  const payloadString = JSON.stringify(payloadObj);

  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  hmac.update(payloadString, 'utf8');
  const signature = `sha256=${hmac.digest('hex')}`;

  // ✅ CORRECT: /ingest does NOT need Authorization header (per backend team fix)
  const response = await request.post(`${BACKEND_URL}/api/v1/webhooks/ingest`, {
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature,
      'X-Target-URL': targetUrl,
    },
    data: payloadString,
  });

  expect(response.status()).toBe(202);
  const data = await response.json();
  const eventId = data.event_id || data.EventID;
  return {
    ...data,
    event_id: eventId,
  };
}

export async function waitForFailedStatus(request: APIRequestContext, eventId: string) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    // ✅ CORRECT: /events REQUIRES the Authorization header
    const res = await request.get(`${BACKEND_URL}/api/v1/webhooks/events/${eventId}`, {
      headers: {
        'Authorization': `Bearer ${MANAGEMENT_TOKEN}`,
      }
    });
    
    if (res.ok()) {
      const event = await res.json();
      if (
        event.status === 'FAILED' || 
        event.status === 'DEAD_LETTER' || 
        (Array.isArray(event.delivery_attempts) && event.delivery_attempts.some((a: any) => a.status_code >= 400))
      ) {
        return event;
      }
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Event ${eventId} did not reach FAILED within 15s`);
}

export async function replayEvent(request: APIRequestContext, eventId: string) {
  // ✅ CORRECT: /replay REQUIRES the Authorization header
  const response = await request.post(
    `${BACKEND_URL}/api/v1/webhooks/events/${eventId}/replay`,
    {
      headers: {
        'Authorization': `Bearer ${MANAGEMENT_TOKEN}`,
      },
    }
  );
  
  expect(response.status()).toBe(202);
  return await response.json();
}