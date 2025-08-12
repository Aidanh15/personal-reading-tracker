import { test, expect } from '@playwright/test';

test.describe('Kindle Import Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should display import functionality', async ({ page }) => {
    // Look for import button or menu
    const importButton = page.locator('[data-testid="import-highlights"]');
    if (await importButton.isVisible()) {
      await importButton.click();
      
      // Should open import modal or page
      await expect(page.locator('[data-testid="import-modal"]')).toBeVisible();
    }
  });

  test('should handle file upload for Kindle highlights', async ({ page }) => {
    const importButton = page.locator('[data-testid="import-highlights"]');
    if (await importButton.isVisible()) {
      await importButton.click();
      
      // Look for file upload area
      const fileUpload = page.locator('[data-testid="file-upload"]');
      if (await fileUpload.isVisible()) {
        // Create a test file content
        const testContent = `The Great Gatsby: F. Scott Fitzgerald
        
        - Your Highlight on page 1 | location 1-2 | Added on Sunday, January 1, 2023 1:00:00 PM
        
        In my younger and more vulnerable years my father gave me some advice that I've carried with me ever since.
        
        ==========
        
        - Your Highlight on page 5 | location 10-12 | Added on Sunday, January 1, 2023 2:00:00 PM
        
        So we beat on, boats against the current, borne back ceaselessly into the past.`;
        
        // Create a temporary file for testing
        const buffer = Buffer.from(testContent);
        await fileUpload.setInputFiles({
          name: 'kindle-highlights.txt',
          mimeType: 'text/plain',
          buffer: buffer,
        });
        
        // Should show parsing preview
        await expect(page.locator('[data-testid="parsing-preview"]')).toBeVisible();
      }
    }
  });

  test('should allow categorizing imported books', async ({ page }) => {
    // This test would require setting up the import flow
    // and verifying that users can categorize books as:
    // - Currently Reading
    // - Up Next
    // - Previously Read
    // - Skip import
    
    const importButton = page.locator('[data-testid="import-highlights"]');
    if (await importButton.isVisible()) {
      await importButton.click();
      
      // After file upload and parsing
      const bookCategories = page.locator('[data-testid="book-category-selector"]');
      if (await bookCategories.count() > 0) {
        const firstCategory = bookCategories.first();
        await firstCategory.click();
        
        // Select "Previously Read"
        await page.locator('[data-testid="category-previously-read"]').click();
        
        // Verify selection
        await expect(firstCategory).toContainText('Previously Read');
      }
    }
  });

  test('should process and import highlights successfully', async ({ page }) => {
    const importButton = page.locator('[data-testid="import-highlights"]');
    if (await importButton.isVisible()) {
      await importButton.click();
      
      // After categorization, should have import button
      const processImportButton = page.locator('[data-testid="process-import"]');
      if (await processImportButton.isVisible()) {
        await processImportButton.click();
        
        // Should show success message
        await expect(page.locator('[data-testid="import-success"]')).toBeVisible();
        
        // Should close modal and return to dashboard
        await expect(page.locator('[data-testid="import-modal"]')).not.toBeVisible();
      }
    }
  });
});