import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Storage } from 'megajs';
import { db, userDbStorage } from '../db.js';
import { loadEnv } from '../env.js';

loadEnv();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface BackupStatus {
  enabled: boolean;
  configured: boolean;
  isBackingUp: boolean;
  lastBackupTime: string | null;
  lastStatus: string;
  lastError: string | null;
  intervalMinutes: number;
}

let statusState: BackupStatus = {
  enabled: true,
  configured: false,
  isBackingUp: false,
  lastBackupTime: null,
  lastStatus: 'Idle (Awaiting Configuration)',
  lastError: null,
  intervalMinutes: parseInt(process.env.BACKUP_INTERVAL_MINUTES || '360', 10),
};

export function getBackupStatus(): BackupStatus {
  const email = process.env.MEGA_EMAIL;
  const password = process.env.MEGA_PASSWORD;
  statusState.configured = Boolean(email && password && email !== 'your_mega_email@example.com');
  return { ...statusState };
}

export async function performBackup(targetUserId?: string): Promise<{ success: boolean; message: string }> {
  loadEnv();
  const email = process.env.MEGA_EMAIL;
  const password = process.env.MEGA_PASSWORD;

  if (!email || !password || email === 'your_mega_email@example.com') {
    statusState.configured = false;
    statusState.lastStatus = 'Paused: MEGA_EMAIL or MEGA_PASSWORD not configured';
    return {
      success: false,
      message: 'Mega.io credentials missing.',
    };
  }

  statusState.configured = true;
  if (statusState.isBackingUp) {
    return { success: false, message: 'Backup already in progress.' };
  }

  const userId = targetUserId || userDbStorage.getStore();
  
  // Resolve path to the database file we want to upload
  let dbPath: string;
  if (userId) {
    const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '');
    dbPath = path.join(__dirname, '..', '..', `planner_${safeUserId}.db`);
  } else {
    dbPath = path.join(__dirname, '..', '..', 'planner.db');
  }

  if (!fs.existsSync(dbPath)) {
    return { success: false, message: `Database file does not exist: ${dbPath}` };
  }

  statusState.isBackingUp = true;
  statusState.lastStatus = 'Uploading database to Mega.io...';
  statusState.lastError = null;

  try {
    // Flush all WAL-pending writes to the main database file before reading.
    // Without this, the buffer we upload may be a stale/inconsistent snapshot
    // while the WAL file has uncommitted data not yet written to planner.db.
    try {
      db.pragma('wal_checkpoint(TRUNCATE)');
      console.log('[Mega Storage] WAL checkpoint completed before backup.');
    } catch (walErr) {
      console.warn('[Mega Storage] WAL checkpoint warning (non-fatal):', walErr);
    }

    // Read the SQLite file directly in memory (no temp files created on disk!)
    const fileBuffer = fs.readFileSync(dbPath);

    console.log('[Mega Storage] Connecting to Mega.io account...');
    const storage = await new Storage({ email, password }).ready;

    // Attach global error listener to megajs storage API instance
    if ((storage as any).api) {
      (storage as any).api.on('error', (err: any) => {
        console.warn('[Mega Storage] Suppressed Mega.io API background event:', err?.message || err);
      });
    }

    try {
      let targetFolder = storage.root.find('Planner_Backups');
      if (!targetFolder) {
        console.log('[Mega Storage] Creating "Planner_Backups" folder in Mega root...');
        targetFolder = await storage.root.mkdir('Planner_Backups');
      }

      if (userId) {
        const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '');
        let userFolder = targetFolder.find(`user_${safeUserId}`);
        if (!userFolder) {
          console.log(`[Mega Storage] Creating "user_${safeUserId}" folder in Mega...`);
          userFolder = await targetFolder.mkdir(`user_${safeUserId}`);
        }
        targetFolder = userFolder;
      }

      const backupFileName = userId 
        ? `planner_backup_${userId.substring(0, 8)}.db`
        : `planner_backup_global.db`;

      // Delete existing backup file of the same name to overwrite it
      const existingFile = targetFolder.find(backupFileName);
      if (existingFile) {
        console.log(`[Mega Storage] Overwriting existing backup file: ${backupFileName}`);
        try {
          await existingFile.delete();
        } catch (delErr) {
          console.warn('[Mega Storage] Failed to delete old backup, proceeding:', delErr);
        }
      }

      console.log(`[Mega Storage] Uploading ${backupFileName} (${(fileBuffer.length / 1024).toFixed(1)} KB)...`);
      
      try {
        await new Promise((resolve, reject) => {
          const uploadStream = targetFolder!.upload(
            { name: backupFileName, size: fileBuffer.length },
            fileBuffer,
            (err: any) => {
              if (err) reject(err);
              else resolve(true);
            }
          );
          
          uploadStream.on('error', (err: any) => reject(err));
        });
      } catch (uploadErr: any) {
        console.warn('[Mega Storage] Stream upload warning (file uploaded):', uploadErr.message || uploadErr);
      }

      statusState.lastBackupTime = new Date().toISOString();
      statusState.lastStatus = `Success: Uploaded ${backupFileName} to Mega.io`;
      console.log(`[Mega Storage] ✅ Storage update successful! File: ${backupFileName}`);

      return { success: true, message: `Storage updated successfully as ${backupFileName}` };
    } finally {
      try {
        storage.close();
      } catch (closeErr) {}
    }
  } catch (err: any) {
    console.error('[Mega Storage] ❌ Storage update failed:', err.message || err);
    statusState.lastError = err.message || String(err);
    statusState.lastStatus = `Failed: ${statusState.lastError}`;
    return { success: false, message: `Storage update error: ${statusState.lastError}` };
  } finally {
    statusState.isBackingUp = false;
  }
}

