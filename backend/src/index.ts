import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initDb, userDbStorage, getDbInstance } from './db.js';
import { blocksRouter } from './routes/blocks.js';
import { resourcesRouter } from './routes/resources.js';
import { logsRouter } from './routes/logs.js';
import { aiRouter } from './routes/ai.js';
import { reviewRouter } from './routes/review.js';
import { backupRouter } from './routes/backup.js';
import { advisorRouter } from './routes/advisor.js';
import { uploadRouter } from './routes/upload.js';
import { calendarRouter } from './routes/calendar.js';
import { learningRouter } from './routes/learning.js';
import { startAutoBackup, queueStorageUpdate, restoreFromMega } from './services/megaBackup.js';
import { ollamaUrlStorage } from './services/ollama.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Track restored user DBs in memory to avoid repeated restore attempts per session
const restoredUsers = new Set<string>();

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());

// Supabase Auth Context Middleware (extracts userId from JWT and sets AsyncLocalStorage context)
app.use((req, res, next) => {
  const customOllamaUrl = (req.headers['x-ollama-url'] as string) || '';

  ollamaUrlStorage.run(customOllamaUrl, async () => {
    const authHeader = req.headers.authorization;
    let userId: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          // Decode JWT payload
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
          userId = payload.sub || null;
        }
      } catch (e) {
        console.warn('[Auth] Failed to decode Supabase JWT:', e);
      }
    }

    if (userId) {
      const activeUserId = userId;
      const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '');
      const userDbPath = path.join(__dirname, '..', `planner_${safeUserId}.db`);

      // Restore DB from MEGA on first request if local file doesn't exist yet
      if (!fs.existsSync(userDbPath) && !restoredUsers.has(safeUserId)) {
        restoredUsers.add(safeUserId);
        try {
          console.log(`[Auth Sync] New user session detected for ${safeUserId}. Attempting restore from MEGA...`);
          await restoreFromMega(userId);
        } catch (err) {
          console.error(`[Auth Sync] Restore check failed for ${safeUserId}:`, err);
        }
      }

      res.on('finish', () => {
        if (['POST', 'PUT', 'DELETE'].includes(req.method) && res.statusCode >= 200 && res.statusCode < 300) {
          queueStorageUpdate(activeUserId);
        }
      });

      userDbStorage.run(userId, () => {
        next();
      });
    } else {
      next();
    }
  });
});

import { seedCuratedCourses } from './services/curatedCoursesSeed.js';

// Initialize SQLite schema and seed data
initDb();
seedCuratedCourses();

// Initialize Mega automatic backup background service
startAutoBackup();

// Register API Routes
app.use('/api/blocks', blocksRouter);
app.use('/api/resources', resourcesRouter);
app.use('/api/logs', logsRouter);
app.use('/api/ai', aiRouter);
app.use('/api/review', reviewRouter);
app.use('/api/backup', backupRouter);
app.use('/api/advisor', advisorRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/calendar', calendarRouter);
app.use('/api/learning', learningRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// TEMPORARY DEBUG: Shows resources in ALL databases.
// GET /api/debug/resources  — remove after confirming everything is correct.
// ---------------------------------------------------------------------------
app.get('/api/debug/resources', (req, res) => {
  try {
    const results: Record<string, any[]> = {};
    const backendDir = path.join(__dirname, '..');

    // Default DB (unauthenticated uploads go here)
    const defaultDb = new (Database as any)(path.join(backendDir, 'planner.db'), { readonly: true });
    results['planner.db (default/unauthenticated)'] = defaultDb.prepare(
      "SELECT id, type, title, tags, created_at FROM resources ORDER BY created_at DESC"
    ).all();
    defaultDb.close();

    // All per-user DBs
    const userDbs = fs.readdirSync(backendDir).filter(
      (f: string) => f.startsWith('planner_') && f.endsWith('.db') && !f.includes('backup')
    );
    for (const dbFile of userDbs) {
      try {
        const userDb = new (Database as any)(path.join(backendDir, dbFile), { readonly: true });
        results[`${dbFile} (user-specific)`] = userDb.prepare(
          "SELECT id, type, title, tags, created_at FROM resources ORDER BY created_at DESC"
        ).all();
        userDb.close();
      } catch {
        results[dbFile] = [{ error: 'Could not open (may be locked by active session)' }];
      }
    }

    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/debug/migrate-to-user
// Moves non-seed resources from planner.db (default) → planner_<userId>.db.
// Uses the existing cached DB connections to avoid write-lock conflicts.
// Safe to call on every login — returns moved:0 when nothing needs migrating.
// ---------------------------------------------------------------------------
app.post('/api/debug/migrate-to-user', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Auth token required.' });
    }

    const token = authHeader.split(' ')[1];
    const parts = token.split('.');
    if (parts.length !== 3) return res.status(401).json({ error: 'Invalid JWT format' });

    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
    const userId = payload.sub as string;
    if (!userId) return res.status(401).json({ error: 'No sub in JWT payload' });

    const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '');
    const backendDir = path.join(__dirname, '..');
    const userDbPath = path.join(backendDir, `planner_${safeUserId}.db`);

    // Force defaultDb connection by running outside userDbStorage context
    const defaultDb = userDbStorage.run(undefined as any, () => getDbInstance());
    // Move ALL resources — seeds included — since everything is now user-specific
    const resourcesToMove: any[] = defaultDb.prepare(
      'SELECT * FROM resources ORDER BY created_at ASC'
    ).all();


    if (resourcesToMove.length === 0) {
      return res.json({ success: true, moved: 0, message: 'Nothing to migrate.' });
    }

    // Use the existing cached user DB connection
    const userDb = userDbStorage.run(userId, () => getDbInstance());

    const insertStmt = userDb.prepare(`
      INSERT OR IGNORE INTO resources (id, type, title, url_or_content, tags, linked_block_id, summary, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertMany = userDb.transaction((rows: any[]) => {
      for (const r of rows) {
        const safeId = r.id || `res-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        insertStmt.run(safeId, r.type || 'file', r.title || 'Untitled', r.url_or_content || '', r.tags || '[]', r.linked_block_id || null, r.summary || null, r.created_at || new Date().toISOString());
      }
    });
    insertMany(resourcesToMove);

    // Remove from default DB so they don't appear as duplicates
    const deleteStmt = defaultDb.prepare('DELETE FROM resources WHERE id = ? OR id IS NULL');
    const deleteMany = defaultDb.transaction((rows: any[]) => {
      for (const r of rows) {
        if (r.id) deleteStmt.run(r.id);
      }
      // Also delete any orphan rows where id IS NULL
      defaultDb.prepare('DELETE FROM resources WHERE id IS NULL').run();
    });
    deleteMany(resourcesToMove);


    console.log(`[Migrate] Moved ${resourcesToMove.length} resource(s) to planner_${safeUserId}.db`);
    res.json({
      success: true,
      moved: resourcesToMove.length,
      resources: resourcesToMove.map(r => ({ id: r.id, title: r.title, type: r.type })),
      message: `Migrated ${resourcesToMove.length} resource(s) from planner.db → planner_${safeUserId}.db`,
    });
  } catch (err: any) {
    console.error('[Migrate] Error:', err);
    res.status(500).json({ error: err.message });
  }
});



const server = app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Planner REST API Backend running on http://127.0.0.1:${PORT}`);
});

server.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`[Backend Warning] Port ${PORT} is already bound by an active Planner Backend process.`);
  } else {
    console.error('Server error:', err);
  }
});
