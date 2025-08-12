// Test configuration for different environments
module.exports = {
  // Environment-specific configurations
  environments: {
    development: {
      baseUrl: 'http://localhost:5173',
      apiUrl: 'http://localhost:3001',
      timeout: 30000,
      retries: 1,
    },
    staging: {
      baseUrl: 'https://staging.reading-tracker.local',
      apiUrl: 'https://staging-api.reading-tracker.local',
      timeout: 60000,
      retries: 2,
    },
    production: {
      baseUrl: 'https://reading-tracker.local',
      apiUrl: 'https://api.reading-tracker.local',
      timeout: 60000,
      retries: 3,
    },
  },

  // Test data configurations
  testData: {
    sampleBooks: [
      {
        title: 'Test Book 1',
        authors: ['Test Author 1'],
        position: 1,
        status: 'not_started',
      },
      {
        title: 'Test Book 2',
        authors: ['Test Author 2'],
        position: 2,
        status: 'in_progress',
        progressPercentage: 45,
      },
    ],
    sampleHighlights: [
      {
        quoteText: 'This is a test highlight for automated testing.',
        pageNumber: 42,
        personalNotes: 'Important concept for testing.',
      },
    ],
  },

  // Performance thresholds
  performance: {
    pageLoadTime: 3000, // 3 seconds
    apiResponseTime: 1000, // 1 second
    searchResponseTime: 500, // 500ms
    memoryUsage: 100 * 1024 * 1024, // 100MB
  },

  // Visual regression settings
  visualRegression: {
    threshold: 0.2, // 20% difference allowed
    updateBaseline: process.env.UPDATE_VISUAL_BASELINE === 'true',
    browsers: ['chromium', 'firefox', 'webkit'],
  },

  // Accessibility settings
  accessibility: {
    standards: 'WCAG21AA',
    includeWarnings: true,
    tags: ['wcag2a', 'wcag2aa', 'wcag21aa'],
  },

  // Security testing
  security: {
    checkXSS: true,
    checkSQLInjection: true,
    checkCSRF: true,
    checkHeaders: true,
  },
};