// Ensure Node.js undici fetch allows up to 3 minutes for LLM generation headers/body
process.env.UNDICI_HEADERS_TIMEOUT = '180000'; // 3 minutes
process.env.UNDICI_BODY_TIMEOUT = '180000';    // 3 minutes

const OLLAMA_BASE_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const DEFAULT_MODEL = 'llama3.2';
const POPULAR_MODELS = ['llama3.2', 'mistral', 'deepseek-r1', 'qwen2.5', 'phi3', 'gemma2', 'codellama'];

export interface OllamaStatus {
  available: boolean;
  installedModels: string[];
  allModels?: string[];
  popularModels: string[];
  currentModel: string;
}

export async function checkOllamaStatus(): Promise<OllamaStatus> {
  let installedModels: string[] = [];
  let allModels: string[] = [];
  let available = false;

  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = (await res.json()) as { models: Array<{ name: string }> };
      allModels = (data.models || []).map(m => m.name);
      // Filter out embedding-only models from LLM generation select list
      installedModels = allModels.filter(
        m => !m.toLowerCase().includes('nomic') && !m.toLowerCase().includes('embed') && !m.toLowerCase().includes('bge')
      );
      available = true;
    }
  } catch (err) {
    try {
      const res = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const data = (await res.json()) as { models: Array<{ name: string }> };
        allModels = (data.models || []).map(m => m.name);
        installedModels = allModels.filter(
          m => !m.toLowerCase().includes('nomic') && !m.toLowerCase().includes('embed') && !m.toLowerCase().includes('bge')
        );
        available = true;
      }
    } catch {}
  }

  const currentModel = installedModels.length > 0 ? installedModels[0] : DEFAULT_MODEL;

  return {
    available,
    installedModels,
    allModels,
    popularModels: POPULAR_MODELS,
    currentModel,
  };
}

/** Quick boolean check — use this before attempting any generation. */
export async function isOllamaAvailable(): Promise<{ available: boolean; model: string }> {
  const status = await checkOllamaStatus();
  if (!status.available || status.installedModels.length === 0) {
    return { available: false, model: DEFAULT_MODEL };
  }
  // Find the first healthy (non-500) model
  const healthyModel = await findHealthyModel(status.installedModels);
  return {
    available: healthyModel !== null,
    model: healthyModel || status.installedModels[0],
  };
}

// Cache healthy model to avoid probing on every request (cleared every 5 min)
let _cachedHealthyModel: string | null = null;
let _cacheExpiry = 0;

/**
 * Probes installed models one by one until one responds with 200.
 * Uses a minimal prompt so the probe is fast.
 */
async function findHealthyModel(installedModels: string[]): Promise<string | null> {
  const now = Date.now();
  // Return cached result if still valid
  if (_cachedHealthyModel && now < _cacheExpiry && installedModels.includes(_cachedHealthyModel)) {
    return _cachedHealthyModel;
  }

  for (const model of installedModels) {
    try {
      const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt: 'Hi', stream: false }),
        signal: AbortSignal.timeout(60000), // Allow up to 60s for initial disk cold-start
      });
      if (res.ok) {
        _cachedHealthyModel = model;
        _cacheExpiry = now + 10 * 60 * 1000; // cache for 10 minutes
        console.log(`[Ollama] Healthy model confirmed & active: ${model}`);
        return model;
      } else {
        console.warn(`[Ollama] Model ${model} returned status ${res.status} — trying next installed model`);
      }
    } catch {
      console.warn(`[Ollama] Model ${model} probe timed out — trying next installed model`);
    }
  }

  return null;
}

/** Invalidate the model health cache (call after pulling a new model). */
export function invalidateModelCache() {
  _cachedHealthyModel = null;
  _cacheExpiry = 0;
}

export async function pullOllamaModel(modelName: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName, stream: false }),
    });

    if (res.ok) {
      return { success: true, message: `Model ${modelName} downloaded successfully!` };
    }
  } catch (err: any) {
    console.warn(`Failed to pull model ${modelName}`, err);
  }

  return { success: false, message: `Could not download model ${modelName}. Make sure Ollama is running, or run 'ollama pull ${modelName}' in your terminal.` };
}

