import { useState } from 'react';
import Sheet from '../UI/Sheet';
import BookCover from '../BookCover';
import { Book } from '../../types';

interface RemoveBookSheetProps {
  book: Book | null;
  onClose: () => void;
  onUnschedule?: (book: Book) => Promise<void>;
  onDelete: (book: Book) => Promise<void>;
}

/** Confirms removing a book from Up Next: shelve it (default) or delete it from the library. */
function RemoveBookSheet({ book, onClose, onUnschedule, onDelete }: RemoveBookSheetProps) {
  const [busy, setBusy] = useState<'unschedule' | 'delete' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const close = () => { setConfirmDelete(false); onClose(); };
  const run = async (action: 'unschedule' | 'delete', fn: (book: Book) => Promise<void>) => {
    if (!book) return;
    setBusy(action);
    try {
      await fn(book);
      close();
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet open={book !== null} onClose={close} eyebrow={onUnschedule ? 'Up Next' : 'Unscheduled'} title="Remove this book?">
      {book && (
        <div>
          <div className="flex items-center gap-4">
            <BookCover
              title={book.title}
              authors={book.authors}
              {...(book.coverImageUrl && { coverImageUrl: book.coverImageUrl })}
              size="sm"
              className="!rounded-lg shadow-book"
            />
            <div className="min-w-0">
              <h3 className="font-display text-xl leading-tight text-ink-950">{book.title}</h3>
              <p className="mt-1 text-xs text-ink-500">{book.authors.join(' · ')}</p>
            </div>
          </div>

          {confirmDelete ? (
            <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <p className="text-sm leading-6 text-rose-800">
                Delete <strong>{book.title}</strong> from your library for good? This can't be undone.
              </p>
              <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button className="btn-secondary" onClick={() => setConfirmDelete(false)} disabled={busy !== null}>Keep it</button>
                <button
                  className="inline-flex items-center justify-center rounded-full bg-rose-700 px-5 py-2.5 text-sm font-semibold text-paper-50 transition hover:bg-rose-800"
                  onClick={() => run('delete', onDelete)}
                  disabled={busy !== null}
                >
                  {busy === 'delete' ? 'Deleting…' : 'Delete book'}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-6 space-y-2">
              {onUnschedule && (
                <button className="btn-primary w-full" onClick={() => run('unschedule', onUnschedule)} disabled={busy !== null}>
                  {busy === 'unschedule' ? 'Moving…' : 'Move to Unscheduled'}
                </button>
              )}
              {onUnschedule && (
                <p className="px-2 pb-2 text-center text-xs leading-5 text-ink-500">
                  It stays in your library, off the list, and can be added back any time.
                </p>
              )}
              <button className="btn-secondary w-full !text-rose-700" onClick={() => setConfirmDelete(true)} disabled={busy !== null}>
                Delete from library…
              </button>
              <button className="w-full py-2 text-sm font-semibold text-ink-500" onClick={close} disabled={busy !== null}>Cancel</button>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}

export default RemoveBookSheet;
