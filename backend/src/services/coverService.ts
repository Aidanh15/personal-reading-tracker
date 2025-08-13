import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import https from 'https';
import http from 'http';

export interface CoverSearchResult {
    title: string;
    authors: string[];
    coverUrl?: string;
    localPath?: string;
}

export class CoverService {
    private static readonly COVERS_DIR = join(process.cwd(), 'data', 'covers');
    private static readonly OPEN_LIBRARY_SEARCH_URL = 'https://openlibrary.org/search.json';
    private static readonly OPEN_LIBRARY_COVER_URL = 'https://covers.openlibrary.org/b/id';
    private static readonly GOOGLE_BOOKS_API_URL = 'https://www.googleapis.com/books/v1/volumes';

    static ensureCoversDirectory(): void {
        if (!existsSync(this.COVERS_DIR)) {
            mkdirSync(this.COVERS_DIR, { recursive: true });
            console.log(`Created covers directory: ${this.COVERS_DIR}`);
        }
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

            // Try Goodreads
            result = await this.searchGoodreads(title, authors);
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
        const cleanAuthor = (authors[0] || '').replace(/[^\w\s]/g, '').trim();

        const searchQuery = `${simplifiedTitle}${cleanAuthor ? ` ${cleanAuthor}` : ''}`;
        const searchUrl = `${this.OPEN_LIBRARY_SEARCH_URL}?q=${encodeURIComponent(searchQuery)}&limit=10&fields=key,title,author_name,cover_i`;

        try {
            const searchResult = await this.makeHttpRequest(searchUrl);
            const data = JSON.parse(searchResult);

            if (data.docs && data.docs.length > 0) {
                for (const book of data.docs) {
                    if (book.cover_i) {
                        const coverUrl = `${this.OPEN_LIBRARY_COVER_URL}/${book.cover_i}-M.jpg`;
                        console.log(`  Found Open Library cover: ${coverUrl}`);
                        return { title, authors, coverUrl };
                    }
                }
            }
        } catch (error) {
            console.log(`  Open Library search failed:`, error);
        }

        return { title, authors };
    }

    private static async searchGoogleBooks(title: string, authors: string[]): Promise<CoverSearchResult> {
        console.log(`  Trying Google Books...`);

        const simplifiedTitle = this.simplifyTitle(title);
        const cleanAuthor = (authors[0] || '').replace(/[^\w\s]/g, '').trim();

        const searchQuery = `${simplifiedTitle}${cleanAuthor ? ` ${cleanAuthor}` : ''}`;
        const searchUrl = `${this.GOOGLE_BOOKS_API_URL}?q=${encodeURIComponent(searchQuery)}&maxResults=5&fields=items(volumeInfo(imageLinks))`;

        try {
            const searchResult = await this.makeHttpRequest(searchUrl);
            const data = JSON.parse(searchResult);

            if (data.items && data.items.length > 0) {
                for (const item of data.items) {
                    const imageLinks = item.volumeInfo?.imageLinks;
                    if (imageLinks?.thumbnail) {
                        const coverUrl = imageLinks.thumbnail.replace('http://', 'https://');
                        console.log(`  Found Google Books cover: ${coverUrl}`);
                        return { title, authors, coverUrl };
                    }
                }
            }
        } catch (error) {
            console.log(`  Google Books search failed:`, error);
        }

        return { title, authors };
    }

    private static async searchGoodreads(title: string, authors: string[]): Promise<CoverSearchResult> {
        console.log(`  Trying Goodreads...`);

        const simplifiedTitle = this.simplifyTitle(title);
        const cleanAuthor = (authors[0] || '').replace(/[^\w\s]/g, '').trim();

        const searchQuery = `${simplifiedTitle}${cleanAuthor ? ` ${cleanAuthor}` : ''}`;
        const searchUrl = `https://www.goodreads.com/search?q=${encodeURIComponent(searchQuery)}`;

        try {
            const headers = {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            };

            const html = await this.makeHttpRequestWithHeaders(searchUrl, headers);
            const coverUrlRegex = /<img[^>]+src="([^"]*books\/[^"]*\.(jpg|jpeg|png))"[^>]*>/gi;
            const matches = html.match(coverUrlRegex);

            if (matches && matches.length > 0) {
                for (const match of matches.slice(0, 3)) {
                    const srcMatch = match.match(/src="([^"]+)"/);
                    if (srcMatch && srcMatch[1]) {
                        let imageUrl = srcMatch[1];

                        if (imageUrl.startsWith('//')) {
                            imageUrl = 'https:' + imageUrl;
                        }

                        if (!imageUrl.includes('nophoto') && !imageUrl.includes('blank')) {
                            try {
                                await this.testUrl(imageUrl);
                                console.log(`  Found Goodreads cover: ${imageUrl}`);
                                return { title, authors, coverUrl: imageUrl };
                            } catch {
                                continue;
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.log(`  Goodreads search failed:`, error);
        }

        return { title, authors };
    }

    private static simplifyTitle(title: string): string {
        return title
            // Remove subtitles after colon or dash (most important for your case)
            .replace(/[:\-–—].+$/, '')
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

    private static makeHttpRequestWithHeaders(url: string, headers: Record<string, string>): Promise<string> {
        return new Promise((resolve, reject) => {
            const client = url.startsWith('https:') ? https : http;
            const urlObj = new URL(url);
            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port,
                path: urlObj.pathname + urlObj.search,
                method: 'GET',
                headers: headers
            };
            const request = client.request(options, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`HTTP ${response.statusCode}`));
                    return;
                }
                let data = '';
                response.on('data', (chunk) => { data += chunk; });
                response.on('end', () => { resolve(data); });
            });
            request.on('error', reject);
            request.setTimeout(15000, () => {
                request.destroy();
                reject(new Error('Timeout'));
            });
            request.end();
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