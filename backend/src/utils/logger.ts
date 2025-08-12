import fs from 'fs';
import path from 'path';

export interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  meta?: any;
  component?: string;
  requestId?: string;
}

export class Logger {
  private static instance: Logger;
  private logLevel: string;
  private logToFile: boolean;
  private logDir: string;
  private isProduction: boolean;

  private constructor() {
    this.logLevel = process.env['LOG_LEVEL'] || 'info';
    this.isProduction = process.env['NODE_ENV'] === 'production';
    this.logToFile = this.isProduction || process.env['LOG_TO_FILE'] === 'true';
    this.logDir = process.env['LOGS_PATH'] || path.join(process.cwd(), 'logs');

    // Ensure log directory exists
    if (this.logToFile && !fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private shouldLog(level: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  private formatMessage(entry: LogEntry): string {
    const { timestamp, level, message, component, requestId, meta } = entry;

    let formattedMessage = `${timestamp} [${level.toUpperCase()}]`;

    if (component) {
      formattedMessage += ` [${component}]`;
    }

    if (requestId) {
      formattedMessage += ` [${requestId}]`;
    }

    formattedMessage += ` ${message}`;

    if (meta && Object.keys(meta).length > 0) {
      formattedMessage += ` ${JSON.stringify(meta)}`;
    }

    return formattedMessage;
  }

  private writeToFile(entry: LogEntry): void {
    if (!this.logToFile) return;

    const logFile = path.join(this.logDir, 'application.log');
    const formattedMessage = this.formatMessage(entry) + '\n';

    try {
      fs.appendFileSync(logFile, formattedMessage);
    } catch (error) {
      // Fallback to console if file writing fails
      console.error('Failed to write to log file:', error);
      console.log(formattedMessage.trim());
    }
  }

  private writeToConsole(entry: LogEntry): void {
    const formattedMessage = this.formatMessage(entry);

    // Use appropriate console method based on level
    switch (entry.level) {
      case 'debug':
        console.debug(formattedMessage);
        break;
      case 'info':
        console.info(formattedMessage);
        break;
      case 'warn':
        console.warn(formattedMessage);
        break;
      case 'error':
        console.error(formattedMessage);
        break;
      default:
        console.log(formattedMessage);
    }
  }

  private log(level: LogEntry['level'], message: string, meta?: any, component?: string, requestId?: string): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(meta !== undefined && { meta }),
      ...(component !== undefined && { component }),
      ...(requestId !== undefined && { requestId })
    };

    // Always write to console in development
    if (!this.isProduction) {
      this.writeToConsole(entry);
    }

    // Write to file in production or when explicitly enabled
    if (this.logToFile) {
      this.writeToFile(entry);
    }

    // Also write to console in production for Docker logs
    if (this.isProduction) {
      this.writeToConsole(entry);
    }
  }

  public debug(message: string, meta?: any, component?: string, requestId?: string): void {
    this.log('debug', message, meta, component, requestId);
  }

  public info(message: string, meta?: any, component?: string, requestId?: string): void {
    this.log('info', message, meta, component, requestId);
  }

  public warn(message: string, meta?: any, component?: string, requestId?: string): void {
    this.log('warn', message, meta, component, requestId);
  }

  public error(message: string, meta?: any, component?: string, requestId?: string): void {
    this.log('error', message, meta, component, requestId);
  }

  // Convenience methods for common logging scenarios
  public request(method: string, path: string, statusCode: number, duration: number, requestId?: string): void {
    this.info(`${method} ${path} - ${statusCode} (${duration}ms)`, {
      method,
      path,
      statusCode,
      duration
    }, 'HTTP', requestId);
  }

  public database(operation: string, table: string, duration?: number, meta?: any): void {
    const message = duration
      ? `${operation} on ${table} (${duration}ms)`
      : `${operation} on ${table}`;

    this.debug(message, meta, 'DATABASE');
  }

  public security(event: string, details?: any, requestId?: string): void {
    this.warn(`Security event: ${event}`, details, 'SECURITY', requestId);
  }

  public performance(metric: string, value: number, unit: string = 'ms', meta?: any): void {
    this.info(`Performance: ${metric} = ${value}${unit}`, meta, 'PERFORMANCE');
  }

  // System monitoring logs for Raspberry Pi
  public system(metric: string, value: number | string, unit?: string, meta?: any): void {
    const message = unit ? `System: ${metric} = ${value}${unit}` : `System: ${metric} = ${value}`;
    this.info(message, meta, 'SYSTEM');
  }

  // Log rotation and cleanup
  public rotateLogs(): void {
    if (!this.logToFile) return;

    const logFile = path.join(this.logDir, 'application.log');
    const rotatedFile = path.join(this.logDir, `application-${Date.now()}.log`);

    try {
      if (fs.existsSync(logFile)) {
        const stats = fs.statSync(logFile);
        const fileSizeMB = stats.size / (1024 * 1024);

        // Rotate if file is larger than 10MB
        if (fileSizeMB > 10) {
          fs.renameSync(logFile, rotatedFile);
          this.info('Log file rotated', { oldFile: logFile, newFile: rotatedFile }, 'LOGGER');

          // Keep only last 5 rotated files
          this.cleanupOldLogs();
        }
      }
    } catch (error) {
      this.error('Failed to rotate logs', {
        error: error instanceof Error ? error.message : String(error)
      }, 'LOGGER');
    }
  }

  private cleanupOldLogs(): void {
    try {
      const files = fs.readdirSync(this.logDir)
        .filter(file => file.startsWith('application-') && file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: path.join(this.logDir, file),
          mtime: fs.statSync(path.join(this.logDir, file)).mtime
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      // Keep only the 5 most recent files
      const filesToDelete = files.slice(5);

      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
        this.info('Old log file deleted', { file: file.name }, 'LOGGER');
      }
    } catch (error) {
      this.error('Failed to cleanup old logs', {
        error: error instanceof Error ? error.message : String(error)
      }, 'LOGGER');
    }
  }

  // Get log statistics
  public getStats(): { totalSize: number; fileCount: number; oldestLog: Date | null } {
    if (!this.logToFile) {
      return { totalSize: 0, fileCount: 0, oldestLog: null };
    }

    try {
      const files = fs.readdirSync(this.logDir)
        .filter(file => file.endsWith('.log'))
        .map(file => {
          const filePath = path.join(this.logDir, file);
          const stats = fs.statSync(filePath);
          return {
            name: file,
            size: stats.size,
            mtime: stats.mtime
          };
        });

      const totalSize = files.reduce((sum, file) => sum + file.size, 0);
      const fileCount = files.length;
      const oldestLog = files.length > 0
        ? files.reduce((oldest, file) => file.mtime < oldest ? file.mtime : oldest, files[0]!.mtime)
        : null;

      return { totalSize, fileCount, oldestLog };
    } catch (error) {
      this.error('Failed to get log stats', {
        error: error instanceof Error ? error.message : String(error)
      }, 'LOGGER');
      return { totalSize: 0, fileCount: 0, oldestLog: null };
    }
  }
}

// Export singleton instance
export const logger = Logger.getInstance();

// Export convenience functions
export const log = {
  debug: (message: string, meta?: any, component?: string, requestId?: string) =>
    logger.debug(message, meta, component, requestId),
  info: (message: string, meta?: any, component?: string, requestId?: string) =>
    logger.info(message, meta, component, requestId),
  warn: (message: string, meta?: any, component?: string, requestId?: string) =>
    logger.warn(message, meta, component, requestId),
  error: (message: string, meta?: any, component?: string, requestId?: string) =>
    logger.error(message, meta, component, requestId),
  request: (method: string, path: string, statusCode: number, duration: number, requestId?: string) =>
    logger.request(method, path, statusCode, duration, requestId),
  database: (operation: string, table: string, duration?: number, meta?: any) =>
    logger.database(operation, table, duration, meta),
  security: (event: string, details?: any, requestId?: string) =>
    logger.security(event, details, requestId),
  performance: (metric: string, value: number, unit?: string, meta?: any) =>
    logger.performance(metric, value, unit, meta),
  system: (metric: string, value: number | string, unit?: string, meta?: any) =>
    logger.system(metric, value, unit, meta)
};