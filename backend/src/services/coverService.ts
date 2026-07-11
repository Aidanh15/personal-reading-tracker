import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import https from 'https';
import http from 'http';

export interface CoverSearchResult {
    title: string;
    authors: string[];
    coverUrl?: string;
    localPath?: string;
}

export class CoverService {
    private static readonly COVERS_DIR = process.env['COVERS_PATH'] || join(
        dirname(process.env['DATABASE_PATH'] || join(process.cwd(), 'data', 'reading-tracker.db')),
        'covers'
    );
    private static readonly OPEN_LIBRARY_SEARCH_URL = 'https://openlibrary.org/search.json';
    private static readonly OPEN_LIBRARY_COVER_URL = 'https://covers.openlibrary.org/b/id';
    private static readonly GOOGLE_BOOKS_API_URL = 'https://www.googleapis.com/books/v1/volumes';

    static ensureCoversDirectory(): void {
        if (!existsSync(this.COVERS_DIR)) {
            mkdirSync(this.COVERS_DIR, { recursive: true });
            console.log(`Created covers directory: ${this.COVERS_DIR}`);
        }
    }

    static getCoversDirectory(): string {
        return this.COVERS_DIR;
    }

    static async searchBookCover(title: string, authors: string[]): Promise<CoverSearchResult> {
        try {
            console.log(`Searching for cover: "${title}" by ${authors.join(', ')}`);

            // Try Open Library first
            let result = await this.searchOpenLibrary(title, authors);
            if (result.coverUrl) return result;

            // Try Google Books
            result = await this.searchGoogleBooks(title, authors);
            if (result.coverUrl) return result;

            console.log(`No cover found for "${title}"`);
            return { title, authors };
        } catch (error) {
            console.error(`Failed to search for cover of "${title}":`, error);
            return { title, authors };
        }
    }

    private static async searchOpenLibrary(title: string, authors: string[]): Promise<CoverSearchResult> {
        console.log(`  Trying Open Library...`);

        const simplifiedTitle = this.simplifyTitle(title);
        const cleanAuthor = this.normalizeText(authors[0] || '');

        const searchParams = new URLSearchParams({
            title: simplifiedTitle,
            limit: '20',
            fields: 'key,title,author_name,cover_i,isbn'
        });
        if (cleanAuthor) searchParams.set('author', cleanAuthor);
        const searchUrl = `${this.OPEN_LIBRARY_SEARCH_URL}?${searchParams.toString()}`;

        try {
            const searchResult = await this.makeHttpRequest(searchUrl);
            const data = JSON.parse(searchResult);

            const coverUrl = await this.findOpenLibraryCover(data.docs || [], title, authors, false);
            if (coverUrl) return { title, authors, coverUrl };

            // Translated works can be indexed under their original-language title.
            // A relevance search lets us reuse that work's cover when the author agrees.
            const fallbackQuery = `title:"${simplifiedTitle}"${cleanAuthor ? ` author:"${cleanAuthor}"` : ''}`;
            const fallbackUrl = `${this.OPEN_LIBRARY_SEARCH_URL}?q=${encodeURIComponent(fallbackQuery)}&limit=20&fields=key,title,author_name,cover_i,isbn`;
            const fallbackData = JSON.parse(await this.makeHttpRequest(fallbackUrl));
            const translatedCoverUrl = await this.findOpenLibraryCover(
                fallbackData.docs || [],
                title,
                authors,
                true
            );
            if (translatedCoverUrl) {
                return { title, authors, coverUrl: translatedCoverUrl };
            }

            // Some records are not indexed under their author field. Retry by
            // title only, but retain only independently matching authors to
            // avoid same-title false positives.
            const titleOnlyParams = new URLSearchParams({
                title: simplifiedTitle,
                limit: '20',
                fields: 'key,title,author_name,cover_i,isbn'
            });
            const titleOnlyData = JSON.parse(await this.makeHttpRequest(
                `${this.OPEN_LIBRARY_SEARCH_URL}?${titleOnlyParams.toString()}`
            ));
            const authorMatchedBooks = (titleOnlyData.docs || []).filter((book: any) =>
                this.authorsLikelyMatch(authors, book.author_name || [])
            );
            const titleOnlyCoverUrl = await this.findOpenLibraryCover(
                authorMatchedBooks,
                title,
                authors,
                false
            );
            if (titleOnlyCoverUrl) {
                return { title, authors, coverUrl: titleOnlyCoverUrl };
            }
        } catch (error) {
            console.log(`  Open Library search failed:`, error);
        }

        return { title, authors };
    }

