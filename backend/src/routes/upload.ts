import { Router } from 'express';
import multer from 'multer';
import { Storage } from 'megajs';
import { db, userDbStorage } from '../db.js';
import { loadEnv } from '../env.js';
import { summarizeDocument } from '../services/summarize.js';

loadEnv();

export const uploadRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});

// Helper to extract userId from Auth header if AsyncLocalStorage was lost during Multer stream
function getUserIdFromReq(req: any): string | null {
  const existing = userDbStorage.getStore();
  if (existing) return existing;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
        return payload.sub || null;
      }
    } catch {}
  }
  return null;
}

uploadRouter.post('/', upload.single('file'), async (req, res) => {
  const userId = getUserIdFromReq(req);
  const runHandler = async () => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: 'No file provided' });
      }


    const title = req.body.title || file.originalname;
    const linkedBlockId = req.body.linked_block_id || null;
    let tags: string[] = [];
    if (req.body.tags) {
      try {
        tags = Array.isArray(req.body.tags) ? req.body.tags : JSON.parse(req.body.tags);
      } catch {
        tags = typeof req.body.tags === 'string' ? req.body.tags.split(',').map((t: string) => t.trim()) : [];
      }
    }
    const summarize = req.body.summarize === 'true';
    const model = req.body.model || undefined;

    // -----------------------------------------------------------------------
    // Step 1: Determine resource type & extract text content
    // -----------------------------------------------------------------------
    const ext = file.originalname.toLowerCase();
    const isImage = file.mimetype.startsWith('image/');
    const isPdf = file.mimetype === 'application/pdf' || ext.endsWith('.pdf');
    const isWord =
      file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.mimetype === 'application/msword' ||
      ext.endsWith('.docx') ||
      ext.endsWith('.doc');
    const isText = file.mimetype.startsWith('text/') || ext.endsWith('.txt') || ext.endsWith('.md');
    const isDocument = isPdf || isWord || isText;

    let extractedText: string | null = null;
    let summaryText: string | null = null;

    if (isDocument) {
      try {
        console.log(`[Upload] Extracting text from ${file.originalname} (${file.mimetype})...`);
        // Always extract raw text for RAG search; summarize only if explicitly requested
        const result = await summarizeDocument(
          file.buffer,
          file.mimetype,
          summarize ? model : undefined
        );
        extractedText = result.rawText;  // Full text for RAG indexing
        summaryText = summarize ? result.summary : null;  // AI summary (optional)
        console.log(`[Upload] Text extraction successful (${result.textLength} chars extracted${summarize ? ', summary generated' : ''}).`);
      } catch (extractErr: any) {
        console.warn('[Upload] Text extraction warning:', extractErr.message || extractErr);
        extractedText = `[Could not extract text from ${file.originalname}: ${extractErr.message}]`;
      }
    }

    // -----------------------------------------------------------------------
    // Step 2: Determine content to store in SQLite
    // -----------------------------------------------------------------------
    const resourceType = isImage ? 'image' : 'file';

    // Dynamic file-type label — used in the stored content prefix so RAG search
    // correctly identifies the source document format.
    const fileTypeLabel = isImage ? '🖼️ Image'
      : isPdf   ? '📄 PDF'
      : isWord  ? '📝 Word Document'
      : isText  ? '📃 Text File'
      : '📁 File';

    let contentToStore = extractedText && extractedText.length > 0
      ? extractedText
      : `${fileTypeLabel}: ${file.originalname}`;

    // -----------------------------------------------------------------------
    // Step 3: SAVE TO LOCAL SQLITE IMMEDIATELY (0ms latency)
    // -----------------------------------------------------------------------
    const resourceId = `res-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const parsedTags = JSON.stringify([
      ...tags,
      ...(isPdf ? ['pdf'] : isWord ? ['docx'] : isText ? ['text'] : ['file']),
      'uploaded',
    ]);

    db.prepare(`
      INSERT INTO resources (id, type, title, url_or_content, tags, linked_block_id, summary)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      resourceId,
      resourceType,
      title,
      `${fileTypeLabel}: ${file.originalname}\n\n${contentToStore}`,
      parsedTags,
      linkedBlockId,
      summaryText,
    );

    console.log(`[Upload] ✅ Resource saved to SQLite immediately with ID: ${resourceId}`);

    // -----------------------------------------------------------------------
    // Step 4: Background upload to MEGA cloud (Non-blocking)
    // -----------------------------------------------------------------------
    const megaEmail = process.env.MEGA_EMAIL;
    const megaPassword = process.env.MEGA_PASSWORD;
    const megaConfigured = megaEmail && megaPassword && megaEmail !== 'your_mega_email@example.com';

    if (megaConfigured) {
      // Fire-and-forget background upload so UI never waits or hangs
      (async () => {
        try {
          console.log(`[Upload Background] Uploading ${file.originalname} to MEGA...`);
          const storage = await new Storage({ email: megaEmail, password: megaPassword }).ready;
          if ((storage as any).api) {
            (storage as any).api.on('error', () => {});
          }
          let targetFolder = storage.root.find('Planner_Uploads') || await storage.root.mkdir('Planner_Uploads');
          const fileExtension = file.originalname.includes('.') ? file.originalname.split('.').pop() : '';
          const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${fileExtension ? '.' + fileExtension : ''}`;
          
          const megaFile = await new Promise<any>((resolve, reject) => {
            targetFolder!.upload({ name: uniqueFileName, size: file.size }, file.buffer, (err: any, uploadedFile: any) => {
              if (err) reject(err); else resolve(uploadedFile);
            });
          });
          
          const link = await megaFile.link();
          storage.close();
          console.log(`[Upload Background] ✅ MEGA upload finished: ${link}`);

          // Update SQLite record with the Mega link
          const updatedContent = `${fileTypeLabel}: ${file.originalname}\n🔗 MEGA Link: ${link}\n\n${contentToStore}`;
          db.prepare('UPDATE resources SET url_or_content = ? WHERE id = ?').run(updatedContent, resourceId);
        } catch (bgErr: any) {
          console.warn('[Upload Background] MEGA upload warning:', bgErr.message || bgErr);
        }
      })();
    }

    const savedResource = db.prepare('SELECT * FROM resources WHERE id = ?').get(resourceId);

    return res.status(200).json({
      success: true,
      message: 'File saved locally. Content is ready for RAG Chat.',
      resource: savedResource,
      ragSearchable: isDocument,
      extractedLength: extractedText ? extractedText.length : 0,
    });

  } catch (err: any) {
    console.error('[Upload] Error during upload process:', err.message || err);
    return res.status(500).json({ error: err.message || 'File upload failed' });
  }
  };

  if (userId) {
    return userDbStorage.run(userId, runHandler);
  } else {
    return runHandler();
  }
});

