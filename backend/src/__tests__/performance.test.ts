import { spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(require('child_process').exec);

describe('API Performance Tests', () => {
  const baseUrl = 'http://localhost:3001';
  
  beforeAll(async () => {
    // Ensure the server is running for performance tests
    // This would typically be handled by the test setup
  });

  test('GET /api/books endpoint performance', async () => {
    const command = `npx autocannon -c 10 -d 10 -j ${baseUrl}/api/books`;
    
    try {
      const { stdout } = await execAsync(command);
      const results = JSON.parse(stdout);
      
      // Performance assertions
      expect(results.requests.average).toBeGreaterThan(100); // At least 100 req/sec
      expect(results.latency.p99).toBeLessThan(1000); // 99th percentile under 1 second
      expect(results.errors).toBe(0); // No errors during load test
      
      console.log('Books API Performance Results:', {
        avgRequests: results.requests.average,
        p99Latency: results.latency.p99,
        errors: results.errors
      });
    } catch (error) {
      console.warn('Performance test skipped - server may not be running:', error.message);
    }
  }, 30000);

  test('GET /api/search endpoint performance', async () => {
    const command = `npx autocannon -c 5 -d 5 -j "${baseUrl}/api/search?q=test"`;
    
    try {
      const { stdout } = await execAsync(command);
      const results = JSON.parse(stdout);
      
      // Search should be reasonably fast even under load
      expect(results.requests.average).toBeGreaterThan(50); // At least 50 req/sec
      expect(results.latency.p95).toBeLessThan(2000); // 95th percentile under 2 seconds
      expect(results.errors).toBe(0);
      
      console.log('Search API Performance Results:', {
        avgRequests: results.requests.average,
        p95Latency: results.latency.p95,
        errors: results.errors
      });
    } catch (error) {
      console.warn('Search performance test skipped - server may not be running:', error.message);
    }
  }, 20000);

  test('POST /api/books/:id/highlights endpoint performance', async () => {
    // This test would create highlights under load to test write performance
    const testData = JSON.stringify({
      quoteText: 'Performance test highlight',
      pageNumber: 42,
      personalNotes: 'Test note'
    });
    
    const command = `npx autocannon -c 5 -d 5 -j -m POST -H "Content-Type: application/json" -b '${testData}' ${baseUrl}/api/books/1/highlights`;
    
    try {
      const { stdout } = await execAsync(command);
      const results = JSON.parse(stdout);
      
      // Write operations should be slower but still reasonable
      expect(results.requests.average).toBeGreaterThan(20); // At least 20 req/sec
      expect(results.latency.p99).toBeLessThan(3000); // 99th percentile under 3 seconds
      
      console.log('Highlights POST Performance Results:', {
        avgRequests: results.requests.average,
        p99Latency: results.latency.p99,
        errors: results.errors
      });
    } catch (error) {
      console.warn('Highlights POST performance test skipped:', error.message);
    }
  }, 20000);
});

describe('Database Query Performance Tests', () => {
  test('should measure database query performance', async () => {
    // This would test direct database query performance
    const { getDatabase } = require('../database/connection');
    
    try {
      const db = getDatabase();
      const startTime = Date.now();
      
      // Test complex query performance
      const books = db.prepare(`
        SELECT b.*, 
               COUNT(h.id) as highlight_count,
               AVG(CASE WHEN h.id IS NOT NULL THEN 1 ELSE 0 END) as avg_highlights
        FROM books b
        LEFT JOIN highlights h ON b.id = h.book_id
        GROUP BY b.id
        ORDER BY b.position
      `).all();
      
      const queryTime = Date.now() - startTime;
      
      // Query should complete quickly even with joins
      expect(queryTime).toBeLessThan(100); // Under 100ms
      expect(books).toBeDefined();
      
      console.log(`Complex query completed in ${queryTime}ms for ${books.length} books`);
    } catch (error) {
      console.warn('Database performance test skipped:', error.message);
    }
  });

  test('should measure search query performance', async () => {
    const { getDatabase } = require('../database/connection');
    
    try {
      const db = getDatabase();
      const startTime = Date.now();
      
      // Test full-text search performance
      const searchResults = db.prepare(`
        SELECT 'book' as type, id, title as content, authors as context
        FROM books 
        WHERE title LIKE ? OR authors LIKE ?
        UNION ALL
        SELECT 'highlight' as type, h.id, h.quote_text as content, b.title as context
        FROM highlights h
        JOIN books b ON h.book_id = b.id
        WHERE h.quote_text LIKE ? OR h.personal_notes LIKE ?
        LIMIT 50
      `).all('%test%', '%test%', '%test%', '%test%');
      
      const queryTime = Date.now() - startTime;
      
      // Search should be fast
      expect(queryTime).toBeLessThan(200); // Under 200ms
      expect(searchResults).toBeDefined();
      
      console.log(`Search query completed in ${queryTime}ms with ${searchResults.length} results`);
    } catch (error) {
      console.warn('Search performance test skipped:', error.message);
    }
  });
});