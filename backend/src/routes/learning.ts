import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { isOllamaAvailable, generateRagText } from '../services/ollama.js';

export const learningRouter = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function parseMinutes(t: string): number {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

// ---------------------------------------------------------------------------
// GET /api/learning/path
// Computes a personalized, ordered learning path based on category adherence.
// ---------------------------------------------------------------------------
learningRouter.get('/path', async (req: Request, res: Response) => {
  try {
    const blocks = db.prepare(`
      SELECT category, status FROM blocks
      WHERE date >= date('now', '-90 days')
      ORDER BY date DESC
    `).all() as Array<{ category: string; status: string }>;

    // Aggregate per-category stats
    const categoryMap: Record<string, { total: number; done: number }> = {};
    for (const b of blocks) {
      const cat = (b.category || 'Other').trim();
      if (!categoryMap[cat]) categoryMap[cat] = { total: 0, done: 0 };
      categoryMap[cat].total++;
      if (b.status === 'done') categoryMap[cat].done++;
    }

    // Exclude generic "Rest" from learning path
    const restLike = ['rest', 'break', 'lunch', 'sleep'];
    const stages = Object.entries(categoryMap)
      .filter(([cat]) => !restLike.some(r => cat.toLowerCase().includes(r)))
      .map(([category, { total, done }]) => {
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        const stage: 'mastered' | 'in_progress' | 'needs_work' =
          pct >= 80 ? 'mastered' : pct >= 50 ? 'in_progress' : 'needs_work';
        return { category, completionPct: pct, blockCount: total, stage };
      })
      // Sort: mastered first, then in_progress, then needs_work; within each group sort by pct desc
      .sort((a, b) => {
        const order = { mastered: 0, in_progress: 1, needs_work: 2 };
        if (order[a.stage] !== order[b.stage]) return order[a.stage] - order[b.stage];
        return b.completionPct - a.completionPct;
      });

    // Next recommended focus: the first needs_work or lowest in_progress category
    const nextFocus = stages.find(s => s.stage === 'needs_work') ||
      stages.find(s => s.stage === 'in_progress') ||
      stages[0] || null;

    // Optional LLM narrative
    let narrative: string | null = null;
    try {
      const { available, model } = await isOllamaAvailable();
      if (available && stages.length > 0) {
        const stagesStr = stages
          .map(s => `${s.category}: ${s.completionPct}% (${s.stage.replace('_', ' ')})`)
          .join(', ');
        const prompt = `You are a learning coach. Based on a student's study category performance summary, write ONE concise paragraph (2-3 sentences, max 80 words) of personalized encouragement and next steps. Be specific, warm, and actionable.

Category performance: ${stagesStr}
Next recommended focus: ${nextFocus?.category || 'N/A'}

Return ONLY the plain paragraph text, no JSON, no markdown.`;
        const { text, offline } = await generateRagText(prompt, model);
        if (!offline && text && text.trim().length > 10) {
          narrative = text.trim().slice(0, 400);
        }
      }
    } catch {
      // narrative stays null — fine
    }

    res.json({ stages, nextFocus, narrative });
  } catch (err: any) {
    console.error('[Learning] /path error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/learning/fatigue
// Computes a real-time mental fatigue score (0–100) from multiple signals.
// ---------------------------------------------------------------------------
learningRouter.get('/fatigue', (req: Request, res: Response) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];

    // Today's blocks sorted by time
    const todayBlocks = (db.prepare(`
      SELECT * FROM blocks
      WHERE date = ?
      ORDER BY start_time ASC
    `).all(todayStr) as any[]);

    // --- Signal 1: Consecutive back-to-back blocks without rest ---
    let maxConsecutive = 0;
    let currentStreak = 0;
    for (let i = 0; i < todayBlocks.length - 1; i++) {
      const curr = todayBlocks[i];
      const next = todayBlocks[i + 1];
      const isRest = (c: any) => ['rest', 'break', 'lunch', 'sleep'].some(r => c.category?.toLowerCase().includes(r));
      if (!isRest(curr) && !isRest(next)) {
        const currEnd = parseMinutes(curr.end_time);
        const nextStart = parseMinutes(next.start_time);
        if (nextStart <= currEnd + 5) {
          // within 5-min gap — treat as back-to-back
          currentStreak++;
          maxConsecutive = Math.max(maxConsecutive, currentStreak);
        } else {
          currentStreak = 0;
        }
      } else {
        currentStreak = 0;
      }
    }
    const backToBackScore = clamp(maxConsecutive * 18, 0, 54); // max 54 pts from 3+ consecutive

    // --- Signal 2: Recent skip streak (last 6 blocks, any date) ---
    const recentBlocks = (db.prepare(`
      SELECT status FROM blocks
      WHERE date <= ?
      ORDER BY date DESC, start_time DESC
      LIMIT 6
    `).all(todayStr) as any[]);

    let consecutiveSkips = 0;
    for (const b of recentBlocks) {
      if (b.status === 'skipped') consecutiveSkips++;
      else break;
    }
    const skipScore = clamp(consecutiveSkips * 15, 0, 30); // max 30 pts from 2+ skips

    // --- Signal 3: Time-of-day adherence decay ---
    // Fetch last 14 days of blocks to compute morning vs evening adherence
    const twoWeekBlocks = (db.prepare(`
      SELECT start_time, status FROM blocks
      WHERE date >= date('now', '-14 days') AND date <= date('now')
    `).all() as any[]);

    let morningDone = 0, morningTotal = 0;
    let eveningDone = 0, eveningTotal = 0;
    for (const b of twoWeekBlocks) {
      const hour = parseMinutes(b.start_time) / 60;
      if (hour >= 6 && hour < 12) {
        morningTotal++;
        if (b.status === 'done') morningDone++;
      } else if (hour >= 17 && hour < 23) {
        eveningTotal++;
        if (b.status === 'done') eveningDone++;
      }
    }
    const morningPct = morningTotal > 0 ? morningDone / morningTotal : 1;
    const eveningPct = eveningTotal > 0 ? eveningDone / eveningTotal : 1;
    const decay = morningPct - eveningPct; // positive = evening degradation
    const decayScore = clamp(Math.round(decay * 30), 0, 20); // max 20 pts

    // --- Signal 4: Category monotony (same category 3+ times today) ---
    const catCounts: Record<string, number> = {};
    for (const b of todayBlocks) {
      const cat = b.category?.toLowerCase() || 'other';
      if (!['rest', 'break'].includes(cat)) {
        catCounts[cat] = (catCounts[cat] || 0) + 1;
      }
    }
    const maxMonotony = Math.max(0, ...Object.values(catCounts));
    const monotonyScore = clamp((maxMonotony - 2) * 8, 0, 16); // kicks in at 3+, max 16 pts

    const totalScore = clamp(backToBackScore + skipScore + decayScore + monotonyScore, 0, 100);

    let level: 'fresh' | 'mild' | 'tired' | 'burnout';
    if (totalScore < 20) level = 'fresh';
    else if (totalScore < 45) level = 'mild';
    else if (totalScore < 70) level = 'tired';
    else level = 'burnout';

    // Build human-readable signal list
    const signals: string[] = [];
    if (maxConsecutive >= 1) signals.push(`${maxConsecutive + 1}× back-to-back sessions`);
    if (consecutiveSkips >= 1) signals.push(`${consecutiveSkips} skipped in a row`);
    if (decay > 0.2) signals.push(`Evening adherence ${Math.round(eveningPct * 100)}% vs morning ${Math.round(morningPct * 100)}%`);
    if (maxMonotony >= 3) signals.push(`${maxMonotony}× same category today`);

    // Break suggestion: next 15-min window after last block
    let breakSuggestion: { start_time: string; end_time: string } | undefined;
    if (todayBlocks.length > 0) {
      const lastEnd = parseMinutes(todayBlocks[todayBlocks.length - 1].end_time);
      const breakStart = lastEnd + 5;
      const breakEnd = breakStart + 15;
      if (breakEnd <= 23 * 60) {
        const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
        breakSuggestion = { start_time: fmt(breakStart), end_time: fmt(breakEnd) };
      }
    }

    res.json({
      score: totalScore,
      level,
      signals,
      breakSuggestion,
      breakdown: { backToBack: backToBackScore, skipStreak: skipScore, eveningDecay: decayScore, monotony: monotonyScore },
    });
  } catch (err: any) {
    console.error('[Learning] /fatigue error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/learning/energy-profile
// Returns morning / afternoon / evening adherence %, detects peak window.
// ---------------------------------------------------------------------------
learningRouter.get('/energy-profile', (req: Request, res: Response) => {
  try {
    const blocks = (db.prepare(`
      SELECT start_time, status FROM blocks
      WHERE date >= date('now', '-30 days')
    `).all() as any[]);

    const windows = {
      morning:   { done: 0, total: 0 },   // 6–12
      afternoon: { done: 0, total: 0 },   // 12–17
      evening:   { done: 0, total: 0 },   // 17–23
    };

    for (const b of blocks) {
      const hour = parseMinutes(b.start_time) / 60;
      let win: keyof typeof windows | null = null;
      if (hour >= 6 && hour < 12) win = 'morning';
      else if (hour >= 12 && hour < 17) win = 'afternoon';
      else if (hour >= 17 && hour < 23) win = 'evening';

      if (win) {
        windows[win].total++;
        if (b.status === 'done') windows[win].done++;
      }
    }

    const pct = (w: { done: number; total: number }) =>
      w.total > 0 ? Math.round((w.done / w.total) * 100) : 0;

    const morning = pct(windows.morning);
    const afternoon = pct(windows.afternoon);
    const evening = pct(windows.evening);

    const vals = { morning, afternoon, evening };
    const peakWindow = (Object.entries(vals).sort((a, b) => b[1] - a[1])[0][0]) as 'morning' | 'afternoon' | 'evening';

    res.json({ morning, afternoon, evening, peakWindow,
      blockCounts: {
        morning: windows.morning.total,
        afternoon: windows.afternoon.total,
        evening: windows.evening.total,
      }
    });
  } catch (err: any) {
    console.error('[Learning] /energy-profile error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/learning/reschedule
// Finds open slots for given skipped block IDs in the next 7 days.
// ---------------------------------------------------------------------------
learningRouter.post('/reschedule', (req: Request, res: Response) => {
  try {
    const { skippedIds } = req.body as { skippedIds: string[] };
    if (!skippedIds || !Array.isArray(skippedIds) || skippedIds.length === 0) {
      return res.status(400).json({ error: 'skippedIds array is required' });
    }

    // Fetch skipped blocks details
    const placeholders = skippedIds.map(() => '?').join(',');
    const skippedBlocks = (db.prepare(`
      SELECT * FROM blocks WHERE id IN (${placeholders})
    `).all(...skippedIds) as any[]);

    if (skippedBlocks.length === 0) {
      return res.json({ slots: [] });
    }

    // Fetch all existing planned/done blocks for the next 7 days
    const existingBlocks = (db.prepare(`
      SELECT date, start_time, end_time FROM blocks
      WHERE date > date('now') AND date <= date('now', '+7 days')
      AND status IN ('planned', 'done')
      ORDER BY date, start_time
    `).all() as any[]);

    // Build a date → busy intervals map
    const busyMap: Record<string, Array<{ start: number; end: number }>> = {};
    for (const b of existingBlocks) {
      if (!busyMap[b.date]) busyMap[b.date] = [];
      busyMap[b.date].push({ start: parseMinutes(b.start_time), end: parseMinutes(b.end_time) });
    }

    // For each skipped block, find the next available slot with matching duration
    const slots: Array<{
      blockId: string;
      blockTitle: string;
      originalDate: string;
      suggestedDate: string;
      suggestedStart: string;
      suggestedEnd: string;
    }> = [];

    const fmtTime = (m: number) =>
      `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

    for (const block of skippedBlocks) {
      const durationMins = parseMinutes(block.end_time) - parseMinutes(block.start_time);
      const originalStart = parseMinutes(block.start_time);
      let found = false;

      for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
        const d = new Date();
        d.setDate(d.getDate() + dayOffset);
        const dateStr = d.toISOString().split('T')[0];
        const busy = busyMap[dateStr] || [];

        // Try to place block at same time of day first, then scan from 7:00
        const candidates = [originalStart, 7 * 60, 9 * 60, 11 * 60, 14 * 60, 16 * 60, 18 * 60];
        for (const start of candidates) {
          const end = start + durationMins;
          if (end > 22 * 60) continue; // no late-night blocks
          const overlaps = busy.some(b => !(end <= b.start || start >= b.end));
          if (!overlaps) {
            slots.push({
              blockId: block.id,
              blockTitle: block.title,
              originalDate: block.date,
              suggestedDate: dateStr,
              suggestedStart: fmtTime(start),
              suggestedEnd: fmtTime(end),
            });
            // Mark this slot as busy so next blocks don't collide
            busy.push({ start, end });
            busyMap[dateStr] = busy;
            found = true;
            break;
          }
        }
        if (found) break;
      }
    }

    res.json({ slots });
  } catch (err: any) {
    console.error('[Learning] /reschedule error:', err);
    res.status(500).json({ error: err.message });
  }
});
