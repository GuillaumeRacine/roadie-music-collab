import { promises as fs } from 'fs';
import path from 'path';

export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  action: 'rename' | 'move' | 'analyze' | 'upload' | 'delete' | 'organize' | 'restore' | 'create_folder';
  filePath: string;
  oldPath?: string;
  newPath?: string;
  details: {
    originalName?: string;
    newName?: string;
    category?: string;
    dateSource?: string;
    detectedDate?: string;
    folderCreated?: string;
    analysisResults?: any;
    fileSize?: number;
    duration?: number;
  };
  metadata?: {
    userId?: string;
    userAgent?: string;
    ip?: string;
  };
}

class ActivityLogger {
  private logFilePath: string;

  constructor() {
    // Store logs in a local file for now
    this.logFilePath = path.join(process.cwd(), 'activity-log.json');
  }

  async logActivity(entry: Omit<ActivityLogEntry, 'id' | 'timestamp'>): Promise<void> {
    try {
      const fullEntry: ActivityLogEntry = {
        ...entry,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString()
      };

      // Read existing logs
      let logs: ActivityLogEntry[] = [];
      try {
        const data = await fs.readFile(this.logFilePath, 'utf8');
        logs = JSON.parse(data);
      } catch (error) {
        // File doesn't exist yet, start with empty array
        logs = [];
      }

      // Add new entry
      logs.push(fullEntry);

      // Keep only last 1000 entries to prevent file from growing too large
      if (logs.length > 1000) {
        logs = logs.slice(-1000);
      }

      // Write back to file
      await fs.writeFile(this.logFilePath, JSON.stringify(logs, null, 2));

      console.log(`Activity logged: ${entry.action} - ${entry.filePath}`);
    } catch (error) {
      console.error('Failed to log activity:', error);
    }
  }

  async getActivities(limit: number = 100, offset: number = 0): Promise<ActivityLogEntry[]> {
    try {
      const data = await fs.readFile(this.logFilePath, 'utf8');
      const logs: ActivityLogEntry[] = JSON.parse(data);

      // Return most recent first
      return logs
        .reverse()
        .slice(offset, offset + limit);
    } catch (error) {
      console.error('Failed to read activity log:', error);
      return [];
    }
  }

  async getActivitiesForFile(filePath: string): Promise<ActivityLogEntry[]> {
    try {
      const data = await fs.readFile(this.logFilePath, 'utf8');
      const logs: ActivityLogEntry[] = JSON.parse(data);

      return logs
        .filter(log =>
          log.filePath === filePath ||
          log.oldPath === filePath ||
          log.newPath === filePath
        )
        .reverse();
    } catch (error) {
      console.error('Failed to read activity log:', error);
      return [];
    }
  }

  async getActivitiesByDateRange(startDate: string, endDate: string): Promise<ActivityLogEntry[]> {
    try {
      const data = await fs.readFile(this.logFilePath, 'utf8');
      const logs: ActivityLogEntry[] = JSON.parse(data);

      return logs
        .filter(log => log.timestamp >= startDate && log.timestamp <= endDate)
        .reverse();
    } catch (error) {
      console.error('Failed to read activity log:', error);
      return [];
    }
  }

  async clearOldLogs(daysToKeep: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      const cutoffIso = cutoffDate.toISOString();

      const data = await fs.readFile(this.logFilePath, 'utf8');
      const logs: ActivityLogEntry[] = JSON.parse(data);

      const filteredLogs = logs.filter(log => log.timestamp >= cutoffIso);

      await fs.writeFile(this.logFilePath, JSON.stringify(filteredLogs, null, 2));

      console.log(`Cleaned up activity log, kept ${filteredLogs.length} entries`);
    } catch (error) {
      console.error('Failed to clean up activity log:', error);
    }
  }
}

export const activityLogger = new ActivityLogger();