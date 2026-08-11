import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { syncBlockToGoogleCalendar, deleteGoogleCalendarEvent } from '../services/gcalService.js';

export const blocksRouter = Router();

// Helper to update daily_logs when block status changes
function updateDailyLogForDate(dateStr: string) {
  const blocks = db.prepare('SELECT status FROM blocks WHERE date = ?').all(dateStr) as Array<{ status: string }>;
  const total = blocks.length;
  const done = blocks.filter(b => b.status === 'done').length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const existing = db.prepare('SELECT id FROM daily_logs WHERE date = ?').get(dateStr);
  if (existing) {
    db.prepare(`
      UPDATE daily_logs 
      SET planned_count = ?, completed_count = ?, adherence_pct = ?, updated_at = CURRENT_TIMESTAMP
      WHERE date = ?
    `).run(total, done, pct, dateStr);
  } else {
    db.prepare(`
      INSERT INTO daily_logs (id, date, planned_count, completed_count, adherence_pct)
      VALUES (?, ?, ?, ?, ?)
    `).run(`log-${dateStr}`, dateStr, total, done, pct);
  }
}

// ---------------------------------------------------------------------------
// Auto-skip debounce gate — only run the write transaction at most once per 5 minutes
// to avoid spamming SQLite on rapid/burst GET /api/blocks requests.
// ---------------------------------------------------------------------------
let _lastAutoSkipTime = 0;
const AUTO_SKIP_DEBOUNCE_MS = 5 * 60 * 1000; // 5 minutes

// GET /api/blocks
blocksRouter.get('/', (req: Request, res: Response) => {
  const { date, startDate, endDate } = req.query;

  // Auto-mark past planned blocks as skipped — debounced to at most once per 5 minutes
  const now = Date.now();
  if (now - _lastAutoSkipTime > AUTO_SKIP_DEBOUNCE_MS) {
    try {
      const nowDate = new Date();
      const yyyy = nowDate.getFullYear();
      const mm = String(nowDate.getMonth() + 1).padStart(2, '0');
      const dd = String(nowDate.getDate()).padStart(2, '0');
      const todayStr = `${yyyy}-${mm}-${dd}`;
      const timeStr = String(nowDate.getHours()).padStart(2, '0') + ':' + String(nowDate.getMinutes()).padStart(2, '0');

      const toUpdate = db.prepare(`
        SELECT id, date FROM blocks 
        WHERE status = 'planned' 
          AND (date < ? OR (date = ? AND end_time < ?))
      `).all(todayStr, todayStr, timeStr) as Array<{ id: string; date: string }>;

      if (toUpdate.length > 0) {
        const updateStmt = db.prepare("UPDATE blocks SET status = 'skipped' WHERE id = ?");
        const updateTransaction = db.transaction((items: Array<{ id: string }>) => {
          for (const item of items) {
            updateStmt.run(item.id);
          }
        });
        updateTransaction(toUpdate);

        // Recalculate daily logs for only the unique affected dates — one pass each
        const uniqueDates = Array.from(new Set(toUpdate.map(x => x.date)));
        for (const d of uniqueDates) {
          updateDailyLogForDate(d);
        }
      }

      _lastAutoSkipTime = now;
    } catch (err) {
      console.error('Error auto-skipping past blocks:', err);
    }
  }

  let query = 'SELECT * FROM blocks';
  const params: any[] = [];

  if (date) {
    query += ' WHERE date = ?';
    params.push(date);
  } else if (startDate && endDate) {
    query += ' WHERE date >= ? AND date <= ?';
    params.push(startDate, endDate);
  }

  query += ' ORDER BY date ASC, start_time ASC';
  const blocks = db.prepare(query).all(...params);
  res.json(blocks);
});

