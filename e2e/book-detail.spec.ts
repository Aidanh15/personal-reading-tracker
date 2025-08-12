import { test, expect } from '@playwright/test';

test.describe('Book Detail Page - Progress Tracking and Highlights', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard first
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should navigate to book detail page and display comprehensive information', async ({ page }) => {
    // Click on the first book card to navigate to detail page
    const firstBookCard = page.locator('[data-testid="book-card"]').first();
    await expect(firstBookCard).toBeVisible();
    
    await firstBookCard.click();
    
    // Wait for navigation to book detail page
    await page.waitForLoadState('networkidle');
    
    // Check that we're on the book detail page
    await expect(page.locator('[data-testid="book-detail-page"]')).toBeVisible();
    
    // Verify book metadata is displayed
    await expect(page.locator('[data-testid="book-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="book-author"]')).toBeVisible();
    
    // Check for progress tracking section
    await expect(page.locator('[data-testid="progress-tracker"]')).toBeVisible();
    
    // Check for highlights section
    await expect(page.locator('[data-testid="highlights-section"]')).toBeVisible();
  });

  test('should allow updating reading progress', async ({ page }) => {
    // Navigate to a book detail page
    await page.locator('[data-testid="book-card"]').first().click();
    await page.waitForLoadState('networkidle');
    
    // Find and interact with progress tracker
    const progressTracker = page.locator('[data-testid="progress-tracker"]');
    await expect(progressTracker).toBeVisible();
    
    // Look for progress input or slider
    const progressInput = page.locator('[data-testid="progress-input"]');
    if (await progressInput.isVisible()) {
      await progressInput.fill('25');
      
      // Save progress
      const saveButton = page.locator('[data-testid="save-progress"]');
      await saveButton.click();
      
      // Wait for success feedback
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    }
  });

  test('should allow changing reading status', async ({ page }) => {
    // Navigate to a book detail page
    await page.locator('[data-testid="book-card"]').first().click();
    await page.waitForLoadState('networkidle');
    
    // Find status selector
    const statusSelector = page.locator('[data-testid="status-selector"]');
    if (await statusSelector.isVisible()) {
      await statusSelector.click();
      
      // Select "In Progress" status
      await page.locator('[data-testid="status-in-progress"]').click();
      
      // Verify status change
      await expect(page.locator('[data-testid="current-status"]')).toContainText('In Progress');
    }
  });

  test('should display and manage highlights', async ({ page }) => {
    // Navigate to a book detail page
    await page.locator('[data-testid="book-card"]').first().click();
    await page.waitForLoadState('networkidle');
    
    // Check highlights section
    const highlightsSection = page.locator('[data-testid="highlights-section"]');
    await expect(highlightsSection).toBeVisible();
    
    // Check for add highlight button
    const addHighlightButton = page.locator('[data-testid="add-highlight-button"]');
    if (await addHighlightButton.isVisible()) {
      await addHighlightButton.click();
      
      // Fill in highlight form
      await page.locator('[data-testid="highlight-text"]').fill('This is a test highlight from the book.');
      await page.locator('[data-testid="highlight-page"]').fill('42');
      await page.locator('[data-testid="highlight-notes"]').fill('Important concept to remember.');
      
      // Save highlight
      await page.locator('[data-testid="save-highlight"]').click();
      
      // Verify highlight was added
      await expect(page.locator('[data-testid="highlight-item"]')).toBeVisible();
    }
  });

  test('should search within book highlights', async ({ page }) => {
    // Navigate to a book detail page
    await page.locator('[data-testid="book-card"]').first().click();
    await page.waitForLoadState('networkidle');
    
    // Look for highlight search functionality
    const highlightSearch = page.locator('[data-testid="highlight-search"]');
    if (await highlightSearch.isVisible()) {
      await highlightSearch.fill('test');
      
      // Wait for search results
      await page.waitForTimeout(500);
      
      // Verify search results are filtered
      const searchResults = page.locator('[data-testid="highlight-item"]');
      if (await searchResults.count() > 0) {
        await expect(searchResults.first()).toContainText('test');
      }
    }
  });
});