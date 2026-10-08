import { MutableRefObject, ReactNode, TouchEvent, useEffect, useRef, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TrashIcon } from '@heroicons/react/24/outline';
import BookCard from '../UI/BookCard';
import { Book } from '../../types';

const HOLD_TO_DRAG_MS = 300;
const SWIPE_TO_REMOVE_PX = 90;

interface UpNextListProps {
  books: Book[];
  onReorder: (order: Array<{ id: number; phase: string | null }>) => Promise<void>;
  onRemove: (book: Book) => void;
}

/** Splits "Phase 4 — The American Experiment" into its label and title. */
function phaseHeading(phase: string | null | undefined): { label: string; title: string } {
  if (!phase) return { label: 'Unsorted', title: 'Not yet in a phase' };
  const [label, ...rest] = phase.split(' — ');
  return rest.length ? { label: label!, title: rest.join(' — ') } : { label: '', title: phase };
}

/** Horizontal swipe left on touch screens reveals "Remove"; past the threshold it asks to remove. */
function SwipeToRemove({ children, onSwipe, dragActive }: {
  children: ReactNode;
  onSwipe: () => void;
  dragActive: MutableRefObject<boolean>;
}) {
  const [offset, setOffset] = useState(0);
  const [settling, setSettling] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const mode = useRef<'undecided' | 'swipe' | 'scroll'>('undecided');

  const onTouchStart = (event: TouchEvent) => {
    const touch = event.touches[0];
    if (!touch) return;
    start.current = { x: touch.clientX, y: touch.clientY };
    mode.current = 'undecided';
    setSettling(false);
  };

  const onTouchMove = (event: TouchEvent) => {
    const touch = event.touches[0];
    if (!start.current || !touch) return;
    if (dragActive.current) { setOffset(0); return; }

    const dx = touch.clientX - start.current.x;
    const dy = touch.clientY - start.current.y;
    if (mode.current === 'undecided') {
      if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.3) mode.current = 'swipe';
      else if (Math.abs(dy) > 12) mode.current = 'scroll';
    }
    if (mode.current === 'swipe') setOffset(Math.max(-160, Math.min(0, dx)));
  };

  const onTouchEnd = () => {
    if (mode.current === 'swipe' && offset <= -SWIPE_TO_REMOVE_PX && !dragActive.current) onSwipe();
    start.current = null;
    mode.current = 'undecided';
    setSettling(true);
    setOffset(0);
  };

  return (
    <div className="relative h-full overflow-hidden rounded-[1.35rem]">
      <div
        className="absolute inset-0 flex items-center justify-end gap-2 rounded-[1.35rem] bg-rose-700 pr-6 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-paper-50"
        style={{ opacity: Math.min(1, -offset / SWIPE_TO_REMOVE_PX) }}
        aria-hidden="true"
      >
        <TrashIcon className="h-4 w-4" /> Remove
      </div>
      <div
        className="h-full"
        style={{ transform: `translateX(${offset}px)`, transition: settling ? 'transform 200ms ease' : 'none' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}

function SortableBook({ book, onRemove, dragActive, lastDragEnd }: {
  book: Book;
  onRemove: (book: Book) => void;
  dragActive: MutableRefObject<boolean>;
  lastDragEnd: MutableRefObject<number>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: book.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={`group/item relative touch-pan-y select-none [-webkit-touch-callout:none] ${isDragging ? 'opacity-30' : ''}`}
      onContextMenu={event => event.preventDefault()}
      onClickCapture={event => {
        // A drag ends with a click on the card; don't follow the link
        if (Date.now() - lastDragEnd.current < 400) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      <SwipeToRemove onSwipe={() => onRemove(book)} dragActive={dragActive}>
        <BookCard book={book} showPosition />
      </SwipeToRemove>
      <button
        onClick={event => { event.preventDefault(); onRemove(book); }}
        onPointerDown={event => event.stopPropagation()}
        className="absolute bottom-3 right-3 hidden h-8 w-8 place-items-center rounded-full border border-ink-900/10 bg-paper-50 text-ink-400 opacity-0 shadow-sm transition hover:text-rose-700 focus-visible:opacity-100 group-hover/item:opacity-100 md:grid"
        aria-label={`Remove ${book.title} from Up Next`}
        title="Remove from Up Next"
      >
        <TrashIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

function UpNextList({ books, onReorder, onRemove }: UpNextListProps) {
  const [items, setItems] = useState(books);
  const [activeId, setActiveId] = useState<number | null>(null);
  const dragActive = useRef(false);
  const lastDragEnd = useRef(0);

  // Take fresh server data, but never mid-drag (the local order is ahead of it)
  useEffect(() => { if (!dragActive.current) setItems(books); }, [books]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { delay: HOLD_TO_DRAG_MS, tolerance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: HOLD_TO_DRAG_MS, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      // Enter still opens the book; Space picks it up
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] },
    })
  );

  const onDragStart = (event: DragStartEvent) => {
    dragActive.current = true;
    setActiveId(Number(event.active.id));
    navigator.vibrate?.(15);
  };

  const onDragEnd = async (event: DragEndEvent) => {
    dragActive.current = false;
    lastDragEnd.current = Date.now();
    setActiveId(null);

    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex(book => book.id === active.id);
    const newIndex = items.findIndex(book => book.id === over.id);
    // The moved book joins the section of the book it was dropped onto
    const phase = items[newIndex]?.phase ?? null;
    const start = Math.floor(Math.min(...items.map(book => book.position)));
    const reordered = arrayMove(items, oldIndex, newIndex)
      .map((book, index) => ({ ...book, position: start + index, ...(book.id === active.id && { phase }) }));

    const previous = items;
    setItems(reordered);
    try {
      await onReorder(reordered.map(book => ({ id: book.id, phase: book.phase ?? null })));
    } catch {
      setItems(previous);
    }
  };

  const activeBook = items.find(book => book.id === activeId);
  const sections: Array<{ phase: string | null | undefined; books: Book[] }> = [];
  for (const book of items) {
    const last = sections[sections.length - 1];
    if (last && last.phase === book.phase) last.books.push(book);
    else sections.push({ phase: book.phase, books: [book] });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => { dragActive.current = false; lastDragEnd.current = Date.now(); setActiveId(null); }}
    >
      <SortableContext items={items.map(book => book.id)} strategy={rectSortingStrategy}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {sections.map((section, index) => {
            const heading = phaseHeading(section.phase);
            return [
              <div
                key={`phase-${index}-${section.phase ?? 'none'}`}
                className={`col-span-full flex flex-col gap-2 border-t border-ink-900/10 pt-6 sm:flex-row sm:items-baseline sm:justify-between ${index > 0 ? 'mt-8' : ''}`}
              >
                <div className="flex items-baseline gap-3">
                  {heading.label && (
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-copper-600">{heading.label}</span>
                  )}
                  <h3 className="font-display text-2xl text-ink-900">{heading.title}</h3>
                </div>
                <span className="font-mono text-[9px] uppercase tracking-wider text-ink-400">{section.books.length} books</span>
              </div>,
              ...section.books.map(book => (
                <SortableBook key={book.id} book={book} onRemove={onRemove} dragActive={dragActive} lastDragEnd={lastDragEnd} />
              )),
            ];
          })}
        </div>
      </SortableContext>
      <DragOverlay dropAnimation={{ duration: 180, easing: 'ease-out' }}>
        {activeBook && (
          <div className="rotate-[1.5deg] scale-[1.03] cursor-grabbing shadow-card-hover">
            <BookCard book={activeBook} showPosition />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

export default UpNextList;
