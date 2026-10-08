import { db } from '../connection';

export type DiscussionStatus = 'active' | 'reviewed';
export type MessageRole = 'user' | 'assistant';
export type MessageKind = 'chat' | 'review';

export interface Discussion {
  id: number;
  bookId: number;
  claudeSessionId: string;
  status: DiscussionStatus;
  model: string | null;
  reviewDraft: string | null;
  reviewRating: number | null;
  appliedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DiscussionMessage {
  id: number;
  discussionId: number;
  role: MessageRole;
  kind: MessageKind;
  content: string;
  createdAt: string;
}

const DISCUSSION_COLUMNS = `
  id,
  book_id as bookId,
  claude_session_id as claudeSessionId,
  status,
  model,
  review_draft as reviewDraft,
  review_rating as reviewRating,
  applied_at as appliedAt,
  created_at as createdAt,
  updated_at as updatedAt
`;

const MESSAGE_COLUMNS = `
  id,
  discussion_id as discussionId,
  role,
  kind,
  content,
  created_at as createdAt
`;

export class DiscussionQueries {
  static create(bookId: number, claudeSessionId: string, model: string | null): Discussion {
    const result = db.prepare(`
      INSERT INTO discussions (book_id, claude_session_id, model) VALUES (?, ?, ?)
    `).run(bookId, claudeSessionId, model);
    return this.get(Number(result.lastInsertRowid))!;
  }

  static get(id: number): Discussion | null {
    return (db.prepare(`SELECT ${DISCUSSION_COLUMNS} FROM discussions WHERE id = ?`).get(id) as Discussion | undefined) ?? null;
  }

  // Newest first
  static listForBook(bookId: number): Discussion[] {
    return db.prepare(`
      SELECT ${DISCUSSION_COLUMNS} FROM discussions WHERE book_id = ? ORDER BY created_at DESC, id DESC
    `).all(bookId) as Discussion[];
  }

  // Oldest first
  static messages(discussionId: number): DiscussionMessage[] {
    return db.prepare(`
      SELECT ${MESSAGE_COLUMNS} FROM discussion_messages WHERE discussion_id = ? ORDER BY id ASC
    `).all(discussionId) as DiscussionMessage[];
  }

  static addMessage(discussionId: number, role: MessageRole, kind: MessageKind, content: string): DiscussionMessage {
    const result = db.prepare(`
      INSERT INTO discussion_messages (discussion_id, role, kind, content) VALUES (?, ?, ?, ?)
    `).run(discussionId, role, kind, content);
    db.prepare('UPDATE discussions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(discussionId);
    return db.prepare(`SELECT ${MESSAGE_COLUMNS} FROM discussion_messages WHERE id = ?`)
      .get(Number(result.lastInsertRowid)) as DiscussionMessage;
  }

  static lastMessage(discussionId: number): DiscussionMessage | null {
    return (db.prepare(`
      SELECT ${MESSAGE_COLUMNS} FROM discussion_messages WHERE discussion_id = ? ORDER BY id DESC LIMIT 1
    `).get(discussionId) as DiscussionMessage | undefined) ?? null;
  }

  static setSessionId(id: number, claudeSessionId: string): void {
    db.prepare('UPDATE discussions SET claude_session_id = ? WHERE id = ?').run(claudeSessionId, id);
  }

  static saveReview(id: number, draft: string, rating: number | null): Discussion {
    db.prepare(`
      UPDATE discussions SET review_draft = ?, review_rating = ?, status = 'reviewed' WHERE id = ?
    `).run(draft, rating, id);
    return this.get(id)!;
  }

  static markApplied(id: number): Discussion {
    db.prepare("UPDATE discussions SET applied_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(id);
    return this.get(id)!;
  }

  /** The reader's most recent saved reviews of other books, as examples of their voice. */
  static voiceExamples(excludeBookId: number, limit = 2): string[] {
    return (db.prepare(`
      SELECT personal_review AS review FROM books
      WHERE id != ? AND personal_review IS NOT NULL AND trim(personal_review) != ''
      ORDER BY updated_at DESC, id DESC LIMIT ?
    `).all(excludeBookId, limit) as { review: string }[]).map(row => row.review);
  }

  static delete(id: number): boolean {
    return db.prepare('DELETE FROM discussions WHERE id = ?').run(id).changes > 0;
  }
}
