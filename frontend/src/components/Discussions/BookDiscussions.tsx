import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChatBubbleLeftRightIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Book, Discussion } from '../../types';
import { discussionsApi } from '../../services/discussionsApi';
import StarRating from '../UI/StarRating';
import { useNotification } from '../../contexts/NotificationContext';

function firstLine(text: string | null): string {
  if (!text) return '';
  const line = text.trim().split('\n')[0] ?? '';
  return line.length > 140 ? `${line.slice(0, 140)}…` : line;
}

/** "Discuss with Claude" on a finished book, plus its past discussions. */
function BookDiscussions({ book }: { book: Book }) {
  const navigate = useNavigate();
  const { showError } = useNotification();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [discussions, setDiscussions] = useState<Discussion[]>([]);

  useEffect(() => {
    discussionsApi.health().then(health => setAvailable(health.ok));
    discussionsApi.list(book.id).then(setDiscussions).catch(() => setDiscussions([]));
  }, [book.id]);

  const active = discussions[0]?.status === 'active' ? discussions[0] : undefined;

  const open = () => {
    navigate(active ? `/books/${book.id}/discuss/${active.id}` : `/books/${book.id}/discuss/new`);
  };

  const remove = async (discussion: Discussion) => {
    if (!window.confirm('Delete this discussion and its transcript? Your saved review on the book is not affected.')) return;
    try {
      await discussionsApi.remove(discussion.id);
      setDiscussions(previous => previous.filter(item => item.id !== discussion.id));
    } catch (error) {
      showError('Could not delete the discussion', error instanceof Error ? error.message : undefined);
    }
  };

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Discuss with Claude</p>
          <h3 className="mt-1 text-lg font-semibold text-gray-900">Talk it through, get your review</h3>
        </div>
        <button
          type="button"
          className="btn-primary gap-2 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={open}
          disabled={available === false}
        >
          <ChatBubbleLeftRightIcon className="h-4 w-4" />
          {available === false ? 'Claude unavailable' : active ? 'Continue discussion' : 'Discuss with Claude'}
        </button>
      </div>

      {discussions.length > 0 && (
        <ul className="mt-5 divide-y divide-ink-900/10">
          {discussions.map(discussion => (
            <li key={discussion.id} className="flex items-start justify-between gap-3 py-3">
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => navigate(`/books/${book.id}/discuss/${discussion.id}`)}
              >
                <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                  <span>{new Date(discussion.createdAt.replace(' ', 'T') + (discussion.createdAt.endsWith('Z') ? '' : 'Z')).toLocaleDateString()}</span>
                  {discussion.reviewRating !== null && <StarRating value={discussion.reviewRating} />}
                  {discussion.appliedAt && <span className="status-pill status-completed">Saved as review</span>}
                  {discussion.status === 'active' && <span className="status-pill status-in_progress">In progress</span>}
                </div>
                <p className="mt-1 truncate text-sm text-gray-800">
                  {firstLine(discussion.reviewDraft) || 'No review written yet'}
                </p>
              </button>
              <button
                type="button"
                onClick={() => remove(discussion)}
                className="rounded-full p-2 text-gray-400 hover:text-red-600"
                aria-label="Delete discussion"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default BookDiscussions;