    private static async searchGoogleBooks(title: string, authors: string[]): Promise<CoverSearchResult> {
        console.log(`  Trying Google Books...`);

        const simplifiedTitle = this.simplifyTitle(title);
        const cleanAuthor = this.normalizeText(authors[0] || '');

        const searchQuery = `intitle:"${simplifiedTitle}"${cleanAuthor ? ` inauthor:"${cleanAuthor}"` : ''}`;
        const apiKey = process.env['GOOGLE_BOOKS_API_KEY'];
        const searchUrl = `${this.GOOGLE_BOOKS_API_URL}?q=${encodeURIComponent(searchQuery)}&maxResults=10&printType=books&fields=items(volumeInfo(title,authors,imageLinks))${apiKey ? `&key=${encodeURIComponent(apiKey)}` : ''}`;

        try {
            const searchResult = await this.makeHttpRequest(searchUrl);
            const data = JSON.parse(searchResult);

            const candidates = (data.items || [])
                .map((item: any) => ({
                    item,
                    score: this.scoreCandidate(
                        title,
                        authors,
                        item.volumeInfo?.title || '',
                        item.volumeInfo?.authors || []
                    )
                }))
                .filter(({ item, score }: any) => score >= 0.62 && item.volumeInfo?.imageLinks)
                .sort((a: any, b: any) => b.score - a.score);

            for (const { item, score } of candidates) {
                const imageLinks = item.volumeInfo.imageLinks;
                const coverUrl = imageLinks.extraLarge || imageLinks.large || imageLinks.medium ||
                    imageLinks.small || imageLinks.thumbnail || imageLinks.smallThumbnail;
                if (coverUrl) {
                    const secureCoverUrl = coverUrl.replace('http://', 'https://').replace('&edge=curl', '');
                    console.log(`  Found Google Books cover (${score.toFixed(2)} match): ${secureCoverUrl}`);
                    return { title, authors, coverUrl: secureCoverUrl };
                }
            }
        } catch (error) {
            console.log(`  Google Books search failed:`, error);
        }

        return { title, authors };
    }

