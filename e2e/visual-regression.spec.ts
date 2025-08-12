import { test, expect } from '@playwright/test';

test.describe('Visual Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('dashboard layout should remain consistent', async ({ page }) => {
    // Wait for all content to load
    await page.waitForSelector('[data-testid="book-card"]', { timeout: 10000 });
    
    // Take screenshot of the full dashboard
    await expect(page).toHaveScreenshot('dashboard-full.png', {
      fullPage: true,
      threshold: 0.2, // Allow 20% difference for dynamic content
    });
  });

  test('book card component should remain visually consistent', async ({ page }) => {
    // Wait for book cards to load
    await page.waitForSelector('[data-testid="book-card"]');
    
    // Screenshot of the first book card
    const firstBookCard = page.locator('[data-testid="book-card"]').first();
    await expect(firstBookCard).toHaveScreenshot('book-card-component.png', {
      threshold: 0.1,
    });
  });

  test('mobile layout should remain consistent', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Wait for mobile layout to adjust
    await page.waitForTimeout(500);
    
    // Take mobile screenshot
    await expect(page).toHaveScreenshot('dashboard-mobile.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });

  test('tablet layout should remain consistent', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    
    await page.waitForTimeout(500);
    
    await expect(page).toHaveScreenshot('dashboard-tablet.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });

  test('book detail page layout should remain consistent', async ({ page }) => {
    // Navigate to a book detail page
    const firstBookCard = page.locator('[data-testid="book-card"]').first();
    if (await firstBookCard.isVisible()) {
      await firstBookCard.click();
      await page.waitForLoadState('networkidle');
      
      // Take screenshot of book detail page
      await expect(page).toHaveScreenshot('book-detail-page.png', {
        fullPage: true,
        threshold: 0.2,
      });
    }
  });

  test('search results layout should remain consistent', async ({ page }) => {
    // Perform a search
    const searchBar = page.locator('[data-testid="global-search"]');
    if (await searchBar.isVisible()) {
      await searchBar.fill('test');
      await page.waitForTimeout(500);
      
      // Screenshot search results
      const searchResults = page.locator('[data-testid="search-results"]');
      if (await searchResults.isVisible()) {
        await expect(searchResults).toHaveScreenshot('search-results.png', {
          threshold: 0.1,
        });
      }
    }
  });

  test('dark mode consistency (if implemented)', async ({ page }) => {
    // Check if dark mode toggle exists
    const darkModeToggle = page.locator('[data-testid="dark-mode-toggle"]');
    if (await darkModeToggle.isVisible()) {
      await darkModeToggle.click();
      await page.waitForTimeout(500);
      
      // Take dark mode screenshot
      await expect(page).toHaveScreenshot('dashboard-dark-mode.png', {
        fullPage: true,
        threshold: 0.2,
      });
    }
  });

  test('loading states should remain consistent', async ({ page }) => {
    // Intercept API calls to simulate loading states
    await page.route('/api/books', route => {
      // Delay the response to capture loading state
      setTimeout(() => route.continue(), 2000);
    });
    
    // Reload page to trigger loading state
    await page.reload();
    
    // Capture loading state
    await expect(page.locator('[data-testid="loading-spinner"]')).toHaveScreenshot('loading-state.png', {
      threshold: 0.1,
    });
  });

  test('error states should remain consistent', async ({ page }) => {
    // Intercept API calls to simulate error
    await page.route('/api/books', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' })
      });
    });
    
    await page.reload();
    await page.waitForTimeout(1000);
    
    // Capture error state
    const errorMessage = page.locator('[data-testid="error-message"]');
    if (await errorMessage.isVisible()) {
      await expect(errorMessage).toHaveScreenshot('error-state.png', {
        threshold: 0.1,
      });
    }
  });
});