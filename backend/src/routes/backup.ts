import { Router } from 'express';
import { getBackupStatus, performBackup, restoreFromMega } from '../services/megaBackup.js';
import { userDbStorage } from '../db.js';

export const backupRouter = Router();

// GET /api/backup/status - Get current backup status
backupRouter.get('/status', (req, res) => {
  const status = getBackupStatus();
  res.json(status);
});

// POST /api/backup/trigger - Manually trigger cloud backup to Mega.io
backupRouter.post('/trigger', async (req, res) => {
  const result = await performBackup();
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

// POST /api/backup/restore - Manually restore user database from Mega.io
backupRouter.post('/restore', async (req, res) => {
  const userId = userDbStorage.getStore();
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Must be logged in to restore database.' });
  }

  const restored = await restoreFromMega(userId);
  if (restored) {
    res.json({ success: true, message: 'Database successfully restored from MEGA backup!' });
  } else {
    res.status(404).json({ success: false, message: 'No backup found in MEGA for this account.' });
  }
});
