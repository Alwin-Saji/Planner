import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  Plus,
  CheckCircle2,
  XCircle,
  Circle,
  Filter,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Youtube,
  ExternalLink,
  FileText,
  Coffee,
  Sparkles,
  Sun,
  Sunrise,
  Moon,
} from 'lucide-react';
import { Block, BlockStatus, Resource } from '../types';
import { formatLocalDateStr, parseLocalDateStr, getTodayStr } from '../utils/dateUtils';

interface DailyViewProps {
  blocks: Block[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  resources: Resource[];
  onUpdateBlock: (id: string, updates: Partial<Block>) => void;
  onDeleteBlock: (id: string) => void;
  onOpenCreateModal: (defaultDate?: string, defaultStartTime?: string, defaultEndTime?: string) => void;
  onEditBlock: (block: Block) => void;
  onViewResource?: (resourceId: string) => void;
  onAutoScheduleBreaks?: (date: string) => Promise<void>;
}

function parseMinutes(t: string): number {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getYouTubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
  return match ? match[1] : null;
}

const getCategoryBadgeStyle = (cat: string, isDone: boolean, isSkipped: boolean) => {
  if (isDone) {
    return {
      cardBg: 'bg-[#101012] border-zinc-800/60 opacity-60 hover:opacity-85',
      pillBg: 'bg-zinc-800 text-zinc-400',
      titleColor: 'line-through text-zinc-500',
    };
  }
  if (isSkipped) {
    return {
      cardBg: 'bg-[#0A0A0A] border-zinc-900 opacity-40',
      pillBg: 'bg-zinc-900 text-zinc-600',
      titleColor: 'line-through text-zinc-600',
    };
  }

  const c = (cat || '').toLowerCase();
  if (c.includes('work') || c.includes('code') || c.includes('dev') || c.includes('dsa')) {
    return {
      cardBg: 'bg-[#14100E] border-[#FF5722]/30 hover:border-[#FF5722]/60 hover:bg-[#1A1310] shadow-[0_4px_20px_rgba(255,87,34,0.06)]',
      pillBg: 'bg-[#FF5722] text-white font-bold',
      titleColor: 'text-zinc-100 font-bold',
    };
  }
  if (c.includes('study') || c.includes('read') || c.includes('learn') || c.includes('review')) {
    return {
      cardBg: 'bg-[#14120B] border-[#FFC107]/30 hover:border-[#FFC107]/60 hover:bg-[#1A170E] shadow-[0_4px_20px_rgba(255,193,7,0.06)]',
      pillBg: 'bg-[#FFC107] text-[#451A03] font-bold',
      titleColor: 'text-zinc-100 font-bold',
    };
  }
  if (c.includes('health') || c.includes('gym') || c.includes('sport') || c.includes('run') || c.includes('exercise')) {
    return {
      cardBg: 'bg-[#140E11] border-[#E91E63]/30 hover:border-[#E91E63]/60 hover:bg-[#1A1015] shadow-[0_4px_20px_rgba(233,30,99,0.06)]',
      pillBg: 'bg-[#E91E63] text-white font-bold',
      titleColor: 'text-zinc-100 font-bold',
    };
  }
  return {
    cardBg: 'bg-[#0E120E] border-[#8BC34A]/30 hover:border-[#8BC34A]/60 hover:bg-[#111711] shadow-[0_4px_20px_rgba(139,195,74,0.06)]',
    pillBg: 'bg-[#8BC34A] text-[#1A2F0F] font-bold',
    titleColor: 'text-zinc-100 font-bold',
  };
};

export const DailyView: React.FC<DailyViewProps> = ({
  blocks,
  selectedDate,
  onSelectDate,
  resources,
  onUpdateBlock,
  onDeleteBlock,
  onOpenCreateModal,
  onEditBlock,
  onViewResource,
  onAutoScheduleBreaks,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'planned' | 'done' | 'skipped'>('all');
  const [viewMode, setViewMode] = useState<'timeline' | 'kanban'>('kanban');

  const dayBlocks = blocks
    .filter((b) => b.date === selectedDate)
    .filter((b) => selectedCategory === 'All' || b.category.toLowerCase() === selectedCategory.toLowerCase())
    .filter((b) => selectedStatus === 'all' || b.status === selectedStatus)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const total = dayBlocks.length;
  const done = dayBlocks.filter((b) => b.status === 'done').length;
  const adherence = total > 0 ? Math.round((done / total) * 100) : 0;
  const categories = ['All', ...Array.from(new Set(blocks.map((b) => b.category)))];

  const isToday = selectedDate === getTodayStr();

  const morningBlocks = dayBlocks.filter((b) => parseMinutes(b.start_time) < 720);
  const afternoonBlocks = dayBlocks.filter((b) => {
    const startM = parseMinutes(b.start_time);
    return startM >= 720 && startM < 1020;
  });
  const eveningBlocks = dayBlocks.filter((b) => parseMinutes(b.start_time) >= 1020);

  const START_HOUR = 6;
  const END_HOUR = 23;
  const HOUR_HEIGHT = 120;

  const getPositionFromTime = (timeStr: string) => {
    const mins = parseMinutes(timeStr);
    const offsetMins = Math.max(0, mins - START_HOUR * 60);
    return (offsetMins / 60) * HOUR_HEIGHT;
  };

  const getHeightFromDuration = (startTime: string, endTime: string) => {
    const startM = parseMinutes(startTime);
    const endM = parseMinutes(endTime);
    const durationM = Math.max(30, endM - startM);
    return (durationM / 60) * HOUR_HEIGHT;
  };

  const getOverlapColumns = (dayBlocks: Block[]) => {
    const columns: Block[][] = [];
    dayBlocks.forEach((block) => {
      let placed = false;
      const bStart = parseMinutes(block.start_time);

      for (let i = 0; i < columns.length; i++) {
        const lastInCol = columns[i][columns[i].length - 1];
        const lastEnd = parseMinutes(lastInCol.end_time);
        if (bStart >= lastEnd) {
          columns[i].push(block);
          placed = true;
          break;
        }
      }
      if (!placed) {
        columns.push([block]);
      }
    });
    return columns;
  };

  const blockColumns = getOverlapColumns(dayBlocks);
  const getBlockColumnInfo = (blockId: string) => {
    for (let colIdx = 0; colIdx < blockColumns.length; colIdx++) {
      if (blockColumns[colIdx].some((b) => b.id === blockId)) {
        return { colIdx, totalCols: blockColumns.length };
      }
    }
    return { colIdx: 0, totalCols: 1 };
  };

  const hoursArray = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

  const detectBreakNeed = () => {
    for (let i = 0; i < dayBlocks.length; i++) {
      const curr = dayBlocks[i];
      const startM = parseMinutes(curr.start_time);
      const endM = parseMinutes(curr.end_time);
      const duration = endM - startM;
      if (duration >= 90 && curr.category !== 'Rest' && curr.category !== 'Break') {
        return {
          reason: `Heavy ${duration}-min session ("${curr.title}")`,
          breakStart: formatMinutes(endM),
          breakEnd: formatMinutes(endM + 15),
        };
      }
    }
    return null;
  };

  const breakNeed = detectBreakNeed();

  const handleStatusToggle = (id: string, currentStatus: BlockStatus) => {
    onUpdateBlock(id, { status: currentStatus === 'done' ? 'planned' : 'done' });
  };

  const changeDate = (days: number) => {
    const d = parseLocalDateStr(selectedDate);
    d.setDate(d.getDate() + days);
    onSelectDate(formatLocalDateStr(d));
  };

  const renderKanbanCard = (block: Block) => {
    const isDone = block.status === 'done';
    const isSkipped = block.status === 'skipped';
    const linkedNote = resources.find((r) => r.id === block.notes_id);
    const youtubeId = getYouTubeId(block.custom_link) || (linkedNote ? getYouTubeId(linkedNote.url_or_content) : null);

    return (
      <motion.div
        key={block.id}
        layout
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        whileHover={{ x: 3 }}
        className={`group/kcard relative flex flex-col justify-between p-4 rounded-2xl transition-all duration-200 bg-transparent hover:bg-white text-zinc-300 hover:text-black space-y-3 ${
          isDone ? 'opacity-40 hover:opacity-100' : isSkipped ? 'opacity-30 hover:opacity-100' : 'opacity-90 hover:opacity-100'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <button
              onClick={() => handleStatusToggle(block.id, block.status)}
              className="mt-0.5 text-zinc-500 group-hover/kcard:text-black shrink-0 focus:outline-none transition-transform active:scale-90"
            >
              {isDone ? (
                <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400 group-hover/kcard:text-emerald-600 fill-emerald-400/20" />
              ) : isSkipped ? (
                <XCircle className="w-4.5 h-4.5 text-zinc-600 group-hover/kcard:text-zinc-400" />
              ) : (
                <Circle className="w-4.5 h-4.5 text-zinc-500 group-hover/kcard:text-black transition-colors" />
              )}
            </button>
            <div className="space-y-1 min-w-0 flex-1">
              <h4 className={`font-sans font-semibold text-sm tracking-tight ${isDone ? 'line-through text-zinc-500 group-hover/kcard:text-zinc-400' : 'text-zinc-100 group-hover/kcard:text-black'}`}>
                {block.title}
              </h4>
              <div className="flex items-center gap-1.5 text-[11px] font-sans text-zinc-400 group-hover/kcard:text-zinc-600 font-bold">
                <Clock className="w-3 h-3 text-zinc-500 group-hover/kcard:text-black" />
                <span>{block.start_time} — {block.end_time}</span>
              </div>
            </div>
          </div>
          <span className="font-sans text-[9px] uppercase tracking-widest px-2 py-0.5 rounded bg-white/5 group-hover/kcard:bg-black/10 text-zinc-400 group-hover/kcard:text-black font-bold shrink-0 transition-colors">
            {block.category}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1 font-sans text-xs">
          <div className="flex items-center gap-1.5">
            {youtubeId && (
              <a
                href={block.custom_link || (linkedNote ? linkedNote.url_or_content : '#')}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-[10px] font-bold text-red-400 group-hover/kcard:text-red-600 transition"
              >
                <Youtube className="w-3 h-3" />
                <span>Video</span>
              </a>
            )}
            {block.custom_link && !youtubeId && (
              <a
                href={block.custom_link}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-[10px] font-bold text-blue-400 group-hover/kcard:text-blue-600 transition"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Link</span>
              </a>
            )}
            {linkedNote && (
              <button
                onClick={() => onViewResource && onViewResource(linkedNote.id)}
                className="flex items-center gap-1 text-[10px] font-bold text-amber-400 group-hover/kcard:text-amber-600 transition"
              >
                <FileText className="w-3 h-3" />
                <span>Note</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 ml-auto opacity-0 group-hover/kcard:opacity-100 transition-opacity">
            {block.status === 'skipped' ? (
              <button
                onClick={() => {
                  onOpenCreateModal(selectedDate, block.start_time, block.end_time);
                }}
                className="text-[11px] font-sans font-bold text-amber-400 hover:text-amber-300 transition px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20"
                title="Reschedule session in future"
              >
                Reschedule ➔
              </button>
            ) : (
              <button
                onClick={() => onUpdateBlock(block.id, { status: 'skipped' })}
                className="text-[11px] font-sans text-zinc-500 hover:text-black transition px-1.5 py-0.5 rounded hover:bg-black/10"
              >
                Skip
              </button>
            )}
            <button
              onClick={() => onEditBlock(block)}
              className="text-[11px] font-sans text-zinc-600 hover:text-black transition px-1.5 py-0.5 rounded hover:bg-black/10"
            >
              Edit
            </button>
            <button
              onClick={() => onDeleteBlock(block.id)}
              className="text-[11px] font-sans text-zinc-500 hover:text-red-600 transition px-1.5 py-0.5 rounded hover:bg-black/10"
            >
              Delete
            </button>
          </div>
        </div>
      </motion.div>
    );
  };

  const renderKanbanColumn = (title: string, icon: React.ReactNode, columnBlocks: Block[], defaultStart: string, defaultEnd: string) => (
    <div className="flex flex-col space-y-3 rounded-3xl bg-[#070709] p-5 flex-1 min-w-[300px]">
      <div className="flex items-center justify-between pb-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="text-zinc-300">{icon}</div>
          <div>
            <h3 className="font-heading font-extrabold text-sm text-white">{title}</h3>
            <p className="font-sans text-[11px] text-zinc-500">{columnBlocks.filter((b) => b.status === 'done').length} of {columnBlocks.length} completed</p>
          </div>
        </div>
        <button onClick={() => onOpenCreateModal(selectedDate, defaultStart, defaultEnd)} className="p-1 text-zinc-500 hover:text-white transition rounded-lg"><Plus className="w-4 h-4" /></button>
      </div>
      <div className="space-y-2 min-h-[200px]">
        <AnimatePresence mode="popLayout">{columnBlocks.map(renderKanbanCard)}</AnimatePresence>
        {columnBlocks.length === 0 && (
          <div onClick={() => onOpenCreateModal(selectedDate, defaultStart, defaultEnd)} className="rounded-2xl p-6 text-center space-y-1.5 cursor-pointer hover:bg-white/[0.02] transition group">
            <div className="w-7 h-7 rounded-xl bg-zinc-900 flex items-center justify-center text-zinc-600 group-hover:text-zinc-300 mx-auto transition"><Plus className="w-3.5 h-3.5" /></div>
            <p className="font-sans text-xs text-zinc-600 group-hover:text-zinc-400 transition">No blocks in {title.toLowerCase()}</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header Banner - Borderless Floating Concept with Circular Progress */}
      <div className="flex flex-wrap items-center justify-between gap-6 py-2 px-1">
        <div className="flex items-center gap-6">
          {/* Circular Progress Ring */}
          <div className="relative flex items-center justify-center shrink-0">
            <svg className="w-14 h-14 transform -rotate-90">
              <circle cx="28" cy="28" r={22} stroke="currentColor" strokeWidth="3.5" className="text-zinc-800" fill="transparent" />
              <motion.circle
                cx="28"
                cy="28"
                r={22}
                stroke="currentColor"
                strokeWidth="3.5"
                className="text-emerald-400"
                fill="transparent"
                strokeDasharray={2 * Math.PI * 22}
                initial={{ strokeDashoffset: 2 * Math.PI * 22 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 22 - (adherence / 100) * 2 * Math.PI * 22 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="font-sans text-xs font-extrabold text-white">{adherence}%</span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="font-heading font-black text-2xl md:text-3xl tracking-tight text-white">
                Daily Schedule
              </h2>
              {isToday && (
                <span className="font-sans text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
                  Today
                </span>
              )}
            </div>
            <p className="font-sans text-xs text-zinc-400">
              {done} of {total} tasks completed
            </p>
          </div>
        </div>

        {/* Floating Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Compact Date Picker */}
          <div className="flex items-center gap-1 bg-[#0E0E12] p-1 rounded-xl">
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => changeDate(-1)} className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition"><ChevronLeft className="w-3.5 h-3.5" /></motion.button>
            <div className="relative flex items-center gap-1.5 px-1.5">
              <CalendarIcon className="w-3.5 h-3.5 text-white shrink-0" />
              <input type="date" value={selectedDate} onChange={(e) => onSelectDate(e.target.value)} style={{ colorScheme: 'dark' }} className="bg-transparent text-white font-sans text-xs focus:outline-none cursor-pointer font-bold [&::-webkit-calendar-picker-indicator]:brightness-0 [&::-webkit-calendar-picker-indicator]:invert" />
            </div>
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => changeDate(1)} className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition"><ChevronRight className="w-3.5 h-3.5" /></motion.button>
          </div>

          {/* Kinetic Sliding Pill Mode Toggle */}
          <div className="relative flex items-center bg-[#0E0E12] p-1 rounded-xl">
            <button
              onClick={() => setViewMode('kanban')}
              className={`relative z-10 px-3.5 py-1.5 rounded-lg font-sans text-xs font-bold transition-colors duration-200 ${
                viewMode === 'kanban' ? 'text-black' : 'text-zinc-400 hover:text-white'
              }`}
            >
              {viewMode === 'kanban' && (
                <motion.span
                  layoutId="activeModePill"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  className="absolute inset-0 bg-white rounded-lg -z-10 shadow-sm"
                />
              )}
              Phases
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`relative z-10 px-3.5 py-1.5 rounded-lg font-sans text-xs font-bold transition-colors duration-200 ${
                viewMode === 'timeline' ? 'text-black' : 'text-zinc-400 hover:text-white'
              }`}
            >
              {viewMode === 'timeline' && (
                <motion.span
                  layoutId="activeModePill"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  className="absolute inset-0 bg-white rounded-lg -z-10 shadow-sm"
                />
              )}
              Linear Spine
            </button>
          </div>

          {onAutoScheduleBreaks && (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onAutoScheduleBreaks(selectedDate)}
              className="flex items-center gap-1.5 bg-[#141415] hover:bg-[#1E1E20] border border-white/[0.08] text-white px-4 py-2 rounded-xl font-sans text-xs font-bold transition shrink-0"
            >
              <Coffee className="w-4 h-4 text-emerald-400" />
              <span>Optimize Breaks</span>
            </motion.button>
          )}

          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => onOpenCreateModal(selectedDate)} className="flex items-center gap-1.5 bg-white hover:bg-zinc-200 text-black px-4 py-2 rounded-xl font-sans text-xs font-bold transition shrink-0"><Plus className="w-4 h-4 stroke-[2.5]" /><span>Add Block</span></motion.button>
        </div>
      </div>

      {/* AI Rest Optimizer Banner - Borderless Floating Notification */}
      {breakNeed && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center justify-between gap-4 p-3.5 rounded-xl bg-[#0B1510] text-emerald-300 text-xs font-sans">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0"><Coffee className="w-4 h-4" /></div>
            <div>
              <span className="font-bold text-white uppercase tracking-wider text-[10px] flex items-center gap-1.5"><Sparkles className="w-3 h-3 text-emerald-400" /> AI Rest Optimizer</span>
              <span className="text-zinc-300 font-sans text-xs">{breakNeed.reason}. Schedule a 15-min rest break at <strong>{breakNeed.breakStart}</strong> to refresh.</span>
            </div>
          </div>
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => { onOpenCreateModal(selectedDate, breakNeed.breakStart, breakNeed.breakEnd); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-400 text-black font-bold font-sans hover:bg-emerald-300 transition cursor-pointer shrink-0 text-xs"><Plus className="w-3 h-3" /><span>Add 15m Break ({breakNeed.breakStart})</span></motion.button>
        </motion.div>
      )}

      {/* Category & Status Filters bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-1">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          <Filter className="w-3.5 h-3.5 text-zinc-500 shrink-0 mr-1" />
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`relative z-10 px-3.5 py-1 rounded-full text-xs font-sans transition-colors duration-200 cursor-pointer ${
                  isSelected ? 'text-black font-bold' : 'text-zinc-500 hover:text-white'
                }`}
              >
                {isSelected && (
                  <motion.span
                    layoutId="activeCategoryPill"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    className="absolute inset-0 bg-white rounded-full -z-10 shadow-sm"
                  />
                )}
                {cat}
              </button>
            );
          })}
        </div>

        {/* Status Pills: All | Planned | Done | Skipped */}
        <div className="flex items-center gap-1.5 bg-[#0E0E12] p-1 rounded-xl">
          {(['all', 'planned', 'done', 'skipped'] as const).map((status) => {
            const isSelected = selectedStatus === status;
            const count = status === 'all' 
              ? dayBlocks.length 
              : dayBlocks.filter(b => b.status === status).length;

            return (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`px-3 py-1 rounded-lg text-xs font-sans font-bold capitalize transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSelected 
                    ? status === 'skipped' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-white text-black'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <span>{status}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  isSelected ? (status === 'skipped' ? 'bg-rose-500/30 text-rose-200' : 'bg-black/10 text-black') : 'bg-white/10 text-zinc-400'
                }`}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {viewMode === 'kanban' ? (
        <div className="flex flex-col lg:flex-row gap-6 overflow-x-auto pb-4">
          {renderKanbanColumn('Morning', <Sunrise className="w-4 h-4 text-amber-400" />, morningBlocks, '09:00', '10:30')}
          {renderKanbanColumn('Afternoon', <Sun className="w-4 h-4 text-orange-400" />, afternoonBlocks, '13:00', '14:30')}
          {renderKanbanColumn('Evening', <Moon className="w-4 h-4 text-indigo-400" />, eveningBlocks, '18:00', '19:30')}
        </div>
      ) : (
        /* Ultra-Minimal Borderless Linear Spine Graph View */
        <div className="rounded-3xl bg-[#060608] p-6 md:p-8 space-y-4 shadow-2xl">
          {(() => {
            const full24HoursArray = Array.from({ length: 24 }, (_, i) => i);

            // Collect all unique starting and stopping times for exact mark lines
            const exactMarksMap: Record<number, { isStart: boolean; isEnd: boolean; times: string[] }> = {};

            dayBlocks.forEach((b) => {
              const startM = parseMinutes(b.start_time);
              const endM = parseMinutes(b.end_time);

              // If start time is non-hourly (e.g. 09:30), track it
              if (startM % 60 !== 0) {
                if (!exactMarksMap[startM]) exactMarksMap[startM] = { isStart: true, isEnd: false, times: [b.start_time] };
                else {
                  exactMarksMap[startM].isStart = true;
                  if (!exactMarksMap[startM].times.includes(b.start_time)) exactMarksMap[startM].times.push(b.start_time);
                }
              }

              // If end time is non-hourly (e.g. 10:30), track it as a stopping mark
              if (endM % 60 !== 0) {
                if (!exactMarksMap[endM]) exactMarksMap[endM] = { isStart: false, isEnd: true, times: [b.end_time] };
                else {
                  exactMarksMap[endM].isEnd = true;
                  if (!exactMarksMap[endM].times.includes(b.end_time)) exactMarksMap[endM].times.push(b.end_time);
                }
              }
            });

            return full24HoursArray.map((hour) => {
              const hourStr = `${String(hour).padStart(2, '0')}:00`;
              const nextHourStr = `${String((hour + 1) % 24).padStart(2, '0')}:00`;

              const slotStartM = hour * 60;
              const slotEndM = (hour + 1) * 60;

              // Assign task strictly by its START TIME hour
              const slotBlocks = dayBlocks.filter((b) => {
                const bStartM = parseMinutes(b.start_time);
                return bStartM >= slotStartM && bStartM < slotEndM;
              });

              // Detect tasks that END within this hour slot
              const endingBlocks = dayBlocks.filter((b) => {
                const bEndM = parseMinutes(b.end_time);
                return bEndM > slotStartM && bEndM <= slotEndM;
              });

              // Detect tasks that started in an earlier hour but cross into/through this current hour
              const crossingBlocks = dayBlocks.filter((b) => {
                const bStartM = parseMinutes(b.start_time);
                const bEndM = parseMinutes(b.end_time);
                return bStartM < slotStartM && bEndM > slotStartM;
              });

              // Hourly header status: If an exact block starts at :00 or ends at :00, it's a primary mark.
              // If a block passes through (e.g. 09:30 to 10:30 going through 10:00), 10:00 is a faint sub-mark!
              const startsOnHour = slotBlocks.some((b) => b.category !== 'Rest' && parseMinutes(b.start_time) === slotStartM);
              const endsOnHour = endingBlocks.some((b) => b.category !== 'Rest' && parseMinutes(b.end_time) === slotStartM);
              const isPrimaryHourMark = startsOnHour || endsOnHour;
              const isFaintSubMarkHour = crossingBlocks.length > 0 && !isPrimaryHourMark;
              const hasEvents = slotBlocks.length > 0 || crossingBlocks.length > 0 || isPrimaryHourMark;

              // Get non-hourly intermediate marks inside this hour (e.g., 09:30 or 10:30)
              const intraHourMarks = Object.keys(exactMarksMap)
                .map(Number)
                .filter((m) => m > slotStartM && m < slotEndM)
                .sort((a, b) => a - b);

              // Interspersed chronological items
              interface TimelineItem {
                type: 'block' | 'mark';
                timeMins: number;
                data: any;
                isCrossing?: boolean;
              }

              const timelineItems: TimelineItem[] = [];

              // Include crossing blocks at the start of the hour
              crossingBlocks.forEach((block) => {
                timelineItems.push({
                  type: 'block',
                  timeMins: slotStartM,
                  data: block,
                  isCrossing: true
                });
              });

              slotBlocks.forEach((block) => {
                timelineItems.push({
                  type: 'block',
                  timeMins: parseMinutes(block.start_time),
                  data: block
                });
              });

              intraHourMarks.forEach((mins) => {
                timelineItems.push({
                  type: 'mark',
                  timeMins: mins,
                  data: mins
                });
              });

              timelineItems.sort((a, b) => {
                if (a.timeMins !== b.timeMins) {
                  return a.timeMins - b.timeMins;
                }
                // 'mark' ticks render before blocks starting at the exact same minute
                return a.type === 'mark' ? -1 : 1;
              });

              return (
                <div key={hour} className="space-y-2 pt-2">
                  {/* Hourly Spine Header Line */}
                  <div
                    className={`group/hour flex items-center gap-4 py-1 transition-opacity duration-200 ${
                      isPrimaryHourMark
                        ? 'opacity-100'
                        : isFaintSubMarkHour
                        ? 'opacity-90 hover:opacity-100'
                        : slotBlocks.length > 0
                        ? 'opacity-90'
                        : 'opacity-60 hover:opacity-90'
                    }`}
                  >
                    {/* Hourly Time Stamp on Left */}
                    <span
                      className={`font-body text-xs shrink-0 ${
                        isPrimaryHourMark
                          ? 'text-zinc-100 font-bold'
                          : isFaintSubMarkHour
                          ? 'text-zinc-400 font-medium'
                          : 'text-zinc-400 font-medium'
                      }`}
                    >
                      {hourStr}
                      {isFaintSubMarkHour && <span className="text-[9px] text-zinc-500 font-mono ml-1 font-normal">(sub-mark)</span>}
                    </span>

                    {/* Spine Line: Refined white line for primary hour mark, clearly visible dashed/solid line for sub-mark & general slots */}
                    <div
                      className={`h-[1px] flex-1 transition-all ${
                        isPrimaryHourMark
                          ? 'bg-white'
                          : isFaintSubMarkHour
                          ? 'border-t border-dashed border-zinc-400'
                          : 'bg-zinc-700'
                      }`}
                    />

                    {hasEvents && (
                      <span className="font-body text-[10px] text-zinc-400 shrink-0">
                        {isPrimaryHourMark ? 'Mark' : isFaintSubMarkHour ? 'Sub-mark' : ''}
                      </span>
                    )}

                    <button
                      onClick={() => onOpenCreateModal(selectedDate, hourStr, nextHourStr)}
                      className="opacity-0 group-hover/hour:opacity-100 flex items-center gap-1 font-body text-[11px] text-zinc-400 hover:text-white transition px-2 py-0.5 rounded hover:bg-white/10 shrink-0"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add</span>
                    </button>
                  </div>

                  {/* Interspersed Timeline Items (Crossing blocks, Tasks and Sub-marks in order) */}
                  {timelineItems.length > 0 && (
                    <div className="space-y-2 pl-4">
                      {timelineItems.map((item) => {
                        if (item.type === 'mark') {
                          const mins = item.data;
                          const markTimeStr = formatMinutes(mins);
                          
                          const isStudyEndTime = dayBlocks.some(
                            (b) => b.category !== 'Rest' && parseMinutes(b.end_time) === mins
                          );
                          const isStudyStartTime = dayBlocks.some(
                            (b) => b.category !== 'Rest' && parseMinutes(b.start_time) === mins
                          );
                          const isRestTime = dayBlocks.some(
                            (b) => b.category === 'Rest' && (parseMinutes(b.start_time) === mins || parseMinutes(b.end_time) === mins)
                          );

                          let label = 'Sub-mark';
                          let subLabel = '(sub-mark)';
                          let lineStyle = 'border-t border-dashed border-zinc-800';
                          let textStyle = 'text-zinc-500';

                          if (isStudyEndTime) {
                            label = 'Stopping Mark';
                            subLabel = '(session end)';
                            lineStyle = 'bg-white/45';
                            textStyle = 'text-zinc-300 font-bold';
                          } else if (isStudyStartTime) {
                            label = 'Starting Mark';
                            subLabel = '(session start)';
                            lineStyle = 'bg-white/45';
                            textStyle = 'text-zinc-300 font-bold';
                          } else if (isRestTime) {
                            label = 'Break';
                            subLabel = '(break)';
                            lineStyle = 'border-t border-dashed border-emerald-500/40';
                            textStyle = 'text-emerald-400 font-medium';
                          }

                          return (
                            <div key={`mark-${markTimeStr}`} className="flex items-center gap-4 py-1.5 opacity-90">
                              <span className={`font-body text-xs shrink-0 ${textStyle}`}>
                                {markTimeStr}
                                <span className="text-[9px] text-zinc-500 ml-1 font-normal">
                                  {subLabel}
                                </span>
                              </span>

                              <div className={`h-[1px] flex-1 ${lineStyle}`} />

                              <span className={`font-body text-[10px] shrink-0 ${textStyle}`}>
                                {label}
                              </span>
                            </div>
                          );
                        } else if (item.isCrossing) {
                          const block = item.data;
                          return (
                            <div
                              key={`cross-${block.id}`}
                              className="flex items-center gap-3 py-1.5 px-3 rounded-xl border border-zinc-800/40 bg-white/[0.02] opacity-75 hover:opacity-100 transition-all group/cross"
                            >
                              <div className="flex items-center gap-1.5 shrink-0 font-mono text-[10px] text-zinc-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 shrink-0" />
                                <span>{hourStr}</span>
                              </div>

                              <div className="h-3 w-[1px] bg-zinc-700 shrink-0" />

                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <span className="text-xs font-sans text-zinc-300 truncate">
                                  Passing through: {block.title}
                                </span>
                                <span className="font-heading text-[9px] uppercase tracking-wider text-zinc-400  px-2 py-0.5 rounded shrink-0">
                                  {block.category}
                                </span>
                              </div>
                            </div>
                          );
                        } else {
                          const block = item.data;
                          const isDone = block.status === 'done';
                          const isSkipped = block.status === 'skipped';
                          const linkedNote = resources.find((r) => r.id === block.notes_id);
                          const youtubeId =
                            getYouTubeId(block.custom_link) || (linkedNote ? getYouTubeId(linkedNote.url_or_content) : null);

                          return (
                            <motion.div
                              key={block.id}
                              layout
                              initial={{ opacity: 0, x: -4 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, scale: 0.96 }}
                              className={`group/row flex flex-wrap items-center justify-between gap-4 py-2.5 px-4 rounded-xl transition-all duration-200 bg-transparent text-zinc-300 hover:bg-white hover:text-black ${
                                isDone ? 'opacity-40 hover:opacity-100' : isSkipped ? 'opacity-30 hover:opacity-100' : 'opacity-90 hover:opacity-100'
                              }`}
                            >
                              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 font-body text-[11px] font-bold text-zinc-400 group-hover/row:text-black transition-colors shrink-0">
                                  <Clock className="w-3.5 h-3.5 text-zinc-500 group-hover/row:text-black transition-colors" />
                                  <span>{block.start_time}</span>
                                  <span className="text-zinc-600 group-hover/row:text-zinc-400 font-normal">→</span>
                                  <span className="font-extrabold">{block.end_time}</span>
                                </div>

                                <button
                                  onClick={() => handleStatusToggle(block.id, block.status)}
                                  className="text-zinc-500 group-hover/row:text-black shrink-0 focus:outline-none transition-transform active:scale-85"
                                >
                                  {isDone ? (
                                    <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400 group-hover/row:text-emerald-600 fill-emerald-400/20" />
                                  ) : isSkipped ? (
                                    <XCircle className="w-4.5 h-4.5 text-zinc-600 group-hover/row:text-zinc-400" />
                                  ) : (
                                    <Circle className="w-4.5 h-4.5 text-zinc-500 group-hover/row:text-black transition-colors" />
                                  )}
                                </button>

                                <span
                                  className={`text-sm font-sans tracking-tight truncate font-medium ${
                                    isDone ? 'line-through text-zinc-500 group-hover/row:text-zinc-400' : 'text-zinc-100 group-hover/row:text-black font-semibold'
                                  }`}
                                >
                                  {block.title}
                                </span>

                                <span className="font-mono text-[9px] uppercase tracking-widest px-2 py-0.5 rounded bg-white/5 group-hover/row:bg-black/10 text-zinc-400 group-hover/row:text-black font-bold shrink-0 transition-colors">
                                  {block.category}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 shrink-0 ml-auto justify-end">
                                {youtubeId && (
                                  <a
                                    href={block.custom_link || (linkedNote ? linkedNote.url_or_content : '#')}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-1 px-2 py-0.5 rounded text-red-400 group-hover/row:text-red-600 text-[10px] font-mono font-bold transition"
                                  >
                                    <Youtube className="w-3 h-3" />
                                    <span>Video</span>
                                  </a>
                                )}
                                {block.custom_link && !youtubeId && (
                                  <a
                                    href={block.custom_link}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-1 px-2 py-0.5 rounded text-blue-400 group-hover/row:text-blue-600 text-[10px] font-mono font-bold transition"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    <span>Link</span>
                                  </a>
                                )}
                                {linkedNote && (
                                  <button
                                    onClick={() => onViewResource && onViewResource(linkedNote.id)}
                                    className="flex items-center gap-1 px-2 py-0.5 rounded text-amber-400 group-hover/row:text-amber-600 text-[10px] font-mono font-bold transition"
                                  >
                                    <FileText className="w-3 h-3" />
                                    <span>Note</span>
                                  </button>
                                )}

                                <div className="flex items-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => onEditBlock(block)}
                                    className="text-[11px] font-mono text-zinc-600 hover:text-black transition px-2 py-0.5 rounded hover:bg-black/10"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => onDeleteBlock(block.id)}
                                    className="text-[11px] font-mono text-zinc-500 hover:text-red-600 transition px-2 py-0.5 rounded hover:bg-black/10"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          );
                        }
                      })}
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </div>
      )}
    </div>
  );
};