// POST /api/blocks
blocksRouter.post('/', (req: Request, res: Response) => {
  const { date, start_time, end_time, title, category, status, recurrence_rule, notes_id, custom_link, calendar_sync_enabled } = req.body;

  if (!date || !start_time || !end_time || !title) {
    return res.status(400).json({ error: 'Missing required block fields' });
  }

  const id = `block-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const blockStatus = status || 'planned';
  const syncEnabled = calendar_sync_enabled !== undefined ? (calendar_sync_enabled ? 1 : 0) : 1;

  db.prepare(`
    INSERT INTO blocks (id, date, start_time, end_time, title, category, status, recurrence_rule, notes_id, custom_link, calendar_sync_enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, date, start_time, end_time, title, category || 'General', blockStatus, recurrence_rule || null, notes_id || null, custom_link || null, syncEnabled);

  updateDailyLogForDate(date);

  const created = db.prepare('SELECT * FROM blocks WHERE id = ?').get(id) as any;
  if (created) {
    syncBlockToGoogleCalendar(created).catch(err => console.error('[GCal Sync Error]:', err));
  }
  res.status(201).json(created);
});

// PUT /api/blocks/:id
blocksRouter.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM blocks WHERE id = ?').get(id) as any;

  if (!existing) {
    return res.status(404).json({ error: 'Block not found' });
  }

  const date = req.body.date ?? existing.date;
  const start_time = req.body.start_time ?? existing.start_time;
  const end_time = req.body.end_time ?? existing.end_time;
  const title = req.body.title ?? existing.title;
  const category = req.body.category ?? existing.category;
  const status = req.body.status ?? existing.status;
  const recurrence_rule = req.body.recurrence_rule !== undefined ? req.body.recurrence_rule : existing.recurrence_rule;
  const notes_id = req.body.notes_id !== undefined ? req.body.notes_id : existing.notes_id;
  const custom_link = req.body.custom_link !== undefined ? req.body.custom_link : existing.custom_link;
  const calendar_sync_enabled = req.body.calendar_sync_enabled !== undefined ? (req.body.calendar_sync_enabled ? 1 : 0) : (existing.calendar_sync_enabled ?? 1);

  db.prepare(`
    UPDATE blocks
    SET date = ?, start_time = ?, end_time = ?, title = ?, category = ?, status = ?, recurrence_rule = ?, notes_id = ?, custom_link = ?, calendar_sync_enabled = ?
    WHERE id = ?
  `).run(date, start_time, end_time, title, category, status, recurrence_rule, notes_id, custom_link, calendar_sync_enabled, id);

  updateDailyLogForDate(date);
  if (existing.date !== date) {
    updateDailyLogForDate(existing.date);
  }

  const updated = db.prepare('SELECT * FROM blocks WHERE id = ?').get(id) as any;
  if (updated) {
    syncBlockToGoogleCalendar(updated).catch(err => console.error('[GCal Sync Error]:', err));
  }
  res.json(updated);
});

// DELETE /api/blocks/:id
blocksRouter.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT date, gcal_event_id FROM blocks WHERE id = ?').get(id) as any;

  if (!existing) {
    return res.status(404).json({ error: 'Block not found' });
  }

  if (existing.gcal_event_id) {
    deleteGoogleCalendarEvent(existing.gcal_event_id).catch(err => console.error('[GCal Delete Error]:', err));
  }

  db.prepare('DELETE FROM blocks WHERE id = ?').run(id);
  updateDailyLogForDate(existing.date);

  res.json({ success: true, id });
});

