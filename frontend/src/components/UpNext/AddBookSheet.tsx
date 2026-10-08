import { FormEvent, useEffect, useState } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import Sheet from '../UI/Sheet';
import BookCover from '../BookCover';
import LoadingSpinner from '../UI/LoadingSpinner';
import { booksApi } from '../../services/api';
import { AddToUpNextData, BookCandidate } from '../../types';

interface AddBookSheetProps {
  open: boolean;
  onClose: () => void;
  onAdd: (data: AddToUpNextData) => Promise<void>;
}

/** Search Open Library / Google Books, pick the right edition, and add it to the end of Up Next. */
function AddBookSheet({ open, onClose, onAdd }: AddBookSheetProps) {
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<BookCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [selected, setSelected] = useState<BookCandidate | null>(null);
  const [manual, setManual] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualAuthor, setManualAuthor] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery(''); setCandidates([]); setSelected(null); setManual(false);
      setManualTitle(''); setManualAuthor(''); setSearchFailed(false);
    }
  }, [open]);

  useEffect(() => {
    const trimmed = query.trim();
    if (manual || trimmed.length < 2) { setCandidates([]); setSearching(false); return; }

    const controller = new AbortController();
    setSearching(true);
    setSearchFailed(false);
    const timer = setTimeout(() => {
      booksApi.lookup(trimmed, controller.signal)
        .then(results => { setCandidates(results); setSearching(false); })
        .catch(() => { if (!controller.signal.aborted) { setSearchFailed(true); setSearching(false); } });
    }, 400);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, manual]);

  const add = async (data: AddToUpNextData) => {
    setAdding(true);
    try {
      await onAdd(data);
      onClose();
    } finally {
      setAdding(false);
    }
  };

  const submitManual = (event: FormEvent) => {
    event.preventDefault();
    if (manualTitle.trim() && manualAuthor.trim()) {
      add({ title: manualTitle.trim(), authors: manualAuthor.split(/\s*[&,]\s*/).filter(Boolean) });
    }
  };

  return (
    <Sheet open={open} onClose={onClose} eyebrow="Up Next" title={selected ? 'Add this book?' : 'Add a book'}>
      {selected ? (
        <div>
          <div className="flex gap-4">
            <BookCover
              title={selected.title}
              authors={selected.authors}
              {...(selected.coverUrl && { coverImageUrl: selected.coverUrl })}
              size="lg"
              className="!rounded-xl shadow-book"
            />
            <div className="min-w-0">
              <h3 className="font-display text-2xl leading-tight text-ink-950">{selected.title}</h3>
              <p className="mt-1.5 text-sm text-ink-500">{selected.authors.join(' · ')}</p>
              {selected.year && <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-ink-400">First published {selected.year}</p>}
              <p className="mt-4 text-xs leading-5 text-ink-500">
                It goes to the end of Up Next. Press and hold it there to move it into place.
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="btn-secondary" onClick={() => setSelected(null)} disabled={adding}>Back to results</button>
            <button
              className="btn-primary"
              disabled={adding}
              onClick={() => add({
                title: selected.title,
                authors: selected.authors,
                ...(selected.coverUrl && { coverUrl: selected.coverUrl }),
              })}
            >
              {adding ? 'Adding and fetching cover…' : 'Add to Up Next'}
            </button>
          </div>
        </div>
      ) : manual ? (
        <form onSubmit={submitManual} className="space-y-3">
          <input className="input-field" placeholder="Title" value={manualTitle} onChange={e => setManualTitle(e.target.value)} autoFocus />
          <input className="input-field" placeholder="Author (separate several with &)" value={manualAuthor} onChange={e => setManualAuthor(e.target.value)} />
          <p className="text-xs leading-5 text-ink-500">A cover is looked up automatically when you add it.</p>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button type="button" className="btn-secondary" onClick={() => setManual(false)} disabled={adding}>Search instead</button>
            <button type="submit" className="btn-primary" disabled={adding || !manualTitle.trim() || !manualAuthor.trim()}>
              {adding ? 'Adding and fetching cover…' : 'Add to Up Next'}
            </button>
          </div>
        </form>
      ) : (
        <div>
          <label className="relative block">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              className="input-field !pl-10"
              placeholder="Title, author, or both"
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
              enterKeyHint="search"
            />
          </label>

          <div className="mt-4 min-h-[8rem]">
            {searching && <div className="grid h-32 place-items-center"><LoadingSpinner /></div>}
            {!searching && searchFailed && <p className="py-6 text-center text-sm text-ink-500">Search is unavailable right now.</p>}
            {!searching && !searchFailed && query.trim().length >= 2 && candidates.length === 0 && (
              <p className="py-6 text-center text-sm text-ink-500">No matches found.</p>
            )}
            {!searching && candidates.length > 0 && (
              <ul className="divide-y divide-ink-900/10">
                {candidates.map((candidate, index) => (
                  <li key={`${candidate.title}-${index}`}>
                    <button
                      onClick={() => setSelected(candidate)}
                      className="flex w-full items-center gap-3 rounded-xl px-1 py-3 text-left transition hover:bg-copper-500/5"
                    >
                      <BookCover
                        title={candidate.title}
                        authors={candidate.authors}
                        {...(candidate.coverUrl && { coverImageUrl: candidate.coverUrl })}
                        size="sm"
                        className="!h-[4.5rem] !w-12 !rounded-md"
                      />
                      <span className="min-w-0">
                        <span className="line-clamp-2 font-display text-base leading-snug text-ink-950">{candidate.title}</span>
                        <span className="mt-0.5 block truncate text-xs text-ink-500">
                          {candidate.authors.join(' · ')}{candidate.year ? ` · ${candidate.year}` : ''}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            onClick={() => { setManual(true); setManualTitle(query.trim()); }}
            className="mt-2 text-xs font-semibold text-copper-700 underline-offset-4 hover:underline"
          >
            Can't find it? Add it by hand
          </button>
        </div>
      )}
    </Sheet>
  );
}

export default AddBookSheet;
