export type BlockStatus = 'planned' | 'done' | 'skipped';

export interface Block {
  id: string;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  title: string;
  category: string;
  status: BlockStatus;
  recurrence_rule?: string | null;
  notes_id?: string | null;
  notes?: string | null;
  custom_link?: string | null;
  calendar_sync_enabled?: boolean | number | null;
  created_at?: string;
}


export type ResourceType = 'youtube' | 'note' | 'link' | 'file';

export interface Resource {
  id: string;
  type: ResourceType;
  title: string;
  url_or_content: string;
  tags: string; // JSON string array
  linked_block_id?: string | null;
  summary?: string | null;
  created_at?: string;
}

export interface DailyLog {
  id: string;
  date: string;
  planned_count: number;
  completed_count: number;
  adherence_pct: number;
  notes_summary?: string;
  updated_at?: string;
}

export interface AdherenceSummary {
  totalDays: number;
  currentStreak: number;
  maxStreak: number;
  totalPlanned: number;
  totalCompleted: number;
  overallAdherence: number;
  categorySplit: Array<{
    category: string;
    total: number;
    done: number;
  }>;
}

export interface OllamaStatus {
  available: boolean;
  installedModels: string[];
  allModels?: string[];
  popularModels: string[];
  currentModel: string;
}

export interface AISuggestion {
  id: string;
  type: 'warning' | 'opportunity' | 'insight';
  title: string;
  description: string;
  actionLabel?: string;
  actionType?: string;
  category?: string;
  targetResource?: Resource;
  suggestedBreak?: {
    date: string;
    start_time: string;
    end_time: string;
    title: string;
    category: string;
    status?: BlockStatus;
  };
}

export interface RagChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  /** True when the response came from the offline fallback, not a live Ollama call */
  offline?: boolean;
  sources?: Array<{
    id: string;
    title: string;
    type: ResourceType;
    url_or_content: string;
    score: string;
  }>;
}


export interface WeeklyReviewData {
  period: { startDate: string; endDate: string };
  metrics: {
    totalPlanned: number;
    completedCount: number;
    skippedCount: number;
    adherencePct: number;
    categories: Record<string, { total: number; done: number }>;
    weakCategories?: Array<{ category: string; pct: number; total: number; done: number }>;
    timeOfDayStats?: {
      morning: { total: number; completed: number };
      afternoon: { total: number; completed: number };
      evening: { total: number; completed: number };
    };
    backToBackWarningCount?: number;
  };
  completedBlocks: Block[];
  notes: Resource[];
  markdownSummary: string;
}

// ---------------------------------------------------------------------------
// Learning Intelligence Types
// ---------------------------------------------------------------------------

export interface LearningPathStage {
  category: string;
  completionPct: number;
  blockCount: number;
  stage: 'mastered' | 'in_progress' | 'needs_work';
}

export interface LearningPath {
  stages: LearningPathStage[];
  nextFocus: LearningPathStage | null;
  narrative: string | null;
}

export interface FatigueReport {
  score: number; // 0–100
  level: 'fresh' | 'mild' | 'tired' | 'burnout';
  signals: string[];
  breakSuggestion?: { start_time: string; end_time: string };
  breakdown: {
    backToBack: number;
    skipStreak: number;
    eveningDecay: number;
    monotony: number;
  };
}

export interface EnergyProfile {
  morning: number;   // adherence % 6–12
  afternoon: number; // adherence % 12–17
  evening: number;   // adherence % 17–23
  peakWindow: 'morning' | 'afternoon' | 'evening';
  blockCounts: { morning: number; afternoon: number; evening: number };
}

export interface RescheduleSlot {
  blockId: string;
  blockTitle: string;
  originalDate: string;
  suggestedDate: string;
  suggestedStart: string;
  suggestedEnd: string;
}
