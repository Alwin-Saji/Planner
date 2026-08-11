import { createClient } from '@supabase/supabase-js';
import { loadEnv } from './env.js';

loadEnv();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Warning: SUPABASE_URL or SUPABASE_ANON_KEY is missing from environment variables.');
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : new Proxy({}, {
      get() {
        throw new Error('[Supabase] Client is not initialized. Please ensure SUPABASE_URL and SUPABASE_ANON_KEY are configured in your backend .env file.');
      }
    }) as any;
