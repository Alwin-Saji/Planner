import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Zap, Route, RotateCcw, Sun, Sunset, Moon,
  ChevronRight, CheckCircle2, AlertTriangle, Coffee,
  TrendingUp, TrendingDown, Clock, RefreshCw, ArrowRight,
  Sparkles, Target, Activity, Award, SkipForward,
} from 'lucide-react';
import {
  LearningPath, FatigueReport, EnergyProfile, RescheduleSlot, Block,
} from '../types';
import {
  fetchLearningPath, fetchFatigueReport, fetchEnergyProfile, fetchRescheduleSlots,
} from '../api';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface LearningPanelProps {
  skippedBlocks: Block[];
  onScheduleBreak: (blockData: Partial<Block>) => void;
  onAcceptReschedule: (slot: RescheduleSlot) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

const FATIGUE_COLORS = {
  fresh:   { bar: 'bg-emerald-400', glow: 'shadow-emerald-400/30', text: 'text-emerald-400', label: 'Fresh & Focused' },
  mild:    { bar: 'bg-yellow-400',  glow: 'shadow-yellow-400/30',  text: 'text-yellow-400',  label: 'Mildly Fatigued' },
  tired:   { bar: 'bg-orange-400',  glow: 'shadow-orange-400/30',  text: 'text-orange-400',  label: 'Getting Tired' },
  burnout: { bar: 'bg-red-500',     glow: 'shadow-red-500/30',     text: 'text-red-400',     label: 'Burnout Risk!' },
};

const STAGE_CONFIG = {
  mastered:    { color: 'border-emerald-400 bg-emerald-400/10 text-emerald-400', dot: 'bg-emerald-400', icon: Award, label: 'Mastered' },
  in_progress: { color: 'border-yellow-400 bg-yellow-400/10 text-yellow-400',   dot: 'bg-yellow-400',  icon: TrendingUp, label: 'In Progress' },
  needs_work:  { color: 'border-red-400 bg-red-400/10 text-red-400',            dot: 'bg-red-400',     icon: Target, label: 'Needs Work' },
};

const ENERGY_WINDOW_CONFIG = {
  morning:   { icon: Sun,    label: 'Morning',   sub: '6 AM – 12 PM', color: 'text-amber-400',  bar: 'bg-amber-400' },
  afternoon: { icon: Sunset, label: 'Afternoon', sub: '12 – 5 PM',    color: 'text-orange-400', bar: 'bg-orange-400' },
  evening:   { icon: Moon,   label: 'Evening',   sub: '5 – 11 PM',    color: 'text-indigo-400', bar: 'bg-indigo-400' },
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Animated arc gauge for fatigue score */
const FatigueGauge: React.FC<{ score: number; level: FatigueReport['level'] }> = ({ score, level }) => {
  const circleRef = useRef<SVGCircleElement>(null);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const arc = (score / 100) * circumference * 0.75; // 3/4 arc
  const cfg = FATIGUE_COLORS[level];

  useEffect(() => {
    if (!circleRef.current) return;
    circleRef.current.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(0.16,1,0.3,1)';
  }, []);

  const colorMap = { fresh: '#34d399', mild: '#facc15', tired: '#fb923c', burnout: '#ef4444' };

  return (
    <div className="relative flex items-center justify-center" style={{ width: 100, height: 100 }}>
      <svg width="100" height="100" viewBox="0 0 100 100" style={{ transform: 'rotate(135deg)' }}>
        {/* Track */}
        <circle
          cx="50" cy="50" r={radius}
          fill="none" stroke="#27272a" strokeWidth="8"
          strokeDasharray={`${circumference * 0.75} ${circumference}`}
          strokeLinecap="round"
        />
        {/* Fill */}
        <circle
          ref={circleRef}
          cx="50" cy="50" r={radius}
          fill="none" stroke={colorMap[level]} strokeWidth="8"
          strokeDasharray={`${arc} ${circumference}`}
          strokeDashoffset="0"
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${colorMap[level]}66)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-xl font-black font-mono ${cfg.text}`}>{score}</span>
        <span className="text-[9px] text-zinc-500 font-medium uppercase tracking-wider">/ 100</span>
      </div>
    </div>
  );
};

/** Animated bar for energy profile */
const EnergyBar: React.FC<{ pct: number; barClass: string; peak: boolean }> = ({ pct, barClass, peak }) => {
  const [displayed, setDisplayed] = useState(0);
  useEffect(() => {
    const timeout = setTimeout(() => setDisplayed(pct), 120);
    return () => clearTimeout(timeout);
  }, [pct]);
  return (
    <div className="relative w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
      <motion.div
        className={`h-full rounded-full ${barClass} ${peak ? 'shadow-lg' : ''}`}
        initial={{ width: 0 }}
        animate={{ width: `${displayed}%` }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export const LearningPanel: React.FC<LearningPanelProps> = ({
  skippedBlocks,
  onScheduleBreak,
  onAcceptReschedule,
}) => {
  const [learningPath, setLearningPath] = useState<LearningPath | null>(null);
  const [fatigue, setFatigue] = useState<FatigueReport | null>(null);
  const [energy, setEnergy] = useState<EnergyProfile | null>(null);
  const [rescheduleSlots, setRescheduleSlots] = useState<RescheduleSlot[]>([]);
  const [dismissedSlots, setDismissedSlots] = useState<Set<string>>(new Set());
  const [acceptedSlots, setAcceptedSlots] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeSection, setActiveSection] = useState<'fatigue' | 'path' | 'reschedule' | 'energy'>('fatigue');

  const loadAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    try {
      const [path, fat, eng] = await Promise.all([
        fetchLearningPath(),
        fetchFatigueReport(),
        fetchEnergyProfile(),
      ]);
      setLearningPath(path);
      setFatigue(fat);
      setEnergy(eng);

      // Fetch reschedule slots for current skipped blocks
      if (skippedBlocks.length > 0) {
        const ids = skippedBlocks.map(b => b.id);
        const { slots } = await fetchRescheduleSlots(ids);
        setRescheduleSlots(slots);
      }
    } catch (err) {
      console.warn('[LearningPanel] fetch error:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [skippedBlocks.length]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Re-fetch reschedule slots when skipped blocks change
  useEffect(() => {
    if (skippedBlocks.length > 0 && !isLoading) {
      fetchRescheduleSlots(skippedBlocks.map(b => b.id))
        .then(({ slots }) => setRescheduleSlots(slots))
        .catch(() => {});
    } else {
      setRescheduleSlots([]);
    }
  }, [skippedBlocks.length]);

  const handleScheduleBreak = () => {
    if (!fatigue?.breakSuggestion) return;
    const today = new Date().toISOString().split('T')[0];
    onScheduleBreak({
      date: today,
      start_time: fatigue.breakSuggestion.start_time,
      end_time: fatigue.breakSuggestion.end_time,
      title: '☕ Mental Reset Break',
      category: 'Rest',
      status: 'planned',
      notes: `🧠 AI Fatigue Detection: Score ${fatigue.score}/100 (${fatigue.level}). Signals: ${fatigue.signals.join(', ')}`,
    });
  };

  const handleAcceptSlot = (slot: RescheduleSlot) => {
    setAcceptedSlots(prev => new Set([...prev, slot.blockId]));
    onAcceptReschedule(slot);
  };

  const handleDismissSlot = (blockId: string) => {
    setDismissedSlots(prev => new Set([...prev, blockId]));
  };

  const visibleSlots = rescheduleSlots.filter(s =>
    !dismissedSlots.has(s.blockId) && !acceptedSlots.has(s.blockId)
  );

  const tabs = [
    { id: 'fatigue' as const, icon: Activity, label: 'Fatigue', badge: fatigue?.level === 'burnout' || fatigue?.level === 'tired' ? '!' : null },
    { id: 'path' as const, icon: Route, label: 'Path' },
    { id: 'reschedule' as const, icon: RotateCcw, label: 'Reschedule', badge: visibleSlots.length > 0 ? String(visibleSlots.length) : null },
    { id: 'energy' as const, icon: Zap, label: 'Energy' },
  ];

  if (isLoading) {
    return (
      <div className="w-full py-4 border-t border-white/[0.04] mt-2">
        <div className="flex items-center gap-2 text-zinc-600 text-xs font-mono animate-pulse">
          <Brain className="w-3.5 h-3.5" />
          <span>Analysing your learning patterns…</span>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="w-full py-3 border-t border-white/[0.04] mt-1 space-y-3"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-white/5 flex items-center justify-center">
            <Brain className="w-3.5 h-3.5 text-violet-400" />
          </div>
          <h3 className="font-heading font-black text-xs text-white tracking-wider uppercase">
            Learning Intelligence Hub
          </h3>
          {fatigue && (
            <span className={`text-[9px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
              fatigue.level === 'fresh' ? 'bg-emerald-400/10 text-emerald-400' :
              fatigue.level === 'mild'  ? 'bg-yellow-400/10 text-yellow-400' :
              fatigue.level === 'tired' ? 'bg-orange-400/10 text-orange-400' :
              'bg-red-400/10 text-red-400'
            }`}>
              {FATIGUE_COLORS[fatigue.level].label}
            </span>
          )}
        </div>
        <button
          onClick={() => loadAll(true)}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 text-xs font-mono text-zinc-500 hover:text-white transition disabled:opacity-30 cursor-pointer group"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
        </button>
      </div>

      {/* Section Tabs */}
      <div className="flex items-center gap-1 border-b border-white/[0.05] pb-0">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              className={`relative flex items-center gap-1.5 px-3 py-2 text-[11px] font-mono font-medium transition-all cursor-pointer rounded-t-lg ${
                isActive
                  ? 'text-white border-b-2 border-violet-400 -mb-px'
                  : 'text-zinc-500 hover:text-zinc-300 border-b-2 border-transparent -mb-px'
              }`}
            >
              <Icon className="w-3 h-3 shrink-0" />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className={`text-[9px] font-bold px-1 rounded-full ${
                  tab.badge === '!' ? 'bg-red-500/20 text-red-400' : 'bg-violet-400/20 text-violet-300'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Section Content */}
      <AnimatePresence mode="wait">
        {/* ---------------------------------------------------------------- */}
        {/* FATIGUE SECTION                                                  */}
        {/* ---------------------------------------------------------------- */}
        {activeSection === 'fatigue' && fatigue && (
          <motion.div
            key="fatigue"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start pt-1"
          >
            {/* Left: Gauge + Action */}
            <div className="lg:col-span-4 flex flex-col items-center gap-3">
              <FatigueGauge score={fatigue.score} level={fatigue.level} />
              <div className="text-center">
                <p className={`text-sm font-bold ${FATIGUE_COLORS[fatigue.level].text}`}>
                  {FATIGUE_COLORS[fatigue.level].label}
                </p>
                <p className="text-[10px] text-zinc-600 mt-0.5">Mental fatigue index</p>
              </div>
              {fatigue.breakSuggestion && (fatigue.level === 'tired' || fatigue.level === 'burnout') && (
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleScheduleBreak}
                  className="flex items-center gap-1.5 text-xs font-bold text-black bg-white hover:bg-zinc-100 px-3 py-1.5 rounded-full transition shadow-md cursor-pointer"
                >
                  <Coffee className="w-3.5 h-3.5" />
                  <span>Schedule Break</span>
                </motion.button>
              )}
            </div>

            {/* Right: Breakdown bars + signals */}
            <div className="lg:col-span-8 space-y-3">
              {/* Breakdown */}
              <div className="space-y-2">
                {[
                  { label: 'Back-to-back', val: fatigue.breakdown.backToBack, max: 54 },
                  { label: 'Skip streak',  val: fatigue.breakdown.skipStreak,  max: 30 },
                  { label: 'Evening decay', val: fatigue.breakdown.eveningDecay, max: 20 },
                  { label: 'Monotony',     val: fatigue.breakdown.monotony,     max: 16 },
                ].map(({ label, val, max }) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-500 w-24 shrink-0">{label}</span>
                    <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.round((val / max) * 100)}%` }}
                        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                        className={`h-full rounded-full ${
                          val === 0 ? 'bg-zinc-700' :
                          val < max * 0.4 ? 'bg-emerald-500' :
                          val < max * 0.7 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500 w-6 text-right">{val}</span>
                  </div>
                ))}
              </div>

              {/* Active Signals */}
              {fatigue.signals.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[9px] text-zinc-600 uppercase tracking-wider font-semibold">Active Signals</span>
                  <div className="flex flex-wrap gap-1.5">
                    {fatigue.signals.map((sig, i) => (
                      <span key={i} className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-orange-400/10 text-orange-300 font-medium border border-orange-400/10">
                        <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                        {sig}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {fatigue.signals.length === 0 && (
                <div className="flex items-center gap-2 text-emerald-400/80 text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>No fatigue signals detected — you&apos;re in great shape!</span>
                </div>
              )}

              {/* Break suggestion time */}
              {fatigue.breakSuggestion && (
                <div className="flex items-center gap-2 text-[10px] text-zinc-500 pt-1">
                  <Clock className="w-3 h-3 shrink-0" />
                  <span>Suggested break: <span className="text-zinc-300 font-mono">{fatigue.breakSuggestion.start_time} – {fatigue.breakSuggestion.end_time}</span></span>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* LEARNING PATH SECTION                                            */}
        {/* ---------------------------------------------------------------- */}
        {activeSection === 'path' && learningPath && (
          <motion.div
            key="path"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="space-y-4 pt-1"
          >
            {learningPath.stages.length === 0 ? (
              <p className="text-xs text-zinc-500">Not enough session data yet. Complete a few more blocks to see your learning path.</p>
            ) : (
              <>
                {/* Horizontal Stepper */}
                <div className="flex flex-wrap gap-2">
                  {learningPath.stages.map((stage, i) => {
                    const cfg = STAGE_CONFIG[stage.stage];
                    const Icon = cfg.icon;
                    const isNext = learningPath.nextFocus?.category === stage.category;
                    return (
                      <motion.div
                        key={stage.category}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.05, duration: 0.2 }}
                        className={`relative flex flex-col gap-1 px-3 py-2 rounded-xl border text-left transition-all ${cfg.color} ${
                          isNext ? 'ring-2 ring-white/20 shadow-lg scale-105' : ''
                        }`}
                        style={{ minWidth: 100 }}
                      >
                        {isNext && (
                          <span className="absolute -top-2 left-2 text-[8px] font-bold bg-white text-black px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                            Focus Next
                          </span>
                        )}
                        <div className="flex items-center gap-1.5">
                          <Icon className="w-3 h-3 shrink-0" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">{cfg.label}</span>
                        </div>
                        <p className="text-[11px] font-semibold truncate">{stage.category}</p>
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 h-1 bg-black/20 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${stage.completionPct}%` }}
                              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: i * 0.05 }}
                              className={`h-full rounded-full ${cfg.dot}`}
                            />
                          </div>
                          <span className="text-[10px] font-mono font-bold shrink-0">{stage.completionPct}%</span>
                        </div>
                        <span className="text-[9px] opacity-60">{stage.blockCount} sessions</span>
                      </motion.div>
                    );
                  })}
                </div>

                {/* AI Narrative */}
                {learningPath.narrative && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="flex items-start gap-2.5 p-3 rounded-xl bg-violet-400/5 border border-violet-400/10"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-violet-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-zinc-300 leading-relaxed">{learningPath.narrative}</p>
                  </motion.div>
                )}

                {/* Next Focus CTA */}
                {learningPath.nextFocus && (
                  <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <Target className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                    <span>Recommended next focus: <span className="text-white font-semibold">{learningPath.nextFocus.category}</span> — currently at <span className="font-mono text-yellow-400">{learningPath.nextFocus.completionPct}%</span> adherence</span>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* ADAPTIVE RESCHEDULE SECTION                                      */}
        {/* ---------------------------------------------------------------- */}
        {activeSection === 'reschedule' && (
          <motion.div
            key="reschedule"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="space-y-3 pt-1"
          >
            {visibleSlots.length === 0 && skippedBlocks.length === 0 && (
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>No skipped blocks to reschedule. Keep up the great work!</span>
              </div>
            )}

            {visibleSlots.length === 0 && skippedBlocks.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <SkipForward className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <span>Could not find open slots in the next 7 days for {skippedBlocks.length} skipped block(s). Try clearing some planned sessions.</span>
              </div>
            )}

            <AnimatePresence>
              {visibleSlots.map((slot, i) => (
                <motion.div
                  key={slot.blockId}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8, height: 0, marginBottom: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.2 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700/50 transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-zinc-200 truncate">{slot.blockTitle}</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      Skipped on {formatDate(slot.originalDate)}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <ArrowRight className="w-2.5 h-2.5 text-violet-400 shrink-0" />
                      <span className="text-[11px] text-zinc-300">
                        <span className="font-semibold text-white">{formatDate(slot.suggestedDate)}</span>
                        <span className="font-mono text-zinc-400 ml-1">{slot.suggestedStart}–{slot.suggestedEnd}</span>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleDismissSlot(slot.blockId)}
                      className="text-[10px] text-zinc-600 hover:text-zinc-400 transition px-2 py-1 rounded-lg hover:bg-zinc-800 cursor-pointer"
                    >
                      Dismiss
                    </button>
                    <button
                      onClick={() => handleAcceptSlot(slot)}
                      className="flex items-center gap-1 text-[10px] font-bold text-black bg-white hover:bg-zinc-100 px-2.5 py-1 rounded-lg transition cursor-pointer"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      Accept
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Already accepted */}
            {acceptedSlots.size > 0 && (
              <p className="text-[10px] text-emerald-400/70 flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 shrink-0" />
                {acceptedSlots.size} reschedule(s) accepted and added to your planner.
              </p>
            )}
          </motion.div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* ENERGY PROFILE SECTION                                           */}
        {/* ---------------------------------------------------------------- */}
        {activeSection === 'energy' && energy && (
          <motion.div
            key="energy"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="space-y-4 pt-1"
          >
            <div className="grid grid-cols-3 gap-3">
              {(['morning', 'afternoon', 'evening'] as const).map(win => {
                const cfg = ENERGY_WINDOW_CONFIG[win];
                const pct = energy[win];
                const isPeak = energy.peakWindow === win;
                const Icon = cfg.icon;
                return (
                  <motion.div
                    key={win}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className={`relative flex flex-col gap-2 p-3 rounded-xl border transition-all ${
                      isPeak
                        ? 'border-white/20 bg-white/[0.04] shadow-lg'
                        : 'border-zinc-800/60 bg-zinc-900/30'
                    }`}
                  >
                    {isPeak && (
                      <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[8px] font-bold bg-white text-black px-2 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap">
                        Peak Window
                      </span>
                    )}
                    <div className={`flex items-center gap-1.5 ${cfg.color}`}>
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="text-[11px] font-bold">{cfg.label}</span>
                    </div>
                    <div className="text-center">
                      <span className={`text-2xl font-black font-mono ${isPeak ? 'text-white' : 'text-zinc-300'}`}>
                        {pct}
                      </span>
                      <span className="text-xs text-zinc-500">%</span>
                    </div>
                    <EnergyBar pct={pct} barClass={cfg.bar} peak={isPeak} />
                    <p className="text-[9px] text-zinc-600 text-center">{cfg.sub}</p>
                    <p className="text-[9px] text-zinc-600 text-center">{energy.blockCounts[win]} sessions</p>
                  </motion.div>
                );
              })}
            </div>

            {/* Insight tip */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-900/40 border border-zinc-800/40"
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-xs text-zinc-400 leading-relaxed">
                <span className="text-white font-semibold">
                  {ENERGY_WINDOW_CONFIG[energy.peakWindow].label}
                </span>
                {' '}is your peak focus window ({energy[energy.peakWindow]}% adherence).
                {' '}Schedule your hardest study sessions between{' '}
                <span className="text-zinc-200 font-medium">{ENERGY_WINDOW_CONFIG[energy.peakWindow].sub}</span>
                {' '}for maximum retention.
                {energy[energy.peakWindow] === 0 && (
                  <span className="text-zinc-500"> (Not enough data yet — track more sessions to personalise this.)</span>
                )}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
