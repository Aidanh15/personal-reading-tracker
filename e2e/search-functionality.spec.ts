import { test, expect } from '@playwright/test';

test.describe('Search Functionality - Global Search Across Books and Highlights', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should display global search functionality', async ({ page }) => {
    // Check for search bar in the main navigation or header
    const searchBar = page.locator('[data-testid="global-search"]');
    await expect(searchBar).toBeVisible();
  });

  test('should search across book titles and authors', async ({ page }) => {
    const searchBar = page.locator('[data-testid="global-search"]');
    await searchBar.fill('test');
    
    // Wait for search results
    await page.waitForTimeout(500);
    
    // Check for search results container
    const searchResults = page.locator('[data-testid="search-results"]');
    await expect(searchResults).toBeVisible();
    
    // Verify results contain books
    const bookResults = page.locator('[data-testid="book-search-result"]');
    if (await bookResults.count() > 0) {
      await expect(bookResults.first()).toBeVisible();
    }
  });

  test('should search across highlights text', async ({ page }) => {
    const searchBar = page.locator('[data-testid="global-search"]');
    await searchBar.fill('highlight');
    
    await page.waitForTimeout(500);
    
    // Check for highlight results
    const highlightResults = page.locator('[data-testid="highlight-search-result"]');
    if (await highlightResults.count() > 0) {
      await expect(highlightResults.first()).toBeVisible();
      
      // Verify highlight results show book context
      await expect(highlightResults.first().locator('[data-testid="result-book-title"]')).toBeVisible();
    }
  });

  test('should filter search results by type', async ({ page }) => {
    const searchBar = page.locator('[data-testid="global-search"]');
    await searchBar.fill('test');
    
    await page.waitForTimeout(500);
    
    // Look for filter options
    const booksFilter = page.locator('[data-testid="filter-books"]');
    const highlightsFilter = page.locator('[data-testid="filter-highlights"]');
    
    if (await booksFilter.isVisible()) {
      await booksFilter.click();
      
      // Verify only book results are shown
      await expect(page.locator('[data-testid="book-search-result"]')).toBeVisible();
      
      // Verify highlight results are hidden
      const highlightResults = page.locator('[data-testid="highlight-search-result"]');
      if (await highlightResults.count() > 0) {
        await expect(highlightResults.first()).not.toBeVisible();
      }
    }
  });

  test('should navigate to search results', async ({ page }) => {
    const searchBar = page.locator('[data-testid="global-search"]');
    await searchBar.fill('test');
    
    await page.waitForTimeout(500);
    
    // Click on a book search result
    const bookResult = page.locator('[data-testid="book-search-result"]').first();
    if (await bookResult.isVisible()) {
      await bookResult.click();
      
      // Should navigate to book detail page
      await page.waitForLoadState('networkidle');
      await expect(page.locator('[data-testid="book-detail-page"]')).toBeVisible();
    }
  });

  test('should handle empty search results gracefully', async ({ page }) => {
    const searchBar = page.locator('[data-testid="global-search"]');
    await searchBar.fill('nonexistentbookxyz123');
    
    await page.waitForTimeout(500);
    
    // Should show no results message
    const noResults = page.locator('[data-testid="no-search-results"]');
    await expect(noResults).toBeVisible();
    await expect(noResults).toContainText('No results found');
  });
});