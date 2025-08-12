import { logger } from './logger';
import fs from 'fs';
import path from 'path';

export interface SystemMetrics {
    timestamp: string;
    memory: {
        used: number;
        total: number;
        percentage: number;
    };
    cpu: {
        percentage: number;
    };
    database: {
        size: number;
        connections: number;
    };
    uptime: number;
    temperature?: number;
    diskUsage?: {
        used: number;
        total: number;
        percentage: number;
    };
}

export interface AlertThresholds {
    memory: number;
    cpu: number;
    temperature: number;
    diskUsage: number;
    responseTime: number;
}

export class MonitoringService {
    private static instance: MonitoringService;
    private isRaspberryPi: boolean;
    private alertThresholds: AlertThresholds;
    private lastAlerts: Map<string, number> = new Map();
    private alertCooldown: number = 5 * 60 * 1000; // 5 minutes
    private metricsHistory: SystemMetrics[] = [];
    private maxHistorySize: number = 100;

    private constructor() {
        this.isRaspberryPi = process.arch === 'arm64' || process.env['RASPBERRY_PI'] === 'true';
        this.alertThresholds = {
            memory: this.isRaspberryPi ? 80 : 85, // Lower threshold for Pi
            cpu: this.isRaspberryPi ? 70 : 80,
            temperature: 70, // Celsius
            diskUsage: 85,
            responseTime: 2000 // milliseconds
        };
    }

    public static getInstance(): MonitoringService {
        if (!MonitoringService.instance) {
            MonitoringService.instance = new MonitoringService();
        }
        return MonitoringService.instance;
    }

    public async collectMetrics(): Promise<SystemMetrics> {
        const timestamp = new Date().toISOString();

        // Memory metrics
        const memUsage = process.memoryUsage();
        const memory = {
            used: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
            total: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
            percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
        };

        // CPU metrics (simplified - would need more complex implementation for accurate CPU usage)
        const cpu = {
            percentage: await this.getCpuUsage()
        };

        // Database metrics
        const database = await this.getDatabaseMetrics();

        // Uptime
        const uptime = Math.round(process.uptime());

        // Temperature (Raspberry Pi specific)
        const temperature = this.isRaspberryPi ? await this.getTemperature() : undefined;

        // Disk usage
        const diskUsage = await this.getDiskUsage();

        const metrics: SystemMetrics = {
            timestamp,
            memory,
            cpu,
            database,
            uptime,
            ...(temperature !== undefined && { temperature }),
            ...(diskUsage !== undefined && { diskUsage })
        };

        // Store in history
        this.metricsHistory.push(metrics);
        if (this.metricsHistory.length > this.maxHistorySize) {
            this.metricsHistory.shift();
        }

        // Check for alerts
        this.checkAlerts(metrics);

        return metrics;
    }

    private async getCpuUsage(): Promise<number> {
        // Simplified CPU usage calculation
        // In a real implementation, you'd want to use a more accurate method
        const startUsage = process.cpuUsage();

        return new Promise((resolve) => {
            setTimeout(() => {
                const endUsage = process.cpuUsage(startUsage);
                const totalUsage = endUsage.user + endUsage.system;
                const percentage = Math.round((totalUsage / 1000000) * 100); // Convert to percentage
                resolve(Math.min(percentage, 100)); // Cap at 100%
            }, 100);
        });
    }

    private async getDatabaseMetrics(): Promise<{ size: number; connections: number }> {
        try {
            const dbPath = process.env['DATABASE_PATH'] || './data/reading-tracker.db';

            let size = 0;
            if (fs.existsSync(dbPath)) {
                const stats = fs.statSync(dbPath);
                size = Math.round(stats.size / 1024 / 1024); // MB
            }

            // For SQLite, connections are typically 1 (single connection)
            const connections = 1;

            return { size, connections };
        } catch (error) {
            logger.error('Failed to get database metrics', {
                error: error instanceof Error ? error.message : String(error)
            }, 'MONITORING');
            return { size: 0, connections: 0 };
        }
    }

    private async getTemperature(): Promise<number | undefined> {
        if (!this.isRaspberryPi) return undefined;

        try {
            const tempPath = '/sys/class/thermal/thermal_zone0/temp';
            if (fs.existsSync(tempPath)) {
                const tempRaw = fs.readFileSync(tempPath, 'utf8').trim();
                return Math.round(parseInt(tempRaw) / 1000); // Convert to Celsius
            }
        } catch (error) {
            logger.debug('Failed to read temperature', {
                error: error instanceof Error ? error.message : String(error)
            }, 'MONITORING');
        }

        return undefined;
    }

