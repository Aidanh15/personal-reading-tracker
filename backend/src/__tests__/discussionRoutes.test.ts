import { draftBodySchema, messageBodySchema, reviewBodySchema } from '../routes/discussionSchemas';

describe('discussion request bodies', () => {
    it('draft ratings must be quarter stars or null', () => {
        expect(draftBodySchema.safeParse({ draft: 'Text', rating: 4.1 }).success).toBe(false);
        expect(draftBodySchema.safeParse({ draft: 'Text', rating: 4.25 }).success).toBe(true);
        expect(draftBodySchema.safeParse({ draft: 'Text', rating: null }).success).toBe(true);
    });

    it('a message is non-empty text, or null to retry', () => {
        expect(messageBodySchema.safeParse({ content: null }).success).toBe(true);
        expect(messageBodySchema.safeParse({ content: '   ' }).success).toBe(false);
        expect(messageBodySchema.safeParse({ content: 'An answer' }).success).toBe(true);
    });

    it('review instructions are optional and bounded', () => {
        expect(reviewBodySchema.safeParse({}).success).toBe(true);
        expect(reviewBodySchema.safeParse({ instructions: 'shorter' }).success).toBe(true);
        expect(reviewBodySchema.safeParse({ instructions: 'x'.repeat(2001) }).success).toBe(false);
    });
});