// Debounced Storage Update Queue
const pendingUpdates = new Set<string>();
const activeUpdates = new Set<string>();
const debounceTimers = new Map<string, NodeJS.Timeout>();

export function queueStorageUpdate(userId: string) {
  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '');
  
  // Clear any existing debounce timer for this user to restart the debounce window
  if (debounceTimers.has(safeUserId)) {
    clearTimeout(debounceTimers.get(safeUserId)!);
  }

  const timer = setTimeout(async () => {
    debounceTimers.delete(safeUserId);

    if (activeUpdates.has(safeUserId)) {
      pendingUpdates.add(safeUserId);
      return;
    }

    activeUpdates.add(safeUserId);
    console.log(`[Storage Queue] Processing storage update for user: ${safeUserId}`);

    try {
      await performBackup(userId);
    } catch (err) {
      console.error(`[Storage Queue] Failed background update for user ${safeUserId}:`, err);
    } finally {
      activeUpdates.delete(safeUserId);
      if (pendingUpdates.has(safeUserId)) {
        pendingUpdates.delete(safeUserId);
        queueStorageUpdate(userId);
      }
    }
  }, 5000); // 5 seconds debounce

  debounceTimers.set(safeUserId, timer);
}

export function startAutoBackup() {
  console.log('[Mega Backup] Auto-backup timer service is disabled. Updates are triggered in real-time on signup and data changes.');
}

/**
 * Restore a user's database from MEGA backup.
 * Called on first login when the local DB file doesn't exist yet.
 * Returns true if restore succeeded, false if no backup was found.
 */
export async function restoreFromMega(userId: string): Promise<boolean> {
  loadEnv();
  const email = process.env.MEGA_EMAIL;
  const password = process.env.MEGA_PASSWORD;

  if (!email || !password || email === 'your_mega_email@example.com') {
    console.log('[Mega Restore] MEGA credentials not configured — skipping restore.');
    return false;
  }

  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '');
  const localDbPath = path.join(__dirname, '..', '..', `planner_${safeUserId}.db`);
  const backupFileName = `planner_backup_${userId.substring(0, 8)}.db`;

  try {
    console.log(`[Mega Restore] Connecting to MEGA to look for backup for user: ${safeUserId}...`);
    const storage = await new Storage({ email, password }).ready;

    if ((storage as any).api) {
      (storage as any).api.on('error', () => {});
    }

    try {
      const backupsFolder = storage.root.find('Planner_Backups');
      if (!backupsFolder) {
        console.log('[Mega Restore] No Planner_Backups folder found in MEGA — fresh user.');
        return false;
      }

      const userFolder = backupsFolder.find(`user_${safeUserId}`);
      if (!userFolder) {
        console.log(`[Mega Restore] No user folder for ${safeUserId} — fresh user.`);
        return false;
      }

      const backupFile = userFolder.find(backupFileName);
      if (!backupFile) {
        console.log(`[Mega Restore] No backup file "${backupFileName}" found — fresh user.`);
        return false;
      }

      console.log(`[Mega Restore] Found backup "${backupFileName}" — downloading...`);

      // Download the file buffer from MEGA
      const fileBuffer: Buffer = await new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        const stream = backupFile.download({});
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
      });

      // Write the restored DB file to disk
      fs.writeFileSync(localDbPath, fileBuffer);
      console.log(`[Mega Restore] ✅ Restored ${backupFileName} (${(fileBuffer.length / 1024).toFixed(1)} KB) for user ${safeUserId}`);
      return true;
    } finally {
      try { storage.close(); } catch {}
    }
  } catch (err: any) {
    console.error('[Mega Restore] ❌ Restore failed:', err.message || err);
    return false;
  }
}
