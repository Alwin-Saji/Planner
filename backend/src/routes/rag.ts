import { Router, Request, Response } from 'express';
import { spawn, execFile } from 'child_process';
import { db } from '../db.js';
import {
  checkOllamaStatus,
  pullOllamaModel,
  generateRagText,
  isOllamaAvailable,
  offlineFallbackMessage,
  invalidateModelCache,
  getEmbedding,
  cosineSimilarity,
} from '../services/ollama.js';

export const ragRouter = Router();

// ---------------------------------------------------------------------------
// Probe GPU availability once at startup. Falls back to CPU if nvidia-smi
// is not found or exits non-zero — avoiding hardcoded device index.
// ---------------------------------------------------------------------------
let _gpuEnv: Record<string, string> = {};

function detectGpuEnv(): Promise<Record<string, string>> {
  return new Promise((resolve) => {
    execFile('nvidia-smi', ['--query-gpu=name', '--format=csv,noheader'], { timeout: 3000 }, (err, stdout) => {
      if (!err && stdout.trim().length > 0) {
        console.log(`[GPU] Detected NVIDIA GPU: ${stdout.trim().split('\n')[0]}. Enabling CUDA for Ollama.`);
        resolve({ CUDA_VISIBLE_DEVICES: '0' });
      } else {
        console.log('[GPU] No NVIDIA GPU detected or nvidia-smi unavailable. Running Ollama on CPU.');
        resolve({});
      }
    });
  });
}

// Run GPU probe once at module load
detectGpuEnv().then((env) => { _gpuEnv = env; });

// GET /api/ai/status (or /api/rag/status)
ragRouter.get('/status', async (req: Request, res: Response) => {
  const status = await checkOllamaStatus();
  res.json(status);
});

// POST /api/ai/start
ragRouter.post('/start', async (req: Request, res: Response) => {
  try {
    const child = spawn('ollama', ['serve'], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      env: {
        ...process.env,
        // Use dynamically detected GPU env — falls back to CPU if no Nvidia GPU found
        ..._gpuEnv,
      },
    });
    child.unref();
    const gpuMsg = _gpuEnv.CUDA_VISIBLE_DEVICES !== undefined
      ? 'Ollama start command triggered with CUDA GPU acceleration.'
      : 'Ollama start command triggered (CPU mode — no NVIDIA GPU detected).';
    res.json({ success: true, message: gpuMsg, gpuDetected: !!_gpuEnv.CUDA_VISIBLE_DEVICES });
  } catch (err: any) {
    console.error('Failed to start Ollama:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to start Ollama process' });
  }
});

// POST /api/ai/pull
ragRouter.post('/pull', async (req: Request, res: Response) => {
  const { model } = req.body;
  if (!model || typeof model !== 'string') {
    return res.status(400).json({ error: 'Model name is required' });
  }

  const result = await pullOllamaModel(model);
  if (result.success) invalidateModelCache(); // Force re-probe on next request
  res.json(result);
});

