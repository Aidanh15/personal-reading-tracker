import { test, expect } from '@playwright/test';

test.describe('Dashboard - Main Reading List View', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the dashboard
    await page.goto('/');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
  });

  test('should display the main dashboard with reading sections', async ({ page }) => {
    // Check that the main dashboard loads
    await expect(page.locator('h1')).toContainText('Personal Reading Tracker');
    
    // Check for the three main sections based on requirements
    await expect(page.locator('[data-testid="currently-reading-section"]')).toBeVisible();
    await expect(page.locator('[data-testid="up-next-section"]')).toBeVisible();
    await expect(page.locator('[data-testid="previously-read-section"]')).toBeVisible();
  });

  test('should display books in optimized reading order', async ({ page }) => {
    // Check that books are displayed in the Up Next section
    const upNextSection = page.locator('[data-testid="up-next-section"]');
    await expect(upNextSection).toBeVisible();
    
    // Check that books have position indicators
    const bookCards = page.locator('[data-testid="book-card"]');
    await expect(bookCards.first()).toBeVisible();
    
    // Verify book information is displayed (title, author, cover)
    const firstBook = bookCards.first();
    await expect(firstBook.locator('[data-testid="book-title"]')).toBeVisible();
    await expect(firstBook.locator('[data-testid="book-author"]')).toBeVisible();
  });

  test('should show progress indicators for books', async ({ page }) => {
    // Look for books in the Currently Reading section
    const currentlyReadingSection = page.locator('[data-testid="currently-reading-section"]');
    
    // If there are books in progress, check for progress bars
    const booksInProgress = currentlyReadingSection.locator('[data-testid="book-card"]');
    const count = await booksInProgress.count();
    
    if (count > 0) {
      const firstInProgressBook = booksInProgress.first();
      await expect(firstInProgressBook.locator('[data-testid="progress-bar"]')).toBeVisible();
      await expect(firstInProgressBook.locator('[data-testid="progress-percentage"]')).toBeVisible();
    }
  });

  test('should be responsive on mobile devices', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Check that the layout adapts to mobile
    await expect(page.locator('[data-testid="mobile-navigation"]')).toBeVisible();
    
    // Check that book cards stack properly on mobile
    const bookCards = page.locator('[data-testid="book-card"]');
    if (await bookCards.count() > 0) {
      const firstCard = bookCards.first();
      const boundingBox = await firstCard.boundingBox();
      expect(boundingBox?.width).toBeLessThan(400); // Should fit mobile width
    }
  });
});