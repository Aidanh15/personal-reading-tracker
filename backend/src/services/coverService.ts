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

    // Ensure covers directory exists
    static ensureCoversDirectory(): void {
        if (!existsSync(this.COVERS_DIR)) {
            mkdirSync(this.COVERS_DIR, { recursive: true });
            console.log(`Created covers directory: ${this.COVERS_DIR}`);
        }
    }

    // Search for book and get cover URL with multiple strategies and sources
    static async searchBookCover(title: string, authors: string[]): Promise<CoverSearchResult> {
        try {
            console.log(`Searching for cover: "${title}" by ${authors.join(', ')}`);

            // Strategy 1: Try Open Library (multiple strategies)
            let result = await this.searchOpenLibrary(title, authors);
            if (result.coverUrl) return result;

            // Strategy 2: Try Google Books API
            result = await this.searchGoogleBooks(title, authors);
            if (result.coverUrl) return result;

            // Strategy 3: Try Open Library with ISBN search (if we can find ISBN)
            result = await this.searchOpenLibraryByISBN(title, authors);
            if (result.coverUrl) return result;

            // Strategy 4: Try more aggressive title variations
            result = await this.searchWithAggressiveVariations(title, authors);
            if (result.coverUrl) return result;

            // Strategy 5: Try author-only search for well-known authors
            result = await this.searchByAuthorOnly(title, authors);
            if (result.coverUrl) return result;

            // Strategy 6: Try Google Images search as final fallback
            result = await this.searchGoogleImages(title, authors);
            if (result.coverUrl) return result;

            console.log(`No cover found for "${title}" after trying all sources and strategies`);
            return { title, authors };
        } catch (error) {
            console.error(`Failed to search for cover of "${title}":`, error);
            return { title, authors };
        }
    }

    // Search Open Library with multiple strategies
    private static async searchOpenLibrary(title: string, authors: string[]): Promise<CoverSearchResult> {
        console.log(`  Trying Open Library...`);

        // Strategy 1: Exact title and author search
        let result = await this.trySearchStrategy(title, authors, 'exact');
        if (result.coverUrl) return result;

        // Strategy 2: Title only search (broader)
        result = await this.trySearchStrategy(title, authors, 'title-only');
        if (result.coverUrl) return result;

        // Strategy 3: Simplified title search (remove subtitles, series info)
        const simplifiedTitle = this.simplifyTitle(title);
        if (simplifiedTitle !== title) {
            result = await this.trySearchStrategy(simplifiedTitle, authors, 'simplified');
            if (result.coverUrl) return result;
        }

        // Strategy 4: Author's last name + simplified title
        if (authors.length > 0 && authors[0]) {
            const lastName = this.extractLastName(authors[0]);
            result = await this.trySearchStrategy(simplifiedTitle, [lastName], 'lastname');
            if (result.coverUrl) return result;
        }

        return { title, authors };
    }

    // Search Google Books API
    private static async searchGoogleBooks(title: string, authors: string[]): Promise<CoverSearchResult> {
        try {
            console.log(`  Trying Google Books API...`);

            const cleanTitle = title.replace(/[^\w\s]/g, '').trim();
            const cleanAuthor = (authors[0] || '').replace(/[^\w\s]/g, '').trim();

            // Try exact search first
            let searchQuery = `intitle:"${cleanTitle}"${cleanAuthor ? ` inauthor:"${cleanAuthor}"` : ''}`;
            let result = await this.tryGoogleBooksQuery(searchQuery, 'exact');
            if (result.coverUrl) return result;

            // Try broader search
            const simplifiedTitle = this.simplifyTitle(title);
            searchQuery = `${simplifiedTitle}${cleanAuthor ? ` ${cleanAuthor}` : ''}`;
            result = await this.tryGoogleBooksQuery(searchQuery, 'broad');
            if (result.coverUrl) return result;

            return { title, authors };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log(`  Google Books search failed:`, errorMessage);
            return { title, authors };
        }
    }

    // Try Google Books query
    private static async tryGoogleBooksQuery(query: string, strategy: string): Promise<CoverSearchResult> {
        try {
            const searchUrl = `${this.GOOGLE_BOOKS_API_URL}?q=${encodeURIComponent(query)}&maxResults=10&fields=items(volumeInfo(title,authors,imageLinks))`;
            console.log(`    Google Books ${strategy}: ${searchUrl}`);

            const searchResult = await this.makeHttpRequest(searchUrl);
            const data = JSON.parse(searchResult);

            if (!data.items || data.items.length === 0) {
                console.log(`    No Google Books results for ${strategy}`);
                return { title: '', authors: [] };
            }

            // Look for a book with a cover image
            for (const item of data.items) {
                const volumeInfo = item.volumeInfo;
                if (volumeInfo?.imageLinks?.thumbnail) {
                    // Google Books thumbnails are HTTP, convert to HTTPS and get larger size
                    let coverUrl = volumeInfo.imageLinks.thumbnail
                        .replace('http://', 'https://')
                        .replace('&zoom=1', '&zoom=2'); // Get larger image

                    console.log(`    Found Google Books cover (${strategy}): ${coverUrl}`);
                    return { title: '', authors: [], coverUrl };
                }
            }

            console.log(`    No covers in Google Books results for ${strategy}`);
            return { title: '', authors: [] };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log(`    Google Books ${strategy} failed:`, errorMessage);
            return { title: '', authors: [] };
        }
    }

    // Try a specific search strategy
    private static async trySearchStrategy(title: string, authors: string[], strategy: string): Promise<CoverSearchResult> {
        try {
            // Clean up title and author for search
            const cleanTitle = title.replace(/[^\w\s]/g, '').trim();
            const cleanAuthor = (authors[0] || '').replace(/[^\w\s]/g, '').trim();

            // Build search query based on strategy
            let searchQuery: string;
            switch (strategy) {
                case 'exact':
                    searchQuery = `title:"${cleanTitle}"${cleanAuthor ? ` author:"${cleanAuthor}"` : ''}`;
                    break;
                case 'title-only':
                    searchQuery = `title:"${cleanTitle}"`;
                    break;
                case 'simplified':
                case 'lastname':
                    searchQuery = `${cleanTitle}${cleanAuthor ? ` ${cleanAuthor}` : ''}`;
                    break;
                default:
                    searchQuery = `title:"${cleanTitle}"`;
            }

            const searchUrl = `${this.OPEN_LIBRARY_SEARCH_URL}?q=${encodeURIComponent(searchQuery)}&limit=10&fields=key,title,author_name,cover_i`;
            console.log(`  Strategy ${strategy}: ${searchUrl}`);

            const searchResult = await this.makeHttpRequest(searchUrl);
            const data = JSON.parse(searchResult);

            if (!data.docs || data.docs.length === 0) {
                console.log(`  No results for strategy ${strategy}`);
                return { title, authors };
            }

            // Look through results for one with a cover
            for (const book of data.docs) {
                if (book.cover_i) {
                    const coverUrl = `${this.OPEN_LIBRARY_COVER_URL}/${book.cover_i}-M.jpg`;
                    console.log(`  Found cover with strategy ${strategy}: ${coverUrl}`);
                    return { title, authors, coverUrl };
                }
            }

            console.log(`  No covers found in results for strategy ${strategy}`);
            return { title, authors };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log(`  Strategy ${strategy} failed:`, errorMessage);
            return { title, authors };
        }
    }

    // Simplify title by removing common patterns
    private static simplifyTitle(title: string): string {
        return title
            // Remove subtitles after colon or dash
            .replace(/[:\-–—].+$/, '')
            // Remove series information in parentheses
            .replace(/\s*\([^)]*\)\s*$/, '')
            // Remove edition information
            .replace(/\s*(Penguin|Vintage|Modern|Classics?|Edition|Deluxe|Unabridged|Complete).*$/i, '')
            // Remove "A Novel" or similar
            .replace(/\s*:?\s*A\s+(Novel|Story|Memoir|Biography).*$/i, '')
            // Clean up extra whitespace
            .replace(/\s+/g, ' ')
            .trim();
    }

    // Extract last name from author
    private static extractLastName(author: string): string {
        const parts = author.trim().split(/\s+/);
        return parts[parts.length - 1] || author;
    }

    // Download cover image to local storage
    static async downloadCover(coverResult: CoverSearchResult): Promise<CoverSearchResult> {
        if (!coverResult.coverUrl) {
            return coverResult;
        }

        try {
            this.ensureCoversDirectory();

            // Generate safe filename
            const safeTitle = coverResult.title
                .replace(/[^\w\s-]/g, '')
                .replace(/\s+/g, '_')
                .toLowerCase();
            const filename = `${safeTitle}.jpg`;
            const localPath = join(this.COVERS_DIR, filename);

            // Check if file already exists
            if (existsSync(localPath)) {
                console.log(`Cover already exists: ${filename}`);
                return {
                    ...coverResult,
                    localPath: `/covers/${filename}`
                };
            }

            console.log(`Downloading cover for "${coverResult.title}" to ${filename}`);

            await this.downloadFile(coverResult.coverUrl, localPath);

            console.log(`Successfully downloaded cover: ${filename}`);
            return {
                ...coverResult,
                localPath: `/covers/${filename}`
            };
        } catch (error) {
            console.error(`Failed to download cover for "${coverResult.title}":`, error);
            return coverResult;
        }
    }

    // Get cover for a book (search and download)
    static async getCoverForBook(title: string, authors: string[]): Promise<CoverSearchResult> {
        const searchResult = await this.searchBookCover(title, authors);
        if (searchResult.coverUrl) {
            return await this.downloadCover(searchResult);
        }
        return searchResult;
    }

    // Batch process covers for multiple books
    static async processCoversForBooks(books: Array<{ title: string; authors: string[] }>): Promise<CoverSearchResult[]> {
        console.log(`Processing covers for ${books.length} books...`);

        const results: CoverSearchResult[] = [];

        for (const book of books) {
            try {
                const result = await this.getCoverForBook(book.title, book.authors);
                results.push(result);

                // Add small delay to be respectful to the API
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

    // Helper: Make HTTP request
    private static makeHttpRequest(url: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const client = url.startsWith('https:') ? https : http;

            const request = client.get(url, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                    return;
                }

                let data = '';
                response.on('data', (chunk) => {
                    data += chunk;
                });

                response.on('end', () => {
                    resolve(data);
                });
            });

            request.on('error', (error) => {
                reject(error);
            });

            request.setTimeout(10000, () => {
                request.destroy();
                reject(new Error('Request timeout'));
            });
        });
    }

    // Helper: Download file
    private static downloadFile(url: string, localPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const client = url.startsWith('https:') ? https : http;

            const request = client.get(url, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                    return;
                }

                const fileStream = createWriteStream(localPath);
                response.pipe(fileStream);

                fileStream.on('finish', () => {
                    fileStream.close();
                    resolve();
                });

                fileStream.on('error', (error) => {
                    reject(error);
                });
            });

            request.on('error', (error) => {
                reject(error);
            });

            request.setTimeout(15000, () => {
                request.destroy();
                reject(new Error('Download timeout'));
            });
        });
    }

    // Strategy 3: Search Open Library by ISBN (try to find ISBN first)
    private static async searchOpenLibraryByISBN(title: string, authors: string[]): Promise<CoverSearchResult> {
        try {
            console.log(`  Trying Open Library ISBN search...`);

            // First, try to find the book to get its ISBN
            const cleanTitle = title.replace(/[^\w\s]/g, '').trim();
            const cleanAuthor = (authors[0] || '').replace(/[^\w\s]/g, '').trim();

            const searchQuery = `${cleanTitle}${cleanAuthor ? ` ${cleanAuthor}` : ''}`;
            const searchUrl = `${this.OPEN_LIBRARY_SEARCH_URL}?q=${encodeURIComponent(searchQuery)}&limit=5&fields=key,title,author_name,isbn,cover_i`;

            const searchResult = await this.makeHttpRequest(searchUrl);
            const data = JSON.parse(searchResult);

            if (!data.docs || data.docs.length === 0) {
                return { title, authors };
            }

            // Look for books with ISBNs and try to get covers via ISBN
            for (const book of data.docs) {
                if (book.isbn && book.isbn.length > 0) {
                    const isbn = book.isbn[0];
                    const isbnCoverUrl = `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`;

                    // Test if the ISBN cover exists
                    try {
                        await this.testUrl(isbnCoverUrl);
                        console.log(`  Found cover via ISBN: ${isbnCoverUrl}`);
                        return { title, authors, coverUrl: isbnCoverUrl };
                    } catch {
                        // ISBN cover doesn't exist, continue
                    }
                }
            }

            return { title, authors };
        } catch (error) {
            console.log(`  ISBN search failed:`, error instanceof Error ? error.message : 'Unknown error');
            return { title, authors };
        }
    }

    // Strategy 4: Try more aggressive title variations
    private static async searchWithAggressiveVariations(title: string, authors: string[]): Promise<CoverSearchResult> {
        console.log(`  Trying aggressive title variations...`);

        const variations = this.generateTitleVariations(title);

        for (const variation of variations) {
            if (variation === title) continue; // Skip original title

            console.log(`    Trying variation: "${variation}"`);

            // Try both Open Library and Google Books with this variation
            let result = await this.trySearchStrategy(variation, authors, 'variation');
            if (result.coverUrl) return result;

            result = await this.tryGoogleBooksQuery(`${variation}${authors[0] ? ` ${authors[0]}` : ''}`, 'variation');
            if (result.coverUrl) return result;
        }

        return { title, authors };
    }

    // Strategy 5: Try author-only search for well-known authors
    private static async searchByAuthorOnly(title: string, authors: string[]): Promise<CoverSearchResult> {
        if (!authors[0]) return { title, authors };

        console.log(`  Trying author-only search...`);

        const author = authors[0];
        const simplifiedTitle = this.simplifyTitle(title);

        // Try searching just by author and see if we can find the book
        const searchQuery = `author:"${author}"`;
        const searchUrl = `${this.OPEN_LIBRARY_SEARCH_URL}?q=${encodeURIComponent(searchQuery)}&limit=20&fields=key,title,author_name,cover_i`;

        try {
            const searchResult = await this.makeHttpRequest(searchUrl);
            const data = JSON.parse(searchResult);

            if (!data.docs || data.docs.length === 0) {
                return { title, authors };
            }

            // Look for books by this author that might match our title
            for (const book of data.docs) {
                if (book.cover_i && book.title) {
                    const bookTitle = book.title.toLowerCase();
                    const targetTitle = simplifiedTitle.toLowerCase();

                    // Check if titles are similar (contains key words)
                    const titleWords = targetTitle.split(/\s+/).filter(word => word.length > 3);
                    const matchingWords = titleWords.filter(word => bookTitle.includes(word));

                    if (matchingWords.length >= Math.min(2, titleWords.length)) {
                        const coverUrl = `${this.OPEN_LIBRARY_COVER_URL}/${book.cover_i}-M.jpg`;
                        console.log(`  Found cover via author search: ${coverUrl} (matched "${book.title}")`);
                        return { title, authors, coverUrl };
                    }
                }
            }

            return { title, authors };
        } catch (error) {
            console.log(`  Author-only search failed:`, error instanceof Error ? error.message : 'Unknown error');
            return { title, authors };
        }
    }

    // Generate title variations for more aggressive searching
    private static generateTitleVariations(title: string): string[] {
        const variations: string[] = [];

        // Original simplified title
        const simplified = this.simplifyTitle(title);
        variations.push(simplified);

        // Remove common words
        const withoutCommonWords = simplified
            .replace(/\b(the|a|an|and|or|but|in|on|at|to|for|of|with|by)\b/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (withoutCommonWords !== simplified) {
            variations.push(withoutCommonWords);
        }

        // Try just the first few words (for long titles)
        const words = simplified.split(/\s+/);
        if (words.length > 3) {
            variations.push(words.slice(0, 3).join(' '));
            variations.push(words.slice(0, 2).join(' '));
        }

        // Try removing numbers and special characters more aggressively
        const alphaOnly = simplified.replace(/[^a-zA-Z\s]/g, ' ').replace(/\s+/g, ' ').trim();
        if (alphaOnly !== simplified) {
            variations.push(alphaOnly);
        }

        // Try title without any punctuation or special formatting
        const cleanest = title
            .replace(/[^\w\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (cleanest !== simplified) {
            variations.push(cleanest);
        }

        return [...new Set(variations)]; // Remove duplicates
    }

    // Test if a URL returns a valid image
    private static async testUrl(url: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            const client = url.startsWith('https:') ? https : http;

            const request = client.get(url, (response) => {
                if (response.statusCode === 200 && response.headers['content-type']?.startsWith('image/')) {
                    resolve(true);
                } else {
                    reject(new Error(`Invalid response: ${response.statusCode}`));
                }
                response.destroy(); // Don't download the full image
            });

            request.on('error', (error) => {
                reject(error);
            });

            request.setTimeout(5000, () => {
                request.destroy();
                reject(new Error('Timeout'));
            });
        });
    }

    // Strategy 6: Google Images search as final fallback
    private static async searchGoogleImages(title: string, authors: string[]): Promise<CoverSearchResult> {
        try {
            console.log(`  Trying Google Images search...`);

            const cleanTitle = this.simplifyTitle(title);
            const cleanAuthor = (authors[0] || '').replace(/[^\w\s]/g, '').trim();

            // Build search queries for Google Images
            const queries = [
                `"${cleanTitle}" "${cleanAuthor}" book cover`,
                `${cleanTitle} ${cleanAuthor} book cover`,
                `"${cleanTitle}" book cover`,
                `${cleanTitle} book cover`
            ].filter((query, index, arr) => arr.indexOf(query) === index); // Remove duplicates

            for (const query of queries) {
                console.log(`    Trying Google Images query: "${query}"`);

                try {
                    const result = await this.tryGoogleImagesQuery(query);
                    if (result.coverUrl) {
                        console.log(`    Found cover via Google Images: ${result.coverUrl}`);
                        return result;
                    }
                } catch (error) {
                    console.log(`    Google Images query failed:`, error instanceof Error ? error.message : 'Unknown error');
                    continue;
                }
            }

            return { title, authors };
        } catch (error) {
            console.log(`  Google Images search failed:`, error instanceof Error ? error.message : 'Unknown error');
            return { title, authors };
        }
    }

    // Try Google Images query using a simple scraping approach
    private static async tryGoogleImagesQuery(query: string): Promise<CoverSearchResult> {
        try {
            // Use Google Images search URL
            const searchUrl = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}&safe=active&tbs=isz:m`;

            // Set headers to mimic a real browser
            const headers = {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            };

            const html = await this.makeHttpRequestWithHeaders(searchUrl, headers);

            // Extract image URLs from the HTML using regex
            // Look for image URLs in the typical Google Images format
            const imageUrlRegex = /"(https?:\/\/[^"]*\.(?:jpg|jpeg|png|webp)[^"]*?)"/gi;
            const matches = html.match(imageUrlRegex);

            if (!matches || matches.length === 0) {
                return { title: '', authors: [] };
            }

            // Filter and validate image URLs
            const validImageUrls: string[] = [];

            for (const match of matches.slice(0, 10)) { // Check first 10 matches
                const url = match.replace(/"/g, '');

                // Skip Google's own URLs and thumbnails
                if (url.includes('google.com') ||
                    url.includes('gstatic.com') ||
                    url.includes('googleusercontent.com') ||
                    url.includes('data:image') ||
                    url.length > 500) { // Skip very long URLs (likely data URLs)
                    continue;
                }

                // Prefer URLs that look like book covers
                if (url.includes('cover') ||
                    url.includes('book') ||
                    url.includes('amazon') ||
                    url.includes('goodreads') ||
                    url.includes('openlibrary')) {
                    validImageUrls.unshift(url); // Add to front
                } else {
                    validImageUrls.push(url);
                }
            }

            // Test the URLs to find a working one
            for (const imageUrl of validImageUrls) {
                try {
                    await this.testUrl(imageUrl);
                    return { title: '', authors: [], coverUrl: imageUrl };
                } catch {
                    // URL doesn't work, try next one
                    continue;
                }
            }

            return { title: '', authors: [] };
        } catch (error) {
            throw error;
        }
    }

    // Make HTTP request with custom headers
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
                    reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                    return;
                }

                let data = '';
                response.on('data', (chunk) => {
                    data += chunk;
                });

                response.on('end', () => {
                    resolve(data);
                });
            });

            request.on('error', (error) => {
                reject(error);
            });

            request.setTimeout(15000, () => {
                request.destroy();
                reject(new Error('Request timeout'));
            });

            request.end();
        });
    }

    // Helper: Delay function
    private static delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Clean up old covers (optional maintenance function)
    static cleanupOldCovers(): void {
        // Implementation for cleaning up unused cover files
        // This could be called periodically to remove covers for deleted books
        console.log('Cover cleanup functionality can be implemented as needed');
    }
}