// ---------------------------------------------------------------------------
// POST /api/ai/chat
// RAG-powered chat. Uses hybrid semantic + keyword retrieval for context.
// Semantic embeddings (nomic-embed-text) are fetched in parallel with keyword
// scoring; both are blended (60% semantic / 40% keyword) and fall back
// gracefully to keyword-only when the embedding model is unavailable.
// Returns { answer, sources, offline } — `offline: true` means Ollama was not available.
// ---------------------------------------------------------------------------
ragRouter.post('/chat', async (req: Request, res: Response) => {
  const { query, model, scope, mode = 'grounded' } = req.body;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query string is required' });
  }

  // Fetch all resources and notes to retrieve context
  let resources = db.prepare('SELECT * FROM resources').all() as any[];

  if (scope && scope !== 'everything') {
    resources = resources.filter(r => {
      try {
        const tags: string[] = JSON.parse(r.tags || '[]');
        return tags.some(t => t.toLowerCase().includes(scope.toLowerCase()));
      } catch {
        return true;
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Hybrid Retrieval: Semantic (Ollama embeddings) + Keyword scoring
  // Embeddings are cached in the `embeddings` table to avoid re-computing on
  // every chat request. A stable content hash acts as the cache key — if the
  // resource content changes, the old cached vector is replaced.
  // ---------------------------------------------------------------------------
  const queryWords = query.toLowerCase().split(/\W+/).filter((w: string) => w.length > 2);

  // Keyword scoring (instant, always available)
  const keywordScores = resources.map(r => {
    const textToSearch = `${r.title}\n${r.url_or_content}`.toLowerCase();
    const titleMatches = queryWords.filter((w: string) => r.title.toLowerCase().includes(w)).length;
    const contentMatches = queryWords.filter((w: string) => textToSearch.includes(w)).length;
    return titleMatches * 0.5 + contentMatches * 0.2;
  });

  // ---------------------------------------------------------------------------
  // Semantic scoring with DB embedding cache
  // ---------------------------------------------------------------------------
  /**
   * Compute a simple but stable hash of a string for cache key comparison.
   * Uses length + first-64-chars + last-64-chars to detect content changes
   * cheaply without requiring a crypto dependency.
   */
  function cheapHash(text: string): string {
    const len = text.length;
    const head = text.substring(0, 64);
    const tail = text.substring(Math.max(0, len - 64));
    return `${len}:${head}:${tail}`;
  }

  let semanticScores: number[] = new Array(resources.length).fill(0);
  try {
    const queryEmbedding = await getEmbedding(query);

    // Fetch all cached embeddings for the current resource set in one query
    const resourceIds = resources.map((r: any) => r.id);
    const placeholders = resourceIds.map(() => '?').join(',');
    const cachedRows = resourceIds.length > 0
      ? db.prepare(`SELECT resource_id, chunk_text, vector FROM embeddings WHERE resource_id IN (${placeholders})`).all(...resourceIds) as any[]
      : [];

    const cacheMap = new Map<string, { hash: string; vector: number[] }>();
    for (const row of cachedRows) {
      try {
        cacheMap.set(row.resource_id, {
          hash: row.chunk_text,            // chunk_text stores the content hash
          vector: JSON.parse(row.vector),
        });
      } catch { /* malformed cache row — ignore, will be regenerated */ }
    }

    // For each resource: use cache hit or compute + persist new embedding
    const upsertStmt = db.prepare(`
      INSERT INTO embeddings (id, resource_id, chunk_text, vector)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET chunk_text = excluded.chunk_text, vector = excluded.vector
    `);

    const resourceEmbeddings: number[][] = await Promise.all(
      resources.map(async (r: any) => {
        const text = `${r.title} ${r.url_or_content.substring(0, 400)}`;
        const contentHash = cheapHash(text);
        const cached = cacheMap.get(r.id);

        if (cached && cached.hash === contentHash) {
          return cached.vector; // ✅ Cache hit — skip Ollama
        }

        // ❌ Cache miss — compute embedding and persist to DB
        const vec = await getEmbedding(text);
        try {
          upsertStmt.run(`emb-${r.id}`, r.id, contentHash, JSON.stringify(vec));
        } catch (cacheWriteErr) {
          console.warn('[RAG] Failed to cache embedding for resource', r.id, cacheWriteErr);
        }
        return vec;
      })
    );

    semanticScores = resourceEmbeddings.map(vec => cosineSimilarity(queryEmbedding, vec));
  } catch {
    // Embedding model unavailable — fall back to pure keyword retrieval
    console.log('[RAG] Semantic embeddings unavailable, using keyword-only retrieval.');
  }


  const hasSemanticSignal = semanticScores.some(s => s > 0);
  const scoredResources = resources.map((r, i) => {
    // Blend: 60% semantic (when available) + 40% keyword
    const combined = hasSemanticSignal
      ? semanticScores[i] * 0.6 + (keywordScores[i] / Math.max(...keywordScores, 1)) * 0.4
      : keywordScores[i];
    return {
      resource: r,
      score: combined,
      snippet: r.url_or_content.substring(0, 300),
    };
  });

  // Pick top 3 matches
  scoredResources.sort((a, b) => b.score - a.score);
  const topMatches = scoredResources.slice(0, 3);

  const contextText = topMatches.length > 0 && topMatches[0].score > 0
    ? topMatches.map(m => `[Source: ${m.resource.title} (${m.resource.type})]\n${m.resource.url_or_content}`).join('\n\n---\n\n')
    : '';

  const { available } = await isOllamaAvailable();
  if (!available) {
    return res.json({
      answer: offlineFallbackMessage(),
      sources: [],
      offline: true,
    });
  }

  let prompt = '';
  if (mode === 'web') {
    prompt = `You are a high-intelligence AI study assistant and timetable planner.
The user is asking a general learning query (Mode: General Knowledge & Web Search).

USER QUERY: ${query}

INSTRUCTIONS:
1. Provide a concise, clear explanation of the topic.
2. Provide 2 key takeaways or action items.
3. Suggest a 45-minute study block title & category (e.g. "Study: Quantum Mechanics") so the user can add it to their calendar.`;
  } else {
    prompt = `You are an AI personal assistant for a daily timetable and study planner app.
Answer the user's query clearly and concisely based on the following grounded notes and resources:

CONTEXT FROM LOCAL NOTES:
${contextText || 'No specific notes found in your database for this query.'}

USER QUERY: ${query}

INSTRUCTIONS:
- If local notes exist above, prioritize them and cite original titles.
- If no relevant notes matched, provide a clear answer using general knowledge and state that no local notes matched.`;
  }

  const startTime = Date.now();
  console.log(`[RAG Performance] Sending prompt to ${model || 'default'} (Prompt Length: ${prompt.length} chars, Semantic: ${hasSemanticSignal ? 'yes' : 'no (keyword fallback)'})...`);

  // Uses generateRagText tailored specifically for RAG chat (num_predict: 250 tokens for concise answers)
  const { text: answer, offline } = await generateRagText(prompt, model);

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[RAG Performance] ✅ Response generated in ${durationSec}s via model ${model}`);

  // Clean up study block title from question phrasing
  let cleanBlockTopic = query
    .replace(/^(what is|what are|how to|explain|summarize|tell me about|show me|help me with|i want to|where is|why does|how does|can you|hi|hello)\s*[,:]?\s*/i, '')
    .replace(/[?.!]+$/, '')
    .trim();

  cleanBlockTopic = cleanBlockTopic ? cleanBlockTopic.charAt(0).toUpperCase() + cleanBlockTopic.slice(1) : query;
  if (cleanBlockTopic.length > 30) {
    cleanBlockTopic = cleanBlockTopic.substring(0, 27) + '...';
  }

  const suggestedBlock = {
    title: `Study: ${cleanBlockTopic}`,
    category: scope && scope !== 'everything' ? scope.toUpperCase() : 'Study',
    durationMinutes: 45,
  };

  res.json({
    answer,
    sources: topMatches.map(m => ({
      id: m.resource.id,
      title: m.resource.title,
      type: m.resource.type,
      url_or_content: m.resource.url_or_content,
      score: m.score.toFixed(3),
    })),
    suggestedBlock,
    offline,
  });
});

function parseMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatMinutes(totalMins: number): string {
  const h = Math.floor(totalMins / 60) % 24;
  const m = totalMins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function detectBreakSuggestion(todayDateStr: string): any | null {
  try {
    const todayBlocks = db.prepare('SELECT * FROM blocks WHERE date = ? ORDER BY start_time ASC').all(todayDateStr) as any[];
    if (!todayBlocks || todayBlocks.length === 0) return null;

    // Get current wall clock time in minutes
    const now = new Date();
    const nowM = now.getHours() * 60 + now.getMinutes();

    // Fetch past 7 days completion rate to gauge user load/fatigue state
    const pastBlocks = db.prepare('SELECT status FROM blocks WHERE date < ? ORDER BY date DESC LIMIT 30').all(todayDateStr) as any[];
    const donePast = pastBlocks.filter(b => b.status === 'done').length;
    const pastAdherence = pastBlocks.length > 0 ? donePast / pastBlocks.length : 0.8;

    // Filter to blocks that are currently active or in the future today (or fall back to all if all past)
    let candidateIndices: number[] = [];
    for (let i = 0; i < todayBlocks.length; i++) {
      const endM = parseMinutes(todayBlocks[i].end_time);
      // Give 30 min buffer for recently completed sessions
      if (endM >= nowM - 30) {
        candidateIndices.push(i);
      }
    }
    if (candidateIndices.length === 0) {
      candidateIndices = todayBlocks.map((_, i) => i);
    }

    for (const i of candidateIndices) {
      const curr = todayBlocks[i];
      const startM = parseMinutes(curr.start_time);
      const endM = parseMinutes(curr.end_time);
      const duration = endM - startM;

      const next = i < todayBlocks.length - 1 ? todayBlocks[i + 1] : null;
      const nextStartM = next ? parseMinutes(next.start_time) : null;
      const gapM = nextStartM !== null ? nextStartM - endM : 60; // Available gap until next session

      // Calculate dynamic recommended break duration (15 to 30 mins) based on session duration & historical completion rate
      let recommendedBreakDuration = 15;
      if (duration >= 120 || pastAdherence < 0.5) {
        recommendedBreakDuration = 30;
      } else if (duration >= 90 || pastAdherence < 0.7) {
        recommendedBreakDuration = 20;
      }

      // Check if long continuous session (>= 75 mins) or back-to-back blocks without rest
      const isLongSession = duration >= 75 && curr.category !== 'Rest' && curr.category !== 'Break';
      const isBackToBack = next && nextStartM === endM && curr.category !== 'Rest' && next.category !== 'Rest';

      if (isLongSession || isBackToBack) {
        // Optimal break insertion time: if session already ended, use max(nowM, endM)
        const breakStartM = Math.max(nowM > startM && nowM < endM ? endM : nowM > endM ? nowM : endM, endM);
        const actualBreakDuration = (gapM > 0 && gapM < recommendedBreakDuration) ? Math.max(10, gapM) : recommendedBreakDuration;
        const breakEndM = breakStartM + actualBreakDuration;

        const breakStartStr = formatMinutes(breakStartM);
        const breakEndStr = formatMinutes(breakEndM);

        const breakTitle = actualBreakDuration >= 25 
          ? `🛋️ ${actualBreakDuration}-Min Deep Rest & Recharge` 
          : `☕ ${actualBreakDuration}-Min Rest Break`;

        const isCurrentlyActive = nowM >= startM && nowM <= endM;
        const timePrefix = isCurrentlyActive ? 'Current Session: ' : '';

        const descMessage = isBackToBack
          ? `${timePrefix}"${curr.title}" and "${next!.title}" are back-to-back. Based on current time and session load, inserting a ${actualBreakDuration}-min break at ${breakStartStr} will optimize focus.`
          : `${timePrefix}You have an intense ${duration}-min session for "${curr.title}". Schedule a ${actualBreakDuration}-min break at ${breakStartStr} to reset focus.`;

        return {
          id: `sug-break-${todayDateStr}-${breakStartStr}`,
          type: isBackToBack || pastAdherence < 0.6 ? 'warning' : 'opportunity',
          title: `${breakTitle} Recommended (${breakStartStr})`,
          description: descMessage,
          actionLabel: `Insert ${actualBreakDuration}-Min Break at ${breakStartStr}`,
          actionType: 'INSERT_BREAK',
          suggestedBreak: {
            date: todayDateStr,
            start_time: breakStartStr,
            end_time: breakEndStr,
            title: breakTitle,
            category: 'Rest',
            status: 'planned'
          }
        };
      }
    }
  } catch (err) {
    console.warn('Break detection failed:', err);
  }
  return null;
}

// POST /api/ai/suggestions
ragRouter.post('/suggestions', async (req: Request, res: Response) => {
  const { model, date } = req.body;
  const targetDate = date || new Date().toISOString().split('T')[0];

  // Detect break recommendation for user's schedule
  const breakSug = detectBreakSuggestion(targetDate);

  // Retrieve past 7 days logs & blocks
  const logs = db.prepare('SELECT * FROM daily_logs ORDER BY date DESC LIMIT 7').all() as any[];
  const recentBlocks = db.prepare('SELECT * FROM blocks ORDER BY date DESC, start_time ASC LIMIT 20').all() as any[];

  const categoryStats: Record<string, { total: number; skipped: number; completed: number }> = {};
  const timeOfDayStats = {
    morning: { total: 0, completed: 0 },
    afternoon: { total: 0, completed: 0 },
    evening: { total: 0, completed: 0 },
  };

  recentBlocks.forEach(b => {
    if (!categoryStats[b.category]) {
      categoryStats[b.category] = { total: 0, skipped: 0, completed: 0 };
    }
    categoryStats[b.category].total++;
    if (b.status === 'skipped') {
      categoryStats[b.category].skipped++;
    } else if (b.status === 'done') {
      categoryStats[b.category].completed++;
    }

    const hr = parseInt(b.start_time.split(':')[0], 10) || 9;
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

  // Compute deterministic insights directly from real timetable stats
  const deterministicInsights: any[] = [];

  // 1. Find category with most skipped blocks
  let highestSkippedCat = '';
  let maxSkippedCount = 0;
  Object.entries(categoryStats).forEach(([cat, stats]) => {
    if (stats.skipped > maxSkippedCount) {
      maxSkippedCount = stats.skipped;
      highestSkippedCat = cat;
    }
  });

  if (highestSkippedCat && maxSkippedCount > 0) {
    deterministicInsights.push({
      id: `sug-det-skipped-${highestSkippedCat.toLowerCase()}`,
      type: 'warning',
      title: `Review Skipped ${highestSkippedCat} Sessions`,
      description: `You have skipped ${maxSkippedCount} session${maxSkippedCount > 1 ? 's' : ''} in ${highestSkippedCat}. Consider scheduling these during your peak focus hours.`,
      actionLabel: 'View Schedule',
      actionType: 'GOTO_DAILY'
    });
  }

  // 2. Identify peak productive time slot
  let peakSlot = '';
  let maxSlotCompleted = 0;
  for (const slot of Object.keys(timeOfDayStats) as Array<'morning' | 'afternoon' | 'evening'>) {
    if (timeOfDayStats[slot].completed > maxSlotCompleted) {
      maxSlotCompleted = timeOfDayStats[slot].completed;
      peakSlot = slot;
    }
  }

  if (peakSlot && maxSlotCompleted > 0) {
    const slotLabel = peakSlot.charAt(0).toUpperCase() + peakSlot.slice(1);
    deterministicInsights.push({
      id: `sug-det-peak-${peakSlot}`,
      type: 'insight',
      title: `Peak Productivity: ${slotLabel}s`,
      description: `Your highest block completion rate happens during ${peakSlot} hours (${maxSlotCompleted} blocks done). Schedule challenging topics then!`,
      actionLabel: 'Schedule Block',
      actionType: 'CREATE_BLOCK'
    });
  }

  // Fallback defaults incorporating deterministic insights seamlessly
  const defaultSuggestions = [
    ...(breakSug ? [breakSug] : []),
    ...deterministicInsights,
    {
      id: 'sug-1',
      type: 'opportunity',
      title: 'Pomodoro Interval Focus',
      description: 'Try breaking down long study sessions into 45-minute pomodoro blocks to improve retention.',
      actionLabel: 'Schedule Session',
      actionType: 'CREATE_BLOCK'
    },
    {
      id: 'sug-2',
      type: 'warning',
      title: 'Review Skipped Categories',
      description: 'Review your frequently skipped study categories in the morning before starting core work.',
      actionLabel: 'View Schedule',
      actionType: 'GOTO_DAILY'
    },
    {
      id: 'sug-3',
      type: 'insight',
      title: 'Attach Key Documentation Links',
      description: 'Keep documentation links attached directly to each study block for quick reference during sessions.',
      actionLabel: 'Open Resources',
      actionType: 'LINK_RESOURCE'
    }
  ].slice(0, 3);

  const prompt = `Based on the past week's study performance:
Category statistics: ${JSON.stringify(categoryStats)}
Time of Day completion statistics (morning: 5am-12pm, afternoon: 12pm-5pm, evening: 5pm-5am): ${JSON.stringify(timeOfDayStats)}

Provide 3 short, highly actionable study habits, break recommendations, or adjustments to increase timetable completion rates and handle fatigue. Return ONLY a valid JSON array of objects with keys: id, type ("warning"|"opportunity"|"insight"), title, description, actionLabel, actionType ("CREATE_BLOCK"|"GOTO_DAILY"|"LINK_RESOURCE"|"WEEKLY_REVIEW"). Format:
[
  {
    "id": "sug-1",
    "type": "opportunity",
    "title": "Short catchy title",
    "description": "Clear actionable recommendation",
    "actionLabel": "Action text",
    "actionType": "CREATE_BLOCK"
  }
]`;

  try {
    const { text: responseText, offline } = await generateRagText(prompt, model);

    if (offline) {
      return res.json({ suggestions: defaultSuggestions });
    }

    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const suggestions = parsed.map((item: any, idx: number) => ({
        id: item.id || `sug-${idx + 1}`,
        type: ['warning', 'opportunity', 'insight'].includes(item.type) ? item.type : 'insight',
        title: item.title || (typeof item === 'string' ? item : `Optimization ${idx + 1}`),
        description: item.description || (typeof item === 'string' ? item : ''),
        actionLabel: item.actionLabel || 'Apply',
        actionType: item.actionType || (idx === 0 ? 'CREATE_BLOCK' : idx === 1 ? 'GOTO_DAILY' : 'LINK_RESOURCE'),
      }));

      // Prepend break suggestion if available
      const combined = breakSug ? [breakSug, ...suggestions.slice(0, 2)] : suggestions;
      return res.json({ suggestions: combined });
    }
    res.json({ suggestions: defaultSuggestions });
  } catch (err) {
    console.warn('AI suggestions LLM generation warning:', err);
    res.json({ suggestions: defaultSuggestions });
  }
});

// ---------------------------------------------------------------------------
// RAG CONVERSATION STORAGE ENDPOINTS
// ---------------------------------------------------------------------------

// GET /api/ai/conversations - List all saved conversations
ragRouter.get('/conversations', (req: Request, res: Response) => {
  try {
    const conversations = db.prepare(`
      SELECT c.*, 
             (SELECT text FROM rag_messages WHERE conversation_id = c.id AND sender = 'user' ORDER BY created_at DESC LIMIT 1) as snippet,
             (SELECT COUNT(*) FROM rag_messages WHERE conversation_id = c.id) as message_count
      FROM rag_conversations c
      ORDER BY c.updated_at DESC
    `).all();
    res.json(conversations);
  } catch (err: any) {
    console.error('Failed to fetch RAG conversations:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch conversations' });
  }
});

// GET /api/ai/conversations/:id - Get single conversation and all messages
ragRouter.get('/conversations/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const conversation = db.prepare('SELECT * FROM rag_conversations WHERE id = ?').get(id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    const messages = db.prepare('SELECT * FROM rag_messages WHERE conversation_id = ? ORDER BY created_at ASC').all(id);

    const formattedMessages = messages.map((m: any) => ({
      id: m.id,
      sender: m.sender,
      text: m.text,
      sources: m.sources ? JSON.parse(m.sources) : undefined,
      timestamp: m.timestamp,
    }));

    res.json({ ...conversation, messages: formattedMessages });
  } catch (err: any) {
    console.error('Failed to fetch conversation:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch conversation' });
  }
});

// POST /api/ai/conversations - Create or update conversation & append message
ragRouter.post('/conversations', (req: Request, res: Response) => {
  try {
    const { id, title, scope, model, message } = req.body;
    if (!message || !message.text) {
      return res.status(400).json({ error: 'Message payload is required' });
    }

    let convId = id;

    const extractKeyTopic = (text: string): string => {
      const rawText = text.trim();
      let clean = rawText
        .replace(/^(hi|hello|hey|greetings|please|kindly|can you|could you|what is|what are|how to|explain|summarize|tell me about|show me|help me with|i want to|where is|why does|how does|what|how|why|is|are)\s*[,:]?\s*/i, '')
        .replace(/[?.!]+$/, '')
        .trim();

      if (!clean || clean.length <= 2) {
        return 'New Conversation';
      }

      return clean.charAt(0).toUpperCase() + clean.slice(1);
    };

    if (!convId) {
      convId = `conv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      let cleanTitle = extractKeyTopic(message.text);
      if (cleanTitle.length > 35) {
        cleanTitle = cleanTitle.substring(0, 32) + '...';
      }

      const convTitle = title || cleanTitle;
      db.prepare(`
        INSERT INTO rag_conversations (id, title, scope, model, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(convId, convTitle, scope || 'everything', model || '');
    } else {
      if (message.sender === 'user') {
        let cleanTitle = extractKeyTopic(message.text);
        if (cleanTitle && cleanTitle !== 'New Conversation') {
          if (cleanTitle.length > 35) cleanTitle = cleanTitle.substring(0, 32) + '...';
          db.prepare('UPDATE rag_conversations SET title = ? WHERE id = ?').run(cleanTitle, convId);
        }
      }

      db.prepare(`
        UPDATE rag_conversations 
        SET updated_at = CURRENT_TIMESTAMP, scope = ?, model = ?
        WHERE id = ?
      `).run(scope || 'everything', model || '', convId);
    }

    const msgId = message.id || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    db.prepare(`
      INSERT INTO rag_messages (id, conversation_id, sender, text, sources, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      msgId,
      convId,
      message.sender || 'user',
      message.text,
      message.sources ? JSON.stringify(message.sources) : null,
      message.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    );

    res.json({ conversationId: convId, messageId: msgId });
  } catch (err: any) {
    console.error('Failed to save RAG conversation:', err);
    res.status(500).json({ error: err.message || 'Failed to save conversation' });
  }
});

// DELETE /api/ai/conversations/:id - Delete conversation
ragRouter.delete('/conversations/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM rag_conversations WHERE id = ?').run(id);
    db.prepare('DELETE FROM rag_messages WHERE conversation_id = ?').run(id);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Failed to delete conversation:', err);
    res.status(500).json({ error: err.message || 'Failed to delete conversation' });
  }
});
