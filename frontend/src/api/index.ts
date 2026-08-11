import { Block, Resource, DailyLog, AdherenceSummary, OllamaStatus, AISuggestion, WeeklyReviewData, LearningPath, FatigueReport, EnergyProfile, RescheduleSlot } from '../types';
import { getSupabaseClient } from '../supabaseClient';

export const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/api';

// ---------------------------------------------------------------------------
// Cached auth token — updated whenever Supabase session changes.
// getAuthHeaders() reads this synchronously, adding zero network latency.
// ---------------------------------------------------------------------------
let _cachedToken: string | null = null;

/**
 * Call this once at startup and whenever auth state changes.
 * Stores the Supabase JWT so every API call can include it without
 * making a separate getSession() network round-trip.
 */
export async function refreshAuthToken(): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    _cachedToken = null;
    return;
  }
  try {
    const { data } = await supabase.auth.getSession();
    _cachedToken = data.session?.access_token ?? null;
  } catch {
    _cachedToken = null;
  }
}

/**
 * One-time migration: moves any resources that were saved in the default
 * planner.db (unauthenticated uploads) into the authenticated user's DB.
 * Safe to call on every login — it is a no-op if there's nothing to move.
 */
export async function migrateToUser(): Promise<void> {
  if (!_cachedToken) return; // not logged in — nothing to migrate
  try {
    const res = await fetch(`${API_BASE}/debug/migrate-to-user`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    const result = await res.json();
    if (result.moved > 0) {
      console.log(`[Migration] Moved ${result.moved} resource(s) from default DB → user DB:`, result.resources?.map((r: any) => r.title));
    }
  } catch (err) {
    // Non-fatal — resources will still show on next reload once the user uploads again
    console.warn('[Migration] Auto-migration skipped:', err);
  }
}


/**
 * Returns the Authorization header if the user is logged in, or {} if not.
 * Always reads from the in-memory cache — no async Supabase call needed.
 */
function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = _cachedToken ? { Authorization: `Bearer ${_cachedToken}` } : {};
  const customOllama = localStorage.getItem('custom_ollama_url');
  if (customOllama) {
    headers['X-Ollama-URL'] = customOllama.trim();
  }
  return headers;
}

export async function fetchBlocks(params?: { date?: string; startDate?: string; endDate?: string }): Promise<Block[]> {
  const query = new URLSearchParams();
  if (params?.date) query.append('date', params.date);
  if (params?.startDate) query.append('startDate', params.startDate);
  if (params?.endDate) query.append('endDate', params.endDate);

  const res = await fetch(`${API_BASE}/blocks?${query.toString()}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch blocks');
  return res.json();
}

export async function createBlock(blockData: Partial<Block>): Promise<Block> {
  const res = await fetch(`${API_BASE}/blocks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(blockData),
  });
  if (!res.ok) throw new Error('Failed to create block');
  return res.json();
}

export async function updateBlock(id: string, updates: Partial<Block>): Promise<Block> {
  const res = await fetch(`${API_BASE}/blocks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('Failed to update block');
  return res.json();
}

export async function deleteBlock(id: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/blocks/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete block');
  return res.json();
}

export async function autoScheduleBreaks(date: string): Promise<{ message: string; count: number }> {
  const res = await fetch(`${API_BASE}/blocks/auto-breaks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ date }),
  });
  if (!res.ok) throw new Error('Failed to auto-schedule breaks');
  return res.json();
}

export async function fetchResources(params?: { type?: string; tag?: string }): Promise<Resource[]> {
  const query = new URLSearchParams();
  if (params?.type) query.append('type', params.type);
  if (params?.tag) query.append('tag', params.tag);

  const headers = getAuthHeaders();
  console.log('[fetchResources] Sending request with headers:', headers);
  
  try {
    const whoami = await fetch(`${API_BASE}/resources/whoami`, { headers });
    const whoamiData = await whoami.json();
    console.log('[fetchResources] Backend identifies this session as:', whoamiData.userId);
  } catch (e) {
    console.error('[fetchResources] Failed to check whoami:', e);
  }

  const res = await fetch(`${API_BASE}/resources?${query.toString()}`, {
    headers,
  });
  if (!res.ok) throw new Error('Failed to fetch resources');
  const data = await res.json();
  console.log(`[fetchResources] Fetched ${data.length} resources from backend`);
  return data;
}

