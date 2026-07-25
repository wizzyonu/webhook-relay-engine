// e2e/specs/edge-cases.spec.ts
import { test, expect } from '@playwright/test';
import { seedFailedWebhook, waitForFailedStatus } from '../helpers/api';

/**
 * Edge-Case Injection (integration_skills.md §3A).
 * Verifies the frontend degrades gracefully under failure conditions.
 */
test.describe('Edge Cases & Resilience', () => {
  
  test('409 Conflict triggers optimistic rollback + error toast', async ({ page, request }) => {
    const seeded = await seedFailedWebhook(request);
    await waitForFailedStatus(request, seeded.event_id);

    // Force the /replay endpoint to return 409 Conflict
    await page.route('**/webhooks/events/*/replay', (route) =>
      route.fulfill({ status: 409, json: { error: { code: 'CONFLICT', message: 'Event is currently DISPATCHING' } } })
    );

    await page.goto('/');
    await page.getByTestId('status-filter').selectOption('FAILED');
    await page.locator('text=httpbin.org/status/500').first().click();
    await page.getByTestId('replay-button').click();

    // Rollback: status must revert from QUEUED back to FAILED
    await expect(page.getByTestId('event-status-badge')).toContainText('FAILED', { ignoreCase: true });
    // User feedback: an error toast must appear
    await expect(page.getByTestId('error-toast')).toBeVisible();
  });

  test('network timeout shows error state without crashing', async ({ page, request }) => {
    const seeded = await seedFailedWebhook(request);
    await waitForFailedStatus(request, seeded.event_id);

    // Simulate a hung request (abort = network failure)
    await page.route('**/webhooks/events/*/replay', (route) => route.abort('timedout'));

    await page.goto('/');
    await page.getByTestId('status-filter').selectOption('FAILED');
    await page.locator('text=httpbin.org/status/500').first().click();
    await page.getByTestId('replay-button').click();

    // The app must not white-screen; an error state must render
    await expect(page.getByTestId('error-toast')).toBeVisible();
    await expect(page.getByTestId('webhook-detail-drawer')).toBeVisible(); // Drawer stays mounted
  });

  test('RBAC: non-admin receives 403 on replay (NFR7)', async ({ page, request }) => {
    const seeded = await seedFailedWebhook(request);
    await waitForFailedStatus(request, seeded.event_id);

    // Force 403 Forbidden (simulating a read-only role)
    await page.route('**/webhooks/events/*/replay', (route) =>
      route.fulfill({ status: 403, json: { error: { code: 'FORBIDDEN', message: 'Insufficient role' } } })
    );

    await page.goto('/');
    await page.getByTestId('status-filter').selectOption('FAILED');
    await page.locator('text=httpbin.org/status/500').first().click();
    await page.getByTestId('replay-button').click();

    await expect(page.getByTestId('error-toast')).toContainText(/forbidden/i);
  });

  // ✅ KEEP ACTIVE: This proves our rendering discipline (NFR2)
  test('Zero CLS: layout does not shift during data load', async ({ page }) => {
    await page.goto('/');
    
    const cls = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          let clsValue = 0;
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (!(entry as any).hadRecentInput) clsValue += (entry as any).value;
            }
          });
          observer.observe({ type: 'layout-shift', buffered: true });
          
          setTimeout(() => {
            observer.disconnect();
            resolve(clsValue);
          }, 5000);
        })
    );

    // NFR2 / integration_skills.md §3A: CLS must be effectively zero.
    expect(cls).toBeLessThan(0.01);
  });
});