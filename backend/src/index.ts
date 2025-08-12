import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { logger } from './utils/logger';
import { monitoring } from './utils/monitoring';

import { booksRouter } from './routes/books';
import { highlightsRouter } from './routes/highlights';
import { searchRouter } from './routes/search';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env['PORT'] || 3000;
const NODE_ENV = process.env['NODE_ENV'] || 'development';

// Security middleware with CSP for serving static files
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
        },
    },
}));

// CORS configuration
app.use(cors({
    origin: process.env['CORS_ORIGIN'] || (NODE_ENV === 'development' ? 'http://localhost:5173' : 'http://localhost:3000'),
    credentials: true
}));

// Request parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging middleware
if (NODE_ENV === 'production') {
    app.use(morgan('combined'));
} else {
    app.use(morgan('dev'));
}
app.use(requestLogger);

// Serve static files in production with optimized caching
if (NODE_ENV === 'production') {
    const frontendPath = path.join(__dirname, '../../frontend/dist');
    if (fs.existsSync(frontendPath)) {
        // Serve static assets with aggressive caching for versioned files
        app.use('/assets', express.static(path.join(frontendPath, 'assets'), {
            maxAge: '1y', // 1 year cache for versioned assets
            etag: true,
            lastModified: true,
            setHeaders: (res, filePath) => {
                // Set compression headers for text files
                if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
                    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
                }
                // Enable gzip compression hint
                res.setHeader('Vary', 'Accept-Encoding');
            }
        }));

        // Serve other static files with shorter cache
        app.use(express.static(frontendPath, {
            maxAge: '1h', // 1 hour cache for other files
            etag: true,
            lastModified: true,
            index: false, // Don't serve index.html here
            setHeaders: (res, filePath) => {
                // No cache for HTML files to ensure updates are seen
                if (filePath.endsWith('.html')) {
                    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                    res.setHeader('Pragma', 'no-cache');
                    res.setHeader('Expires', '0');
                }
                res.setHeader('Vary', 'Accept-Encoding');
            }
        }));

        console.log(`📁 Serving static files from: ${frontendPath} with optimized caching`);
    }
}

// Enhanced health check endpoint with monitoring integration
app.get('/health', async (_req, res) => {
    try {
        const metrics = await monitoring.collectMetrics();
        const healthStatus = monitoring.getHealthStatus();

        const healthData = {
            status: healthStatus.status,
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            environment: NODE_ENV,
            uptime: process.uptime(),
            memory: {
                used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
                external: Math.round(process.memoryUsage().external / 1024 / 1024),
                percentage: metrics.memory.percentage
            },
            cpu: {
                percentage: metrics.cpu.percentage
            },
            database: {
                path: process.env['DATABASE_PATH'] || './data/reading-tracker.db',
                exists: fs.existsSync(process.env['DATABASE_PATH'] || './data/reading-tracker.db'),
                size: metrics.database.size
            },
            temperature: metrics.temperature,
            checks: healthStatus.checks
        };

        const statusCode = healthStatus.status === 'healthy' ? 200 :
            healthStatus.status === 'warning' ? 200 : 503;

        res.status(statusCode).json(healthData);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Health check failed', { error: errorMessage }, 'HEALTH');
        res.status(503).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            error: 'Health check failed'
        });
    }
});

