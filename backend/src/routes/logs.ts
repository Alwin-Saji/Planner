import { Router, Request, Response } from 'express';
import { db } from '../db.js';

export const logsRouter = Router();

// GET /api/logs
logsRouter.get('/', (req: Request, res: Response) => {
  const logs = db.prepare('SELECT * FROM daily_logs ORDER BY date ASC').all() as any[];

  // Calculate streak (consecutive days with adherence >= 50% up to today)
  const todayStr = new Date().toISOString().split('T')[0];
  let currentStreak = 0;
  let maxStreak = 0;
  let tempStreak = 0;

  logs.forEach(log => {
    if (log.adherence_pct >= 50 && log.planned_count > 0) {
      tempStreak++;
      if (tempStreak > maxStreak) maxStreak = tempStreak;
    } else {
      tempStreak = 0;
    }
  });

  // Calculate current streak working backwards from today
  const sortedDesc = [...logs].reverse();
  for (const log of sortedDesc) {
    if (log.date <= todayStr) {
      if (log.adherence_pct >= 50 && log.planned_count > 0) {
        currentStreak++;
      } else if (log.date !== todayStr) {
        // Break streak if a past day was missed
        break;
      }
    }
  }

  // Calculate overall adherence %
  const totalPlanned = logs.reduce((acc, l) => acc + l.planned_count, 0);
  const totalCompleted = logs.reduce((acc, l) => acc + l.completed_count, 0);
  const overallAdherence = totalPlanned > 0 ? Math.round((totalCompleted / totalPlanned) * 100) : 0;

  // Calculate category split
  const categorySplit = db.prepare(`
    SELECT category, 
           COUNT(*) as total, 
           SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done
    FROM blocks
    GROUP BY category
  `).all();

  res.json({
    logs,
    summary: {
      totalDays: logs.length,
      currentStreak,
      maxStreak,
      totalPlanned,
      totalCompleted,
      overallAdherence,
      categorySplit,
    },
  });
});
