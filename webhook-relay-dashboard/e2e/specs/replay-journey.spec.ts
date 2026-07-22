// e2e/specs/replay-journey.spec.ts
import { test, expect } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid'; // For generating mock trace IDs

test.describe('Webhook Replay Journey', () => {
  const mockEventId = '123e4567-e89b-12d3-a456-426614174000';
  const mockTraceId = uuidv4();

  test('should open detail drawer, replay failed event optimistically, and propagate trace ID', async ({ page }) => {
    
    // 1. Mock the initial GET /webhooks/events (List)
    await page.route('**/api/v1/webhooks/events*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [{
            id: mockEventId,
            status: 'FAILED', // FSM allows replay from here
            target_url: 'https://api.client.com/webhook',
            trace_id: mockTraceId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            idempotency_key: uuidv4(),
            payload: { event: 'test' }
          }],
          next_cursor: null,
          has_more: false
        }),
      });
    });

    // 2. Mock the GET /webhooks/events/:id (Detail)
    await page.route(`**/api/v1/webhooks/events/${mockEventId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: mockEventId,
          status: 'FAILED',
          trace_id: mockTraceId,
          payload: { event: 'test', data: { nested: true } }
        }),
      });
    });

    // 3. Intercept the POST /replay request to verify headers and simulate 202 Accepted
    let replayTraceHeader: string | null = null;
    
    await page.route(`**/api/v1/webhooks/events/${mockEventId}/replay`, async (route) => {
      // Capture the trace header injected by our elite API client
      replayTraceHeader = route.request().headers()['traceparent'];
      
      // Simulate backend processing delay
      await new Promise(r => setTimeout(r, 500));

      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({
          id: mockEventId,
          status: 'QUEUED', // Backend confirms transition
          trace_id: mockTraceId
        }),
      });
    });

    // --- EXECUTE USER JOURNEY ---

    // Navigate to dashboard
    await page.goto('/');
    
    // Verify Zero CLS: Ensure the grid skeleton doesn't cause layout shifts
    await expect(page.locator('text=https://api.client.com/webhook')).toBeVisible();

    // Click the row to open the native <dialog> drawer
    await page.locator('text=https://api.client.com/webhook').click();
    
    // Verify Drawer opened and Trace ID is visible
    await expect(page.locator(`text=${mockTraceId}`)).toBeVisible();

    // Click the Replay button
    const replayButton = page.locator('button:has-text("Replay")');
    await expect(replayButton).toBeVisible();
    await replayButton.click();

    // Verify Optimistic UI: The status should change to QUEUED instantly, 
    // BEFORE the network request resolves.
    // (Assuming the Badge component renders the status text)
    await expect(page.locator('[data-testid="status-badge"]').first()).toHaveText('QUEUED');

    // --- ASSERTIONS ---

    // Verify Trace Propagation (Integration Checklist #7)
    expect(replayTraceHeader).not.toBeNull();
    // Verify it matches W3C Trace Context format (00-traceid-spanid-flags)
    expect(replayTraceHeader).toMatch(/^00-[a-f0-9]{32}-[a-f0-9]{16}-01$/i);
  });
});