    private async getDiskUsage(): Promise<{ used: number; total: number; percentage: number } | undefined> {
        try {
            const dataPath = process.env['DATABASE_PATH'] || './data';
            const dirPath = path.dirname(dataPath);

            if (fs.existsSync(dirPath)) {
                // This is a simplified implementation
                // In production, you'd want to use a library like 'statvfs' or execute 'df' command
                // For now, return mock data - in real implementation, use system calls
                return {
                    used: 0,
                    total: 0,
                    percentage: 0
                };
            }
        } catch (error) {
            logger.debug('Failed to get disk usage', {
                error: error instanceof Error ? error.message : String(error)
            }, 'MONITORING');
        }

        return undefined;
    }

    private checkAlerts(metrics: SystemMetrics): void {
        // Memory alert
        if (metrics.memory.percentage > this.alertThresholds.memory) {
            this.sendAlert('HIGH_MEMORY', `Memory usage: ${metrics.memory.percentage}%`, {
                used: metrics.memory.used,
                total: metrics.memory.total,
                percentage: metrics.memory.percentage
            });
        }

        // CPU alert
        if (metrics.cpu.percentage > this.alertThresholds.cpu) {
            this.sendAlert('HIGH_CPU', `CPU usage: ${metrics.cpu.percentage}%`, {
                percentage: metrics.cpu.percentage
            });
        }

        // Temperature alert (Raspberry Pi)
        if (metrics.temperature && metrics.temperature > this.alertThresholds.temperature) {
            this.sendAlert('HIGH_TEMPERATURE', `Temperature: ${metrics.temperature}°C`, {
                temperature: metrics.temperature,
                threshold: this.alertThresholds.temperature
            });
        }

        // Disk usage alert
        if (metrics.diskUsage && metrics.diskUsage.percentage > this.alertThresholds.diskUsage) {
            this.sendAlert('HIGH_DISK_USAGE', `Disk usage: ${metrics.diskUsage.percentage}%`, {
                used: metrics.diskUsage.used,
                total: metrics.diskUsage.total,
                percentage: metrics.diskUsage.percentage
            });
        }
    }

    private sendAlert(type: string, message: string, details: any): void {
        const now = Date.now();
        const lastAlert = this.lastAlerts.get(type) || 0;

        // Check cooldown period
        if (now - lastAlert < this.alertCooldown) {
            return;
        }

        this.lastAlerts.set(type, now);

        logger.warn(`ALERT: ${message}`, details, 'MONITORING');

        // In a production environment, you might want to:
        // - Send notifications via email, Slack, etc.
        // - Write to a separate alerts log file
        // - Trigger automated responses

        this.logAlert(type, message, details);
    }

    private logAlert(type: string, message: string, details: any): void {
        const alertEntry = {
            timestamp: new Date().toISOString(),
            type,
            message,
            details,
            severity: this.getAlertSeverity(type)
        };

        // Log to separate alerts file if in production
        if (process.env['NODE_ENV'] === 'production') {
            const alertsLogPath = path.join(process.env['LOGS_PATH'] || './logs', 'alerts.log');
            try {
                fs.appendFileSync(alertsLogPath, JSON.stringify(alertEntry) + '\n');
            } catch (error) {
                logger.error('Failed to write alert to file', {
                    error: error instanceof Error ? error.message : String(error)
                }, 'MONITORING');
            }
        }
    }

    private getAlertSeverity(type: string): 'low' | 'medium' | 'high' | 'critical' {
        switch (type) {
            case 'HIGH_TEMPERATURE':
                return 'critical';
            case 'HIGH_MEMORY':
            case 'HIGH_CPU':
                return 'high';
            case 'HIGH_DISK_USAGE':
                return 'medium';
            default:
                return 'low';
        }
    }

    public getMetricsHistory(): SystemMetrics[] {
        return [...this.metricsHistory];
    }

    public getLatestMetrics(): SystemMetrics | null {
        if (this.metricsHistory.length === 0) {
            return null;
        }
        const latest = this.metricsHistory[this.metricsHistory.length - 1];
        return latest || null;
    }

    public getAverageMetrics(minutes: number = 10): Partial<SystemMetrics> | null {
        const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
        const recentMetrics = this.metricsHistory.filter(
            m => new Date(m.timestamp) > cutoffTime
        );

        if (recentMetrics.length === 0) return null;

        const avgMemory = recentMetrics.reduce((sum, m) => sum + m.memory.percentage, 0) / recentMetrics.length;
        const avgCpu = recentMetrics.reduce((sum, m) => sum + m.cpu.percentage, 0) / recentMetrics.length;
        const avgTemp = recentMetrics
            .filter(m => m.temperature !== undefined)
            .reduce((sum, m) => sum + (m.temperature || 0), 0) / recentMetrics.length;

        const result: Partial<SystemMetrics> = {
            memory: {
                used: Math.round(recentMetrics.reduce((sum, m) => sum + m.memory.used, 0) / recentMetrics.length),
                total: Math.round(recentMetrics.reduce((sum, m) => sum + m.memory.total, 0) / recentMetrics.length),
                percentage: Math.round(avgMemory)
            },
            cpu: {
                percentage: Math.round(avgCpu)
            }
        };

        if (avgTemp > 0) {
            result.temperature = Math.round(avgTemp);
        }

        return result;
    }

