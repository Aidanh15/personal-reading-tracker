import fs from 'fs';
import path from 'path';

interface LogRotationConfig {
  maxFiles: number;
  maxSizeMB: number;
  logDir: string;
}

export class LogRotation {
  private config: LogRotationConfig;

  constructor(config: LogRotationConfig) {
    this.config = config;
    this.ensureLogDirectory();
  }

  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.config.logDir)) {
      fs.mkdirSync(this.config.logDir, { recursive: true });
    }
  }

  private getLogFiles(): string[] {
    try {
      return fs.readdirSync(this.config.logDir)
        .filter(file => file.endsWith('.log'))
        .map(file => path.join(this.config.logDir, file))
        .sort((a, b) => {
          const statA = fs.statSync(a);
          const statB = fs.statSync(b);
          return statB.mtime.getTime() - statA.mtime.getTime();
        });
    } catch (error) {
      console.error('Error reading log directory:', error);
      return [];
    }
  }

  private getFileSize(filePath: string): number {
    try {
      const stats = fs.statSync(filePath);
      return stats.size / (1024 * 1024); // Size in MB
    } catch (error) {
      return 0;
    }
  }

  public shouldRotate(currentLogPath: string): boolean {
    if (!fs.existsSync(currentLogPath)) {
      return false;
    }

    const sizeMB = this.getFileSize(currentLogPath);
    return sizeMB >= this.config.maxSizeMB;
  }

  public rotateLog(currentLogPath: string): string {
    if (!fs.existsSync(currentLogPath)) {
      return currentLogPath;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logDir = path.dirname(currentLogPath);
    const logName = path.basename(currentLogPath, '.log');
    const rotatedPath = path.join(logDir, `${logName}-${timestamp}.log`);

    try {
      // Move current log to rotated name
      fs.renameSync(currentLogPath, rotatedPath);
      
      // Clean up old logs
      this.cleanupOldLogs();
      
      console.log(`📋 Log rotated: ${currentLogPath} -> ${rotatedPath}`);
      return currentLogPath; // Return original path for new log
    } catch (error) {
      console.error('Error rotating log:', error);
      return currentLogPath;
    }
  }

  private cleanupOldLogs(): void {
    const logFiles = this.getLogFiles();
    
    // Remove excess files (keep only maxFiles)
    if (logFiles.length > this.config.maxFiles) {
      const filesToDelete = logFiles.slice(this.config.maxFiles);
      
      filesToDelete.forEach(file => {
        try {
          fs.unlinkSync(file);
          console.log(`🗑️ Deleted old log: ${file}`);
        } catch (error) {
          console.error(`Error deleting log file ${file}:`, error);
        }
      });
    }
  }

  public getLogStats(): { totalFiles: number; totalSizeMB: number; oldestLog?: string } {
    const logFiles = this.getLogFiles();
    const totalSizeMB = logFiles.reduce((total, file) => total + this.getFileSize(file), 0);
    const oldestLog = logFiles.length > 0 ? logFiles[logFiles.length - 1] : undefined;
    
    return {
      totalFiles: logFiles.length,
      totalSizeMB: Math.round(totalSizeMB * 100) / 100,
      ...(oldestLog && { oldestLog })
    };
  }
}