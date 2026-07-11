import { Link } from 'react-router-dom';
import { ArrowUpRightIcon, CheckIcon } from '@heroicons/react/24/outline';
import { Book } from '../../types';
import { getMilestone, isParallelTrack } from '../../data/readingPlan';
import ProgressBar from './ProgressBar';
import BookCover from '../BookCover';

interface BookCardProps {
  book: Book;
  onClick?: (book: Book) => void;
  showPosition?: boolean;
  variant?: 'default' | 'compact' | 'detailed';
}

function BookCard({ book, onClick, showPosition = false, variant = 'default' }: BookCardProps) {
  const milestone = Number.isInteger(book.position) ? getMilestone(book.position) : undefined;
  const isDetailed = variant === 'detailed';
  const statusLabel = book.status === 'completed'
    ? 'Read'
    : book.status === 'in_progress'
      ? 'Reading'
      : book.status === 'did_not_finish'
        ? 'DNF'
        : 'Queued';

  const content = (
    <article className="group relative flex h-full gap-4 overflow-hidden rounded-[1.35rem] border border-ink-900/10 bg-paper-50/90 p-4 shadow-card transition duration-300 hover:-translate-y-0.5 hover:border-copper-500/40 hover:shadow-card-hover">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-copper-400/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="relative shrink-0">
        <BookCover
          title={book.title}
          authors={book.authors}
          {...(book.coverImageUrl && { coverImageUrl: book.coverImageUrl })}
          size={isDetailed ? 'lg' : variant === 'compact' ? 'sm' : 'md'}
          className="!rounded-xl shadow-book"
        />
        {showPosition && (
          <span className="absolute -left-2 -top-2 grid min-h-8 min-w-8 place-items-center rounded-full border-2 border-paper-50 bg-ink-950 px-1.5 font-mono text-[11px] font-semibold text-paper-50 shadow-lg">
            {isParallelTrack(book.title) ? 'P' : book.position}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            <span className={`status-pill status-${book.status}`}>{statusLabel}</span>
            {milestone && <span className="milestone-pill">{milestone}</span>}
          </div>
          <ArrowUpRightIcon className="h-4 w-4 shrink-0 text-ink-400 transition group-hover:text-copper-600" />
        </div>

        <h3 className={`${isDetailed ? 'font-display text-xl' : 'font-display text-lg'} line-clamp-3 leading-tight text-ink-950`}>
          {book.title}
        </h3>
        <p className="mt-1.5 line-clamp-2 text-xs font-medium leading-relaxed text-ink-500">
          {book.authors.join(' · ')}
        </p>

        <div className="mt-auto pt-4">
          {book.status !== 'not_started' ? (
            <div className="space-y-2">
              <ProgressBar progress={book.progressPercentage} showPercentage={false} className="h-1.5" />
              <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-ink-400">
                <span>{book.status === 'did_not_finish' ? `Stopped at ${book.progressPercentage}%` : `${book.progressPercentage}% complete`}</span>
                {book.status === 'completed' && <CheckIcon className="h-3.5 w-3.5 text-sage-600" />}
              </div>
            </div>
          ) : (
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-400">
              {showPosition && !isParallelTrack(book.title) ? `Master list · ${String(book.position).padStart(3, '0')}` : 'In the library'}
            </p>
          )}
        </div>
      </div>
    </article>
  );

  if (onClick) {
    return <div onClick={() => onClick(book)} className="h-full cursor-pointer">{content}</div>;
  }

  return <Link to={`/books/${book.id}`} className="block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-copper-500 focus-visible:ring-offset-4">{content}</Link>;
}

export default BookCard;
