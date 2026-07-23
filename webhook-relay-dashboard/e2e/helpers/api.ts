// e2e/helpers/api.ts
import { APIRequestContext, expect } from '@playwright/test';
import * as crypto from 'crypto';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const WEBHOOK_SECRET = process.env.TEST_WEBHOOK_SECRET || 'UX2mIQWtej46BIE4EYv/Z2ymoQbcO9hCu85sBh8/y7Y=';

function computeHMAC(payload: string, secret: string): string {
  // ✅ CRITICAL FIX: Decode the Base64 secret into a Buffer.
  // This matches how Go's hmac.New(sha256.New, decodedKey) works.
  const keyBuffer = Buffer.from(secret, 'base64');
  
  return crypto
    .createHmac('sha256', keyBuffer)
    .update(payload)
    .digest('hex');
}

export async function seedFailedWebhook(request: APIRequestContext) {
  // ✅ RESTORED: target_url must be in the body per the OpenAPI contract
  const bodyObj = {
    event_type: 'payment.success',
    target_url: 'https://httpbin.org/status/500',
    payload: { 
      amount: 100, 
      currency: 'USD', 
      order_id: `e2e-test-order-${Date.now()}` 
    },
  };
  
  // 1. Stringify EXACTLY ONCE. This is the exact byte stream.
  const bodyString = JSON.stringify(bodyObj);
  
  // 2. Compute HMAC using the decoded Base64 key
  const rawSignature = computeHMAC(bodyString, WEBHOOK_SECRET);
  
  // 3. Prepend 'sha256=' as strictly required by the backend
  const signature = `sha256=${rawSignature}`;

  // 4. Pass as a Buffer to prevent Playwright from altering Content-Type or adding whitespace
  const response = await request.post(`${BACKEND_URL}/api/v1/webhooks/ingest`, {
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature,
    },
    data: Buffer.from(bodyString), 
  });

  if (response.status() !== 202) {
    const errorText = await response.text();
    console.error(`\n❌ BACKEND REJECTED INGEST: ${response.status()}`);
    console.error(`Response Body: ${errorText}`);
    console.error(`Sent Signature: ${signature}`);
    console.error(`Sent Body Buffer Length: ${bodyString.length} bytes\n`);
  }

  expect(response.status()).toBe(202);
  const responseBody = await response.json();
  expect(responseBody.event_id).toBeTruthy();
  expect(responseBody.idempotency_key).toBeTruthy();
  return responseBody;
}

export async function waitForFailedStatus(request: APIRequestContext, eventId: string) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const res = await request.get(`${BACKEND_URL}/api/v1/webhooks/events/${eventId}`);
    if (res.ok()) {
      const event = await res.json();
      if (event.status === 'FAILED' || event.status === 'DEAD_LETTER') {
        return event;
      }
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Event ${eventId} did not reach FAILED within 15s`);
}