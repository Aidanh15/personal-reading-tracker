import { db } from '../connection';
import { Highlight, CreateHighlightRequest, UpdateHighlightRequest } from '../../types';

export class HighlightQueries {
  // Get all highlights for a book
  static getHighlightsByBookId(bookId: number): Highlight[] {
    const query = `
      SELECT 
        id,
        book_id as bookId,
        quote_text as quoteText,
        page_number as pageNumber,
        location,
        personal_notes as personalNotes,
        highlight_date as highlightDate,
        created_at as createdAt,
        updated_at as updatedAt
      FROM highlights 
      WHERE book_id = ?
      ORDER BY page_number ASC, created_at ASC
    `;
    
    return db.prepare(query).all(bookId) as Highlight[];
  }

  // Get highlight by ID
  static getHighlightById(id: number): Highlight | null {
    const query = `
      SELECT 
        id,
        book_id as bookId,
        quote_text as quoteText,
        page_number as pageNumber,
        location,
        personal_notes as personalNotes,
        highlight_date as highlightDate,
        created_at as createdAt,
        updated_at as updatedAt
      FROM highlights 
      WHERE id = ?
    `;
    
    return db.prepare(query).get(id) as Highlight | null;
  }

  // Create new highlight
  static createHighlight(bookId: number, highlightData: CreateHighlightRequest): Highlight {
    const query = `
      INSERT INTO highlights (book_id, quote_text, page_number, location, personal_notes, highlight_date)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    const result = db.prepare(query).run(
      bookId,
      highlightData.quoteText,
      highlightData.pageNumber,
      highlightData.location,
      highlightData.personalNotes,
      highlightData.highlightDate
    );
    
    const newHighlight = this.getHighlightById(result.lastInsertRowid as number);
    if (!newHighlight) {
      throw new Error('Failed to create highlight');
    }
    
    return newHighlight;
  }

  // Update highlight
  static updateHighlight(id: number, highlightData: UpdateHighlightRequest): Highlight | null {
    const updates: string[] = [];
    const values: any[] = [];
    
    if (highlightData.quoteText !== undefined) {
      updates.push('quote_text = ?');
      values.push(highlightData.quoteText);
    }
    
    if (highlightData.pageNumber !== undefined) {
      updates.push('page_number = ?');
      values.push(highlightData.pageNumber);
    }
    
    if (highlightData.location !== undefined) {
      updates.push('location = ?');
      values.push(highlightData.location);
    }
    
    if (highlightData.personalNotes !== undefined) {
      updates.push('personal_notes = ?');
      values.push(highlightData.personalNotes);
    }
    
    if (updates.length === 0) {
      return this.getHighlightById(id);
    }
    
    const query = `UPDATE highlights SET ${updates.join(', ')} WHERE id = ?`;
    values.push(id);
    
    db.prepare(query).run(...values);
    return this.getHighlightById(id);
  }

  // Delete highlight
  static deleteHighlight(id: number): boolean {
    const query = 'DELETE FROM highlights WHERE id = ?';
    const result = db.prepare(query).run(id);
    return result.changes > 0;
  }

  // Search highlights by text
  static searchHighlights(searchTerm: string, bookId?: number): (Highlight & { bookTitle: string; bookAuthors: string[] })[] {
    let query = `
      SELECT 
        h.id,
        h.book_id as bookId,
        h.quote_text as quoteText,
        h.page_number as pageNumber,
        h.location,
        h.personal_notes as personalNotes,
        h.highlight_date as highlightDate,
        h.created_at as createdAt,
        h.updated_at as updatedAt,
        b.title as bookTitle,
        b.authors as bookAuthors
      FROM highlights h
      JOIN books b ON h.book_id = b.id
      WHERE (h.quote_text LIKE ? OR h.personal_notes LIKE ?)
    `;
    
    const params: any[] = [`%${searchTerm}%`, `%${searchTerm}%`];
    
    if (bookId !== undefined) {
      query += ' AND h.book_id = ?';
      params.push(bookId);
    }
    
    query += ' ORDER BY h.created_at DESC';
    
    const rows = db.prepare(query).all(...params) as any[];
    return rows.map(row => ({
      ...row,
      bookAuthors: JSON.parse(row.bookAuthors)
    }));
  }

  // Get highlight count for a book
  static getHighlightCount(bookId: number): number {
    const query = 'SELECT COUNT(*) as count FROM highlights WHERE book_id = ?';
    const result = db.prepare(query).get(bookId) as { count: number };
    return result.count;
  }

  // Bulk create highlights (for Kindle import)
  static bulkCreateHighlights(bookId: number, highlights: CreateHighlightRequest[]): Highlight[] {
    const query = `
      INSERT INTO highlights (book_id, quote_text, page_number, location, personal_notes, highlight_date)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    const stmt = db.prepare(query);
    const createdHighlights: Highlight[] = [];
    
    const transaction = db.transaction(() => {
      for (const highlight of highlights) {
        const result = stmt.run(
          bookId,
          highlight.quoteText,
          highlight.pageNumber,
          highlight.location,
          highlight.personalNotes,
          highlight.highlightDate
        );
        
        const newHighlight = this.getHighlightById(result.lastInsertRowid as number);
        if (newHighlight) {
          createdHighlights.push(newHighlight);
        }
      }
    });
    
    transaction();
    return createdHighlights;
  }

  // Check if highlight already exists (for duplicate prevention)
  static highlightExists(bookId: number, quoteText: string): boolean {
    const query = 'SELECT COUNT(*) as count FROM highlights WHERE book_id = ? AND quote_text = ?';
    const result = db.prepare(query).get(bookId, quoteText) as { count: number };
    return result.count > 0;
  }
}