    private static simplifyTitle(title: string): string {
        return title
            // Remove subtitles after a colon or a spaced dash, but preserve titles
            // such as Moby-Dick and Catch-22.
            .replace(/:.+$/, '')
            .replace(/\s[-–—]\s.+$/, '')
            // Remove series information in parentheses or brackets
            .replace(/\s*[\(\[][^\)\]]*[\)\]]\s*$/g, '')
            // Remove common publisher/edition markers anywhere in title
            .replace(/\s*(Penguin|Vintage|Modern|Oxford|Classics?|Edition|Deluxe|Unabridged|Complete|Masterworks?|Library).*$/i, '')
            // Remove marketing descriptions (like "gripping and inspiring classic")
            .replace(/\s*:?\s*The\s+(gripping|inspiring|classic|bestselling|acclaimed|award[- ]winning|timeless|definitive|original|complete|unputdownable).*$/i, '')
            // Remove "A Novel/Story/Memoir" etc.
            .replace(/\s*:?\s*A\s+(Novel|Story|Memoir|Biography|Collection|Guide|History|Study).*$/i, '')
            // Remove common descriptive phrases
            .replace(/\s*:?\s*(Now\s+a\s+Netflix\s+Series|Major\s+Motion\s+Picture|Sunday\s+Times\s+Bestseller).*$/i, '')
            // Remove year ranges or publication info
            .replace(/\s*[\(\[]?\d{4}[\-–]\d{4}[\)\]]?.*$/g, '')
            // Remove standalone years in parentheses
            .replace(/\s*\(\d{4}\)\s*$/g, '')
            // Remove "S." or similar series markers
            .replace(/\s+S\.\s*$/i, '')
            // Remove specific problematic patterns we've seen
            .replace(/\s*:?\s*(Inside the FBI Elite Serial Crime Unit, the Bestselling True Story).*$/i, '')
            .replace(/\s*:?\s*(Oil, Money, Murder and the Birth of the FBI).*$/i, '')
            .replace(/\s*:?\s*(Political Dystopian Classic).*$/i, '')
            // Clean up extra whitespace and punctuation
            .replace(/\s+/g, ' ')
            .replace(/[,;]\s*$/, '')
            .trim();
    }

    private static scoreCandidate(
        expectedTitle: string,
        expectedAuthors: string[],
        candidateTitle: string,
        candidateAuthors: string[]
    ): number {
        const expected = this.normalizeWords(this.simplifyTitle(expectedTitle));
        const candidate = this.normalizeWords(this.simplifyTitle(candidateTitle));
        if (!expected.length || !candidate.length) return 0;

        const candidateWords = new Set(candidate);
        const sharedTitleWords = expected.filter(word => candidateWords.has(word)).length;
        const titleScore = this.normalizeText(this.simplifyTitle(expectedTitle)) ===
            this.normalizeText(this.simplifyTitle(candidateTitle))
            ? 1
            : sharedTitleWords / Math.max(expected.length, candidate.length);

        const expectedAuthorWords = this.normalizeWords(expectedAuthors.join(' '));
        const candidateAuthorWords = new Set(this.normalizeWords(candidateAuthors.join(' ')));
        const authorScore = expectedAuthorWords.length === 0 || candidateAuthorWords.size === 0
            ? 0.5
            : expectedAuthorWords.filter(word => candidateAuthorWords.has(word)).length / expectedAuthorWords.length;

        return (titleScore * 0.78) + (authorScore * 0.22);
    }

    private static async findOpenLibraryCover(
        books: any[],
        title: string,
        authors: string[],
        allowTranslatedTitle: boolean
    ): Promise<string | undefined> {
        const candidates = books
            .map((book: any) => ({
                book,
                score: this.scoreCandidate(title, authors, book.title || '', book.author_name || [])
            }))
            .filter(({ book, score }: any) =>
                (book.cover_i || book.isbn?.length) &&
                (score >= 0.62 || (allowTranslatedTitle && this.authorsLikelyMatch(authors, book.author_name || [])))
            )
            .sort((a: any, b: any) => b.score - a.score);

        for (const { book, score } of candidates) {
            if (book.cover_i) {
                const coverUrl = `${this.OPEN_LIBRARY_COVER_URL}/${book.cover_i}-L.jpg`;
                console.log(`  Found Open Library cover (${score.toFixed(2)} match): ${coverUrl}`);
                return coverUrl;
            }

            for (const isbn of (book.isbn || []).slice(0, 5)) {
                const coverUrl = `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-L.jpg?default=false`;
                try {
                    await this.testUrl(coverUrl);
                    console.log(`  Found Open Library ISBN cover (${score.toFixed(2)} match): ${coverUrl}`);
                    return coverUrl;
                } catch {
                    // Try the next edition ISBN.
                }
            }
        }

        return undefined;
    }

    private static authorsLikelyMatch(expectedAuthors: string[], candidateAuthors: string[]): boolean {
        const expected = new Set(this.normalizeWords(expectedAuthors.join(' ')).filter(word => word.length > 3));
        const candidate = this.normalizeWords(candidateAuthors.join(' ')).filter(word => word.length > 3);
        return candidate.some(word => expected.has(word));
    }

    private static normalizeWords(value: string): string[] {
        return this.normalizeText(value)
            .split(' ')
            .filter(word => word.length > 1 && !['a', 'an', 'and', 'of', 'the'].includes(word));
    }

    private static normalizeText(value: string): string {
        return value
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    static async downloadCover(coverResult: CoverSearchResult): Promise<CoverSearchResult> {
        if (!coverResult.coverUrl) return coverResult;

        try {
            this.ensureCoversDirectory();

            const safeTitle = coverResult.title
                .replace(/[^\w\s-]/g, '')
                .replace(/\s+/g, '_')
                .toLowerCase();
            const safeAuthor = (coverResult.authors[0] || '')
                .replace(/[^\w\s-]/g, '')
                .replace(/\s+/g, '_')
                .toLowerCase();
            const filename = safeAuthor ? `${safeTitle}_by_${safeAuthor}.jpg` : `${safeTitle}.jpg`;
            const localPath = join(this.COVERS_DIR, filename);

            if (existsSync(localPath)) {
                return { ...coverResult, localPath: `/covers/${filename}` };
            }

            await this.downloadFile(coverResult.coverUrl, localPath);
            return { ...coverResult, localPath: `/covers/${filename}` };
        } catch (error) {
            console.error(`Failed to download cover:`, error);
            return coverResult;
        }
    }

    static async getCoverForBook(title: string, authors: string[]): Promise<CoverSearchResult> {
        const searchResult = await this.searchBookCover(title, authors);
        if (searchResult.coverUrl) {
            return await this.downloadCover(searchResult);
        }
        return searchResult;
    }

    static async processCoversForBooks(books: Array<{ title: string; authors: string[] }>): Promise<CoverSearchResult[]> {
        console.log(`Processing covers for ${books.length} books...`);

        const results: CoverSearchResult[] = [];

        for (const book of books) {
            try {
                const result = await this.getCoverForBook(book.title, book.authors);
                results.push(result);

                // Add small delay to be respectful to the APIs
                await this.delay(500);
            } catch (error) {
                console.error(`Failed to process cover for "${book.title}":`, error);
                results.push({ title: book.title, authors: book.authors });
            }
        }

        const successCount = results.filter(r => r.localPath).length;
        console.log(`Successfully processed ${successCount}/${books.length} book covers`);

        return results;
    }

    private static makeHttpRequest(url: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const client = url.startsWith('https:') ? https : http;
            const request = client.get(url, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`HTTP ${response.statusCode}`));
                    return;
                }
                let data = '';
                response.on('data', (chunk) => { data += chunk; });
                response.on('end', () => { resolve(data); });
            });
            request.on('error', reject);
            request.setTimeout(10000, () => {
                request.destroy();
                reject(new Error('Timeout'));
            });
        });
    }

    private static downloadFile(url: string, localPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const client = url.startsWith('https:') ? https : http;
            const request = client.get(url, (response) => {
                // Handle redirects
                if (response.statusCode === 302 || response.statusCode === 301) {
                    const redirectUrl = response.headers.location;
                    if (redirectUrl) {
                        console.log(`  Following redirect to: ${redirectUrl}`);
                        this.downloadFile(redirectUrl, localPath).then(resolve).catch(reject);
                        return;
                    }
                }

                if (response.statusCode !== 200) {
                    reject(new Error(`HTTP ${response.statusCode}`));
                    return;
                }
                const fileStream = createWriteStream(localPath);
                response.pipe(fileStream);
                fileStream.on('finish', () => {
                    fileStream.close();
                    resolve();
                });
                fileStream.on('error', reject);
            });
            request.on('error', reject);
            request.setTimeout(15000, () => {
                request.destroy();
                reject(new Error('Timeout'));
            });
        });
    }

    private static async testUrl(url: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            const client = url.startsWith('https:') ? https : http;
            const request = client.get(url, (response) => {
                // Accept both 200 (direct image) and 302 (redirect to image)
                if ((response.statusCode === 200 || response.statusCode === 302) &&
                    response.headers['content-type']?.startsWith('image/')) {
                    resolve(true);
                } else {
                    reject(new Error(`Invalid response: ${response.statusCode}`));
                }
                response.destroy();
            });
            request.on('error', reject);
            request.setTimeout(5000, () => {
                request.destroy();
                reject(new Error('Timeout'));
            });
        });
    }

    private static delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    static cleanupOldCovers(): void {
        console.log('Cover cleanup functionality can be implemented as needed');
    }
}
