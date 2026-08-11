import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Award, Coffee, AlertCircle, Smile,
  Sun, Sunset, Moon, Target, RotateCcw,
  Activity, CheckCircle2, ArrowRight, Route, Zap,
} from 'lucide-react';
import { fetchTechAdvisorRecommendation, TechAdvisorRecommendation } from '../api';
import { fetchFatigueReport, fetchLearningPath, fetchEnergyProfile, fetchRescheduleSlots } from '../api';
import { FatigueReport, LearningPath, EnergyProfile, RescheduleSlot, Block } from '../types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface TechAdvisorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAutoScheduleBreaks?: (date: string) => Promise<void>;
  onScheduleBreak?: (blockData: Partial<Block>) => void;
  onAcceptReschedule?: (slot: RescheduleSlot) => void;
  selectedDate: string;
  skippedBlocks?: Block[];
}

type TabId = 'stack' | 'fatigue' | 'path' | 'energy' | 'reschedule';

const TABS: { id: TabId; label: string }[] = [
  { id: 'stack',      label: 'Stack' },
  { id: 'fatigue',    label: 'Fatigue' },
  { id: 'path',       label: 'Path' },
  { id: 'energy',     label: 'Energy' },
  { id: 'reschedule', label: 'Reschedule' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

const FATIGUE_LABEL = {
  fresh:   'Fresh',
  mild:    'Mild Fatigue',
  tired:   'Getting Tired',
  burnout: 'Burnout Risk',
};

const STAGE_LABEL = {
  mastered:    'Mastered',
  in_progress: 'In Progress',
  needs_work:  'Needs Work',
};

const ENERGY_WIN = {
  morning:   { Icon: Sun,    label: 'Morning',   sub: '6–12 AM'  },
  afternoon: { Icon: Sunset, label: 'Afternoon', sub: '12–5 PM'  },
  evening:   { Icon: Moon,   label: 'Evening',   sub: '5–11 PM'  },
};

// ---------------------------------------------------------------------------
// Thin progress bar — matches WeeklyReviewModal style exactly
// ---------------------------------------------------------------------------
const Bar: React.FC<{ pct: number }> = ({ pct }) => (
  <div className="h-1 w-full bg-zinc-900 rounded-full overflow-hidden">
    <motion.div
      initial={{ width: 0 }}
      animate={{ width: `${pct}%` }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      className="h-full bg-white rounded-full"
    />
  </div>
);

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
export const TechAdvisorModal: React.FC<TechAdvisorModalProps> = ({
  isOpen, onClose, onAutoScheduleBreaks, onScheduleBreak, onAcceptReschedule,
  selectedDate, skippedBlocks = [],
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('stack');

  const [advisor, setAdvisor] = useState<TechAdvisorRecommendation | null>(null);
  const [fatigue, setFatigue] = useState<FatigueReport | null>(null);
  const [path, setPath]       = useState<LearningPath | null>(null);
  const [energy, setEnergy]   = useState<EnergyProfile | null>(null);
  const [reschedule, setReschedule] = useState<RescheduleSlot[]>([]);
  const [dismissed, setDismissed]   = useState<Set<string>>(new Set());
  const [accepted, setAccepted]     = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading]   = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    setDismissed(new Set());
    setAccepted(new Set());

    Promise.allSettled([
      fetchTechAdvisorRecommendation(),
      fetchFatigueReport(),
      fetchLearningPath(),
      fetchEnergyProfile(),
      skippedBlocks.length > 0
        ? fetchRescheduleSlots(skippedBlocks.map(b => b.id))
        : Promise.resolve({ slots: [] }),
    ]).then(([adv, fat, lp, eng, resc]) => {
      if (adv.status  === 'fulfilled') setAdvisor(adv.value);
      if (fat.status  === 'fulfilled') setFatigue(fat.value);
      if (lp.status   === 'fulfilled') setPath(lp.value);
      if (eng.status  === 'fulfilled') setEnergy(eng.value);
      if (resc.status === 'fulfilled') setReschedule((resc.value as any).slots || []);
    }).finally(() => setIsLoading(false));
  }, [isOpen]);

  const visibleSlots = reschedule.filter(
    s => !dismissed.has(s.blockId) && !accepted.has(s.blockId),
  );

  // small alert badges on tab
  const alert = (id: TabId) => {
    if (id === 'fatigue' && fatigue && (fatigue.level === 'tired' || fatigue.level === 'burnout')) return true;
    if (id === 'reschedule' && visibleSlots.length > 0) return true;
    return false;
  };

  const handleScheduleBreak = () => {
    if (!fatigue?.breakSuggestion) return;
    onScheduleBreak?.({
      date: selectedDate,
      start_time: fatigue.breakSuggestion.start_time,
      end_time: fatigue.breakSuggestion.end_time,
      title: '☕ Mental Reset Break',
      category: 'Rest',
      status: 'planned',
      notes: `🧠 Fatigue score ${fatigue.score}/100 — ${fatigue.signals.join(', ')}`,
    });
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.98, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.98, opacity: 0, y: 10 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="bg-[#050505] w-full max-w-3xl rounded-3xl shadow-2xl flex flex-col overflow-hidden font-sans"
            style={{ maxHeight: '86vh' }}
          >
            {/* ── Header ─────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-8 pt-8 pb-5 shrink-0">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-heading font-black text-white">
                  AI Advisor
                </h2>
              </div>
              <button onClick={onClose} className="p-1 text-zinc-500 hover:text-white transition cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* ── Tab Bar ────────────────────────────────────────── */}
            <div className="flex gap-6 px-8 border-b border-white/[0.04] shrink-0">
              {TABS.map(({ id, label }) => {
                const isActive = activeTab === id;
                return (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={`relative py-2 text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                      isActive ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {label}
                    {alert(id) && (
                      <span className="absolute -top-0.5 -right-2 w-1 h-1 rounded-full bg-white" />
                    )}
                    {isActive && (
                      <motion.div
                        layoutId="advisorUnderline"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* ── Body ───────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center gap-3 py-20">
                  <div className="w-8 h-8 border-2 border-white/10 border-t-white rounded-full animate-spin" />
                  <p className="text-xs text-zinc-500 tracking-wider uppercase">Analyzing patterns…</p>
                </div>
              ) : (
                <AnimatePresence mode="wait">

                  {/* ── STACK ──────────────────────────────────────── */}
                  {activeTab === 'stack' && advisor && (
                    <motion.div key="stack"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="px-8 py-6 space-y-6"
                    >
                      {/* Focus line */}
                      <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                        <Award className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          Current focus: <span className="text-white font-bold">{advisor.currentFocus}</span>
                          {' · '}<span className="font-heading">{advisor.adherencePct}%</span> adherence
                        </span>
                      </div>

                      {/* Recommendation */}
                      <div className="space-y-2">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest block">Path Recommendation</span>
                        <h3 className="text-xl font-black text-white uppercase tracking-tight">
                          {advisor.recommendation.nextStack}
                        </h3>
                        <p className="text-[11px] text-zinc-400 leading-relaxed max-w-lg">
                          {advisor.recommendation.focusDescription} {advisor.recommendation.rationale}
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          onClose();
                          const lbl = advisor.recommendation.actionLabel?.toLowerCase() || '';
                          onAutoScheduleBreaks?.(lbl.includes('review') ? 'OPEN_WEEKLY_REVIEW' : 'GOTO_DAILY');
                        }}
                        className="bg-white text-black px-6 py-2 rounded-full font-bold text-xs hover:bg-zinc-200 transition cursor-pointer uppercase tracking-wider"
                      >
                        {advisor.recommendation.actionLabel}
                      </button>

                      {/* Break monitor row */}
                      {advisor.breakAdvisor && (
                        <div className="border-t border-white/[0.04] pt-5 space-y-3">
                          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest block">Fatigue &amp; Spacing Monitor</span>
                          <div className="flex items-center gap-2.5">
                            {advisor.breakAdvisor.status === 'burnout' && <AlertCircle className="w-4 h-4 text-zinc-300 animate-pulse shrink-0" />}
                            {advisor.breakAdvisor.status === 'caution' && <Coffee className="w-4 h-4 text-zinc-300 shrink-0" />}
                            {advisor.breakAdvisor.status === 'healthy' && <Smile className="w-4 h-4 text-zinc-300 shrink-0" />}
                            <span className="text-xs font-extrabold uppercase tracking-wider text-white">
                              {advisor.breakAdvisor.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 leading-relaxed">{advisor.breakAdvisor.message}</p>
                          <div className="grid grid-cols-2 gap-4 pt-2 text-[11px] text-zinc-500">
                            <div>
                              Completed today
                              <strong className="text-white block font-bold text-sm mt-0.5">{advisor.breakAdvisor.completedToday} sessions</strong>
                            </div>
                            <div>
                              Back-to-back count
                              <strong className="text-white block font-bold text-sm mt-0.5">{advisor.breakAdvisor.consecutiveWithoutRest}</strong>
                            </div>
                          </div>
                          {onAutoScheduleBreaks && advisor.breakAdvisor.status !== 'healthy' && (
                            <button
                              onClick={() => { onAutoScheduleBreaks(selectedDate); onClose(); }}
                              className="flex items-center gap-2 text-xs text-zinc-500 hover:text-white transition cursor-pointer"
                            >
                              <Coffee className="w-3.5 h-3.5" />
                              Auto-schedule rest breaks
                            </button>
                          )}
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* ── FATIGUE ────────────────────────────────────── */}
                  {activeTab === 'fatigue' && fatigue && (
                    <motion.div key="fatigue"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="px-8 py-6 space-y-6"
                    >
                      {/* Score */}
                      <div className="flex items-end justify-between">
                        <div>
                          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest block mb-2">Fatigue Index</span>
                          <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-extrabold text-white font-heading">{fatigue.score}</span>
                            <span className="text-zinc-500 text-sm font-body">/ 100</span>
                          </div>
                        </div>
                        <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
                          {FATIGUE_LABEL[fatigue.level]}
                        </span>
                      </div>

                      {/* Breakdown bars — WeeklyReviewModal pattern */}
                      <div className="space-y-3">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest block">Signal Breakdown</span>
                        {([
                          { label: 'Back-to-back sessions', val: fatigue.breakdown.backToBack,  max: 54 },
                          { label: 'Skip streak',           val: fatigue.breakdown.skipStreak,   max: 30 },
                          { label: 'Evening decay',         val: fatigue.breakdown.eveningDecay, max: 20 },
                          { label: 'Category monotony',     val: fatigue.breakdown.monotony,     max: 16 },
                        ] as const).map(({ label, val, max }) => (
                          <div key={label} className="space-y-1.5">
                            <div className="flex justify-between text-[11px] text-zinc-400">
                              <span>{label}</span>
                              <span className="font-heading">{val}/{max}</span>
                            </div>
                            <Bar pct={max > 0 ? Math.round((val / max) * 100) : 0} />
                          </div>
                        ))}
                      </div>

                      {/* Signals list */}
                      {fatigue.signals.length > 0 ? (
                        <div className="space-y-2">
                          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest block">Active Signals</span>
                          {fatigue.signals.map((sig, i) => (
                            <div key={i} className="flex items-center gap-2 py-1.5 border-b border-white/[0.02] text-[11px] text-zinc-400">
                              <span className="w-1 h-1 rounded-full bg-zinc-600 shrink-0" />
                              {sig}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          No active fatigue signals — great pacing!
                        </div>
                      )}

                      {/* Break action */}
                      {fatigue.breakSuggestion && (fatigue.level === 'tired' || fatigue.level === 'burnout') && (
                        <div className="flex items-center justify-between border-t border-white/[0.04] pt-4">
                          <span className="text-[11px] text-zinc-500">
                            Suggested break: <span className="font-body text-zinc-300">{fatigue.breakSuggestion.start_time}–{fatigue.breakSuggestion.end_time}</span>
                          </span>
                          <button
                            onClick={handleScheduleBreak}
                            className="bg-white text-black px-4 py-1.5 rounded-full font-bold text-xs hover:bg-zinc-200 transition cursor-pointer"
                          >
                            Schedule break
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* ── PATH ───────────────────────────────────────── */}
                  {activeTab === 'path' && path && (
                    <motion.div key="path"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="px-8 py-6 space-y-5"
                    >
                      {path.nextFocus && (
                        <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                          <Target className="w-3.5 h-3.5 shrink-0" />
                          Focus next: <span className="text-white font-bold ml-1">{path.nextFocus.category}</span>
                          <span className="font-heading ml-1">{path.nextFocus.completionPct}%</span>
                        </div>
                      )}

                      <div className="space-y-1">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest block mb-3">Learning Path</span>
                        {path.stages.length === 0 ? (
                          <p className="text-[11px] text-zinc-500">Complete more blocks to build your learning path.</p>
                        ) : (
                          path.stages.map((stage, i) => {
                            const isNext = path.nextFocus?.category === stage.category;
                            return (
                              <motion.div
                                key={stage.category}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: i * 0.04 }}
                                className="flex items-center justify-between gap-4 py-3.5 border-b border-white/[0.02] last:border-b-0 hover:bg-white/[0.01] px-1 rounded-lg transition-colors"
                              >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                    stage.stage === 'mastered' ? 'bg-white' :
                                    stage.stage === 'in_progress' ? 'bg-zinc-400' : 'bg-zinc-700'
                                  }`} />
                                  <div className="min-w-0 flex-1 space-y-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-medium text-white truncate">{stage.category}</span>
                                      {isNext && <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider shrink-0">Focus</span>}
                                    </div>
                                    <Bar pct={stage.completionPct} />
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0 text-[11px] text-zinc-500">
                                  <span className="font-heading">{stage.completionPct}%</span>
                                  <span className="text-[9px] uppercase tracking-wider text-zinc-700">{STAGE_LABEL[stage.stage]}</span>
                                </div>
                              </motion.div>
                            );
                          })
                        )}
                      </div>

                      {path.narrative && (
                        <p className="text-[11px] text-zinc-400 leading-relaxed border-l-2 border-white/10 pl-4 pt-1">
                          {path.narrative}
                        </p>
                      )}
                    </motion.div>
                  )}

                  {/* ── ENERGY ─────────────────────────────────────── */}
                  {activeTab === 'energy' && energy && (
                    <motion.div key="energy"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="px-8 py-6 space-y-5"
                    >
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest block">Focus Energy by Time of Day</span>

                      <div className="space-y-1">
                        {(['morning', 'afternoon', 'evening'] as const).map((win, i) => {
                          const cfg = ENERGY_WIN[win];
                          const pct = energy[win];
                          const isPeak = energy.peakWindow === win;
                          const Icon = cfg.Icon;
                          return (
                            <motion.div
                              key={win}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: i * 0.05 }}
                              className="flex items-center justify-between gap-4 py-3.5 border-b border-white/[0.02] last:border-b-0 hover:bg-white/[0.01] px-1 rounded-lg transition-colors"
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <Icon className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                                <div className="flex-1 space-y-1.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-white capitalize">{cfg.label}</span>
                                    <span className="text-[9px] text-zinc-600">{cfg.sub}</span>
                                    {isPeak && <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider">Peak</span>}
                                  </div>
                                  <Bar pct={pct} />
                                </div>
                              </div>
                              <div className="shrink-0 text-right">
                                <span className="text-sm font-extrabold text-white font-heading">{pct}%</span>
                                <span className="text-[9px] text-zinc-600 block">{energy.blockCounts[win]} sessions</span>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>

                      <p className="text-[11px] text-zinc-400 leading-relaxed">
                        <span className="text-white font-semibold">{ENERGY_WIN[energy.peakWindow].label}</span> is your peak window
                        at <span className="font-heading text-white">{energy[energy.peakWindow]}%</span> adherence.
                        Schedule your hardest sessions during <span className="text-zinc-300">{ENERGY_WIN[energy.peakWindow].sub}</span>.
                      </p>
                    </motion.div>
                  )}

                  {/* ── RESCHEDULE ─────────────────────────────────── */}
                  {activeTab === 'reschedule' && (
                    <motion.div key="reschedule"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="px-8 py-6 space-y-4"
                    >
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest block">Adaptive Reschedule</span>

                      {visibleSlots.length === 0 && skippedBlocks.length === 0 && (
                        <div className="flex items-center gap-2 text-[11px] text-zinc-500 py-8">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          No skipped blocks — great consistency!
                        </div>
                      )}
                      {visibleSlots.length === 0 && skippedBlocks.length > 0 && (
                        <div className="flex items-center gap-2 text-[11px] text-zinc-500 py-8">
                          <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                          No open slots found in the next 7 days.
                        </div>
                      )}

                      <AnimatePresence>
                        {visibleSlots.map((slot, i) => (
                          <motion.div
                            key={slot.blockId}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ delay: i * 0.04 }}
                            className="flex items-center justify-between gap-4 py-3.5 border-b border-white/[0.02] last:border-b-0 hover:bg-white/[0.01] px-1 rounded-lg transition-colors"
                          >
                            <div className="space-y-0.5 min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-medium">Skipped</span>
                                <span className="text-zinc-700 text-xs">·</span>
                                <span className="text-[10px] text-zinc-500">{formatDate(slot.originalDate)}</span>
                              </div>
                              <h4 className="text-xs font-medium text-white truncate">{slot.blockTitle}</h4>
                              <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                                <ArrowRight className="w-2.5 h-2.5 text-zinc-700 shrink-0" />
                                <span className="font-semibold text-zinc-400">{formatDate(slot.suggestedDate)}</span>
                                <span className="font-body text-zinc-600">{slot.suggestedStart}–{slot.suggestedEnd}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <button
                                onClick={() => setDismissed(prev => new Set([...prev, slot.blockId]))}
                                className="text-xs text-zinc-600 hover:text-zinc-400 transition cursor-pointer"
                              >
                                Dismiss
                              </button>
                              <button
                                onClick={() => {
                                  setAccepted(prev => new Set([...prev, slot.blockId]));
                                  onAcceptReschedule?.(slot);
                                }}
                                className="bg-white text-black px-4 py-1.5 rounded-full font-bold text-xs hover:bg-zinc-200 transition cursor-pointer"
                              >
                                Accept
                              </button>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>

                      {accepted.size > 0 && (
                        <p className="text-[10px] text-zinc-600 flex items-center gap-2 pt-1">
                          <CheckCircle2 className="w-3 h-3 shrink-0" />
                          {accepted.size} session(s) rescheduled and added to your planner.
                        </p>
                      )}
                    </motion.div>
                  )}

                </AnimatePresence>
              )}
            </div>

            {/* ── Footer ─────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-8 py-5 border-t border-white/[0.04] shrink-0">
              <span className="text-[10px] text-zinc-600 uppercase tracking-widest">AI Diagnostics</span>
              <button
                onClick={onClose}
                className="bg-white text-black px-6 py-2 rounded-full font-bold text-xs hover:bg-zinc-200 transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
