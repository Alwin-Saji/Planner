import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { Navbar } from './components/Navbar';
import { WeeklyGrid } from './components/WeeklyGrid';
import { DailyView } from './components/DailyView';
import { ResourcesLibrary } from './components/ResourcesLibrary';
import { HeatmapStreak } from './components/HeatmapStreak';
import { SuggestionsPanel } from './components/SuggestionsPanel';
import { BlockModal } from './components/BlockModal';
import { QuickCaptureModal } from './components/QuickCaptureModal';
import { RagChatModal } from './components/RagChatModal';
import { WeeklyReviewModal } from './components/WeeklyReviewModal';
import { StudyPlanModal } from './components/StudyPlanModal';
import { TechAdvisorModal } from './components/TechAdvisorModal';
import { OfflineBanner } from './components/OfflineBanner';
import { AuthModal } from './components/AuthModal';
import { SkippedBlocksModal } from './components/SkippedBlocksModal';
import { CalendarExportModal } from './components/CalendarExportModal';
import { getSupabaseClient } from './supabaseClient';

import {
  Block,
  Resource,
  DailyLog,
  AdherenceSummary,
  OllamaStatus,
  AISuggestion,
} from './types';

import {
  fetchBlocks,
  createBlock,
  updateBlock,
  deleteBlock,
  fetchResources,
  createResource,
  deleteResource,
  uploadResourceFile,
  fetchLogs,
  fetchOllamaStatus,
  fetchAISuggestions,
  startOllama,
  autoScheduleBreaks,
  refreshAuthToken,
  migrateToUser,
  API_BASE,
} from './api';
import { getTodayStr } from './utils/dateUtils';

const DEFAULT_SUGGESTIONS: AISuggestion[] = [
  {
    id: 'sug-1',
    type: 'opportunity',
    title: 'Pomodoro Interval Focus',
    description: 'Try breaking down long study sessions into 45-minute pomodoro blocks to improve retention.',
    actionLabel: 'Schedule Session',
    actionType: 'CREATE_BLOCK',
  },
  {
    id: 'sug-2',
    type: 'warning',
    title: 'Review Skipped Categories',
    description: 'Review your frequently skipped study categories in the morning before starting core work.',
    actionLabel: 'View Schedule',
    actionType: 'GOTO_DAILY',
  },
  {
    id: 'sug-3',
    type: 'insight',
    title: 'Attach Key Documentation Links',
    description: 'Keep documentation links attached directly to each study block for quick reference during sessions.',
    actionLabel: 'Open Resources',
    actionType: 'LINK_RESOURCE',
  },
];

