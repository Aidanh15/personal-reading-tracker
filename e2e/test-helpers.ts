import { Page, expect } from '@playwright/test';

/**
 * Test helper utilities for E2E tests
 */
export class TestHelpers {
  constructor(private page: Page) { }

  /**
   * Wait for the application to be fully loaded
   */
  async waitForAppLoad() {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForSelector('[data-testid="app-loaded"]', { timeout: 10000 });
  }

  /**
   * Navigate to a specific book detail page
   */
  async navigateToBookDetail(bookIndex: number = 0) {
    await this.page.goto('/');
    await this.waitForAppLoad();

    const bookCards = this.page.locator('[data-testid="book-card"]');
    const count = await bookCards.count();
    expect(count).toBeGreaterThan(bookIndex);

    await bookCards.nth(bookIndex).click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Add a test highlight to a book
   */
  async addHighlight(quoteText: string, pageNumber: number, notes?: string) {
    const addButton = this.page.locator('[data-testid="add-highlight-button"]');
    await addButton.click();

    await this.page.locator('[data-testid="highlight-text"]').fill(quoteText);
    await this.page.locator('[data-testid="highlight-page"]').fill(pageNumber.toString());

    if (notes) {
      await this.page.locator('[data-testid="highlight-notes"]').fill(notes);
    }

    await this.page.locator('[data-testid="save-highlight"]').click();

    // Wait for success confirmation
    await expect(this.page.locator('[data-testid="success-message"]')).toBeVisible();
  }

  /**
   * Update reading progress for a book
   */
  async updateProgress(percentage: number) {
    const progressInput = this.page.locator('[data-testid="progress-input"]');
    await progressInput.fill(percentage.toString());

    const saveButton = this.page.locator('[data-testid="save-progress"]');
    await saveButton.click();

    await expect(this.page.locator('[data-testid="success-message"]')).toBeVisible();
  }

  /**
   * Change book reading status
   */
  async changeBookStatus(status: 'not_started' | 'in_progress' | 'completed') {
    const statusSelector = this.page.locator('[data-testid="status-selector"]');
    await statusSelector.click();

    await this.page.locator(`[data-testid="status-${status}"]`).click();

    // Verify status change
    await expect(this.page.locator('[data-testid="current-status"]')).toContainText(
      status.replace('_', ' ')
    );
  }

  /**
   * Perform a global search
   */
  async performSearch(query: string) {
    const searchBar = this.page.locator('[data-testid="global-search"]');
    await searchBar.fill(query);

    // Wait for search results
    await this.page.waitForTimeout(500);

    return this.page.locator('[data-testid="search-results"]');
  }

  /**
   * Check if element is visible with retry
   */
  async isVisibleWithRetry(selector: string, maxRetries: number = 3): Promise<boolean> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const element = this.page.locator(selector);
        await element.waitFor({ state: 'visible', timeout: 2000 });
        return true;
      } catch {
        if (i === maxRetries - 1) return false;
        await this.page.waitForTimeout(1000);
      }
    }
    return false;
  }

  /**
   * Take a screenshot with timestamp
   */
  async takeTimestampedScreenshot(name: string) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await this.page.screenshot({
      path: `test-results/screenshots/${name}-${timestamp}.png`,
      fullPage: true
    });
  }

  /**
   * Mock API response for testing
   */
  async mockApiResponse(endpoint: string, response: any, status: number = 200) {
    await this.page.route(`**/api${endpoint}`, route => {
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    });
  }

  /**
   * Simulate network conditions
   */
  async simulateSlowNetwork() {
    const client = await this.page.context().newCDPSession(this.page);
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: 1.5 * 1024 * 1024 / 8, // 1.5 Mbps
      uploadThroughput: 750 * 1024 / 8, // 750 Kbps
      latency: 40, // 40ms
    });
  }

  /**
   * Reset network conditions
   */
  async resetNetworkConditions() {
    const client = await this.page.context().newCDPSession(this.page);
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: -1,
      uploadThroughput: -1,
      latency: 0,
    });
  }

  /**
   * Check accessibility violations
   */
  async checkAccessibility() {
    // This would integrate with axe-core or similar accessibility testing library
    // For now, we'll do basic checks

    // Check for alt text on images
    const images = this.page.locator('img');
    const imageCount = await images.count();

    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      if (!alt) {
        console.warn(`Image ${i} missing alt text`);
      }
    }

    // Check for proper heading structure
    const headings = this.page.locator('h1, h2, h3, h4, h5, h6');
    const headingCount = await headings.count();

    if (headingCount === 0) {
      console.warn('No headings found on page');
    }
  }

  /**
   * Measure page performance
   */
  async measurePerformance() {
    const performanceEntries = await this.page.evaluate(() => {
      return JSON.stringify(performance.getEntriesByType('navigation'));
    });

    const entries = JSON.parse(performanceEntries);
    const navigation = entries[0];

    return {
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
      loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
      firstPaint: navigation.responseEnd - navigation.requestStart,
    };
  }

  /**
   * Wait for specific network requests to complete
   */
  async waitForApiCall(endpoint: string, timeout: number = 5000) {
    return this.page.waitForResponse(
      response => response.url().includes(endpoint) && response.status() === 200,
      { timeout }
    );
  }

  /**
   * Simulate user typing with realistic delays
   */
  async typeWithDelay(selector: string, text: string, delay: number = 100) {
    const element = this.page.locator(selector);
    await element.click();

    for (const char of text) {
      await element.pressSequentially(char);
      await this.page.waitForTimeout(delay);
    }
  }

  /**
   * Scroll to element and ensure it's visible
   */
  async scrollToElement(selector: string) {
    const element = this.page.locator(selector);
    await element.scrollIntoViewIfNeeded();
    await expect(element).toBeVisible();
  }

  /**
   * Generate test data for a book
   */
  generateTestBook(index: number = 1) {
    return {
      title: `Test Book ${index}`,
      authors: [`Test Author ${index}`],
      position: index,
      status: 'not_started',
      progressPercentage: 0,
      totalPages: 200 + index * 50,
      currentPage: 0,
    };
  }

  /**
   * Generate test data for a highlight
   */
  generateTestHighlight(bookId: number, index: number = 1) {
    return {
      bookId,
      quoteText: `This is test highlight ${index} for automated testing purposes.`,
      pageNumber: index * 10,
      personalNotes: `Test note ${index} for highlight.`,
    };
  }
}