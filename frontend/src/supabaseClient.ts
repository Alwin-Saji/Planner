export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export function getSupabaseConfig(): SupabaseConfig {
  const url = (import.meta as any).env?.VITE_SUPABASE_URL || localStorage.getItem('supabase_url') || '';
  const anonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || localStorage.getItem('supabase_anon_key') || '';
  return { url, anonKey };
}

export function setSupabaseConfig(url: string, anonKey: string) {
  localStorage.setItem('supabase_url', url);
  localStorage.setItem('supabase_anon_key', anonKey);
}

let cachedClient: any = null;
let lastUrl = '';
let lastAnonKey = '';

export function clearSupabaseConfig() {
  localStorage.removeItem('supabase_url');
  localStorage.removeItem('supabase_anon_key');
  cachedClient = null;
  lastUrl = '';
  lastAnonKey = '';
}

export function getSupabaseClient() {
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) return null;
  
  if (cachedClient && url === lastUrl && anonKey === lastAnonKey) {
    return cachedClient;
  }

  const supabaseLib = (window as any).supabase;
  if (supabaseLib && typeof supabaseLib.createClient === 'function') {
    try {
      cachedClient = supabaseLib.createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: window.localStorage
        }
      });
      lastUrl = url;
      lastAnonKey = anonKey;
      return cachedClient;
    } catch (e) {
      console.error('Error creating Supabase client:', e);
      return null;
    }
  }
  return null;
}