export function App() {
  const [activeTab, setActiveTab] = useState<'weekly' | 'daily' | 'resources' | 'adherence'>('weekly');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayStr());

  // Domain State
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [summary, setSummary] = useState<AdherenceSummary | null>(null);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('llama3.2');
  const [suggestions, setSuggestions] = useState<AISuggestion[]>(DEFAULT_SUGGESTIONS);

  // Modals
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<Block | null>(null);
  const [defaultBlockDate, setDefaultBlockDate] = useState<string | undefined>();
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false);
  const [isRagChatOpen, setIsRagChatOpen] = useState(false);
  const [isWeeklyReviewOpen, setIsWeeklyReviewOpen] = useState(false);
  const [isStudyPlanOpen, setIsStudyPlanOpen] = useState(false);
  const [isTechAdvisorOpen, setIsTechAdvisorOpen] = useState(false);
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false);
  const [offlineBannerDismissed, setOfflineBannerDismissed] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSkippedModalOpen, setIsSkippedModalOpen] = useState(false);
  const [isCalendarExportOpen, setIsCalendarExportOpen] = useState(false);

  // Derived state for skipped blocks
  const skippedBlocks = blocks.filter(b => b.status === 'skipped');

  // Initial Data Fetch
  const loadAllData = async () => {
    // 1. Fetch blocks and logs — available regardless of auth state
    try {
      const [fetchedBlocks, logsData] = await Promise.all([
        fetchBlocks(),
        fetchLogs(),
      ]);
      setBlocks(fetchedBlocks);
      setLogs(logsData.logs);
      setSummary(logsData.summary);
    } catch (dbErr) {
      console.error('Error fetching SQLite domain data:', dbErr);
    }

    // 2. Fetch resources from SQLite
    try {
      const fetchedResources = await fetchResources();
      setResources(fetchedResources);
    } catch (resErr) {
      console.warn('Resources fetch warning:', resErr);
      setResources([]);
    }

    // 3. Fetch AI Status & Suggestions (non-blocking)
    try {
      const status = await fetchOllamaStatus();
      setOllamaStatus(status);
      const activeChatModel = status.currentModel && !status.currentModel.toLowerCase().includes('nomic') && !status.currentModel.toLowerCase().includes('embed')
        ? status.currentModel
        : (status.installedModels[0] || 'llama3.2');

      setSelectedModel(activeChatModel);
      const suggestionsData = await fetchAISuggestions(activeChatModel);
      setSuggestions(suggestionsData.suggestions);
    } catch (aiErr) {
      console.warn('AI status/suggestions fetch non-blocking warning:', aiErr);
    }
  };

  // Auth Session Listener & Initial Load
  useEffect(() => {
    console.log("[App.tsx] Auth useEffect triggered");
    const supabase = getSupabaseClient();
    console.log("[App.tsx] getSupabaseClient returned:", !!supabase);
    if (supabase) {
      // 1. Instantly parse URL hash / search params if coming back from Google OAuth redirect
      if (window.location.hash || window.location.search) {
        console.log("[App.tsx] URL hash or search found:", window.location.hash || window.location.search);
        
        // Check for explicitly returned errors from Supabase OAuth
        const params = new URLSearchParams(window.location.hash.replace('#', '?'));
        const errorMsg = params.get('error_description') || params.get('error');
        if (errorMsg) {
          console.error("[App.tsx] Supabase OAuth Error:", errorMsg);
          alert(`Supabase OAuth Error: ${errorMsg.replace(/\+/g, ' ')}\n\nCheck your Supabase Dashboard Google Provider settings (Client ID & Secret).`);
          window.history.replaceState({}, document.title, window.location.pathname);
        } else {
          supabase.auth.getSession().then(async ({ data: { session }, error }: any) => {
            console.log("[App.tsx] getSession result:", { session, error });
            if (session?.user) {
              setUser(session.user);
              
              // Send Google OAuth tokens to backend for calendar background sync
              if (session.provider_token) {
                try {
                  await fetch(`${API_BASE}/calendar/tokens/supabase`, {
                    method: 'POST',
                    headers: { 
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${session.access_token}`
                    },
                    body: JSON.stringify({
                      provider_token: session.provider_token,
                      provider_refresh_token: session.provider_refresh_token
                    })
                  });
                  console.log("[App.tsx] Sent Supabase tokens to backend for Google Calendar auto-sync");
                } catch (err) {
                  console.error("[App.tsx] Failed to sync tokens to backend:", err);
                }
              }

              await refreshAuthToken();
              await migrateToUser();
              loadAllData();
              // Clean hash from URL bar
              window.history.replaceState({}, document.title, window.location.pathname);
            }
          });
        }
      }

      // 2. Listen for auth state changes (firing on login/logout/startup)
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log("[App.tsx] onAuthStateChange event:", event, "session user:", session?.user?.email);
        setUser(session?.user ?? null);
        await refreshAuthToken();
        if (session?.user) {
          await migrateToUser();
        }
        loadAllData();
      });

      // 3. Check existing persistent session
      supabase.auth.getUser().then(({ data: { user }, error }: any) => {
        console.log("[App.tsx] getUser result:", { user, error });
        if (user) {
          setUser(user);
        }
      });

      return () => subscription.unsubscribe();
    } else {
      console.log("[App.tsx] No supabase client available, loading data directly");
      // If Supabase is not configured, no token needed — load directly
      loadAllData();
    }
  }, []);

  const handleLogout = async () => {
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
      setUser(null);
      loadAllData();
    }
  };

  // Keyboard shortcut Ctrl+K for Quick Capture
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsQuickCaptureOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Block Actions
  const handleSaveBlock = async (blockData: Partial<Block>) => {
    try {
      if (blockData.id) {
        await updateBlock(blockData.id, blockData);
      } else {
        await createBlock(blockData);
      }
      await loadAllData();
    } catch (err) {
      console.error('Failed to save block:', err);
    }
  };

  const handleUpdateBlock = async (id: string, updates: Partial<Block>) => {
    // Optimistic UI update
    setBlocks(prev => prev.map(b => (String(b.id) === String(id) ? { ...b, ...updates } : b)));
    try {
      await updateBlock(String(id), updates);
      const logsData = await fetchLogs();
      setLogs(logsData.logs);
      setSummary(logsData.summary);
    } catch (err) {
      console.error('Failed to update block:', err);
      loadAllData();
    }
  };

  const handleDeleteBlock = async (id: string) => {
    setBlocks(prev => prev.filter(b => String(b.id) !== String(id)));
    try {
      await deleteBlock(String(id));
      const logsData = await fetchLogs();
      setLogs(logsData.logs);
      setSummary(logsData.summary);
    } catch (err) {
      console.error('Failed to delete block:', err);
      loadAllData();
    }
  };

  const handleAutoScheduleBreaks = async (dateOrAction: string) => {
    if (dateOrAction === 'GOTO_DAILY') {
      setActiveTab('daily');
      return;
    }
    if (dateOrAction === 'OPEN_WEEKLY_REVIEW') {
      setIsWeeklyReviewOpen(true);
      return;
    }
    try {
      await autoScheduleBreaks(dateOrAction);
      await loadAllData();
    } catch (err) {
      console.error('Failed to auto-schedule breaks:', err);
    }
  };

  // Resource Actions
  const handleCreateResource = async (
    resourceData: Partial<Resource>,
    file?: File,
    options?: { summarize?: boolean; model?: string }
  ) => {
    try {
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', resourceData.title || file.name);
        formData.append('type', 'file');
        if (resourceData.linked_block_id) {
          formData.append('linked_block_id', resourceData.linked_block_id);
        }
        if (resourceData.tags) {
          formData.append('tags', resourceData.tags);
        }
        if (options?.summarize) {
          formData.append('summarize', 'true');
        }
        if (options?.model) {
          formData.append('model', options.model);
        }
        const created = await uploadResourceFile(formData);
        if (created) {
          setResources(prev => [created, ...prev.filter(r => r.id !== created.id)]);
        }
      } else {
        const created = await createResource(resourceData);
        if (created) {
          setResources(prev => [created, ...prev.filter(r => r.id !== created.id)]);
        }
      }
      const updated = await fetchResources();
      setResources(updated);
    } catch (err) {
      console.error('Failed to create resource:', err);
      throw err; // Re-throw so ResourcesLibrary's catch block can show a toast
    }
  };


  const handleDeleteResource = async (id: string) => {
    setResources(prev => prev.filter(r => r.id !== id));
    try {
      await deleteResource(id);
    } catch (err) {
      console.error('Failed to delete resource:', err);
      loadAllData();
    }
  };

  // AI Refresh
  const handleRefreshSuggestions = async () => {
    setIsSuggestionsLoading(true);
    try {
      const data = await fetchAISuggestions();
      setSuggestions(data.suggestions);
    } catch (err) {
      console.error('Error fetching AI suggestions', err);
    } finally {
      setIsSuggestionsLoading(false);
    }
  };

  const handleExecuteAction = async (suggestion: AISuggestion) => {
    if (suggestion.actionType === 'INSERT_BREAK' && suggestion.suggestedBreak) {
      const breakData: Partial<Block> = {
        date: suggestion.suggestedBreak.date || selectedDate,
        start_time: suggestion.suggestedBreak.start_time,
        end_time: suggestion.suggestedBreak.end_time,
        title: suggestion.suggestedBreak.title || '☕ 15-Min Refresh Break',
        category: suggestion.suggestedBreak.category || 'Rest',
        status: 'planned',
        notes: '📌 AI Break Suggestion: Take a rest to refresh mental acuity.',
      };
      await handleSaveBlock(breakData);
    } else if (suggestion.actionType === 'LINK_RESOURCE' || suggestion.actionLabel?.toLowerCase().includes('resource')) {
      setActiveTab('resources');
    } else if (suggestion.actionType === 'GOTO_DAILY' || suggestion.actionLabel?.toLowerCase().includes('schedule')) {
      setActiveTab('daily');
    } else if (suggestion.actionType === 'WEEKLY_REVIEW' || suggestion.actionLabel?.toLowerCase().includes('review')) {
      setIsWeeklyReviewOpen(true);
    } else {
      // Default / CREATE_BLOCK
      setEditingBlock(null);
      setDefaultBlockDate(selectedDate);
      setIsBlockModalOpen(true);
    }
  };

  const handleStartOllama = async () => {
    await startOllama();
    let attempts = 0;
    const maxAttempts = 15;
    return new Promise<void>((resolve, reject) => {
      const interval = setInterval(async () => {
        attempts++;
        try {
          const status = await fetchOllamaStatus();
          if (status.available) {
            clearInterval(interval);
            setOllamaStatus(status);
            if (status.currentModel) {
              setSelectedModel(status.currentModel);
            }
            const suggestionsData = await fetchAISuggestions(status.currentModel || 'llama3.2');
            setSuggestions(suggestionsData.suggestions);
            resolve();
            return;
          }
        } catch (e) {
          // ignore network errors
        }
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          reject(new Error('Ollama started but failed to connect within 30 seconds. Please check if Ollama is installed.'));
        }
      }, 2000);
    });
  };

  return (
    <div className="min-h-screen bg-[#050505] text-foreground flex flex-col relative overflow-hidden bg-radial-mesh selection:bg-white/20 selection:text-white">
      {/* Background Ambient Monochrome Mesh Blobs */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-white/[0.03] rounded-full blur-[140px] animate-pulse-subtle" />
        <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] bg-white/[0.02] rounded-full blur-[140px] animate-pulse-subtle" />
        <div className="absolute -bottom-40 left-1/3 w-[500px] h-[500px] bg-white/[0.03] rounded-full blur-[140px] animate-pulse-subtle" />
      </div>

      {/* Sticky Header Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        ollamaStatus={ollamaStatus}
        selectedModel={selectedModel}
        onSelectModel={(model) => {
          setSelectedModel(model);
          fetchAISuggestions(model).then(d => setSuggestions(d.suggestions)).catch(console.error);
        }}
        onReloadStatus={loadAllData}
        onOpenQuickCapture={() => setIsQuickCaptureOpen(true)}
        onOpenRagChat={() => setIsRagChatOpen(true)}
        onOpenWeeklyReview={() => setIsWeeklyReviewOpen(true)}
        onOpenStudyPlan={() => setIsStudyPlanOpen(true)}
        onOpenAdvisor={() => setIsTechAdvisorOpen(true)}
        onOpenCalendarExport={() => setIsCalendarExportOpen(true)}
        user={user}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* Global Offline Banner — shown when Ollama is not reachable */}
      {ollamaStatus && !ollamaStatus.available && !offlineBannerDismissed && (
        <div className="relative z-20 max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 pt-3">
          <OfflineBanner
            show={true}
            onDismiss={() => setOfflineBannerDismissed(true)}
            onStartOllama={handleStartOllama}
          />
        </div>
      )}

      {/* Main Body Layout */}
      <main className="relative z-10 flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Skipped Blocks Banner */}
        {skippedBlocks.length > 0 && (
          <div className="flex items-center gap-3.5 p-3.5 bg-white/[0.01] hover:bg-white/[0.02] border border-white/[0.03] rounded-2xl transition-all">
            <div className="relative flex items-center justify-center w-8 h-8 bg-amber-500/10 text-amber-500 rounded-xl shrink-0">
              <AlertTriangle className="w-4 h-4 stroke-[1.5] animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-zinc-300 font-medium leading-normal">
                You have <strong className="text-white font-semibold">{skippedBlocks.length}</strong> skipped study block{skippedBlocks.length > 1 ? 's' : ''} requiring attention.
              </p>
            </div>
            <button
              onClick={() => setIsSkippedModalOpen(true)}
              className="text-xs text-amber-500 hover:text-amber-400 font-bold transition-colors cursor-pointer shrink-0 uppercase tracking-wider text-[10px] px-3 py-1.5 hover:bg-amber-500/5 rounded-lg"
            >
              Resolve &rarr;
            </button>
          </div>
        )}

        {/* Proactive AI Suggestions Panel */}
        <SuggestionsPanel
          suggestions={suggestions}
          onRefreshSuggestions={handleRefreshSuggestions}
          onExecuteAction={handleExecuteAction}
          onOpenStudyPlan={() => setIsStudyPlanOpen(true)}
          onOpenDiary={() => window.open('https://dailee.albiin.me/', '_blank')}
          isLoading={isSuggestionsLoading}
        />

        {/* Tab View Render with Framer Motion Page Animations */}
        <AnimatePresence mode="wait">
          {activeTab === 'weekly' && (
            <motion.div
              key="weekly"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              <WeeklyGrid
                blocks={blocks}
                selectedDate={selectedDate}
                onSelectDate={(date) => {
                  setSelectedDate(date);
                  setActiveTab('daily');
                }}
                onUpdateBlock={handleUpdateBlock}
                onDeleteBlock={handleDeleteBlock}
                onOpenCreateModal={(defDate) => {
                  setEditingBlock(null);
                  setDefaultBlockDate(defDate || selectedDate);
                  setIsBlockModalOpen(true);
                }}
                onEditBlock={(block) => {
                  setEditingBlock(block);
                  setIsBlockModalOpen(true);
                }}
              />
            </motion.div>
          )}

          {activeTab === 'daily' && (
            <motion.div
              key="daily"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              <DailyView
                blocks={blocks}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                resources={resources}
                onUpdateBlock={handleUpdateBlock}
                onDeleteBlock={handleDeleteBlock}
                onOpenCreateModal={(defDate, startTime, endTime) => {
                  if (startTime && endTime) {
                    setEditingBlock({
                      id: '',
                      date: defDate || selectedDate,
                      start_time: startTime,
                      end_time: endTime,
                      title: '',
                      category: 'Study',
                      status: 'planned',
                    });
                  } else {
                    setEditingBlock(null);
                  }
                  setDefaultBlockDate(defDate || selectedDate);
                  setIsBlockModalOpen(true);
                }}
                onEditBlock={(block) => {
                  setEditingBlock(block);
                  setIsBlockModalOpen(true);
                }}
                onViewResource={() => setActiveTab('resources')}
                onAutoScheduleBreaks={handleAutoScheduleBreaks}
              />
            </motion.div>
          )}

          {activeTab === 'resources' && (
            <motion.div
              key="resources"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              {!user ? (
                // Sign-in wall — resources are strictly per-user
                <div className="flex flex-col items-center justify-center py-32 gap-6 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                    <svg className="w-7 h-7 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-2">Sign in to access your Resources</h2>
                    <p className="text-sm text-zinc-500 max-w-xs leading-relaxed">
                      Your notes, PDFs, and study links are private and tied to your account.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsAuthModalOpen(true)}
                    className="px-6 py-2.5 bg-white text-black text-sm font-semibold rounded-xl hover:bg-zinc-100 transition-colors"
                  >
                    Sign In
                  </button>
                </div>
              ) : (
                <ResourcesLibrary
                  resources={resources}
                  onCreateResource={handleCreateResource}
                  onDeleteResource={handleDeleteResource}
                  installedModels={ollamaStatus?.installedModels || []}
                  allModels={ollamaStatus?.allModels || []}
                />
              )}
            </motion.div>
          )}

          {activeTab === 'adherence' && (
            <motion.div
              key="adherence"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              <HeatmapStreak logs={logs} summary={summary} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Modals & Drawers */}
      <BlockModal
        isOpen={isBlockModalOpen}
        onClose={() => {
          setIsBlockModalOpen(false);
          setEditingBlock(null);
        }}
        onSave={handleSaveBlock}
        initialBlock={editingBlock}
        defaultDate={defaultBlockDate}
        resources={resources}
      />

      <QuickCaptureModal
        isOpen={isQuickCaptureOpen}
        onClose={() => setIsQuickCaptureOpen(false)}
        onCreateBlock={handleSaveBlock}
        onCreateResource={handleCreateResource}
      />

      <RagChatModal
        isOpen={isRagChatOpen}
        onClose={() => setIsRagChatOpen(false)}
        selectedModel={selectedModel}
        onSelectModel={(model) => {
          setSelectedModel(model);
          fetchAISuggestions(model).then(d => setSuggestions(d.suggestions)).catch(console.error);
        }}
        ollamaStatus={ollamaStatus}
        onReloadStatus={loadAllData}
      />

      <WeeklyReviewModal
        isOpen={isWeeklyReviewOpen}
        onClose={() => setIsWeeklyReviewOpen(false)}
      />

      <StudyPlanModal
        isOpen={isStudyPlanOpen}
        onClose={() => setIsStudyPlanOpen(false)}
        onRefreshData={loadAllData}
        selectedModel={selectedModel}
      />

      <TechAdvisorModal
        isOpen={isTechAdvisorOpen}
        onClose={() => setIsTechAdvisorOpen(false)}
        onAutoScheduleBreaks={handleAutoScheduleBreaks}
        onScheduleBreak={handleSaveBlock}
        onAcceptReschedule={async (slot) => {
          await handleSaveBlock({
            date: slot.suggestedDate,
            start_time: slot.suggestedStart,
            end_time: slot.suggestedEnd,
            title: slot.blockTitle,
            category: 'Study',
            status: 'planned',
            notes: `🔄 Rescheduled from ${slot.originalDate} by AI Advisor.`,
          });
        }}
        skippedBlocks={skippedBlocks}
        selectedDate={selectedDate}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={loadAllData}
      />

      <SkippedBlocksModal
        isOpen={isSkippedModalOpen}
        onClose={() => setIsSkippedModalOpen(false)}
        skippedBlocks={skippedBlocks}
        onUpdateBlock={handleUpdateBlock}
        onDeleteBlock={handleDeleteBlock}
        onEditBlock={(block) => {
          setEditingBlock(block);
          setIsBlockModalOpen(true);
        }}
      />

      <CalendarExportModal
        isOpen={isCalendarExportOpen}
        onClose={() => setIsCalendarExportOpen(false)}
      />


    </div>
  );
}

export default App;