export async function createResource(resourceData: Partial<Resource>): Promise<Resource> {
  const res = await fetch(`${API_BASE}/resources`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(resourceData),
  });
  if (!res.ok) throw new Error('Failed to create resource');
  return res.json();
}

export async function updateResource(id: string, updates: Partial<Resource>): Promise<Resource> {
  const res = await fetch(`${API_BASE}/resources/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('Failed to update resource');
  return res.json();
}

export async function deleteResource(id: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/resources/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete resource');
  return res.json();
}

export async function fetchYouTubeOembed(url: string): Promise<any> {
  const res = await fetch(`${API_BASE}/resources/oembed?url=${encodeURIComponent(url)}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch YouTube metadata');
  return res.json();
}

export async function fetchLogs(): Promise<{ logs: DailyLog[]; summary: AdherenceSummary }> {
  const res = await fetch(`${API_BASE}/logs`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch daily logs');
  return res.json();
}

export async function fetchOllamaStatus(): Promise<OllamaStatus> {
  // Ollama status is global — no auth header needed (reads no user data)
  const res = await fetch(`${API_BASE}/ai/status`);
  if (!res.ok) return { available: false, installedModels: [], popularModels: ['llama3.2', 'mistral', 'deepseek-r1', 'qwen2.5'], currentModel: 'llama3.2' };
  return res.json();
}

export async function startOllama(): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/ai/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Failed to send start Ollama command');
  return res.json();
}

export async function pullOllamaModel(model: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/ai/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model }),
  });
  if (!res.ok) throw new Error('Failed to start model download');
  return res.json();
}

export async function postRagChat(query: string, scope: string = 'everything', model?: string, mode: string = 'grounded'): Promise<{ answer: string; sources: any[]; suggestedBlock?: any; offline: boolean }> {
  const res = await fetch(`${API_BASE}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ query, scope, model, mode }),
  });
  if (!res.ok) throw new Error('Failed to send RAG chat query');
  return res.json();
}

export async function fetchAISuggestions(model?: string, date?: string): Promise<{ suggestions: AISuggestion[] }> {
  const res = await fetch(`${API_BASE}/ai/suggestions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ model, date }),
  });
  if (!res.ok) throw new Error('Failed to fetch AI suggestions');
  const data = await res.json();
  const rawSuggestions = data.suggestions || [];
  const suggestions: AISuggestion[] = rawSuggestions.map((item: any, idx: number) => {
    if (typeof item === 'string') {
      return {
        id: `sug-${idx + 1}`,
        type: idx === 0 ? 'opportunity' : idx === 1 ? 'warning' : 'insight',
        title: item.length > 30 ? item.slice(0, 30) + '...' : item,
        description: item,
        actionLabel: 'Apply Tip',
      };
    }
    return {
      id: item.id || `sug-${idx + 1}`,
      type: item.type || 'insight',
      title: item.title || item.description || `Optimization ${idx + 1}`,
      description: item.description || item.title || '',
      actionLabel: item.actionLabel || 'Apply',
      actionType: item.actionType,
      category: item.category,
      suggestedBreak: item.suggestedBreak,
    };
  });
  return { suggestions };
}

