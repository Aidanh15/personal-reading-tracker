import { db } from '../connection';
import { Book, CreateBookRequest, UpdateBookProgressRequest, UpdateBookStatusRequest } from '../../types';

export class BookQueries {
  // Get all books ordered by status and position
  static getAllBooks(): Book[] {
    const query = `
      SELECT 
        id,
        title,
        authors,
        position,
        status,
        progress_percentage as progressPercentage,
        total_pages as totalPages,
        current_page as currentPage,
        started_date as startedDate,
        completed_date as completedDate,
        personal_rating as personalRating,
        personal_review as personalReview,
        cover_image_url as coverImageUrl,
        created_at as createdAt,
        updated_at as updatedAt
      FROM books 
      ORDER BY 
        CASE status 
          WHEN 'in_progress' THEN 1 
          WHEN 'not_started' THEN 2 
          WHEN 'completed' THEN 3 
        END,
        position ASC,
        created_at DESC
    `;
    
    const rows = db.prepare(query).all() as any[];
    return rows.map(row => ({
      ...row,
      authors: JSON.parse(row.authors)
    }));
  }

  // Get book by ID
  static getBookById(id: number): Book | null {
    const query = `
      SELECT 
        id,
        title,
        authors,
        position,
        status,
        progress_percentage as progressPercentage,
        total_pages as totalPages,
        current_page as currentPage,
        started_date as startedDate,
        completed_date as completedDate,
        personal_rating as personalRating,
        personal_review as personalReview,
        cover_image_url as coverImageUrl,
        created_at as createdAt,
        updated_at as updatedAt
      FROM books 
      WHERE id = ?
    `;
    
    const row = db.prepare(query).get(id) as any;
    if (!row) return null;
    
    return {
      ...row,
      authors: JSON.parse(row.authors)
    };
  }

  // Create new book
  static createBook(bookData: CreateBookRequest): Book {
    const query = `
      INSERT INTO books (title, authors, position, total_pages, cover_image_url)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    const position = bookData.position ?? this.getNextPosition();
    const result = db.prepare(query).run(
      bookData.title,
      JSON.stringify(bookData.authors),
      position,
      bookData.totalPages,
      bookData.coverImageUrl
    );
    
    const newBook = this.getBookById(result.lastInsertRowid as number);
    if (!newBook) {
      throw new Error('Failed to create book');
    }
    
    return newBook;
  }

  // Update book progress
  static updateBookProgress(id: number, progressData: UpdateBookProgressRequest): Book | null {
    const updates: string[] = [];
    const values: any[] = [];
    
    if (progressData.currentPage !== undefined) {
      updates.push('current_page = ?');
      values.push(progressData.currentPage);
    }
    
    if (progressData.progressPercentage !== undefined) {
      updates.push('progress_percentage = ?');
      values.push(progressData.progressPercentage);
    }
    
    if (progressData.totalPages !== undefined) {
      updates.push('total_pages = ?');
      values.push(progressData.totalPages);
    }
    
    if (updates.length === 0) {
      return this.getBookById(id);
    }
    
    const query = `UPDATE books SET ${updates.join(', ')} WHERE id = ?`;
    values.push(id);
    
    db.prepare(query).run(...values);
    return this.getBookById(id);
  }

  // Update book status
  static updateBookStatus(id: number, statusData: UpdateBookStatusRequest): Book | null {
    const updates: string[] = ['status = ?'];
    const values: any[] = [statusData.status];
    
    if (statusData.startedDate !== undefined) {
      updates.push('started_date = ?');
      values.push(statusData.startedDate);
    }
    
    if (statusData.completedDate !== undefined) {
      updates.push('completed_date = ?');
      values.push(statusData.completedDate);
    }
    
    const query = `UPDATE books SET ${updates.join(', ')} WHERE id = ?`;
    values.push(id);
    
    db.prepare(query).run(...values);
    return this.getBookById(id);
  }

  // Generic update book method for seeding
  static updateBook(id: number, updateData: Partial<Book>): Book | null {
    const updates: string[] = [];
    const values: any[] = [];
    
    if (updateData.status !== undefined) {
      updates.push('status = ?');
      values.push(updateData.status);
    }
    
    if (updateData.progressPercentage !== undefined) {
      updates.push('progress_percentage = ?');
      values.push(updateData.progressPercentage);
    }
    
    if (updateData.currentPage !== undefined) {
      updates.push('current_page = ?');
      values.push(updateData.currentPage);
    }
    
    if (updateData.startedDate !== undefined) {
      updates.push('started_date = ?');
      values.push(updateData.startedDate);
    }
    
    if (updateData.completedDate !== undefined) {
      updates.push('completed_date = ?');
      values.push(updateData.completedDate);
    }
    
    if (updateData.personalRating !== undefined) {
      updates.push('personal_rating = ?');
      values.push(updateData.personalRating);
    }
    
    if (updateData.personalReview !== undefined) {
      updates.push('personal_review = ?');
      values.push(updateData.personalReview);
    }
    
    if (updates.length === 0) {
      return this.getBookById(id);
    }
    
    const query = `UPDATE books SET ${updates.join(', ')} WHERE id = ?`;
    values.push(id);
    
    db.prepare(query).run(...values);
    return this.getBookById(id);
  }

  // Reorder books
  static reorderBooks(bookIds: number[]): void {
    const updateQuery = 'UPDATE books SET position = ? WHERE id = ?';
    const stmt = db.prepare(updateQuery);
    
    const transaction = db.transaction(() => {
      bookIds.forEach((bookId, index) => {
        stmt.run(index + 1, bookId);
      });
    });
    
    transaction();
  }

  // Delete book
  static deleteBook(id: number): boolean {
    const query = 'DELETE FROM books WHERE id = ?';
    const result = db.prepare(query).run(id);
    return result.changes > 0;
  }

  // Get next position for new books
  private static getNextPosition(): number {
    const query = 'SELECT MAX(position) as maxPosition FROM books';
    const result = db.prepare(query).get() as { maxPosition: number | null };
    return (result.maxPosition || 0) + 1;
  }

  // Search books by title or author
  static searchBooks(searchTerm: string): Book[] {
    const query = `
      SELECT 
        id,
        title,
        authors,
        position,
        status,
        progress_percentage as progressPercentage,
        total_pages as totalPages,
        current_page as currentPage,
        started_date as startedDate,
        completed_date as completedDate,
        personal_rating as personalRating,
        personal_review as personalReview,
        cover_image_url as coverImageUrl,
        created_at as createdAt,
        updated_at as updatedAt
      FROM books 
      WHERE title LIKE ? OR authors LIKE ?
      ORDER BY 
        CASE status 
          WHEN 'in_progress' THEN 1 
          WHEN 'not_started' THEN 2 
          WHEN 'completed' THEN 3 
        END,
        position ASC
    `;
    
    const searchPattern = `%${searchTerm}%`;
    const rows = db.prepare(query).all(searchPattern, searchPattern) as any[];
    return rows.map(row => ({
      ...row,
      authors: JSON.parse(row.authors)
    }));
  }
}