import { Book, Highlight } from '../types';
import { booksApi } from '../services/api';

/**
 * Data synchronization utilities for maintaining consistency between frontend and backend
 */

export interface SyncResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  conflicts?: Array<{
    field: string;
    localValue: any;
    serverValue: any;
  }>;
}

/**
 * Synchronize a book with the server, handling potential conflicts
 */
export async function syncBook(localBook: Book): Promise<SyncResult<Book>> {
  try {
    // Fetch the latest version from server
    const serverBook = await booksApi.getById(localBook.id);

    // Check for conflicts (server version is newer than local)
    const conflicts: Array<{ field: string; localValue: any; serverValue: any }> = [];

    if (new Date(serverBook.updatedAt) > new Date(localBook.updatedAt)) {
      // Check specific fields that might have conflicts
      const fieldsToCheck: (keyof Book)[] = [
        'progressPercentage',
        'currentPage',
        'status',
        'personalRating',
        'personalReview'
      ];

      fieldsToCheck.forEach(field => {
        if (localBook[field] !== serverBook[field]) {
          conflicts.push({
            field: field as string,
            localValue: localBook[field],
            serverValue: serverBook[field]
          });
        }
      });
    }

    return {
      success: true,
      data: serverBook,
      ...(conflicts.length > 0 && { conflicts })
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to sync book'
    };
  }
}

/**
 * Synchronize highlights for a book with the server
 */
export async function syncHighlights(bookId: number, localHighlights: Highlight[]): Promise<SyncResult<Highlight[]>> {
  try {
    // Fetch the latest highlights from server
    const serverHighlights = await booksApi.getHighlights(bookId);

    // Find highlights that exist locally but not on server (potential deletions)
    // const localIds = new Set(localHighlights.map(h => h.id));
    // const serverIds = new Set(serverHighlights.map(h => h.id));

    // These could be used for conflict resolution in the future
    // const deletedOnServer = localHighlights.filter(h => !serverIds.has(h.id));
    // const addedOnServer = serverHighlights.filter(h => !localIds.has(h.id));

    // Find highlights with potential conflicts (same ID but different content)
    const conflicts: Array<{ field: string; localValue: any; serverValue: any }> = [];

    localHighlights.forEach(localHighlight => {
      const serverHighlight = serverHighlights.find(h => h.id === localHighlight.id);
      if (serverHighlight && new Date(serverHighlight.updatedAt) > new Date(localHighlight.updatedAt)) {
        if (localHighlight.quoteText !== serverHighlight.quoteText ||
          localHighlight.personalNotes !== serverHighlight.personalNotes ||
          localHighlight.pageNumber !== serverHighlight.pageNumber ||
          localHighlight.location !== serverHighlight.location) {
          conflicts.push({
            field: `highlight-${localHighlight.id}`,
            localValue: localHighlight,
            serverValue: serverHighlight
          });
        }
      }
    });

    return {
      success: true,
      data: serverHighlights,
      ...(conflicts.length > 0 && { conflicts })
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to sync highlights'
    };
  }
}

/**
 * Batch synchronization for multiple books
 */
export async function syncAllBooks(localBooks: Book[]): Promise<{
  successful: Book[];
  failed: Array<{ book: Book; error: string }>;
  conflicts: Array<{ book: Book; conflicts: Array<{ field: string; localValue: any; serverValue: any }> }>;
}> {
  const successful: Book[] = [];
  const failed: Array<{ book: Book; error: string }> = [];
  const conflicts: Array<{ book: Book; conflicts: Array<{ field: string; localValue: any; serverValue: any }> }> = [];

  // Process books in batches to avoid overwhelming the server
  const batchSize = 5;
  for (let i = 0; i < localBooks.length; i += batchSize) {
    const batch = localBooks.slice(i, i + batchSize);

    const batchPromises = batch.map(async (book) => {
      const result = await syncBook(book);

      if (result.success && result.data) {
        successful.push(result.data);

        if (result.conflicts && result.conflicts.length > 0) {
          conflicts.push({ book, conflicts: result.conflicts });
        }
      } else {
        failed.push({ book, error: result.error || 'Unknown error' });
      }
    });

    await Promise.all(batchPromises);

    // Small delay between batches to be respectful to the server
    if (i + batchSize < localBooks.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return { successful, failed, conflicts };
}

/**
 * Check if local data is stale compared to server
 */
export function isDataStale(localTimestamp: string, serverTimestamp: string, maxAgeMinutes: number = 5): boolean {
  const localTime = new Date(localTimestamp);
  const serverTime = new Date(serverTimestamp);
  const now = new Date();

  // If server data is newer than local data, it's stale
  if (serverTime > localTime) {
    return true;
  }

  // If local data is older than maxAge, it's stale
  const ageInMinutes = (now.getTime() - localTime.getTime()) / (1000 * 60);
  return ageInMinutes > maxAgeMinutes;
}

/**
 * Merge local and server data, preferring server data for conflicts
 */
export function mergeBookData(localBook: Book, serverBook: Book): Book {
  // Always prefer server data for core fields
  return {
    ...localBook,
    ...serverBook,
    // Keep local optimistic updates for UI responsiveness if server data is very recent
    updatedAt: serverBook.updatedAt
  };
}

/**
 * Merge highlight arrays, handling additions, updates, and deletions
 */
export function mergeHighlightData(localHighlights: Highlight[], serverHighlights: Highlight[]): Highlight[] {
  const merged = new Map<number, Highlight>();

  // Start with server highlights (authoritative)
  serverHighlights.forEach(highlight => {
    merged.set(highlight.id, highlight);
  });

  // Add any local highlights that don't exist on server (potential new additions)
  localHighlights.forEach(localHighlight => {
    if (!merged.has(localHighlight.id)) {
      // This might be a new highlight that hasn't been synced yet
      merged.set(localHighlight.id, localHighlight);
    }
  });

  return Array.from(merged.values()).sort((a, b) => {
    // Sort by page number first, then by creation date
    if (a.pageNumber && b.pageNumber) {
      return a.pageNumber - b.pageNumber;
    }
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

/**
 * Validate data integrity between local and server
 */
export function validateDataIntegrity(localData: any, serverData: any): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Check for required fields
  if (!localData.id || !serverData.id) {
    issues.push('Missing ID field');
  }

  if (localData.id !== serverData.id) {
    issues.push('ID mismatch between local and server data');
  }

  // Check timestamps
  if (!localData.createdAt || !serverData.createdAt) {
    issues.push('Missing creation timestamp');
  }

  if (!localData.updatedAt || !serverData.updatedAt) {
    issues.push('Missing update timestamp');
  }

  // Validate timestamp format
  const timestampRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
  if (localData.createdAt && !timestampRegex.test(localData.createdAt)) {
    issues.push('Invalid local creation timestamp format');
  }

  if (serverData.createdAt && !timestampRegex.test(serverData.createdAt)) {
    issues.push('Invalid server creation timestamp format');
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

/**
 * Create a debounced sync function to avoid excessive API calls
 */
export function createDebouncedSync<T extends (...args: any[]) => Promise<any>>(
  syncFunction: T,
  delayMs: number = 1000
): T {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T>;

  return ((...args: Parameters<T>) => {
    lastArgs = args;

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    return new Promise((resolve, reject) => {
      timeoutId = setTimeout(async () => {
        try {
          const result = await syncFunction(...lastArgs);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, delayMs);
    });
  }) as T;
}