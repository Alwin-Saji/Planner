import { db } from '../db.js';

interface BlockItem {
  id: string;
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  category?: string;
  status?: string;
  calendar_sync_enabled?: number | boolean;
  gcal_event_id?: string;
}

export function getStoredTokens(): any | null {
  try {
    const row = db.prepare("SELECT tokens_json FROM gcal_tokens WHERE id = 'default'").get() as { tokens_json: string } | undefined;
    if (row && row.tokens_json) {
      return JSON.parse(row.tokens_json);
    }
  } catch (err) {
    console.error('[GCal Service] Error reading OAuth tokens:', err);
  }
  return null;
}

export function saveStoredTokens(tokens: any): void {
  try {
    const jsonStr = JSON.stringify(tokens);
    db.prepare(`
      INSERT INTO gcal_tokens (id, tokens_json, updated_at)
      VALUES ('default', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET tokens_json = excluded.tokens_json, updated_at = CURRENT_TIMESTAMP
    `).run(jsonStr);
  } catch (err) {
    console.error('[GCal Service] Error saving OAuth tokens:', err);
  }
}

export function clearStoredTokens(): void {
  try {
    db.prepare("DELETE FROM gcal_tokens WHERE id = 'default'").run();
  } catch (err) {
    console.error('[GCal Service] Error clearing OAuth tokens:', err);
  }
}

function getGoogleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/calendar/oauth/callback';
  return { clientId, clientSecret, redirectUri };
}

export function generateAuthUrl(): string {
  const { clientId, redirectUri } = getGoogleConfig();
  if (!clientId) {
    throw new Error('GOOGLE_CLIENT_ID is not configured in .env');
  }

  const scope = encodeURIComponent('https://www.googleapis.com/auth/calendar.events');
  return `https://accounts.google.com/o/oauth2/v2/auth?` +
    `response_type=code` +
    `&client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${scope}` +
    `&access_type=offline` +
    `&prompt=consent`;
}

export async function exchangeCodeForTokens(code: string): Promise<any> {
  const { clientId, clientSecret, redirectUri } = getGoogleConfig();

  const params = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code'
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description || data.error || 'Failed to exchange auth code');
  }

  saveStoredTokens(data);
  return data;
}

async function getValidAccessToken(): Promise<string | null> {
  let tokens = getStoredTokens();
  if (!tokens) return null;

  // Check if token needs refresh
  if (tokens.refresh_token && tokens.expires_in) {
    // If we have a refresh token, refresh to get a fresh access token
    const { clientId, clientSecret } = getGoogleConfig();
    try {
      const params = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tokens.refresh_token,
        grant_type: 'refresh_token'
      });

      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      });

      const data = await res.json();
      if (res.ok && data.access_token) {
        tokens.access_token = data.access_token;
        if (data.expires_in) tokens.expires_in = data.expires_in;
        saveStoredTokens(tokens);
      }
    } catch (e) {
      console.warn('[GCal Service] Token refresh attempt failed:', e);
    }
  }

  return tokens.access_token || null;
}

// Push block event silently into Google Calendar
export async function syncBlockToGoogleCalendar(block: BlockItem): Promise<string | null> {
  if (block.calendar_sync_enabled === 0 || block.calendar_sync_enabled === false) {
    // If sync disabled for this block, remove if it exists in Google Calendar
    if (block.gcal_event_id) {
      await deleteGoogleCalendarEvent(block.gcal_event_id);
    }
    return null;
  }

  const accessToken = await getValidAccessToken();
  if (!accessToken) return null;

  const startIso = `${block.date}T${block.start_time}:00`;
  const endIso = `${block.date}T${block.end_time}:00`;
  const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const eventPayload = {
    summary: block.title,
    description: `Chrono Planner Task [Category: ${block.category || 'General'}]`,
    start: { 
      dateTime: startIso,
      timeZone: localTimeZone
    },
    end: { 
      dateTime: endIso,
      timeZone: localTimeZone
    }
  };

  try {
    if (block.gcal_event_id) {
      // Patch existing event
      const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${block.gcal_event_id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(eventPayload)
      });
      if (res.ok) {
        return block.gcal_event_id;
      }
    }

    // Insert new event
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(eventPayload)
    });

    const data = await res.json();
    if (res.ok && data.id) {
      db.prepare('UPDATE blocks SET gcal_event_id = ? WHERE id = ?').run(data.id, block.id);
      return data.id;
    } else {
      console.warn('[GCal Service] Failed to create Google Calendar event:', data);
    }
  } catch (err) {
    console.error('[GCal Service] Error syncing event to Google Calendar API:', err);
  }

  return null;
}

// Delete event from Google Calendar API
export async function deleteGoogleCalendarEvent(gcalEventId: string): Promise<void> {
  if (!gcalEventId) return;
  const accessToken = await getValidAccessToken();
  if (!accessToken) return;

  try {
    await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${gcalEventId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
  } catch (err) {
    console.error('[GCal Service] Error deleting Google Calendar event:', err);
  }
}