// Metrics endpoint for monitoring
app.get('/metrics', async (_req, res) => {
    try {
        const metrics = await monitoring.collectMetrics();
        const history = monitoring.getMetricsHistory();
        const averages = monitoring.getAverageMetrics(10);

        res.json({
            current: metrics,
            history: history.slice(-20), // Last 20 data points
            averages
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Metrics collection failed', { error: errorMessage }, 'METRICS');
        res.status(500).json({ error: 'Metrics collection failed' });
    }
});

// API routes
app.use('/api/books', booksRouter);
app.use('/api/highlights', highlightsRouter);
app.use('/api/search', searchRouter);

// Serve React app for all non-API routes in production
if (NODE_ENV === 'production') {
    const frontendPath = path.join(__dirname, '../../frontend/dist');
    const indexPath = path.join(frontendPath, 'index.html');

    if (fs.existsSync(indexPath)) {
        app.get('*', (_req, res) => {
            res.sendFile(indexPath);
        });
    } else {
        // Fallback 404 for production if frontend files don't exist
        app.use('*', (_req, res) => {
            res.status(404).json({
                error: {
                    message: 'Frontend files not found - application may not be built correctly',
                    code: 'FRONTEND_NOT_FOUND',
                    timestamp: new Date().toISOString()
                }
            });
        });
    }
} else {
    // Development 404 handler
    app.use('*', (_req, res) => {
        res.status(404).json({
            error: {
                message: 'Route not found',
                code: 'ROUTE_NOT_FOUND',
                timestamp: new Date().toISOString()
            }
        });
    });
}

// Global error handler (must be last)
app.use(errorHandler);

// Start server
const server = app.listen(PORT, () => {
    logger.info(`Personal Reading Tracker API running on port ${PORT}`, {
        port: PORT,
        environment: NODE_ENV,
        database: process.env['DATABASE_PATH'] || './data/reading-tracker.db'
    }, 'SERVER');

    console.log(`🚀 Personal Reading Tracker API running on port ${PORT}`);
    console.log(`📚 Health check: http://localhost:${PORT}/health`);
    console.log(`📊 Metrics: http://localhost:${PORT}/metrics`);
    console.log(`🌍 Environment: ${NODE_ENV}`);
    console.log(`💾 Database: ${process.env['DATABASE_PATH'] || './data/reading-tracker.db'}`);

    // Start monitoring service
    if (NODE_ENV === 'production') {
        monitoring.startMonitoring(1); // Collect metrics every minute
        logger.info('Monitoring service started', { interval: '1 minute' }, 'MONITORING');
    }
});

// Enhanced graceful shutdown for Raspberry Pi
let isShuttingDown = false;

const gracefulShutdown = (signal: string) => {
    if (isShuttingDown) {
        console.log('Shutdown already in progress, ignoring signal');
        return;
    }

    isShuttingDown = true;
    console.log(`${signal} received, shutting down gracefully`);

    // Stop accepting new connections
    server.close((err) => {
        if (err) {
            console.error('Error closing HTTP server:', err);
        } else {
            console.log('HTTP server closed');
        }

        // Close database connections
        try {
            const { DatabaseConnection } = require('./database/connection');
            const dbInstance = DatabaseConnection.getInstance();
            dbInstance.close();
            console.log('Database connections closed');
        } catch (error) {
            console.error('Error closing database:', error);
        }

        // Clear any intervals/timeouts
        clearInterval(memoryMonitorInterval);

        console.log('Graceful shutdown completed');
        process.exit(0);
    });

    // Force close after 15 seconds (longer for Pi)
    setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 15000);
};

// Memory monitoring for Raspberry Pi
let memoryMonitorInterval: NodeJS.Timeout;

const startMemoryMonitoring = () => {
    const isRaspberryPi = process.arch === 'arm64' || process.env['RASPBERRY_PI'] === 'true';

    if (isRaspberryPi && NODE_ENV === 'production') {
        memoryMonitorInterval = setInterval(() => {
            const memUsage = process.memoryUsage();
            const memUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
            const memTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);

            // Log memory usage if it's high (over 200MB on Pi)
            if (memUsedMB > 200) {
                console.warn(`🍓 High memory usage: ${memUsedMB}MB / ${memTotalMB}MB`);

                // Force garbage collection if available and memory is very high
                if (global.gc && memUsedMB > 300) {
                    console.log('🗑️ Forcing garbage collection');
                    global.gc();
                }
            }
        }, 60000); // Check every minute

        console.log('🍓 Memory monitoring started for Raspberry Pi');
    }
};

// Start memory monitoring
startMemoryMonitoring();

// Database maintenance for Raspberry Pi
const startDatabaseMaintenance = () => {
    const isRaspberryPi = process.arch === 'arm64' || process.env['RASPBERRY_PI'] === 'true';

    if (isRaspberryPi && NODE_ENV === 'production') {
        // Run maintenance every 6 hours
        setInterval(() => {
            try {
                const { DatabaseConnection } = require('./database/connection');
                const dbInstance = DatabaseConnection.getInstance();
                dbInstance.performMaintenance();

                // Log database stats
                const stats = dbInstance.getStats();
                if (stats) {
                    console.log(`📊 Database stats: ${stats.totalSizeMB}MB, ${stats.pageCount} pages`);
                }
            } catch (error) {
                console.error('Database maintenance error:', error);
            }
        }, 6 * 60 * 60 * 1000); // 6 hours

        console.log('🍓 Database maintenance scheduled for Raspberry Pi');
    }
};

// Start database maintenance
startDatabaseMaintenance();

// Enhanced signal handling
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('UNHANDLED_REJECTION');
});