    public startMonitoring(intervalMinutes: number = 5): void {
        const interval = intervalMinutes * 60 * 1000;

        logger.info(`Starting monitoring service (interval: ${intervalMinutes}m)`, {
            isRaspberryPi: this.isRaspberryPi,
            thresholds: this.alertThresholds
        }, 'MONITORING');

        // Collect initial metrics
        this.collectMetrics();

        // Set up periodic collection with reduced frequency for Pi
        setInterval(async () => {
            try {
                await this.collectMetrics();
            } catch (error) {
                logger.error('Failed to collect metrics', {
                    error: error instanceof Error ? error.message : String(error)
                }, 'MONITORING');
            }
        }, interval);

        // Log rotation for alerts and application logs
        if (process.env['NODE_ENV'] === 'production') {
            setInterval(() => {
                this.rotateAlertsLog();
                // Trigger application log rotation
                logger.rotateLogs();
            }, 24 * 60 * 60 * 1000); // Daily
        }
    }

    private rotateAlertsLog(): void {
        const alertsLogPath = path.join(process.env['LOGS_PATH'] || './logs', 'alerts.log');

        try {
            if (fs.existsSync(alertsLogPath)) {
                const stats = fs.statSync(alertsLogPath);
                const fileSizeMB = stats.size / (1024 * 1024);

                if (fileSizeMB > 5) { // Rotate if larger than 5MB
                    const rotatedPath = path.join(
                        path.dirname(alertsLogPath),
                        `alerts-${Date.now()}.log`
                    );
                    fs.renameSync(alertsLogPath, rotatedPath);
                    logger.info('Alerts log rotated', { oldFile: alertsLogPath, newFile: rotatedPath }, 'MONITORING');
                }
            }
        } catch (error) {
            logger.error('Failed to rotate alerts log', {
                error: error instanceof Error ? error.message : String(error)
            }, 'MONITORING');
        }
    }

    public getHealthStatus(): {
        status: 'healthy' | 'warning' | 'critical';
        checks: Array<{ name: string; status: 'pass' | 'warn' | 'fail'; message: string }>;
    } {
        const latest = this.getLatestMetrics();
        const checks: Array<{ name: string; status: 'pass' | 'warn' | 'fail'; message: string }> = [];

        if (!latest) {
            return {
                status: 'critical',
                checks: [{ name: 'metrics', status: 'fail', message: 'No metrics available' }]
            };
        }

        // Memory check
        if (latest.memory.percentage > this.alertThresholds.memory) {
            checks.push({
                name: 'memory',
                status: 'fail',
                message: `High memory usage: ${latest.memory.percentage}%`
            });
        } else if (latest.memory.percentage > this.alertThresholds.memory * 0.8) {
            checks.push({
                name: 'memory',
                status: 'warn',
                message: `Elevated memory usage: ${latest.memory.percentage}%`
            });
        } else {
            checks.push({
                name: 'memory',
                status: 'pass',
                message: `Memory usage normal: ${latest.memory.percentage}%`
            });
        }

        // CPU check
        if (latest.cpu.percentage > this.alertThresholds.cpu) {
            checks.push({
                name: 'cpu',
                status: 'fail',
                message: `High CPU usage: ${latest.cpu.percentage}%`
            });
        } else if (latest.cpu.percentage > this.alertThresholds.cpu * 0.8) {
            checks.push({
                name: 'cpu',
                status: 'warn',
                message: `Elevated CPU usage: ${latest.cpu.percentage}%`
            });
        } else {
            checks.push({
                name: 'cpu',
                status: 'pass',
                message: `CPU usage normal: ${latest.cpu.percentage}%`
            });
        }

        // Temperature check (if available)
        if (latest.temperature !== undefined) {
            if (latest.temperature > this.alertThresholds.temperature) {
                checks.push({
                    name: 'temperature',
                    status: 'fail',
                    message: `High temperature: ${latest.temperature}°C`
                });
            } else if (latest.temperature > this.alertThresholds.temperature * 0.9) {
                checks.push({
                    name: 'temperature',
                    status: 'warn',
                    message: `Elevated temperature: ${latest.temperature}°C`
                });
            } else {
                checks.push({
                    name: 'temperature',
                    status: 'pass',
                    message: `Temperature normal: ${latest.temperature}°C`
                });
            }
        }

        // Determine overall status
        const hasFailures = checks.some(c => c.status === 'fail');
        const hasWarnings = checks.some(c => c.status === 'warn');

        const status = hasFailures ? 'critical' : hasWarnings ? 'warning' : 'healthy';

        return { status, checks };
    }
}

// Export singleton instance
export const monitoring = MonitoringService.getInstance();