export async function generateText(
  prompt: string,
  targetModel: string = DEFAULT_MODEL,
  options?: { num_predict?: number; num_ctx?: number; temperature?: number }
): Promise<{ text: string; offline: boolean }> {
  const status = await checkOllamaStatus();

  if (!status.available || status.installedModels.length === 0) {
    return { text: offlineFallbackMessage(), offline: true };
  }

  // If targetModel is an embedding model like nomic-embed-text, substitute with standard chat model
  if (targetModel.toLowerCase().includes('nomic') || targetModel.toLowerCase().includes('embed')) {
    targetModel = status.currentModel || DEFAULT_MODEL;
  }

  // Resolve model: prefer exact match, then substring match, then healthy fallback
  let activeModel = targetModel;
  if (!status.installedModels.includes(targetModel)) {
    const matched = status.installedModels.find(
      m => m.toLowerCase().includes(targetModel.toLowerCase()) || targetModel.toLowerCase().includes(m.toLowerCase())
    );
    activeModel = matched || targetModel;
  }

  // If the resolved model is not in the installed list (or is an embedding model), find a healthy one
  if (!status.installedModels.includes(activeModel) || activeModel.toLowerCase().includes('nomic') || activeModel.toLowerCase().includes('embed')) {
    const healthy = await findHealthyModel(status.installedModels);
    if (!healthy) return { text: offlineFallbackMessage(), offline: true };
    activeModel = healthy;
  }

  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: activeModel,
        prompt,
        stream: false,
        options: {
          num_gpu: 99,        // Full RTX 3050 VRAM layer offloading
          num_thread: 8,      // Maximize CPU worker threads for prompt processing
          num_ctx: options?.num_ctx || 4096,      // 4K context window for detailed prompts + context
          num_predict: options?.num_predict || 2048, // Default 2K tokens
          temperature: options?.temperature ?? 0.2, // Fast deterministic sampling
        },
      }),
      signal: AbortSignal.timeout(300000), // 5 minutes timeout for local LLM inference
    });

    if (res.ok) {
      const data = (await res.json()) as { response: string };
      if (data.response && data.response.trim().length > 0) {
        return { text: data.response.trim(), offline: false };
      }
    } else {
      console.warn(`Ollama responded with status ${res.status} for model ${activeModel}`);
    }
  } catch (err) {
    console.warn(`Ollama request failed for model ${activeModel}:`, err);
  }

  // Ollama was available but returned nothing useful
  return { text: offlineFallbackMessage(), offline: true };
}

/**
 * Dedicated RAG text generator.
 * Uses a concise token limit (num_predict: 250, num_ctx: 2048) so chat responses are fast & focused.
 */
export async function generateRagText(
  prompt: string,
  targetModel: string = DEFAULT_MODEL
): Promise<{ text: string; offline: boolean }> {
  return generateText(prompt, targetModel, { num_predict: 250, num_ctx: 2048, temperature: 0.2 });
}

/**
 * Dedicated Study Planner text generator.
 * Uses an expanded token limit (num_predict: 2500, num_ctx: 4096) so long JSON study plans never truncate.
 */
export async function generatePlannerText(
  prompt: string,
  targetModel: string = DEFAULT_MODEL
): Promise<{ text: string; offline: boolean }> {
  return generateText(prompt, targetModel, { num_predict: 2500, num_ctx: 4096, temperature: 0.2 });
}

/**
 * Returned when Ollama is unreachable or returns an empty response.
 * Route handlers set `offline: true` so the frontend can display a warning banner.
 * Never returns fake or topic-specific hardcoded content.
 */
export function offlineFallbackMessage(): string {
  return '⚠️ Offline Mode: Ollama is not reachable. Please start Ollama (`ollama serve`) and make sure at least one model is installed (`ollama pull llama3.2`), then try again.';
}

export async function getEmbedding(text: string, model: string = 'nomic-embed-text'): Promise<number[]> {
  try {
    const status = await checkOllamaStatus();
    if (!status.available || !status.installedModels.some(m => m.toLowerCase().includes(model.toLowerCase()))) {
      return pseudoVector(text);
    }

    const res = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: text,
      }),
    });

    if (res.ok) {
      const data = (await res.json()) as { embedding: number[] };
      return data.embedding;
    }
  } catch (err) {
    // Fallback to pseudo vector
  }

  return pseudoVector(text);
}

function pseudoVector(text: string): number[] {
  const vec = new Array(64).fill(0);
  const words = text.toLowerCase().split(/\W+/);
  for (const word of words) {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = (hash << 5) - hash + word.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % 64;
    vec[idx] += 1;
  }
  const mag = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vec.map(v => v / mag);
}

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA.length || !vecB.length || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
