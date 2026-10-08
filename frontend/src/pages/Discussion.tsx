import { useCallback, useEffect, useRef, useState, KeyboardEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { Discussion as DiscussionRecord, DiscussionMessage } from '../types';
import { discussionsApi, StreamEvent } from '../services/discussionsApi';
import { ApiRequestError } from '../services/api';
import { useBooks } from '../contexts/BooksContext';
import { useNotification } from '../contexts/NotificationContext';
import StarRating from '../components/UI/StarRating';
import Sheet from '../components/UI/Sheet';

const KICKOFF = 'Start the discussion.';

type PendingTurn = 'start' | 'reply' | 'review';

// Claude's reply is a tagged review (one it wrote in the chat after the reader said yes)
const isTaggedReview = (text: string) => text.includes('<review>');

function Discussion() {
  const { id, discussionId } = useParams<{ id: string; discussionId: string }>();
  const bookId = Number(id);
  const navigate = useNavigate();
  const { getBookById, fetchBooks } = useBooks();
  const { showSuccess, showError } = useNotification();
  const book = getBookById(bookId);

  // Opened directly or reloaded: the library may not be loaded yet
  useEffect(() => {
    if (!book) void fetchBooks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  const [discussion, setDiscussion] = useState<DiscussionRecord | null>(null);
  const [messages, setMessages] = useState<DiscussionMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [turnKind, setTurnKind] = useState<PendingTurn | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [streamed, setStreamed] = useState('');
  const [sentText, setSentText] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; turn: PendingTurn; instructions?: string } | null>(null);
  const [input, setInput] = useState('');
  const [draft, setDraft] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [changes, setChanges] = useState('');
  const [confirmReplace, setConfirmReplace] = useState(false);

  const started = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);
  const reviewPanel = useRef<HTMLDivElement>(null);
  const showReview = useRef(false);
  const currentId = useRef<number | null>(null);

  const load = useCallback(async (idToLoad: number) => {
    const data = await discussionsApi.get(idToLoad);
    currentId.current = idToLoad;
    setDiscussion(data.discussion);
    setMessages(data.messages);
  }, []);

  // When the saved draft changes (new review written), refresh the editable copy
  useEffect(() => {
    setDraft(discussion?.reviewDraft ?? '');
    setRating(discussion?.reviewRating ?? null);
  }, [discussion?.reviewDraft, discussion?.reviewRating]);

  // Follow the chat, or bring a newly written review into view
  useEffect(() => {
    if (showReview.current && reviewPanel.current) {
      showReview.current = false;
      reviewPanel.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (!showReview.current) bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, streamed, status, sentText, discussion?.reviewDraft]);

  const handleEvent = (turn: PendingTurn, instructions?: string) => (event: StreamEvent) => {
    switch (event.type) {
      case 'discussion':
        currentId.current = event.discussion.id;
        setDiscussion(event.discussion);
        navigate(`/books/${bookId}/discuss/${event.discussion.id}`, { replace: true });
        break;
      case 'status':
        setStatus(event.text);
        break;
      case 'delta':
        if (turn !== 'review') setStatus(null);
        setStreamed(previous => previous + event.text);
        break;
      case 'done':
        if (event.discussion.reviewDraft !== null && event.discussion.reviewDraft !== discussion?.reviewDraft) {
          showReview.current = true;
        }
        setDiscussion(event.discussion);
        void load(event.discussion.id);
        break;
      case 'error':
        setError({ message: event.message, turn, ...(instructions !== undefined && { instructions }) });
        if (currentId.current !== null) void load(currentId.current);
        break;
    }
  };

  const runTurn = async (turn: PendingTurn, call: (onEvent: (event: StreamEvent) => void) => Promise<void>, instructions?: string) => {
    setBusy(true);
    setTurnKind(turn);
    setError(null);
    setStatus(turn === 'start' ? 'Getting to know the book…' : turn === 'review' ? 'Writing your review…' : null);
    setStreamed('');
    try {
      await call(handleEvent(turn, instructions));
    } finally {
      setBusy(false);
      setTurnKind(null);
      setStatus(null);
      setStreamed('');
      setSentText(null);
    }
  };

  // Open an existing discussion, or start a new one
  useEffect(() => {
    if (discussionId === 'new') {
      if (started.current) return;
      started.current = true;
      void runTurn('start', onEvent => discussionsApi.start(bookId, onEvent));
      return;
    }
    const idToLoad = Number(discussionId);
    if (currentId.current === idToLoad) return;
    load(idToLoad).catch(() => showError('Could not open the discussion'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discussionId, bookId]);

  const id_ = () => currentId.current!;

  const send = () => {
    const content = input.trim();
    if (!content || busy || !discussion) return;
    setInput('');
    setSentText(content);
    void runTurn('reply', onEvent => discussionsApi.reply(id_(), content, onEvent));
  };

  // Resends the reader's unanswered message (a review request stays a review request)
  const retry = () => {
    if (currentId.current === null) {
      started.current = false;
      void runTurn('start', onEvent => discussionsApi.start(bookId, onEvent));
      return;
    }
    const last = messages[messages.length - 1];
    const turn: PendingTurn = last?.kind === 'review' ? 'review' : 'reply';
    void runTurn(turn, onEvent => discussionsApi.reply(id_(), null, onEvent));
  };

  const writeReview = (instructions?: string) => {
    if (busy || !discussion) return;
    setChanges('');
    void runTurn('review', onEvent => discussionsApi.writeReview(id_(), instructions, onEvent), instructions);
  };

  const saveDraft = async () => {
    if (!discussion) return;
    try {
      setDiscussion(await discussionsApi.saveDraft(discussion.id, draft, rating));
      showSuccess('Draft saved');
    } catch (err) {
      showError('Could not save the draft', err instanceof Error ? err.message : undefined);
    }
  };

  // The server refuses (409) to replace a different existing review unless confirmed
  const apply = async (confirm = false) => {
    if (!discussion) return;
    setConfirmReplace(false);
    try {
      await discussionsApi.saveDraft(discussion.id, draft, rating);
      setDiscussion(await discussionsApi.apply(discussion.id, confirm));
      await fetchBooks();
      showSuccess('Saved as your review');
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 409) {
        setConfirmReplace(true);
        return;
      }
      showError('Could not save your review', err instanceof Error ? err.message : undefined);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const touch = window.matchMedia('(pointer: coarse)').matches;
    if (event.key === 'Enter' && !event.shiftKey && !touch) {
      event.preventDefault();
      send();
    }
  };

  const visible = messages.filter((message, index) => !(index === 0 && message.role === 'user' && message.content === KICKOFF));
  // Last saved message is the reader's with no reply (a turn failed, maybe while the page was closed)
  const unanswered = !busy && !error && messages.length > 0 && messages[messages.length - 1]!.role === 'user';
  const answered = messages.some(message => message.role === 'user' && message.kind === 'chat' && message.content !== KICKOFF);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(`/books/${bookId}`)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-ink-900/10 text-ink-500 hover:text-copper-700"
            aria-label="Back to the book"
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <p className="eyebrow">Discuss with Claude</p>
            <h1 className="truncate font-display text-xl text-ink-950">{book?.title ?? 'Discussion'}</h1>
          </div>
        </div>
        <button
          type="button"
          className="btn-secondary shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => writeReview()}
          disabled={!answered || busy}
        >
          {discussion?.reviewDraft ? 'Rewrite review' : 'Write my review'}
        </button>
      </div>

      <div className="card flex flex-col gap-4">
        {visible.map(message => {
          if (message.kind === 'review' || (message.role === 'assistant' && isTaggedReview(message.content))) {
            return (
              <p key={message.id} className="text-center font-mono text-[11px] uppercase tracking-[0.12em] text-ink-400">
                {message.role === 'user' ? 'Asked Claude for the review' : 'Review drafted below'}
              </p>
            );
          }
          const mine = message.role === 'user';
          return (
            <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${
                  mine ? 'bg-ink-950 text-paper-50' : 'border border-ink-900/10 bg-paper-100 text-ink-900'
                }`}
              >
                {message.content}
              </div>
            </div>
          );
        })}

        {sentText && (
          <div className="flex justify-end">
            <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-ink-950 px-4 py-3 text-[15px] leading-relaxed text-paper-50">
              {sentText}
            </div>
          </div>
        )}

        {busy && streamed && turnKind !== 'review' && !isTaggedReview(streamed) && (
          <div className="flex justify-start">
            <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl border border-ink-900/10 bg-paper-100 px-4 py-3 text-[15px] leading-relaxed text-ink-900">
              {streamed}
            </div>
          </div>
        )}

        {busy && !status && isTaggedReview(streamed) && <p className="animate-pulse text-sm italic text-ink-500">Writing your review…</p>}
        {busy && status && <p className="animate-pulse text-sm italic text-ink-500">{status}</p>}
        {busy && !status && !streamed && <p className="animate-pulse text-sm italic text-ink-500">Claude is thinking…</p>}

        {unanswered && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-copper-300/60 bg-copper-500/5 px-4 py-3 text-sm text-ink-700">
            <span>Claude hasn't replied to this yet.</span>
            <button type="button" className="btn-secondary" onClick={retry}>Send again</button>
          </div>
        )}

        {error && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <span>{error.message}</span>
            <button type="button" className="btn-secondary" onClick={retry} disabled={busy}>
              Retry
            </button>
          </div>
        )}
        <div ref={bottom} />
      </div>

      <div className="card flex items-end gap-3 p-4">
        <textarea
          value={input}
          onChange={event => setInput(event.target.value)}
          onKeyDown={onKeyDown}
          rows={Math.min(8, Math.max(2, input.split('\n').length))}
          placeholder={busy ? 'Claude is replying…' : 'Your answer…'}
          className="min-h-[3rem] flex-1 resize-none rounded-2xl border border-ink-900/10 bg-paper-50 px-4 py-3 text-[15px] focus:border-copper-500/50 focus:outline-none focus:ring-2 focus:ring-copper-400/20"
          disabled={!discussion}
        />
        <button
          type="button"
          onClick={send}
          disabled={busy || !input.trim() || !discussion}
          className="btn-primary h-12 w-12 shrink-0 p-0 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Send"
        >
          <PaperAirplaneIcon className="h-5 w-5" />
        </button>
      </div>

      {discussion?.reviewDraft !== null && discussion?.reviewDraft !== undefined && (
        <div ref={reviewPanel} className="card flex flex-col gap-4 scroll-mt-4">
          <div>
            <p className="eyebrow">Your review</p>
            <p className="mt-1 text-sm text-gray-600">Edit freely; nothing changes on the book until you save it as your review.</p>
          </div>
          <textarea
            value={draft}
            onChange={event => setDraft(event.target.value)}
            rows={Math.min(24, Math.max(8, Math.ceil(draft.length / 70)))}
            maxLength={10000}
            className="w-full rounded-2xl border border-ink-900/10 bg-paper-50 px-4 py-3 text-[15px] leading-relaxed focus:border-copper-500/50 focus:outline-none focus:ring-2 focus:ring-copper-400/20"
          />
          <StarRating size="md" value={rating} onChange={setRating} />
          <div className="flex flex-wrap gap-2">
            <input
              value={changes}
              onChange={event => setChanges(event.target.value)}
              placeholder="Ask for changes, e.g. shorter, lose the bit about Pierre"
              className="input-field min-w-0 flex-1"
              maxLength={2000}
            />
            <button
              type="button"
              className="btn-secondary disabled:opacity-50"
              onClick={() => writeReview(changes)}
              disabled={busy || !changes.trim()}
            >
              Ask for changes
            </button>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={saveDraft} disabled={busy}>Save draft</button>
            <button type="button" className="btn-primary" onClick={() => void apply()} disabled={busy || !draft.trim()}>
              {discussion.appliedAt ? 'Save as my review again' : 'Save as my review'}
            </button>
          </div>
        </div>
      )}

      <Sheet open={confirmReplace} onClose={() => setConfirmReplace(false)} eyebrow="Your review" title="Replace your current review?">
        <p className="text-sm text-gray-700">This book already has a review. Saving replaces it (and the rating, if this draft has one).</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={() => setConfirmReplace(false)}>Cancel</button>
          <button type="button" className="btn-primary" onClick={() => void apply(true)}>Replace</button>
        </div>
      </Sheet>
    </div>
  );
}

export default Discussion;
