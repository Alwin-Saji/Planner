export interface OutlineBlock {
  tempId: string;
  title: string;
  category: string;
  date: string;
  start_time: string;
  end_time: string;
  custom_link?: string;
  notes?: string;
  links?: string[];
}

export interface OutlineResource {
  tempId: string;
  title: string;
  type: 'youtube' | 'link' | 'note';
  url_or_content: string;
}

export interface RecommendedChannel {
  name: string;
  handle: string;
  description: string;
  url: string;
  playlistLength?: string;
  approxTime?: string;
  selected?: boolean;
  /** User-pinned channels are always shown and survive 'Suggest Other' rotations */
  pinned?: boolean;
  /** Rank from the AI/backend (lower = more recommended). Used for sorting & badge display. */
  rank?: number;
  source?: 'ai' | 'reddit' | 'custom' | 'specialist' | 'fallback';
  /** For playlist-type channels: the actual playlist URL */
  playlistUrl?: string;
  /** Number of videos in the playlist (if known) */
  videoCount?: number;
}

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced';
export type LearningGoal = 'comprehensive' | 'crash_course' | 'interview';
export type WizardGenStep = 'parameters' | 'channels' | 'review';
export type StudyPlanModalTab = 'generator' | 'markdown';

/** Whether the user wants a multi-video playlist or a single long-form course video */
export type VideoType = 'playlist' | 'long_course';

export interface SearchedResource {
  id: string;
  title: string;
  url: string;
  source: 'youtube' | 'github' | 'google' | 'stackoverflow' | 'local';
  description: string;
  metadata: {
    views?: number;
    stars?: number;
    votes?: number;
    duration?: string;
    channel?: string;
    language?: string;
    tags?: string[];
    thumbnail?: string;
  };
  relevanceScore: number;
}

export interface SearchMeta {
  queries: string[];
  sourceCounts: Record<string, number>;
  totalFound: number;
}