// POST /api/blocks/auto-breaks
blocksRouter.post('/auto-breaks', (req: Request, res: Response) => {
  const { date } = req.body;
  if (!date) {
    return res.status(400).json({ error: 'Missing date parameter' });
  }

  const blocks = db.prepare('SELECT * FROM blocks WHERE date = ? ORDER BY start_time ASC').all(date) as any[];

  if (blocks.length <= 1) {
    return res.json({ message: 'No breaks needed or insufficient blocks.', count: 0 });
  }

  // Check historical adherence to dynamically adjust break duration
  const pastBlocks = db.prepare('SELECT status FROM blocks WHERE date < ? ORDER BY date DESC LIMIT 30').all(date) as any[];
  const donePast = pastBlocks.filter((b: any) => b.status === 'done').length;
  const pastAdherence = pastBlocks.length > 0 ? donePast / pastBlocks.length : 0.8;

  const parseMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const formatMinutes = (m: number) => {
    const h = Math.floor(m / 60) % 24;
    const min = m % 60;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  };

  const newBlocks: any[] = [];
  let shiftOffset = 0;
  let breaksInserted = 0;

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    let startM = parseMinutes(b.start_time) + shiftOffset;
    let endM = parseMinutes(b.end_time) + shiftOffset;

    if (newBlocks.length > 0) {
      const prev = newBlocks[newBlocks.length - 1];
      const prevStartM = parseMinutes(prev.start_time);
      const prevEndM = parseMinutes(prev.end_time);
      const prevDuration = prevEndM - prevStartM;

      // If back-to-back or overlapping, and neither is Rest
      if (startM <= prevEndM && prev.category !== 'Rest' && b.category !== 'Rest') {
        const breakStart = prevEndM;

        // Dynamically compute break duration: 15 to 30 mins based on prior session duration & past adherence
        let dynamicBreakMins = 15;
        if (prevDuration >= 120 || pastAdherence < 0.5) {
          dynamicBreakMins = 30;
        } else if (prevDuration >= 90 || pastAdherence < 0.7) {
          dynamicBreakMins = 20;
        }

        const breakEnd = breakStart + dynamicBreakMins;
        const breakId = `block-${Date.now()}-break-${Math.random().toString(36).substring(2, 6)}`;
        const title = dynamicBreakMins >= 25 ? `🛋️ ${dynamicBreakMins}-Min Deep Rest & Recharge` : `☕ ${dynamicBreakMins}-Min Rest Break`;

        db.prepare(`
          INSERT INTO blocks (id, date, start_time, end_time, title, category, status)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(breakId, date, formatMinutes(breakStart), formatMinutes(breakEnd), title, 'Rest', 'planned');

        breaksInserted++;

        newBlocks.push({
          id: breakId,
          start_time: formatMinutes(breakStart),
          end_time: formatMinutes(breakEnd),
          category: 'Rest'
        });

        const delay = breakEnd - startM;
        startM += delay;
        endM += delay;
        shiftOffset += delay;
      }
    }

    db.prepare(`
      UPDATE blocks
      SET start_time = ?, end_time = ?
      WHERE id = ?
    `).run(formatMinutes(startM), formatMinutes(endM), b.id);

    newBlocks.push({
      ...b,
      start_time: formatMinutes(startM),
      end_time: formatMinutes(endM)
    });
  }

  if (breaksInserted > 0) {
    updateDailyLogForDate(date);
  }

  res.json({ message: `Successfully inserted ${breaksInserted} rest break(s).`, count: breaksInserted });
});

// ---------------------------------------------------------------------------
// POST /api/blocks/batch
// Inserts many blocks in a single SQLite transaction and recalculates
// daily_logs once per unique date — not N times for N blocks.
// Used by the Study Plan Wizard and Markdown Importer.
// ---------------------------------------------------------------------------
blocksRouter.post('/batch', (req: Request, res: Response) => {
  const { blocks } = req.body;

  if (!Array.isArray(blocks) || blocks.length === 0) {
    return res.status(400).json({ error: 'blocks array is required and must not be empty' });
  }

  const insertStmt = db.prepare(`
    INSERT INTO blocks (id, date, start_time, end_time, title, category, status, recurrence_rule, notes_id, custom_link)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const affectedDates = new Set<string>();
  const inserted: any[] = [];

  const insertTransaction = db.transaction(() => {
    for (const b of blocks) {
      if (!b.date || !b.start_time || !b.end_time || !b.title) continue;
      const id = b.id || `block-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      insertStmt.run(
        id,
        b.date,
        b.start_time,
        b.end_time,
        b.title,
        b.category || 'General',
        b.status || 'planned',
        b.recurrence_rule || null,
        b.notes_id || null,
        b.custom_link || null
      );
      affectedDates.add(b.date);
      inserted.push({ id, ...b });
    }
  });

  try {
    insertTransaction();

    // Single recalculation pass per unique date (not one per block)
    for (const d of affectedDates) {
      updateDailyLogForDate(d);
    }

    res.status(201).json({
      success: true,
      insertedCount: inserted.length,
      affectedDates: Array.from(affectedDates),
      blocks: inserted,
    });
  } catch (err: any) {
    console.error('Batch block insert failed:', err);
    res.status(500).json({ error: err.message || 'Batch insert failed' });
  }
});
