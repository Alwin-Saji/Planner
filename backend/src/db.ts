import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { AsyncLocalStorage } from 'async_hooks';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Async storage for user context
export const userDbStorage = new AsyncLocalStorage<string>();

const dbCache = new Map<string, any>();
const defaultDbPath = path.join(__dirname, '..', 'planner.db');
const defaultDb = new Database(defaultDbPath);
defaultDb.pragma('journal_mode = WAL');

export function getDbInstance(): any {
  const userId = userDbStorage.getStore();
  if (!userId) {
    return defaultDb;
  }

  if (dbCache.has(userId)) {
    return dbCache.get(userId);
  }

  // Safe filename
  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '');
  const userDbPath = path.join(__dirname, '..', `planner_${safeUserId}.db`);
  
  // Check if file exists to detect if it's a new user database
  const isNewUser = !fs.existsSync(userDbPath);

  const userDb = new Database(userDbPath);
  userDb.pragma('journal_mode = WAL');
  
  // Initialize database schema for user
  initDbSchema(userDb);

  dbCache.set(userId, userDb);

  if (isNewUser) {
    console.log(`[Db] Detected new user database for ${userId}. Triggering initial Mega storage folder setup...`);
    import('./services/megaBackup.js').then(({ queueStorageUpdate }) => {
      queueStorageUpdate(userId);
    }).catch(err => {
      console.error('[Db] Failed to trigger initial Mega storage update:', err);
    });
  }

  return userDb;
}

export const db = new Proxy({}, {
  get(target, prop) {
    const instance = getDbInstance();
    const val = Reflect.get(instance, prop);
    return typeof val === 'function' ? val.bind(instance) : val;
  }
}) as any;

export function initDb() {
  initDbSchema(defaultDb);
}

