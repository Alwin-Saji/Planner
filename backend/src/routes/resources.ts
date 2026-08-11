import { Router, Request, Response } from 'express';
import { db, userDbStorage } from '../db.js';

export const resourcesRouter = Router();

// GET /api/resources/whoami
resourcesRouter.get('/whoami', (req: Request, res: Response) => {
  const userId = userDbStorage.getStore();
  res.json({ userId: userId || 'null (unauthenticated)' });
});

// GET /api/resources
resourcesRouter.get('/', (req: Request, res: Response) => {
  const { type, tag } = req.query;
  let query = 'SELECT * FROM resources';
  const params: any[] = [];

  if (type) {
    query += ' WHERE type = ?';
    params.push(type);
  }

  query += ' ORDER BY created_at DESC';
  let resources = db.prepare(query).all(...params) as any[];

  // ---------------------------------------------------------------------------
  // Self-healing: fix any resources that were incorrectly saved as type='note'
  // by an older version of the upload route. Silently corrects them in-place.
  // ---------------------------------------------------------------------------
  const uploadedNotes = resources.filter(r => {
    if (r.type !== 'note') return false;
    try {
      const tags: string[] = JSON.parse(r.tags || '[]');
      return tags.some(t => ['uploaded', 'pdf', 'docx', 'doc', 'txt', 'md'].includes(t.toLowerCase()));
    } catch { return false; }
  });
  if (uploadedNotes.length > 0) {
    const fixStmt = db.prepare("UPDATE resources SET type = 'file' WHERE id = ?");
    for (const r of uploadedNotes) {
      fixStmt.run(r.id);
      r.type = 'file'; // update in-memory too so response is immediately correct
    }
    console.log(`[Resources] Self-healed ${uploadedNotes.length} resource(s) with wrong type 'note' → 'file'`);
  }

  if (tag) {
    const searchTag = (tag as string).toLowerCase();
    resources = resources.filter(r => {
      try {
        const tags: string[] = JSON.parse(r.tags || '[]');
        return tags.some(t => t.toLowerCase().includes(searchTag));
      } catch {
        return false;
      }
    });
  }

  console.log(`[Resources API] GET /api/resources returning ${resources.length} item(s)`);
  res.json(resources);
});


// GET /api/resources/oembed?url=...
resourcesRouter.get('/oembed', async (req: Request, res: Response) => {
  const { url } = req.query;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL query parameter is required' });
  }

  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const response = await fetch(oembedUrl);
    
    if (response.ok) {
      const data = await response.json();
      return res.json(data);
    }

    // Fallback: If YouTube oEmbed returns 404 for playlists or search query URLs, scrape the first video ID
    const htmlRes = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
    if (htmlRes.ok) {
      const html = await htmlRes.text();
      const videoIdMatch = html.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/);
      if (videoIdMatch && videoIdMatch[1]) {
        const videoId = videoIdMatch[1];
        return res.json({
          title: 'YouTube Playlist / Search Result',
          thumbnail_url: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          video_id: videoId,
          video_url: `https://www.youtube.com/watch?v=${videoId}`,
        });
      }
    }

    return res.status(404).json({ error: 'Could not fetch YouTube video metadata' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch YouTube oEmbed data' });
  }
});

// POST /api/resources
resourcesRouter.post('/', (req: Request, res: Response) => {
  const { type, title, url_or_content, tags, linked_block_id } = req.body;

  if (!type || !title || !url_or_content) {
    return res.status(400).json({ error: 'Missing required resource fields' });
  }

  const id = `res-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const parsedTags = Array.isArray(tags) ? JSON.stringify(tags) : (typeof tags === 'string' ? tags : '[]');

  db.prepare(`
    INSERT INTO resources (id, type, title, url_or_content, tags, linked_block_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, type, title, url_or_content, parsedTags, linked_block_id || null);

  const created = db.prepare('SELECT * FROM resources WHERE id = ?').get(id);
  res.status(201).json(created);
});

// PUT /api/resources/:id
resourcesRouter.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM resources WHERE id = ?').get(id) as any;

  if (!existing) {
    return res.status(404).json({ error: 'Resource not found' });
  }

  const type = req.body.type ?? existing.type;
  const title = req.body.title ?? existing.title;
  const url_or_content = req.body.url_or_content ?? existing.url_or_content;
  const tags = req.body.tags !== undefined ? (Array.isArray(req.body.tags) ? JSON.stringify(req.body.tags) : req.body.tags) : existing.tags;
  const linked_block_id = req.body.linked_block_id !== undefined ? req.body.linked_block_id : existing.linked_block_id;

  db.prepare(`
    UPDATE resources
    SET type = ?, title = ?, url_or_content = ?, tags = ?, linked_block_id = ?
    WHERE id = ?
  `).run(type, title, url_or_content, tags, linked_block_id, id);

  const updated = db.prepare('SELECT * FROM resources WHERE id = ?').get(id);
  res.json(updated);
});

// DELETE /api/resources/:id
resourcesRouter.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  db.prepare('DELETE FROM resources WHERE id = ?').run(id);
  // Clean up cached embeddings so orphaned vectors don't persist
  db.prepare('DELETE FROM embeddings WHERE resource_id = ?').run(id);
  res.json({ success: true, id });
});


// ---------------------------------------------------------------------------
// POST /api/resources/batch
// Inserts many resources in a single SQLite transaction.
// Used by the Study Plan Wizard and Markdown Importer.
// ---------------------------------------------------------------------------
resourcesRouter.post('/batch', (req: Request, res: Response) => {
  const { resources } = req.body;

  if (!Array.isArray(resources) || resources.length === 0) {
    return res.status(400).json({ error: 'resources array is required and must not be empty' });
  }

  const insertStmt = db.prepare(`
    INSERT INTO resources (id, type, title, url_or_content, tags, linked_block_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertedIds: string[] = [];
  const skipped: number[] = [];

  const insertTransaction = db.transaction(() => {
    for (let i = 0; i < resources.length; i++) {
      const r = resources[i];
      if (!r.type || !r.title || !r.url_or_content) {
        skipped.push(i);
        continue;
      }
      const id = r.id || `res-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const parsedTags = Array.isArray(r.tags)
        ? JSON.stringify(r.tags)
        : (typeof r.tags === 'string' ? r.tags : '[]');
      insertStmt.run(id, r.type, r.title, r.url_or_content, parsedTags, r.linked_block_id || null);
      insertedIds.push(id);
    }
  });

  try {
    insertTransaction();

    // Fetch the actual DB-inserted rows so response contains real timestamps & fields
    const fetchStmt = db.prepare('SELECT * FROM resources WHERE id = ?');
    const insertedResources = insertedIds.map((id: string) => fetchStmt.get(id)).filter(Boolean);

    res.status(201).json({
      success: true,
      insertedCount: insertedIds.length,
      skippedCount: skipped.length,
      skippedIndices: skipped.length > 0 ? skipped : undefined,
      resources: insertedResources,
    });
  } catch (err: any) {
    console.error('Batch resource insert failed:', err);
    res.status(500).json({ error: err.message || 'Batch insert failed' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/resources/seed
// Triggers manually seeding curated courses into the database
// ---------------------------------------------------------------------------
resourcesRouter.post('/seed', (req: Request, res: Response) => {
  try {
    const { seedCuratedCourses } = require('../services/curatedCoursesSeed.js');
    const result = seedCuratedCourses();
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to seed courses' });
  }
});