export async function fetchWeeklyReview(): Promise<WeeklyReviewData> {
  const res = await fetch(`${API_BASE}/review/weekly`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch weekly review');
  return res.json();
}

export async function generateStudyPlan(data: {
  topic: string;
  category?: string;
  startDate?: string;
  durationDays?: number;
  hoursPerDay?: number;
  referenceUrl?: string;
  selectedChannels?: any[];
  model?: string;
  skillLevel?: string;
  learningGoal?: string;
  learningContext?: string;
  videoType?: string;
  longCourseUrl?: string;
}) {
  const res = await fetch(`${API_BASE}/ai/generate-study-plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to generate study plan');
  return res.json();
}

export async function recommendChannels(data: {
  topic: string;
  skill_level?: string;
  learning_goal?: string;
  learning_context?: string;
  specific_focus?: string;
  video_type?: string;
}) {
  const res = await fetch(`${API_BASE}/ai/recommend-channels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to fetch recommended channels');
  return res.json();
}

export async function parseMarkdown(markdown_content: string, default_category?: string, start_date?: string) {
  const res = await fetch(`${API_BASE}/ai/parse-markdown`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({
      markdownContent: markdown_content,
      markdown_content,
      category: default_category,
      default_category,
      startDate: start_date,
      start_date,
    }),
  });
  if (!res.ok) throw new Error('Failed to parse markdown');
  return res.json();
}

export async function searchResourcesAPI(data: {
  topic: string;
  skillLevel?: string;
  learningGoal?: string;
  maxPerSource?: number;
  sources?: string[];
  model?: string;
}) {
  const res = await fetch(`${API_BASE}/ai/search-resources`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to search resources');
  return res.json();
}

export async function fetchRagConversations() {
  const res = await fetch(`${API_BASE}/ai/conversations`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch RAG conversations');
  return res.json();
}

export async function fetchRagConversationById(id: string) {
  const res = await fetch(`${API_BASE}/ai/conversations/${id}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch conversation');
  return res.json();
}

export async function saveRagConversationMessage(data: {
  id?: string;
  title?: string;
  scope?: string;
  model?: string;
  message: { id?: string; sender: 'user' | 'ai'; text: string; sources?: any[]; timestamp?: string };
}) {
  const res = await fetch(`${API_BASE}/ai/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to save conversation message');
  return res.json();
}

export async function deleteRagConversation(id: string) {
  const res = await fetch(`${API_BASE}/ai/conversations/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete conversation');
  return res.json();
}

export interface TechAdvisorRecommendation {
  currentFocus: string;
  adherencePct: number;
  recommendation: {
    nextStack: string;
    focusDescription: string;
    rationale: string;
    actionLabel: string;
  };
  breakAdvisor: {
    status: 'healthy' | 'caution' | 'burnout';
    message: string;
    consecutiveWithoutRest: number;
    completedToday: number;
  };
}

export async function fetchTechAdvisorRecommendation(): Promise<TechAdvisorRecommendation> {
  const res = await fetch(`${API_BASE}/advisor/recommendation`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch tech stack & break recommendations');
  return res.json();
}

export async function uploadResourceFile(formData: FormData): Promise<Resource> {
  // NOTE: do NOT set Content-Type for multipart/form-data — browser sets it automatically
  const res = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to upload file');
  }
  const data = await res.json();
  return data.resource;
}

// ---------------------------------------------------------------------------
// Batch helpers — single round-trip per resource type instead of N requests.
// ---------------------------------------------------------------------------

export async function createBlocksBatch(blocks: Partial<Block>[]): Promise<{
  success: boolean;
  insertedCount: number;
  affectedDates: string[];
  blocks: Block[];
}> {
  const res = await fetch(`${API_BASE}/blocks/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ blocks }),
  });
  if (!res.ok) throw new Error('Failed to batch-create blocks');
  return res.json();
}

export async function createResourcesBatch(resources: Partial<Resource>[]): Promise<{
  success: boolean;
  insertedCount: number;
  resources: Resource[];
}> {
  const res = await fetch(`${API_BASE}/resources/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ resources }),
  });
  if (!res.ok) throw new Error('Failed to batch-create resources');
  return res.json();
}

// ---------------------------------------------------------------------------
// Learning Intelligence APIs
// ---------------------------------------------------------------------------

export async function fetchLearningPath(): Promise<LearningPath> {
  const res = await fetch(`${API_BASE}/learning/path`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch learning path');
  return res.json();
}

export async function fetchFatigueReport(): Promise<FatigueReport> {
  const res = await fetch(`${API_BASE}/learning/fatigue`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch fatigue report');
  return res.json();
}

export async function fetchEnergyProfile(): Promise<EnergyProfile> {
  const res = await fetch(`${API_BASE}/learning/energy-profile`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch energy profile');
  return res.json();
}

export async function fetchRescheduleSlots(skippedIds: string[]): Promise<{ slots: RescheduleSlot[] }> {
  const res = await fetch(`${API_BASE}/learning/reschedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ skippedIds }),
  });
  if (!res.ok) throw new Error('Failed to fetch reschedule slots');
  return res.json();
}

