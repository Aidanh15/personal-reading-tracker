# Personal Reading Tracker

A self-hosted reading tracker application designed to replace Goodreads with a clean, focused interface. Built for deployment on Raspberry Pi with Docker and Tailscale access.

## Features

- 📚 Track reading progress through an AI-optimized reading list
- 📝 Manage Kindle highlights and quotes
- 📊 Visual progress tracking and reading statistics
- 🔍 Full-text search across books and highlights
- 📱 Responsive design for all devices
- 🐳 Docker containerized for easy deployment
- 🍓 Optimized for Raspberry Pi

## Tech Stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **Database**: SQLite
- **Containerization**: Docker + Docker Compose
- **Testing**: Jest + Playwright

## Quick Start

### Prerequisites

- Node.js 18+
- Docker and Docker Compose
- Git

### Development Setup

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd personal-reading-tracker
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Install dependencies**
   ```bash
   # Backend
   cd backend && npm install
   
   # Frontend
   cd ../frontend && npm install
   ```

4. **Start development servers**
   ```bash
   # Backend (from backend directory)
   npm run dev
   
   # Frontend (from frontend directory)
   npm run dev
   ```

### Production Deployment (Raspberry Pi)

1. **Prepare environment**
   ```bash
   cp .env.production.example .env.production
   # Edit .env.production with your Pi-specific settings
   ```

2. **Build and deploy with Docker**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

3. **Verify deployment**
   ```bash
   curl http://localhost:3000/api/health
   ```

## Configuration

### Environment Variables

See `.env.example` for development and `.env.production.example` for production configuration options.

### Database

The application uses SQLite for simplicity and reliability. Database files are stored in the `data/` directory (configurable via `DATABASE_PATH`).

### Logging

- Development: Console logging
- Production: File logging with rotation
- Raspberry Pi: System monitoring with temperature tracking

## API Endpoints

- `GET /api/health` - Health check and system status
- `GET /api/books` - Get all books with progress
- `GET /api/books/:id` - Get book details
- `PUT /api/books/:id/progress` - Update reading progress
- `GET /api/books/:id/highlights` - Get book highlights
- `POST /api/books/:id/highlights` - Add new highlight
- `GET /api/search` - Search books and highlights

## Testing

```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test

# E2E tests
npm run test:e2e
```

## Security Considerations

- No authentication required (designed for personal use on private network)
- Intended for deployment behind Tailscale or private network
- Database and logs are stored locally
- No external API calls or data sharing

## Contributing

This is a personal project, but feel free to fork and adapt for your own use.

## License

MIT License - see LICENSE file for details.

## Deployment Notes

### Raspberry Pi Optimization

- ARM64 compatible Docker images
- Memory usage optimization
- Temperature monitoring
- Efficient SQLite configuration

### Tailscale Integration

For secure remote access, install Tailscale on your Raspberry Pi:

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

Then access your reading tracker via your Pi's Tailscale IP.

## Troubleshooting

### Common Issues

1. **Port conflicts**: Change `PORT` in environment variables
2. **Database permissions**: Ensure Docker has write access to data directory
3. **Memory issues on Pi**: Reduce concurrent processes in Docker Compose

### Logs

- Application logs: `logs/application.log`
- Docker logs: `docker-compose logs`
- System monitoring: Available at `/api/health`

## Data Import

### Kindle Highlights

1. Export highlights from Kindle (My Clippings.txt)
2. Use the import feature in the web interface
3. Categorize books during import process

### Reading List

Import your reading list via the web interface or by placing a JSON file in the imports directory.