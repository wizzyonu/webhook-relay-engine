// e2e/specs/replay-journey.spec.ts
import { test, expect } from '@playwright/test';
import { seedFailedWebhook, waitForFailedStatus } from '../helpers/api';

test.describe('Webhook Replay Journey', () => {
  test('should open detail drawer, replay failed event optimistically, and propagate trace ID', async ({ page, request }) => {
    // 1. Seed a failed webhook (targets httpbin.org/status/500)
    const seeded = await seedFailedWebhook(request);
    await waitForFailedStatus(request, seeded.event_id);

    // 2. Navigate to the dashboard
    await page.goto('/');

    // 3. Filter by FAILED status
    await page.getByTestId('status-filter').selectOption('FAILED');

    // 4. Wait for the specific row to appear (using the seeded target URL)
    // We use a partial text match for robustness
    const row = page.locator('text=httpbin.org/status/500').first();
    await expect(row).toBeVisible({ timeout: 10000 });

    // 5. Click the row to open the native <dialog> detail drawer
    await row.click();

    // 6. Verify the drawer is open and contains the expected elements
    await expect(page.getByTestId('webhook-detail-drawer')).toBeVisible();
    await expect(page.getByTestId('payload-viewer')).toBeVisible();

    // 7. Click the Replay button
    const replayButton = page.getByTestId('replay-button');
    await expect(replayButton).toBeVisible();
    await expect(replayButton).toBeEnabled();
    
    // Capture the network request to verify trace ID propagation (NFR6)
    const replayRequestPromise = page.waitForRequest(req => 
      req.url().includes('/replay') && req.method() === 'POST'
    );
    
    await replayButton.click();

    // 8. Verify Optimistic UI: The status should change to QUEUED instantly
    await expect(page.getByTestId('event-status-badge')).toContainText('QUEUED', { ignoreCase: true });

    // 9. Verify the network request was sent with the W3C traceparent header
    const replayRequest = await replayRequestPromise;
    expect(replayRequest.headers()['traceparent']).toBeTruthy();

    // 10. Verify the backend responded with 202 Accepted
    const replayResponse = await replayRequest.response();
    expect(replayResponse?.status()).toBe(202);
  });
});