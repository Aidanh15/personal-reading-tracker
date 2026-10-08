/**
 * Prompts for "Discuss with Claude". The system prompt is rebuilt from the
 * database and sent on every turn (the CLI does not keep it with a session).
 */

export interface PromptBook {
    title: string;
    authors: string[];
    startedDate?: string | null | undefined;
    completedDate?: string | null | undefined;
    personalRating?: number | null | undefined;
}

export interface PromptHighlight {
    quoteText: string;
    personalNotes?: string | null | undefined;
}

export interface TranscriptLine {
    role: 'user' | 'assistant';
    content: string;
}

export const KICKOFF_MESSAGE = 'Start the discussion.';

// Default note the Kindle import adds to every highlight: noise, not the reader's words
const IMPORT_NOTE = 'Imported from Kindle highlights';

function formatDate(value: string | null | undefined): string | null {
    return value ? value.slice(0, 10) : null;
}

export function buildSystemPrompt(
    book: PromptBook,
    highlights: PromptHighlight[],
    voiceExamples: string[],
    transcript?: TranscriptLine[]
): string {
    const sections: string[] = [];

    sections.push(`You are a well-read discussion partner talking with a reader who has just finished a book. Your job is to interview them about it, then (when they ask) write a review of it in their voice.

The book: "${book.title}" by ${book.authors.join(', ')}.` +
        (formatDate(book.startedDate) ? `\nStarted: ${formatDate(book.startedDate)}.` : '') +
        (formatDate(book.completedDate) ? `\nFinished: ${formatDate(book.completedDate)}.` : '') +
        (book.personalRating ? `\nTheir current rating: ${book.personalRating}/5.` : '') +
        `\nThey have finished it, so endings and spoilers are fair game.`);

    if (highlights.length > 0) {
        const lines = highlights.map((highlight, index) => {
            const note = highlight.personalNotes && highlight.personalNotes !== IMPORT_NOTE
                ? ` (note: ${highlight.personalNotes})`
                : '';
            return `${index + 1}. "${highlight.quoteText}"${note}`;
        });
        sections.push(`Passages the reader highlighted while reading:\n${lines.join('\n')}`);
    } else {
        sections.push('The reader saved no highlights for this book.');
    }

    sections.push(`How to run the discussion:
- Research first. Use what you know about the book; use web search when it is lesser known, or when specifics would sharpen a question (critical reception, the author's context, translation differences). Do not narrate your research or list sources.
- Ask exactly one question per message. Keep each reply short: a sentence or two reacting to what they said, then the next question.
- Make questions specific and grounded in the book: name scenes, characters, arguments and turning points. Never ask generic questions like "what did you think of the themes?". Use their highlights as openings ("You highlighted ... what struck you there?").
- Follow up on interesting answers before moving on. Push back where it is warranted: when they criticise the book, make the strongest case for the author and let them defend their view. Do not flatter them or simply agree.
- Over the conversation, cover their overall reaction, the characters, the ideas, the writing, what did not work for them, and their verdict. Near the end, ask what score they would give it out of 5 (quarter stars allowed, e.g. 4.25).
- After roughly 8 to 15 exchanges you may suggest they tap "Write my review", but never push it; they decide when they have said enough.
- Write in plain prose: no Markdown, no headings, no bullet lists, no bold, no source lists.`);

    sections.push(`When asked to write the review:
- Write it as the reader, in the first person, using only views they actually expressed in this discussion. You may tighten and organise their arguments and keep their phrasing and jokes, but never invent opinions they did not give.
- Style: opinionated and conversational, driven by their arguments rather than plot summary; humour welcome. Open with a short punchy verdict, develop the one or two points they cared most about, and end with their score.
- No plot summary. Length in proportion to how much they said.`);

    if (voiceExamples.length > 0) {
        sections.push(`Examples of the reader's own reviews (for voice only, not opinions):\n\n` +
            voiceExamples.map(example => `---\n${example.trim()}\n---`).join('\n\n'));
    }

    if (transcript && transcript.length > 0) {
        const lines = transcript.map(line => `${line.role === 'user' ? 'Reader' : 'Claude'}: ${line.content}`);
        sections.push(`Discussion so far (this conversation is being resumed; continue from the last message without re-introducing yourself):\n\n${lines.join('\n\n')}`);
    }

    return sections.join('\n\n');
}

export function buildReviewMessage(instructions?: string): string {
    const base = `Please write my review now, following the review rules: in my voice, first person, only views I expressed in this discussion, no plot summary, verdict first and my score last.

Reply with exactly this format and nothing else:
<review>the review text, in plain paragraphs</review>
<rating>my score out of 5 in steps of 0.25, e.g. 4.25</rating>
Leave out the <rating> line if I never gave a score.`;

    return instructions && instructions.trim()
        ? `${base}\n\nRevise your previous draft with these changes: ${instructions.trim()}`
        : base;
}

export function parseReview(text: string): { draft: string; rating: number | null } {
    const reviews = [...text.matchAll(/<review>([\s\S]*?)<\/review>/g)];
    const lastReview = reviews[reviews.length - 1];
    const draft = (lastReview ? lastReview[1]! : text).trim();

    const ratings = [...text.matchAll(/<rating>([\s\S]*?)<\/rating>/g)];
    const lastRating = ratings[ratings.length - 1];
    const value = lastRating ? Number.parseFloat(lastRating[1]!.trim()) : Number.NaN;
    const rating = Number.isFinite(value)
        ? Math.min(5, Math.max(1, Math.round(value * 4) / 4))
        : null;

    return { draft, rating };
}