export function initDbSchema(targetDb: any) {
  targetDb.exec(`
    CREATE TABLE IF NOT EXISTS blocks (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'planned',
      recurrence_rule TEXT,
      notes_id TEXT,
      custom_link TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS resources (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      url_or_content TEXT NOT NULL,
      tags TEXT DEFAULT '[]',
      linked_block_id TEXT,
      summary TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS daily_logs (
      id TEXT PRIMARY KEY,
      date TEXT UNIQUE NOT NULL,
      planned_count INTEGER DEFAULT 0,
      completed_count INTEGER DEFAULT 0,
      adherence_pct REAL DEFAULT 0.0,
      notes_summary TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS embeddings (
      id TEXT PRIMARY KEY,
      resource_id TEXT NOT NULL,
      chunk_text TEXT NOT NULL,
      vector TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_embeddings_resource_id ON embeddings (resource_id);

    CREATE TABLE IF NOT EXISTS rag_conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      scope TEXT DEFAULT 'everything',
      model TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rag_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      sender TEXT NOT NULL,
      text TEXT NOT NULL,
      sources TEXT,
      timestamp TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES rag_conversations (id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS gcal_tokens (
      id TEXT PRIMARY KEY,
      tokens_json TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  try {
    targetDb.exec(`ALTER TABLE blocks ADD COLUMN custom_link TEXT;`);
  } catch (e) {}

  try {
    targetDb.exec(`ALTER TABLE blocks ADD COLUMN calendar_sync_enabled INTEGER DEFAULT 1;`);
  } catch (e) {}

  try {
    targetDb.exec(`ALTER TABLE blocks ADD COLUMN gcal_event_id TEXT;`);
  } catch (e) {}

  try {
    targetDb.exec(`ALTER TABLE resources ADD COLUMN summary TEXT;`);
  } catch (e) {}

  // Auto-repair any existing blocks that have NULL IDs from prior AI study plan generation
  try {
    const nullBlocks = targetDb.prepare('SELECT rowid, date FROM blocks WHERE id IS NULL').all() as Array<{ rowid: number; date: string }>;
    if (nullBlocks.length > 0) {
      const updateStmt = targetDb.prepare('UPDATE blocks SET id = ? WHERE rowid = ?');
      nullBlocks.forEach((b, idx) => {
        const newId = `block-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`;
        updateStmt.run(newId, b.rowid);
      });
      console.log(`Auto-repaired ${nullBlocks.length} blocks with missing IDs in database.`);
    }
  } catch (err) {
    console.warn('Failed to repair null block IDs:', err);
  }

  seedInitialData(targetDb);
}

function seedInitialData(targetDb: any) {
  const blockCount = targetDb.prepare('SELECT COUNT(*) as count FROM blocks').get() as { count: number };
  
  if (blockCount.count === 0) {
    const today = new Date().toISOString().split('T')[0];
    
    // Generate dates for past 7 days and next 3 days
    const dates: string[] = [];
    for (let i = -7; i <= 3; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }

    const insertBlock = targetDb.prepare(`
      INSERT INTO blocks (id, date, start_time, end_time, title, category, status, recurrence_rule, notes_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertResource = targetDb.prepare(`
      INSERT INTO resources (id, type, title, url_or_content, tags, linked_block_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertLog = targetDb.prepare(`
      INSERT INTO daily_logs (id, date, planned_count, completed_count, adherence_pct)
      VALUES (?, ?, ?, ?, ?)
    `);

    // Sample resources
    const r1Id = 'res-dsa-1';
    const r2Id = 'res-ml-1';
    const r3Id = 'res-fastapi-1';

    insertResource.run(
      r1Id,
      'note',
      'DSA: Backpropagation & Graph Algorithms Notes',
      '# Backpropagation & Graph Algorithms\n\n## Key Concepts\n- Gradient descent update rule: `w = w - lr * grad`\n- Chain rule application across multi-layer neural networks.\n- Topological Sort & Dijkstra algorithm for weighted graph shortest paths.\n\n## Retrospective\nMastered time complexity O(V + E) for BFS/DFS. Practiced 3 LeetCode Hard problems on Dynamic Programming on Trees.',
      JSON.stringify(['dsa', 'ml', 'algorithms']),
      null
    );

    insertResource.run(
      r2Id,
      'youtube',
      'CampusX FastAPI Tutorial & Microservices',
      'https://www.youtube.com/watch?v=7t2alSnE2-I',
      JSON.stringify(['fastapi', 'backend', 'python']),
      null
    );

    insertResource.run(
      r3Id,
      'note',
      'System Design: Rate Limiting & Sliding Window',
      '# Rate Limiter Architectures\n\n- Token Bucket: simple counter with continuous refills\n- Sliding Window Log: store timestamps in Redis ZSET\n- Leaky Bucket: queue based constant output rate',
      JSON.stringify(['system-design', 'backend']),
      null
    );

    // Seed blocks and daily logs across the dates
    let blockIdCounter = 1;

    dates.forEach((dateStr, idx) => {
      const isPast = idx < 7;
      const isToday = idx === 7;

      // Seed 4-5 blocks per day
      const b1Status = isPast ? (Math.random() > 0.3 ? 'done' : 'skipped') : 'planned';
      const b2Status = isPast ? (Math.random() > 0.2 ? 'done' : 'skipped') : 'planned';
      const b3Status = isPast ? (Math.random() > 0.4 ? 'done' : 'skipped') : 'planned';
      const b4Status = isPast ? 'done' : 'planned';

      const id1 = `block-${blockIdCounter++}`;
      const id2 = `block-${blockIdCounter++}`;
      const id3 = `block-${blockIdCounter++}`;
      const id4 = `block-${blockIdCounter++}`;

      insertBlock.run(id1, dateStr, '08:00', '09:30', 'DSA Practice: LeetCode & Trees', 'DSA', b1Status, 'daily', r1Id);
      insertBlock.run(id2, dateStr, '10:00', '12:00', 'Deep Learning & Backprop Review', 'ML', b2Status, 'mon,wed,fri', null);
      insertBlock.run(id3, dateStr, '14:00', '16:00', 'CampusX FastAPI & Microservices', 'Backend', b3Status, null, r2Id);
      insertBlock.run(id4, dateStr, '17:00', '18:30', 'System Design & Code Review', 'Work', b4Status, 'daily', r3Id);

      // Compute daily log
      const allStatuses = [b1Status, b2Status, b3Status, b4Status];
      const doneCount = allStatuses.filter(s => s === 'done').length;
      const plannedCount = allStatuses.length;
      const pct = Math.round((doneCount / plannedCount) * 100);

      insertLog.run(`log-${dateStr}`, dateStr, plannedCount, doneCount, pct);
    });
  }
}
