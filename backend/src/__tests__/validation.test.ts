import { ratingSchema, schemas } from '../middleware/validation';

describe('ratings', () => {
    it('accepts whole and quarter stars from 1 to 5', () => {
        for (const rating of [1, 2.25, 3.5, 4.25, 4.75, 5]) {
            expect(ratingSchema.safeParse(rating).success).toBe(true);
        }
    });

    it('rejects ratings off the quarter-star grid or outside 1-5', () => {
        for (const rating of [4.1, 4.3, 0.75, 5.25, 0]) {
            expect(ratingSchema.safeParse(rating).success).toBe(false);
        }
    });
});

describe('book progress updates', () => {
    it('accepts a quarter-star rating and a review up to 10000 characters', () => {
        expect(schemas.updateBookProgress.safeParse({ personalRating: 4.25, personalReview: 'x'.repeat(10000) }).success).toBe(true);
        expect(schemas.updateBookProgress.safeParse({ personalReview: 'x'.repeat(10001) }).success).toBe(false);
    });
});
