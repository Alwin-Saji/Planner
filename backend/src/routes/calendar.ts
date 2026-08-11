import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { generateAuthUrl, exchangeCodeForTokens, getStoredTokens, clearStoredTokens, saveStoredTokens } from '../services/gcalService.js';

export const calendarRouter = Router();

// Helper to format ISO date strings for iCalendar (YYYYMMDDTHHMMSSZ or YYYYMMDDTHHMMSS)
function formatICalDate(dateStr: string, timeStr: string): string {
  // dateStr is 'YYYY-MM-DD', timeStr is 'HH:MM'
  const cleanDate = dateStr.replace(/-/g, '');
  const cleanTime = timeStr.replace(/:/g, '') + '00';
  return `${cleanDate}T${cleanTime}`;
}

// Helper to build a direct Google Calendar web event creation URL
export function generateGoogleCalendarUrl(block: {
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  category?: string;
}): string {
  const startIso = formatICalDate(block.date, block.start_time);
  const endIso = formatICalDate(block.date, block.end_time);

  const baseUrl = 'https://calendar.google.com/calendar/render';
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: block.title,
    dates: `${startIso}/${endIso}`,
    details: `Chrono Planner Task [Category: ${block.category || 'General'}]`,
  });

  return `${baseUrl}?${params.toString()}`;
}

// GET /api/calendar/feed.ics — Returns calendar feed in iCal standard format based on mode
calendarRouter.get('/feed.ics', (req: Request, res: Response) => {
  try {
    const mode = (req.query.mode as string) || 'all';

    let query = "SELECT * FROM blocks WHERE status != 'skipped'";
    if (mode === 'disabled') {
      query += " AND 1=0"; // empty feed
    } else if (mode === 'selected') {
      query += " AND (calendar_sync_enabled = 1 OR calendar_sync_enabled IS NULL)";
    }

    query += " ORDER BY date ASC, start_time ASC";

    const blocks = db.prepare(query).all() as Array<{
      id: string;
      title: string;
      date: string;
      start_time: string;
      end_time: string;
      category?: string;
      status?: string;
      calendar_sync_enabled?: number;
      created_at?: string;
    }>;

    let icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Chrono Planner//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Chrono Planner Schedule',
      'X-WR-TIMEZONE:UTC'
    ];

    for (const b of blocks) {
      if (!b.date || !b.start_time || !b.end_time) continue;

      const dtStart = formatICalDate(b.date, b.start_time);
      const dtEnd = formatICalDate(b.date, b.end_time);

      icsContent.push(
        'BEGIN:VEVENT',
        `UID:block-${b.id}@chronoplanner`,
        `DTSTAMP:${formatICalDate(new Date().toISOString().split('T')[0], '00:00')}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:${b.title || 'Untitled Block'}`,
        `DESCRIPTION:Chrono Planner block (${b.category || 'General'}) - Status: ${b.status || 'planned'}`,
        `STATUS:${b.status === 'done' ? 'CONFIRMED' : 'TENTATIVE'}`,
        'END:VEVENT'
      );
    }

    icsContent.push('END:VCALENDAR');

    const result = icsContent.join('\r\n');

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="chrono-planner.ics"');
    res.send(result);
  } catch (err: any) {
    console.error('Error generating iCal feed:', err);
    res.status(500).json({ error: 'Failed to generate calendar feed' });
  }
});

// GET /api/calendar/gcal-link — Returns a direct Google Calendar URL for a given block
calendarRouter.get('/gcal-link', (req: Request, res: Response) => {
  const { title, date, start_time, end_time, category } = req.query;

  if (!title || !date || !start_time || !end_time) {
    return res.status(400).json({ error: 'Missing block timing parameters' });
  }

  const url = generateGoogleCalendarUrl({
    title: String(title),
    date: String(date),
    start_time: String(start_time),
    end_time: String(end_time),
    category: category ? String(category) : undefined
  });

  res.json({ url });
});

// ---------------------------------------------------------------------------
// Google Calendar OAuth2 API Integration Endpoints
// ---------------------------------------------------------------------------

// GET /api/calendar/oauth/url — Get Google OAuth2 login authorization URL
calendarRouter.get('/oauth/url', (req: Request, res: Response) => {
  try {
    const url = generateAuthUrl();
    res.json({ url });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to generate OAuth URL' });
  }
});

// GET /api/calendar/oauth/callback — OAuth redirect handler
calendarRouter.get('/oauth/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string;
  if (!code) {
    return res.status(400).send('Missing authorization code');
  }

  try {
    await exchangeCodeForTokens(code);
    res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>Google Calendar Connected</title></head>
        <body style="background:#09090b;color:#f4f4f5;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
          <div style="text-align:center;background:#18181b;padding:32px;border-radius:16px;border:1px solid #27272a;">
            <h2 style="color:#3b82f6;margin-top:0;">Google Calendar Connected!</h2>
            <p style="color:#a1a1aa;font-size:14px;">Chrono Planner will now automatically sync your scheduled blocks into Google Calendar.</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'GCAL_CONNECTED' }, '*');
              }
              setTimeout(() => window.close(), 1500);
            </script>
          </div>
        </body>
      </html>
    `);
  } catch (err: any) {
    console.error('OAuth Callback Error:', err);
    res.status(500).send(`Authentication failed: ${err.message}`);
  }
});

// POST /api/calendar/tokens/supabase — Save Google provider tokens from frontend Supabase session
calendarRouter.post('/tokens/supabase', (req: Request, res: Response) => {
  const { provider_token, provider_refresh_token } = req.body;
  if (!provider_token) {
    return res.status(400).json({ error: 'Missing provider_token' });
  }

  try {
    saveStoredTokens({
      access_token: provider_token,
      refresh_token: provider_refresh_token || null,
      expires_in: 3599, // default google token lifespan
    });
    res.json({ success: true });
  } catch (err: any) {
    console.error('Failed to save Supabase Google tokens:', err);
    res.status(500).json({ error: 'Failed to save tokens' });
  }
});

// GET /api/calendar/oauth/status — Check if Google Calendar API is connected
calendarRouter.get('/oauth/status', (req: Request, res: Response) => {
  const tokens = getStoredTokens();
  const connected = !!(tokens && (tokens.access_token || tokens.refresh_token));
  res.json({ connected });
});

// POST /api/calendar/oauth/disconnect — Disconnect Google Calendar API
calendarRouter.post('/oauth/disconnect', (req: Request, res: Response) => {
  clearStoredTokens();
  res.json({ success: true });
});
