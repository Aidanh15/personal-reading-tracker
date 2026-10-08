import { ReactNode, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  eyebrow?: string;
  title: string;
  children: ReactNode;
}

/** A dialog in the library's paper style: a bottom sheet on phones, centred on larger screens. */
function Sheet({ open, onClose, eyebrow, title, children }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-ink-950/40 backdrop-blur-[2px] animate-fade-in" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        className="relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-[1.75rem] border border-ink-900/10 bg-paper-50 shadow-card-hover animate-slide-up sm:max-w-lg sm:rounded-[1.75rem]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink-900/10 px-6 pb-4 pt-5">
          <div>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h2 id="sheet-title" className="mt-1 font-display text-2xl leading-tight text-ink-950">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-ink-900/10 text-ink-500 transition hover:text-copper-700"
            aria-label="Close"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export default Sheet;
