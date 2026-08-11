import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { isOllamaAvailable, generateRagText } from '../services/ollama.js';

export const advisorRouter = Router();

// GET /api/advisor/recommendation
advisorRouter.get('/recommendation', async (req: Request, res: Response) => {
  // Query all recent blocks to understand their current stack and fatigue
  const blocks = db.prepare(`
    SELECT * FROM blocks 
    ORDER BY date DESC, start_time ASC 
    LIMIT 50
  `).all() as any[];

  // 1. Identify current stack/categories & count completions
  const categoryCounts: Record<string, { total: number; done: number }> = {};
  let totalDone = 0;
  let totalSkipped = 0;

  blocks.forEach(b => {
    if (!categoryCounts[b.category]) {
      categoryCounts[b.category] = { total: 0, done: 0 };
    }
    categoryCounts[b.category].total++;
    if (b.status === 'done') {
      categoryCounts[b.category].done++;
      totalDone++;
    } else if (b.status === 'skipped') {
      totalSkipped++;
    }
  });

  // Calculate overall adherence in the past 50 blocks
  const adherence = blocks.length > 0 ? Math.round((totalDone / blocks.length) * 100) : 0;

  // Determine top category
  let topCategory = 'None';
  let maxDone = 0;
  Object.entries(categoryCounts).forEach(([cat, stats]) => {
    if (stats.done > maxDone) {
      maxDone = stats.done;
      topCategory = cat;
    }
  });

  // ---------------------------------------------------------------------------
  // 2. Personalized Burnout Thresholds
  // Use the user's own 30-day baseline (avg blocks completed per day) rather than
  // hardcoded global thresholds (>=2 back-to-back, >5 completed).
  // ---------------------------------------------------------------------------
  const thirtyDayBlocks = db.prepare(`
    SELECT date, status, start_time, end_time, category 
    FROM blocks 
    WHERE date < date('now') 
    ORDER BY date DESC, start_time ASC 
    LIMIT 300
  `).all() as any[];

  const parseMinutes = (timeStr: string): number => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
  };

  // Compute per-day completed count for the past 30 days to establish baseline
  const dailyCompletedMap: Record<string, number> = {};
  thirtyDayBlocks.forEach(b => {
    if (b.status === 'done') {
      dailyCompletedMap[b.date] = (dailyCompletedMap[b.date] || 0) + 1;
    }
  });
  const dailyCompletedValues = Object.values(dailyCompletedMap);
  const baselineAvgCompleted = dailyCompletedValues.length > 0
    ? dailyCompletedValues.reduce((a, b) => a + b, 0) / dailyCompletedValues.length
    : 4; // sensible default if no history

  // Personalized thresholds: caution at 110% baseline, burnout at 140%
  const burnoutThreshold = Math.round(baselineAvgCompleted * 1.4);
  const cautionThreshold = Math.round(baselineAvgCompleted * 1.1);

  // 3. Today's burnout analysis
  const todayStr = new Date().toISOString().split('T')[0];
  const todayBlocks = blocks.filter(b => b.date === todayStr);

  todayBlocks.sort((a, b) => parseMinutes(a.start_time) - parseMinutes(b.start_time));
  let consecutiveFatigueCount = 0;
  for (let i = 0; i < todayBlocks.length - 1; i++) {
    const curr = todayBlocks[i];
    const next = todayBlocks[i + 1];
    if (curr.category !== 'Rest' && next.category !== 'Rest') {
      const currEnd = parseMinutes(curr.end_time);
      const nextStart = parseMinutes(next.start_time);
      if (nextStart === currEnd) {
        consecutiveFatigueCount++;
      }
    }
  }

  const completedToday = todayBlocks.filter(b => b.status === 'done').length;

  let breakStatus: 'healthy' | 'caution' | 'burnout' = 'healthy';
  let breakRecommendationMessage = `Your current pacing is solid. Your daily average is ~${baselineAvgCompleted.toFixed(1)} blocks completed — keep it up!`;

  if (consecutiveFatigueCount >= 2 || completedToday >= burnoutThreshold) {
    breakStatus = 'burnout';
    breakRecommendationMessage = `🚨 Burnout Alert: You have completed ${completedToday} blocks today (your personal threshold is ~${burnoutThreshold}), with ${consecutiveFatigueCount} consecutive back-to-back sessions. Take a 30-minute walk or screen-free rest before continuing.`;
  } else if (consecutiveFatigueCount > 0 || completedToday >= cautionThreshold) {
    breakStatus = 'caution';
    breakRecommendationMessage = `⚠️ Caution: You are at ${completedToday} blocks today (your baseline average is ~${baselineAvgCompleted.toFixed(1)}). Consider scheduling a 15-minute coffee or stretching break after your next session.`;
  }

  // ---------------------------------------------------------------------------
  // 4. LLM-Powered Tech Stack Recommendation
  // Feed the user's real category breakdown and adherence to Ollama for a
  // nuanced, non-hardcoded recommendation instead of an if/else lookup table.
  // Falls back gracefully to keyword-based logic if Ollama is offline.
  // ---------------------------------------------------------------------------
  const categoryBreakdownStr = Object.entries(categoryCounts)
    .map(([cat, stats]) => `${cat}: ${stats.done}/${stats.total} completed (${Math.round((stats.done / (stats.total || 1)) * 100)}%)`)
    .join(', ');

  let recommendation = {
    nextStack: '',
    focusDescription: `Your top category is ${topCategory} with ${adherence}% overall adherence.`,
    rationale: '',
    actionLabel: '',
  };

  const { available, model: activeModel } = await isOllamaAvailable();

  if (available) {
    const prompt = `You are a senior software engineer and study coach. Based on a student's study analytics below, recommend the SINGLE best next technology stack or skill to learn.

Student's category breakdown (last 50 blocks):
${categoryBreakdownStr}
Overall adherence: ${adherence}%
Top studied category: ${topCategory}

Return ONLY a JSON object (no markdown, no explanation outside the JSON):
{
  "nextStack": "Short name (e.g. FastAPI, React, PostgreSQL)",
  "focusDescription": "One sentence describing what they're currently focused on",
  "rationale": "Two concise sentences explaining why this next stack makes sense given their history",
  "actionLabel": "Short action button label (e.g. Learn FastAPI)"
}`;

    try {
      const { text: aiResponse, offline } = await generateRagText(prompt, activeModel);
      if (!offline) {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0].replace(/,\s*([\]}])/g, '$1'));
          if (parsed.nextStack && parsed.rationale) {
            recommendation = {
              nextStack: parsed.nextStack || recommendation.nextStack,
              focusDescription: parsed.focusDescription || recommendation.focusDescription,
              rationale: parsed.rationale,
              actionLabel: parsed.actionLabel || `Learn ${parsed.nextStack}`,
            };
          }
        }
      }
    } catch (err) {
      console.warn('[Advisor] LLM recommendation parse failed, using keyword fallback:', err);
    }
  }

  // Keyword fallback if Ollama is offline or JSON parse failed
  if (!recommendation.nextStack) {
    const topLower = topCategory.toLowerCase();
    if (topLower.includes('dsa') || topLower.includes('algorithm') || topLower.includes('leet')) {
      recommendation = { nextStack: 'Backend Microservices (FastAPI / Node.js)', focusDescription: 'Strong focus on DSA and algorithms.', rationale: 'With solid algorithm foundations, building backend REST APIs is the ideal next step.', actionLabel: 'Learn FastAPI' };
    } else if (topLower.includes('backend') || topLower.includes('python') || topLower.includes('node') || topLower.includes('sql')) {
      recommendation = { nextStack: 'Frontend Engineering (React + TypeScript)', focusDescription: 'Main focus: Backend Development.', rationale: 'Couple server skills with React to become a full-stack engineer.', actionLabel: 'Explore React' };
    } else if (topLower.includes('frontend') || topLower.includes('react') || topLower.includes('css')) {
      recommendation = { nextStack: 'Backend & Databases (Node.js + PostgreSQL)', focusDescription: 'Main focus: Frontend Engineering.', rationale: 'Extend interface skills into backend request handling and data persistence.', actionLabel: 'Explore Node.js' };
    } else if (topLower.includes('ml') || topLower.includes('ai') || topLower.includes('data')) {
      recommendation = { nextStack: 'AI Agents & LLM Orchestration (LangChain)', focusDescription: 'Main focus: ML & AI.', rationale: 'Build RAG pipelines and function-calling agents to move from theory to engineering.', actionLabel: 'Learn LangChain' };
    } else {
      recommendation = { nextStack: 'Full-Stack Developer Path (Next.js + Prisma)', focusDescription: 'Balanced mix across multiple tech fields.', rationale: 'Building end-to-end applications synthesizes diverse knowledge best.', actionLabel: 'Explore Next.js' };
    }
  }

  res.json({
    currentFocus: topCategory,
    adherencePct: adherence,
    baselineAvgCompleted: parseFloat(baselineAvgCompleted.toFixed(1)),
    personalizedThresholds: { caution: cautionThreshold, burnout: burnoutThreshold },
    recommendation,
    breakAdvisor: {
      status: breakStatus,
      message: breakRecommendationMessage,
      consecutiveWithoutRest: consecutiveFatigueCount,
      completedToday,
    },
  });
});
