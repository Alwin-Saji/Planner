import { Router, Request, Response } from 'express';
import { db } from '../db.js';

export const reviewRouter = Router();

// GET /api/review/weekly
reviewRouter.get('/weekly', (req: Request, res: Response) => {
  const endDateStr = new Date().toISOString().split('T')[0];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);
  const startDateStr = startDate.toISOString().split('T')[0];

  const parseHour = (timeStr: string): number => {
    if (!timeStr) return 9;
    const parts = timeStr.split(':');
    return parseInt(parts[0], 10) || 9;
  };

  const parseMinutes = (timeStr: string): number => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
  };

  const blocks = db.prepare(`
    SELECT * FROM blocks 
    WHERE date >= ? AND date <= ?
    ORDER BY date ASC, start_time ASC
  `).all(startDateStr, endDateStr) as any[];

  const totalPlanned = blocks.length;
  const completedBlocks = blocks.filter(b => b.status === 'done');
  const skippedBlocks = blocks.filter(b => b.status === 'skipped');
  const adherencePct = totalPlanned > 0 ? Math.round((completedBlocks.length / totalPlanned) * 100) : 0;

  // Category breakdown
  const categories: Record<string, { total: number; done: number }> = {};
  blocks.forEach(b => {
    if (!categories[b.category]) categories[b.category] = { total: 0, done: 0 };
    categories[b.category].total++;
    if (b.status === 'done') categories[b.category].done++;
  });

  // 1. Weakest Categories
  const weakCategories = Object.entries(categories)
    .map(([cat, stats]) => ({
      category: cat,
      pct: stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0,
      ...stats
    }))
    .filter(c => c.pct < 60)
    .sort((a, b) => a.pct - b.pct);

  // 2. Time-of-day Diagnostics
  const timeOfDayStats = {
    morning: { total: 0, completed: 0 },
    afternoon: { total: 0, completed: 0 },
    evening: { total: 0, completed: 0 },
  };

  blocks.forEach(b => {
    const hr = parseHour(b.start_time);
    let slot: 'morning' | 'afternoon' | 'evening' = 'morning';
    if (hr >= 12 && hr < 17) {
      slot = 'afternoon';
    } else if (hr >= 17 || hr < 5) {
      slot = 'evening';
    }
    timeOfDayStats[slot].total++;
    if (b.status === 'done') {
      timeOfDayStats[slot].completed++;
    }
  });

  // 3. Break deficiency / Fatigue Risk (Back-to-back blocks without Rest)
  const blocksByDate: Record<string, any[]> = {};
  blocks.forEach(b => {
    if (!blocksByDate[b.date]) blocksByDate[b.date] = [];
    blocksByDate[b.date].push(b);
  });

  let backToBackWarningCount = 0;
  Object.values(blocksByDate).forEach(dayBlocks => {
    dayBlocks.sort((a, b) => parseMinutes(a.start_time) - parseMinutes(b.start_time));
    for (let i = 0; i < dayBlocks.length - 1; i++) {
      const curr = dayBlocks[i];
      const next = dayBlocks[i + 1];
      if (curr.category === 'Rest' || next.category === 'Rest') continue;
      const currEnd = parseMinutes(curr.end_time);
      const nextStart = parseMinutes(next.start_time);
      if (nextStart === currEnd) {
        backToBackWarningCount++;
      }
    }
  });

  // Recent notes attached
  const notes = db.prepare(`
    SELECT * FROM resources
    WHERE type = 'note'
    ORDER BY created_at DESC LIMIT 5
  `).all() as any[];

  // Markdown Summary construction
  const markdownSummary = `# Weekly Review Summary (${startDateStr} to ${endDateStr})

## Highlights & Metrics
- **Overall Adherence**: ${adherencePct}%
- **Total Blocks Planned**: ${totalPlanned}
- **Completed**: ${completedBlocks.length}
- **Skipped**: ${skippedBlocks.length}

## Fatigue & Rest Diagnostic
- **Back-to-Back Sessions**: ${backToBackWarningCount} detected without breaks.
- **Completion by Time of Day**:
  - Morning (5am-12pm): ${timeOfDayStats.morning.completed}/${timeOfDayStats.morning.total}
  - Afternoon (12pm-5pm): ${timeOfDayStats.afternoon.completed}/${timeOfDayStats.afternoon.total}
  - Evening/Night (5pm-5am): ${timeOfDayStats.evening.completed}/${timeOfDayStats.evening.total}

## Category Breakdown
${Object.entries(categories).map(([cat, stat]) => `- **${cat}**: ${stat.done}/${stat.total} completed (${Math.round((stat.done / (stat.total || 1)) * 100)}%)`).join('\n')}

${weakCategories.length > 0 ? `## Focus Areas (Low Adherence < 60%)\n${weakCategories.map(c => `- **${c.category}** needs attention (Only ${c.pct}% completed)`).join('\n')}\n` : ''}
## Key Completed Tasks
${completedBlocks.slice(0, 8).map(b => `- [x] **${b.title}** (${b.category} - ${b.date})`).join('\n')}

## Notes & Knowledge Captured
${notes.map(n => `- **${n.title}**: Tags [${JSON.parse(n.tags || '[]').join(', ')}]`).join('\n')}
`;

  res.json({
    period: { startDate: startDateStr, endDate: endDateStr },
    metrics: {
      totalPlanned,
      completedCount: completedBlocks.length,
      skippedCount: skippedBlocks.length,
      adherencePct,
      categories,
      weakCategories,
      timeOfDayStats,
      backToBackWarningCount,
    },
    completedBlocks,
    notes,
    markdownSummary,
  });
});
