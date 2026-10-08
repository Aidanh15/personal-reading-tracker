import { useEffect, useState } from 'react';

const STAR_PATH = 'M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z';

export interface StarRatingProps {
  value: number | null;
  /** Makes it a picker: tap a star for a whole rating, or type quarter stars (4.25). */
  onChange?: (value: number | null) => void;
  size?: 'sm' | 'md';
}

/** Ratings from 1 to 5 in quarter stars; a 4.25 shows a quarter-filled fifth star. */
function StarRating({ value, onChange, size = 'sm' }: StarRatingProps) {
  const starClass = size === 'md' ? 'h-6 w-6' : 'h-4 w-4';
  const rating = value ?? 0;
  // Typed text is kept locally and only committed on blur, so "4." can become "4.25"
  const [text, setText] = useState(value === null ? '' : String(value));
  useEffect(() => setText(value === null ? '' : String(value)), [value]);

  const star = (index: number) => {
    const fill = Math.min(1, Math.max(0, rating - (index - 1))) * 100;
    return (
      <span className={`relative inline-block ${starClass}`}>
        <svg className={`absolute inset-0 ${starClass} text-gray-300`} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path d={STAR_PATH} />
        </svg>
        <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill}%` }}>
          <svg className={`${starClass} text-yellow-400`} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path d={STAR_PATH} />
          </svg>
        </span>
      </span>
    );
  };

  if (!onChange) {
    return (
      <span className="inline-flex items-center" aria-label={value ? `${value} out of 5` : 'Not rated'}>
        {[1, 2, 3, 4, 5].map(index => <span key={index}>{star(index)}</span>)}
        {value ? <span className="ml-1 text-sm text-gray-600">{value}/5</span> : null}
      </span>
    );
  }

  const commitText = () => {
    const parsed = Number.parseFloat(text);
    const next = Number.isFinite(parsed) ? Math.min(5, Math.max(1, Math.round(parsed * 4) / 4)) : null;
    setText(next === null ? '' : String(next));
    if (next !== value) onChange(next);
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      {[1, 2, 3, 4, 5].map(index => (
        <button
          key={index}
          type="button"
          onClick={() => onChange(index)}
          className="rounded p-1 hover:bg-gray-100"
          aria-label={`${index} star${index > 1 ? 's' : ''}`}
        >
          {star(index)}
        </button>
      ))}
      <input
        type="number"
        min={1}
        max={5}
        step={0.25}
        value={text}
        onChange={event => setText(event.target.value)}
        onBlur={commitText}
        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); commitText(); } }}
        className="ml-2 w-20 rounded border border-gray-300 px-2 py-1 text-sm"
        aria-label="Rating out of 5"
        placeholder="—"
      />
      {value !== null && (
        <button type="button" onClick={() => onChange(null)} className="ml-1 text-sm text-gray-500 hover:text-gray-700">
          Clear
        </button>
      )}
    </div>
  );
}

export default StarRating;
