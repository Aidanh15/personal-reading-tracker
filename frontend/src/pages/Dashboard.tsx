import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRightIcon,
  ArrowUturnLeftIcon,
  BookOpenIcon,
  BookmarkSquareIcon,
  ChartBarIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PlusIcon,
  SparklesIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { useBooks } from '../contexts/BooksContext';
import { useNotification } from '../contexts/NotificationContext';
import { booksApi, reviewApi } from '../services/api';
import { AddToUpNextData, Book, ReviewSummary } from '../types';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import BookCard from '../components/UI/BookCard';
import UpNextList from '../components/UpNext/UpNextList';
import AddBookSheet from '../components/UpNext/AddBookSheet';
import RemoveBookSheet from '../components/UpNext/RemoveBookSheet';

const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Please try again.';

function Dashboard() {
  const { books, loading, error, fetchBooks } = useBooks();
  const [showCompletedBooks, setShowCompletedBooks] = useState(false);
  const [showDnfBooks, setShowDnfBooks] = useState(false);
  const [showUnscheduled, setShowUnscheduled] = useState(false);
  const [reviewSummary, setReviewSummary] = useState<ReviewSummary | null>(null);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<{ book: Book; fromUpNext: boolean } | null>(null);
  const { showSuccess, showError } = useNotification();

  useEffect(() => { fetchBooks(); }, [fetchBooks]);
  useEffect(() => {
    reviewApi.getSummary().then(setReviewSummary).catch(() => setReviewSummary(null));
  }, []);

  const sortedBooks = useMemo(() => [...books].sort((a, b) => a.position - b.position), [books]);
  const inProgressBooks = sortedBooks.filter(book => book.status === 'in_progress');
  const completedBooks = sortedBooks.filter(book => book.status === 'completed');
  const dnfBooks = sortedBooks.filter(book => book.status === 'did_not_finish');
  const parallelBook = sortedBooks.find(book => book.parallelTrack);
  const upNextBooks = useMemo(
    () => sortedBooks.filter(book => book.status === 'not_started' && !book.unscheduled && !book.parallelTrack),
    [sortedBooks]
  );
  const unscheduledBooks = sortedBooks.filter(book => book.status === 'not_started' && book.unscheduled);
  // The numbered list runs from #1 to the last Up Next book; finished books off the list sit at 1000+
  const listLength = Math.floor(Math.max(0, ...sortedBooks.filter(book => book.position < 1000 && !book.parallelTrack).map(book => book.position)));
  const masterCompleted = books.filter(book => book.status === 'completed' && book.position <= listLength).length;
  const journeyProgress = listLength ? Math.round((masterCompleted / listLength) * 100) : 0;
  const nextBook = upNextBooks[0];

  const saveOrder = async (order: Array<{ id: number; phase: string | null }>) => {
    try {
      await booksApi.saveUpNextOrder(order);
      await fetchBooks();
    } catch (error) {
      showError('Couldn\'t save the new order', errorMessage(error));
      await fetchBooks();
      throw error;
    }
  };

  const addBook = async (data: AddToUpNextData) => {
    try {
      const book = await booksApi.addToUpNext(data);
      await fetchBooks();
      showSuccess(`Added ${book.title}`, `#${book.position}, at the end of Up Next${book.coverImageUrl ? '' : ' (no cover found)'}`);
    } catch (error) {
      showError('Couldn\'t add the book', errorMessage(error));
      throw error;
    }
  };

  const setUnscheduled = async (book: Book, unscheduled: boolean) => {
    try {
      await booksApi.setUnscheduled(book.id, unscheduled);
      await fetchBooks();
      showSuccess(unscheduled ? `Moved ${book.title} to Unscheduled` : `${book.title} is back on Up Next`);
    } catch (error) {
      showError('Couldn\'t move the book', errorMessage(error));
      throw error;
    }
  };

  const deleteBook = async (book: Book) => {
    try {
      await booksApi.delete(book.id);
      await fetchBooks();
      showSuccess(`Deleted ${book.title}`);
    } catch (error) {
      showError('Couldn\'t delete the book', errorMessage(error));
      throw error;
    }
  };

  if (loading && books.length === 0) {
    return <div className="grid h-72 place-items-center"><LoadingSpinner size="lg" /></div>;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-xl py-20 text-center">
        <p className="eyebrow">The library is unavailable</p>
        <h1 className="mt-3 font-display text-4xl text-ink-950">Error loading books</h1>
        <p className="mt-3 text-sm text-ink-500">{error}</p>
        <button onClick={fetchBooks} className="btn-primary mt-7">Try Again</button>
      </div>
    );
  }

  return (
    <div className="space-y-12 sm:space-y-16">
      <section className="relative overflow-hidden rounded-[2rem] bg-ink-950 px-6 py-8 text-paper-50 shadow-card sm:px-10 sm:py-12 lg:px-14">
        <div className="absolute -right-24 -top-32 h-80 w-80 rounded-full border border-paper-50/10" />
        <div className="absolute -right-8 -top-16 h-52 w-52 rounded-full border border-copper-400/25" />
        <div className="relative grid gap-10 lg:grid-cols-[1fr_22rem] lg:items-end">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-copper-300">The master reading plan</p>
            <h1 className="mt-5 max-w-3xl font-display text-5xl leading-[0.98] tracking-[-0.035em] sm:text-6xl lg:text-7xl">
              Reading Dashboard
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-paper-200/70 sm:text-base">
              Follow your reading order, review saved passages, and track progress
            </p>
          </div>

          <div className="rounded-2xl border border-paper-50/10 bg-paper-50/[0.06] p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.18em] text-paper-200/60">
              <span>Master list progress</span>
              <span>{journeyProgress}%</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-paper-50/10">
              <div className="h-full rounded-full bg-copper-400 transition-all" style={{ width: `${journeyProgress}%` }} />
            </div>
            <div className="mt-5 flex items-end justify-between">
              <div>
                <p className="font-display text-3xl">{masterCompleted}<span className="text-paper-200/30"> / {listLength}</span></p>
                <p className="mt-1 text-xs text-paper-200/50">books completed</p>
              </div>
              {nextBook && <span className="rounded-full border border-paper-50/10 px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider text-copper-300">Next · #{nextBook.position}</span>}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Reading statistics">
        {[
          { label: 'In the library', value: books.length, icon: BookOpenIcon },
          { label: 'Currently reading', value: inProgressBooks.length, icon: BookmarkSquareIcon },
          { label: 'Books completed', value: completedBooks.length, icon: ChartBarIcon },
          { label: 'Passages due', value: reviewSummary?.dueCount ?? '—', icon: SparklesIcon },
        ].map(item => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="card flex items-center justify-between !p-5">
              <div>
                <p className="font-display text-3xl text-ink-950">{item.value}</p>
                <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.15em] text-ink-400">{item.label}</p>
              </div>
              <span className="grid h-10 w-10 place-items-center rounded-full bg-ink-950 text-paper-50"><Icon className="h-4 w-4" /></span>
            </div>
          );
        })}
      </section>

      <section className="grid overflow-hidden rounded-[1.75rem] border border-copper-500/20 bg-copper-500/[0.07] lg:grid-cols-[1fr_auto]">
        <div className="flex gap-4 p-6 sm:p-8">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-copper-600 text-paper-50"><SparklesIcon className="h-5 w-5" /></span>
          <div>
            <p className="eyebrow">Daily ritual</p>
            <h2 className="mt-1 font-display text-2xl text-ink-950">Daily Review</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-500">
              {reviewSummary
                ? `${reviewSummary.dueCount} saved passage${reviewSummary.dueCount === 1 ? '' : 's'} due today. ${reviewSummary.reviewedToday} reviewed already.`
                : 'Revisit saved passages from your local highlight library.'}
            </p>
          </div>
        </div>
        <Link to="/review" className="flex items-center justify-center gap-2 border-t border-copper-500/20 px-8 py-5 text-sm font-semibold text-copper-700 transition hover:bg-copper-500/10 lg:border-l lg:border-t-0">
          Start Review <ArrowRightIcon className="h-4 w-4" />
        </Link>
      </section>

      {inProgressBooks.length > 0 && (
        <section>
          <div className="mb-6 flex items-end justify-between">
            <div><p className="eyebrow">On the nightstand</p><h2 className="mt-2 font-display text-4xl text-ink-950">Currently Reading</h2></div>
            <p className="hidden text-xs text-ink-400 sm:block">Keep the thread alive.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {inProgressBooks.map(book => <BookCard key={book.id} book={book} variant="detailed" />)}
          </div>
        </section>
      )}

      {parallelBook && (
        <section className="relative overflow-hidden rounded-[1.75rem] border border-sage-500/20 bg-sage-100/60 p-6 sm:p-8">
          <div className="absolute bottom-0 right-6 font-display text-[9rem] leading-none text-sage-700/[0.05]">P</div>
          <div className="relative grid items-center gap-6 lg:grid-cols-[1fr_25rem]">
            <div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-sage-700">Parallel track · Phases 5–7</p>
              <h2 className="mt-3 font-display text-3xl text-ink-950">Proust, at a human pace.</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-ink-600">Approximately 15–25 pages when sustainable. A companion to the main sequence, never a quota.</p>
            </div>
            <BookCard book={parallelBook} variant="compact" />
          </div>
        </section>
      )}

      <section>
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">The master sequence</p>
            <h2 className="mt-2 font-display text-4xl text-ink-950">Up Next</h2>
            <p className="mt-2 text-xs text-ink-400">
              Press and hold a book to move it · swipe left to remove
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-400">{upNextBooks.length} remaining</span>
            <button onClick={() => setAdding(true)} className="btn-primary gap-2 !px-4">
              <PlusIcon className="h-4 w-4" /> Add book
            </button>
          </div>
        </div>

        {upNextBooks.length > 0 ? (
          <UpNextList
            books={upNextBooks}
            onReorder={saveOrder}
            onRemove={book => setRemoving({ book, fromUpNext: true })}
          />
        ) : (
          <p className="card text-center text-sm text-ink-500">Nothing queued. Add a book to start the list.</p>
        )}
      </section>

      {unscheduledBooks.length > 0 && (
        <section className="border-t border-ink-900/10 pt-8">
          <button onClick={() => setShowUnscheduled(value => !value)} className="flex w-full items-center justify-between text-left">
            <div><p className="eyebrow">Off the list</p><h2 className="mt-2 font-display text-3xl text-ink-950">Unscheduled ({unscheduledBooks.length})</h2></div>
            <span className="flex items-center gap-2 rounded-full border border-ink-900/10 bg-paper-50 px-4 py-2 text-xs font-semibold text-ink-600">
              {showUnscheduled ? 'Hide' : 'Show'}
              {showUnscheduled ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
            </span>
          </button>
          {showUnscheduled && (
            <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {unscheduledBooks.map(book => (
                <div key={book.id} className="flex flex-col gap-2">
                  <BookCard book={book} variant="compact" />
                  <div className="flex gap-2">
                    <button onClick={() => setUnscheduled(book, false).catch(() => undefined)} className="btn-secondary flex-1 gap-2 !py-2 !text-xs">
                      <ArrowUturnLeftIcon className="h-3.5 w-3.5" /> Back to Up Next
                    </button>
                    <button
                      onClick={() => setRemoving({ book, fromUpNext: false })}
                      className="btn-secondary !px-3 !py-2 !text-rose-700"
                      aria-label={`Delete ${book.title}`}
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {completedBooks.length > 0 && (
        <section className="border-t border-ink-900/10 pt-8">
          <button onClick={() => setShowCompletedBooks(value => !value)} className="flex w-full items-center justify-between text-left">
            <div><p className="eyebrow">The archive</p><h2 className="mt-2 font-display text-3xl text-ink-950">Previously Read ({completedBooks.length})</h2></div>
            <span className="flex items-center gap-2 rounded-full border border-ink-900/10 bg-paper-50 px-4 py-2 text-xs font-semibold text-ink-600">
              {showCompletedBooks ? 'Hide' : 'Show'}
              {showCompletedBooks ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
            </span>
          </button>
          {showCompletedBooks && <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{completedBooks.map(book => <BookCard key={book.id} book={book} variant="detailed" />)}</div>}
        </section>
      )}

      {dnfBooks.length > 0 && (
        <section className="border-t border-ink-900/10 pt-8">
          <button onClick={() => setShowDnfBooks(value => !value)} className="flex w-full items-center justify-between text-left">
            <div><p className="eyebrow">Set aside</p><h2 className="mt-2 font-display text-3xl text-ink-950">Did Not Finish ({dnfBooks.length})</h2></div>
            <span className="flex items-center gap-2 rounded-full border border-ink-900/10 bg-paper-50 px-4 py-2 text-xs font-semibold text-ink-600">
              {showDnfBooks ? 'Hide' : 'Show'}
              {showDnfBooks ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
            </span>
          </button>
          {showDnfBooks && <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{dnfBooks.map(book => <BookCard key={book.id} book={book} variant="detailed" />)}</div>}
        </section>
      )}

      <AddBookSheet open={adding} onClose={() => setAdding(false)} onAdd={addBook} />
      <RemoveBookSheet
        book={removing?.book ?? null}
        onClose={() => setRemoving(null)}
        {...(removing?.fromUpNext && { onUnschedule: (book: Book) => setUnscheduled(book, true) })}
        onDelete={deleteBook}
      />
    </div>
  );
}

export default Dashboard;
