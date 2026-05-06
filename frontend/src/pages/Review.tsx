import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArchiveBoxIcon,
  ArrowPathIcon,
  BookOpenIcon,
  CheckIcon,
  ClockIcon,
  StarIcon
} from '@heroicons/react/24/outline';
import { reviewApi } from '../services/api';
import { ReviewAction, ReviewHighlight, ReviewSummary } from '../types';
import LoadingSpinner from '../components/UI/LoadingSpinner';

function Review() {
  const [queue, setQueue] = useState<ReviewHighlight[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<ReviewAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentHighlight = queue[0];

  const fetchReviewQueue = async () => {
    try {
      setLoading(true);
      setError(null);
      const [dueHighlights, reviewSummary] = await Promise.all([
        reviewApi.getDue(12),
        reviewApi.getSummary()
      ]);
      setQueue(dueHighlights);
      setSummary(reviewSummary);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load review queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviewQueue();
  }, []);

  const handleAction = async (action: ReviewAction) => {
    if (!currentHighlight) return;

    try {
      setActionLoading(action);
      const result = await reviewApi.recordAction(currentHighlight.id, action);
      setSummary(result.summary);

      if (action === 'favorite') {
        setQueue(items => items.map(item =>
          item.id === result.highlight.id ? result.highlight : item
        ));
      } else {
        setQueue(items => items.slice(1));
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update review item');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">
          <p className="text-lg font-medium">Review queue unavailable</p>
          <p className="text-sm">{error}</p>
        </div>
        <button onClick={fetchReviewQueue} className="btn-primary inline-flex items-center space-x-2">
          <ArrowPathIcon className="h-4 w-4" />
          <span>Try Again</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Daily Review</h1>
          <p className="text-gray-600 mt-1">Revisit saved passages from your local highlight library.</p>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="card p-3">
            <p className="text-xs text-gray-500">Due</p>
            <p className="text-xl font-bold text-gray-900">{summary?.dueCount ?? queue.length}</p>
          </div>
          <div className="card p-3">
            <p className="text-xs text-gray-500">Today</p>
            <p className="text-xl font-bold text-gray-900">{summary?.reviewedToday ?? 0}</p>
          </div>
          <div className="card p-3">
            <p className="text-xs text-gray-500">Saved</p>
            <p className="text-xl font-bold text-gray-900">{summary?.favoriteCount ?? 0}</p>
          </div>
        </div>
      </div>

      {!currentHighlight ? (
        <div className="card text-center py-14">
          <CheckIcon className="h-12 w-12 text-green-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Review complete</h2>
          <p className="text-gray-600 mb-6">No more highlights are due right now.</p>
          <Link to="/" className="btn-primary inline-flex items-center space-x-2">
            <BookOpenIcon className="h-4 w-4" />
            <span>Back to Dashboard</span>
          </Link>
        </div>
      ) : (
        <section className="card max-w-3xl mx-auto">
          <div className="space-y-6">
            <div>
              <p className="text-sm font-medium text-blue-700">
                {currentHighlight.bookTitle}
              </p>
              <p className="text-sm text-gray-500">
                {currentHighlight.bookAuthors.join(', ')}
                {currentHighlight.pageNumber ? ` - Page ${currentHighlight.pageNumber}` : ''}
                {currentHighlight.location ? ` - ${currentHighlight.location}` : ''}
              </p>
            </div>

            <blockquote className="text-2xl leading-relaxed text-gray-900 font-serif">
              &ldquo;{currentHighlight.quoteText}&rdquo;
            </blockquote>

            {currentHighlight.personalNotes && (
              <div className="border-l-4 border-blue-200 pl-4">
                <p className="text-sm font-medium text-gray-700 mb-1">Your note</p>
                <p className="text-gray-700">{currentHighlight.personalNotes}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={() => handleAction('read')}
                disabled={!!actionLoading}
                className="btn-primary inline-flex items-center space-x-2"
              >
                <CheckIcon className="h-4 w-4" />
                <span>{actionLoading === 'read' ? 'Saving...' : 'Read'}</span>
              </button>
              <button
                onClick={() => handleAction('later')}
                disabled={!!actionLoading}
                className="btn-secondary inline-flex items-center space-x-2"
              >
                <ClockIcon className="h-4 w-4" />
                <span>{actionLoading === 'later' ? 'Saving...' : 'Later'}</span>
              </button>
              <button
                onClick={() => handleAction('favorite')}
                disabled={!!actionLoading}
                className="btn-secondary inline-flex items-center space-x-2"
              >
                <StarIcon className={`h-4 w-4 ${currentHighlight.favorite ? 'fill-yellow-400 text-yellow-500' : ''}`} />
                <span>{currentHighlight.favorite ? 'Saved' : 'Save'}</span>
              </button>
              <button
                onClick={() => handleAction('archive')}
                disabled={!!actionLoading}
                className="btn-secondary inline-flex items-center space-x-2"
              >
                <ArchiveBoxIcon className="h-4 w-4" />
                <span>{actionLoading === 'archive' ? 'Saving...' : 'Archive'}</span>
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export default Review;
