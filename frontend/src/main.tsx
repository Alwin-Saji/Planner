import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.tsx';
import './index.css';
import { getSupabaseClient } from './supabaseClient';

// Global Fetch Interceptor for Supabase Auth Headers
const originalFetch = window.fetch;
window.fetch = async (input, init) => {
  // Only intercept /api routes
  const urlStr = typeof input === 'string' ? input : (input as Request).url || '';
  if (urlStr.includes('/api')) {
    const supabase = getSupabaseClient();
    const headers = {
      ...(init?.headers || {}),
    } as Record<string, string>;

    if (supabase) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }
      } catch (e) {
        console.warn('[Fetch Interceptor] Failed to attach token:', e);
      }
    }
    return originalFetch(input, {
      ...init,
      headers,
    });
  }
  return originalFetch(input, init);
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
