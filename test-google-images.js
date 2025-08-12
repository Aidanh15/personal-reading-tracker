// Test script to manually test Google Images search
const https = require('https');

// Simple test of Google Images search
async function testGoogleImagesSearch() {
    const query = "1984 George Orwell book cover";
    const searchUrl = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}&safe=active&tbs=isz:m`;
    
    console.log(`Testing Google Images search for: "${query}"`);
    console.log(`URL: ${searchUrl}`);
    
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
    };

    try {
        const html = await makeHttpRequest(searchUrl, headers);
        console.log(`Response length: ${html.length} characters`);
        
        // Extract image URLs
        const imageUrlRegex = /"(https?:\/\/[^"]*\.(?:jpg|jpeg|png|webp)[^"]*?)"/gi;
        const matches = html.match(imageUrlRegex);
        
        if (matches) {
            console.log(`Found ${matches.length} potential image URLs:`);
            matches.slice(0, 5).forEach((match, index) => {
                const url = match.replace(/"/g, '');
                console.log(`${index + 1}. ${url}`);
            });
        } else {
            console.log('No image URLs found in response');
            // Show a sample of the HTML to debug
            console.log('Sample HTML:', html.substring(0, 500));
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}

function makeHttpRequest(url, headers) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: headers
        };

        const request = https.request(options, (response) => {
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

// Run the test
testGoogleImagesSearch();