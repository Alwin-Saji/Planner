import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  rectIntersection,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  useDroppable,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Sparkles, Clock, X, Maximize2 } from 'lucide-react';
import { Block, BlockStatus } from '../types';
import { BlockCard } from './BlockCard';
import { formatLocalDateStr, getTodayStr, parseLocalDateStr } from '../utils/dateUtils';

interface WeeklyGridProps {
  blocks: Block[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onUpdateBlock: (id: string, updates: Partial<Block>) => void;
  onDeleteBlock: (id: string) => void;
  onOpenCreateModal: (defaultDate?: string) => void;
  onEditBlock: (block: Block) => void;
}

interface DayColumnProps {
  day: { dateStr: string; dayName: string; dayNum: string; isToday: boolean; isWeekend: boolean };
  dayBlocks: Block[];
  selectedDate: string;
  idx: number;
  isExpanded: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onSelectDate: (date: string) => void;
  onUpdateBlock: (id: string, updates: Partial<Block>) => void;
  onDeleteBlock: (id: string) => void;
  onOpenCreateModal: (defaultDate?: string) => void;
  onEditBlock: (block: Block) => void;
}

function formatDateRange(startStr: string, endStr: string): string {
  try {
    const s = parseLocalDateStr(startStr);
    const e = parseLocalDateStr(endStr);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const sMonth = months[s.getMonth()];
    const eMonth = months[e.getMonth()];
    const sDay = s.getDate().toString().padStart(2, '0');
    const eDay = e.getDate().toString().padStart(2, '0');
    const year = s.getFullYear();

    if (sMonth === eMonth) {
      return `${sMonth} ${sDay} – ${eDay}, ${year}`;
    }
    return `${sMonth} ${sDay} – ${eMonth} ${eDay}, ${year}`;
  } catch {
    return `${startStr} — ${endStr}`;
  }
}

const DayColumnContainer: React.FC<DayColumnProps> = ({
  day,
  dayBlocks,
  selectedDate,
  idx,
  isExpanded,
  onMouseEnter,
  onMouseLeave,
  onSelectDate,
  onUpdateBlock,
  onDeleteBlock,
  onOpenCreateModal,
  onEditBlock,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: day.dateStr,
  });

  const validBlocks = (dayBlocks || []).filter((b): b is Block => Boolean(b && b.id != null));
  const total = validBlocks.length;
  const done = validBlocks.filter(b => b.status === 'done').length;
  const adherence = total > 0 ? Math.round((done / total) * 100) : 0;
  const isSelected = selectedDate === day.dateStr;

  const prevDoneRef = React.useRef(done);
  const prevTotalRef = React.useRef(total);

  React.useEffect(() => {
    if (total > 0 && done === total && prevDoneRef.current < total && prevTotalRef.current === total) {
      import('canvas-confetti').then((confetti) => {
        confetti.default({
          particleCount: 85,
          spread: 65,
          origin: { y: 0.75 },
          colors: ['#FF5722', '#FFC107', '#E91E63', '#8BC34A'],
        });
      });
    }
    prevDoneRef.current = done;
    prevTotalRef.current = total;
  }, [done, total]);

  const handleStatusToggle = (id: string, newStatus: BlockStatus) => {
    onUpdateBlock(id, { status: newStatus });
  };

  const itemIds = validBlocks.map(b => String(b.id));

  return (
    <motion.div
      ref={setNodeRef}
      id={day.dateStr}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      onClick={() => onSelectDate(day.dateStr)}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`flex flex-col w-full h-[520px] lg:h-[calc(100vh-240px)] transition-colors duration-200 cursor-pointer rounded-2xl border ${isExpanded
          ? 'lg:flex-grow lg:flex-1 lg:min-w-[320px] lg:max-w-none p-4 bg-white border-zinc-200 text-black shadow-2xl'
          : 'lg:w-[68px] lg:min-w-[68px] lg:shrink-0 p-2 bg-transparent border-white/[0.03] hover:border-white/[0.08] hover:bg-white/[0.01] text-zinc-400'
        } ${day.isToday && !isExpanded ? 'bg-zinc-900/10 border-white/10' : ''}`}
    >
      {!isExpanded ? (
        <div className="flex flex-col items-center justify-between h-full py-2 select-none">
          <div className="flex flex-col items-center gap-1.5">
            <span className="font-numbers text-xs text-zinc-400 font-bold">{day.dayNum}</span>
            {day.isToday && (
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            )}
          </div>

          <span className="font-heading font-black text-sm text-zinc-500 tracking-wider uppercase transform rotate-90 my-auto whitespace-nowrap">
            {day.dayName}
          </span>

          <div className="flex flex-col items-center gap-1 font-numbers text-[9px] text-zinc-500 font-medium">
            <span>{done}/{total}</span>
            <div className="w-5 bg-white/[0.08] h-[4px] rounded-full overflow-hidden">
              <div className="bg-zinc-400 h-full" style={{ width: `${adherence}%` }} />
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Column Header */}
          <div className="flex items-center justify-between pb-2 border-b border-black/[0.06]">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-baseline gap-1.5">
                <span className="font-heading font-bold text-base text-zinc-900 tracking-tight">{day.dayName}</span>
                <span className="font-numbers text-xs text-zinc-500 font-semibold">{day.dayNum}</span>
              </div>
              {day.isToday && (
                <span className="font-numbers text-[8px] uppercase tracking-wider text-white bg-black border border-black px-1.5 py-0.5 rounded font-bold inline-flex items-center gap-1 w-max">
                  <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                  Today
                </span>
              )}
            </div>

            <div className="text-right font-numbers text-[10px]">
              <div className="font-bold text-zinc-800 text-xs">{done}/{total}</div>
              <div className="text-zinc-500">{adherence}%</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-black/[0.06] h-[4px] rounded-full overflow-hidden mt-1.5 mb-1">
            <motion.div
              className="bg-black h-full"
              initial={{ width: 0 }}
              animate={{ width: `${adherence}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>

          {/* Blocks Container */}
          <div className="flex-1 space-y-2 overflow-y-auto pr-0.5 min-h-[300px] scrollbar-thin">
            <SortableContext
              items={itemIds}
              strategy={verticalListSortingStrategy}
            >
              {validBlocks.map(block => (
                <BlockCard
                  key={String(block.id)}
                  block={block}
                  onStatusToggle={handleStatusToggle}
                  onEditBlock={onEditBlock}
                  onDeleteBlock={onDeleteBlock}
                  isInverted={true}
                />
              ))}
            </SortableContext>

            {validBlocks.length === 0 && (
              <motion.div
                whileHover={{ y: -1 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenCreateModal(day.dateStr);
                }}
                className="group relative rounded-xl p-3 border border-dashed border-zinc-300 hover:border-zinc-400 bg-black/[0.01] transition-all cursor-pointer select-none py-6 flex flex-col items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-600 transition-colors" />
                <span className="font-mono text-[10px] text-zinc-400 group-hover:text-zinc-600 transition-colors">
                  Empty
                </span>
              </motion.div>
            )}
          </div>

          {/* Bottom Add button */}
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={(e) => {
              e.stopPropagation();
              onOpenCreateModal(day.dateStr);
            }}
            className="w-full py-1.5 hover:bg-black/[0.04] border border-transparent hover:border-black/10 rounded-xl text-[11px] font-mono text-zinc-500 hover:text-black transition flex items-center justify-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Block</span>
          </motion.button>
        </>
      )}
    </motion.div>
  );
};

export const WeeklyGrid: React.FC<WeeklyGridProps> = ({
  blocks,
  selectedDate,
  onSelectDate,
  onUpdateBlock,
  onDeleteBlock,
  onOpenCreateModal,
  onEditBlock,
}) => {
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [viewDaysMode, setViewDaysMode] = useState<'5' | '7'>('7');
  const [activeBlock, setActiveBlock] = useState<Block | null>(null);

  const [weeklyFocus, setWeeklyFocus] = useState(() => localStorage.getItem('weekly_focus_goal') || '');
  const [scratchpad, setScratchpad] = useState(() => localStorage.getItem('weekly_scratchpad') || '');
  const [isScratchpadOpen, setIsScratchpadOpen] = useState(false);

  React.useEffect(() => {
    localStorage.setItem('weekly_focus_goal', weeklyFocus);
  }, [weeklyFocus]);

  React.useEffect(() => {
    localStorage.setItem('weekly_scratchpad', scratchpad);
  }, [scratchpad]);

  const hoverTimeoutRef = React.useRef<any>(null);

  const handleMouseEnterDay = (dateStr: string) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    if (activeBlock) return;
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredDate(dateStr);
    }, 100);
  };

  const handleMouseLeaveDay = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    if (activeBlock) return;
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredDate(null);
    }, 100);
  };

  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: {
      distance: 5,
    },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 150,
      tolerance: 5,
    },
  });
  const keyboardSensor = useSensor(KeyboardSensor);

  const sensors = useSensors(mouseSensor, touchSensor, keyboardSensor);

  const getWeekDates = (offset: number) => {
    const today = new Date();
    const startDay = new Date(today);
    // Offset by -1 day so Today is positioned as the 2nd card (index 1)
    startDay.setDate(today.getDate() - 1 + offset * 7);

    const week: Array<{ dateStr: string; dayName: string; dayNum: string; isToday: boolean; isWeekend: boolean }> = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(startDay);
      d.setDate(startDay.getDate() + i);
      const dateStr = formatLocalDateStr(d);
      const isToday = dateStr === getTodayStr();
      const dayOfWeekIndex = d.getDay();

      week.push({
        dateStr,
        dayName: dayNames[dayOfWeekIndex],
        dayNum: d.getDate().toString().padStart(2, '0'),
        isToday,
        isWeekend: dayOfWeekIndex === 0 || dayOfWeekIndex === 6,
      });
    }
    return week;
  };

  const allWeekDays = getWeekDates(currentWeekOffset);
  const weekDays = viewDaysMode === '5' ? allWeekDays.filter(d => !d.isWeekend) : allWeekDays;

  const startDateStr = allWeekDays[0].dateStr;
  const endDateStr = allWeekDays[6].dateStr;
  const formattedDateRange = formatDateRange(startDateStr, endDateStr);

  const customCollisionDetection = (args: any) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) return pointerCollisions;
    return rectIntersection(args);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const found = blocks.find(b => String(b.id) === String(active.id));
    if (found) setActiveBlock(found);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (!over) return;
    const overId = String(over.id);

    // Check if overId is a day dateStr
    const targetDay = weekDays.find(w => w.dateStr === overId);
    if (targetDay) {
      setHoveredDate(targetDay.dateStr);
    } else {
      // Check if overId is a block's ID
      const overBlockObj = blocks.find(b => String(b.id) === overId);
      if (overBlockObj) {
        setHoveredDate(overBlockObj.date);
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveBlock(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId === overId) return;

    const activeBlockObj = blocks.find(b => String(b.id) === activeId);
    if (!activeBlockObj) return;

    // Option A: Dropped onto a day column background
    const targetDay = weekDays.find(w => w.dateStr === overId);
    if (targetDay) {
      if (activeBlockObj.date !== targetDay.dateStr) {
        onUpdateBlock(activeId, { date: targetDay.dateStr });
      }
      return;
    }

    // Option B: Dropped onto another BlockCard
    const overBlockObj = blocks.find(b => String(b.id) === overId);
    if (overBlockObj) {
      if (activeBlockObj.date !== overBlockObj.date) {
        // Across different days: move to target day and swap time slot with target card
        onUpdateBlock(activeId, {
          date: overBlockObj.date,
          start_time: overBlockObj.start_time,
          end_time: overBlockObj.end_time,
        });
        onUpdateBlock(String(overBlockObj.id), {
          date: activeBlockObj.date,
          start_time: activeBlockObj.start_time,
          end_time: activeBlockObj.end_time,
        });
      } else {
        // Within the same day: swap time slots so start_time sorting puts active card in new position
        onUpdateBlock(activeId, {
          start_time: overBlockObj.start_time,
          end_time: overBlockObj.end_time,
        });
        onUpdateBlock(String(overBlockObj.id), {
          start_time: activeBlockObj.start_time,
          end_time: activeBlockObj.end_time,
        });
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Redesigned Minimalist Header Controls Bar with Global Theme Colors */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2">
        {/* Left Side: Title & Date Info */}
        <div className="space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="font-heading font-black text-3xl md:text-4xl tracking-tight text-text-primary">
              Weekly Grid
            </h2>
            <div className="flex items-center gap-2 bg-surface-elevated px-3.5 py-1 rounded-xl font-body text-xs font-semibold text-text-secondary shadow-sm">
              <CalendarIcon className="w-3.5 h-3.5 text-text-muted shrink-0" />
              <span className="text-text-primary">{formattedDateRange}</span>
            </div>
          </div>
          <p className="font-mono text-xs text-zinc-400">
            Drag block cards to reschedule • Click any day header to inspect daily timeline
          </p>
        </div>

        {/* Right Side: Control Bar Cluster */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Segmented View Mode Switcher with Active Link Indicator */}
          <div className="flex items-center bg-[#101010] p-1 rounded-2xl text-xs font-body">
            <button
              onClick={() => setViewDaysMode('5')}
              className={`relative px-4 py-1.5 rounded-xl transition-colors duration-200 ${viewDaysMode === '5'
                  ? 'text-black font-extrabold'
                  : 'text-zinc-400 hover:text-white font-medium'
                }`}
            >
              {viewDaysMode === '5' && (
                <motion.div
                  layoutId="viewDaysActiveIndicator"
                  className="absolute inset-0 bg-white rounded-xl shadow-md z-0"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10">5 Work Days</span>
            </button>
            <button
              onClick={() => setViewDaysMode('7')}
              className={`relative px-4 py-1.5 rounded-xl transition-colors duration-200 ${viewDaysMode === '7'
                  ? 'text-black font-extrabold'
                  : 'text-zinc-400 hover:text-white font-medium'
                }`}
            >
              {viewDaysMode === '7' && (
                <motion.div
                  layoutId="viewDaysActiveIndicator"
                  className="absolute inset-0 bg-white rounded-xl shadow-md z-0"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10">7 Full Days</span>
            </button>
          </div>

          {/* Week Navigation */}
          <div className="flex items-center gap-1 bg-surface p-1 rounded-2xl font-body">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setCurrentWeekOffset(prev => prev - 1)}
              className="p-1.5 rounded-xl text-text-muted hover:text-text-primary hover:bg-surface-hover transition-all"
              title="Previous Week"
            >
              <ChevronLeft className="w-4 h-4" />
            </motion.button>
            <button
              onClick={() => setCurrentWeekOffset(0)}
              className={`px-3.5 py-1 rounded-xl text-xs transition-all font-semibold ${
                currentWeekOffset === 0
                  ? 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                  : 'bg-white text-black font-extrabold shadow-sm hover:bg-zinc-200'
              }`}
              title={currentWeekOffset !== 0 ? 'Click to reset to This Week' : 'This Week'}
            >
              {currentWeekOffset === 0
                ? 'This Week'
                : currentWeekOffset === 1
                ? 'Next Week'
                : currentWeekOffset === -1
                ? 'Last Week'
                : currentWeekOffset > 1
                ? `+${currentWeekOffset} Weeks`
                : `${currentWeekOffset} Weeks`}
            </button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setCurrentWeekOffset(prev => prev + 1)}
              className="p-1.5 rounded-xl text-text-muted hover:text-text-primary hover:bg-surface-hover transition-all"
              title="Next Week"
            >
              <ChevronRight className="w-4 h-4" />
            </motion.button>
          </div>

          {/* Add Block Action Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onOpenCreateModal()}
            className="flex items-center gap-2 bg-foreground text-background hover:bg-zinc-200 px-4 py-2 rounded-2xl text-xs font-body font-bold transition-all shadow-md"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Block</span>
          </motion.button>
        </div>
      </div>

      {/* Side-by-Side Content Layout: Columns + Focus & Scratchpad Sidebar */}
      <div className="flex flex-col xl:flex-row gap-6 w-full items-start">
        {/* Left Side: Dynamic Accordion Columns */}
        <div className="flex-1 w-full overflow-hidden">
          <DndContext
            sensors={sensors}
            collisionDetection={customCollisionDetection}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveBlock(null)}
          >
            <div className="flex flex-col lg:flex-row gap-3 pb-4 pt-1 w-full justify-center max-w-[1400px] mx-auto">
              {weekDays.map((day, idx) => {
                const dayBlocks = (blocks || [])
                  .filter(b => Boolean(b && b.id != null && b.date === day.dateStr))
                  .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));

                const defaultExpandedDate = weekDays.find(d => d.dateStr === selectedDate)?.dateStr ||
                  weekDays.find(d => d.isToday)?.dateStr ||
                  weekDays[0]?.dateStr;
                const activeDate = hoveredDate || defaultExpandedDate;
                const isExpanded = day.dateStr === activeDate;

                return (
                  <DayColumnContainer
                    key={day.dateStr}
                    day={day}
                    dayBlocks={dayBlocks}
                    selectedDate={selectedDate}
                    idx={idx}
                    isExpanded={isExpanded}
                    onMouseEnter={() => handleMouseEnterDay(day.dateStr)}
                    onMouseLeave={handleMouseLeaveDay}
                    onSelectDate={onSelectDate}
                    onUpdateBlock={onUpdateBlock}
                    onDeleteBlock={onDeleteBlock}
                    onOpenCreateModal={onOpenCreateModal}
                    onEditBlock={onEditBlock}
                  />
                );
              })}
            </div>

            {/* Drag Overlay Ghost Card */}
            <DragOverlay>
              {activeBlock ? (
                <div className="bg-[#202020] rounded-xl p-3.5 border border-white/40 shadow-2xl w-[320px] opacity-95 text-white">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="font-heading font-extrabold text-white">{activeBlock.start_time} — {activeBlock.end_time}</span>
                      <span className="bg-white text-black font-extrabold text-[9px] px-2 py-0.5 rounded">{activeBlock.category}</span>
                    </div>
                    <h4 className="font-heading font-bold text-sm text-white">{activeBlock.title}</h4>
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>

        {/* Right Side: Weekly Focus & Scratchpad Sidebar Widget */}
        <div className="w-full xl:w-[320px] shrink-0 bg-[#070707] border border-white/[0.03] rounded-2xl p-5 space-y-6 flex flex-col h-[520px] lg:h-[calc(100vh-240px)]">
          {/* Focus Goal Section */}
          <div className="space-y-2 shrink-0">
            <div className="flex items-center gap-2">
              <span className="bg-white/10 text-white text-[9px] font-mono px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">
                Goal
              </span>
              <h3 className="font-heading font-black text-[10px] tracking-widest text-zinc-500 uppercase">
                Weekly Focus
              </h3>
            </div>
            <textarea
              value={weeklyFocus}
              onChange={(e) => setWeeklyFocus(e.target.value)}
              placeholder="Write your main focus or target for this week..."
              className="w-full h-14 bg-transparent border-b border-white/[0.04] focus:border-white/15 p-0 pb-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none resize-none transition-colors leading-relaxed"
            />
          </div>

          {/* Stats Adherence Section */}
          <div className="space-y-3 shrink-0">
            <h3 className="font-heading font-black text-[10px] tracking-widest text-zinc-500 uppercase">
              Weekly Performance
            </h3>
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] font-mono text-zinc-400">Completion Level</span>
                <span className="font-numbers text-xs text-white">
                  {blocks.filter(b => b.status === 'done').length} <span className="text-zinc-600">/ {blocks.length}</span>
                </span>
              </div>
              {/* Segmented Level Meter */}
              <div className="grid grid-cols-10 gap-1">
                {Array.from({ length: 10 }).map((_, i) => {
                  const percentDone = blocks.length > 0 ? (blocks.filter(b => b.status === 'done').length / blocks.length) * 100 : 0;
                  const step = (i + 1) * 10;
                  const isFilled = percentDone >= step;
                  return (
                    <div 
                      key={i}
                      className={`h-1 rounded-full transition-all duration-500 ${
                        isFilled ? 'bg-white' : 'bg-white/10'
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* Scratchpad Section */}
          <div className="space-y-2 flex flex-col flex-1 min-h-0">
            <div className="flex items-center justify-between shrink-0">
              <h3 className="font-heading font-black text-[10px] tracking-widest text-zinc-500 uppercase">
                Quick Scratchpad
              </h3>
              <span className="text-[8px] font-mono text-zinc-600 tracking-wider">PAGE. 01</span>
            </div>
            
            {/* Tear-off Notepad sheet (Clickable Preview) */}
            <div 
              onClick={() => setIsScratchpadOpen(true)}
              className="group relative rounded-xl overflow-hidden border-2 border-zinc-200 bg-[#FAFAFA] flex-1 flex flex-col min-h-0 shadow-2xl cursor-pointer hover:border-zinc-400 transition-all duration-200"
            >
              {/* Tear-off perforated line top header */}
              <div className="h-7 border-b-2 border-dashed border-zinc-300 bg-zinc-100 flex items-center justify-between px-3 shrink-0 select-none">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <div className="w-2 h-2 rounded-full bg-amber-400" />
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest font-bold">TEAR HERE</span>
                  <Maximize2 className="w-3 h-3 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
              
              <div className="relative flex-1 flex flex-col min-h-0 pointer-events-none">
                <textarea
                  value={scratchpad}
                  readOnly
                  placeholder="Click to start writing..."
                  className="w-full flex-1 bg-transparent pl-9 pr-3 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none resize-none transition-colors lined-paper-white-textarea min-h-0 font-cursive text-2xl font-semibold"
                  style={{
                    fontFamily: "'Caveat', cursive, sans-serif",
                    paddingTop: '8px',
                    paddingBottom: '8px',
                  }}
                />
                {/* Notepad vertical left red margin line */}
                <div className="absolute left-7 top-0 bottom-0 w-[2px] bg-red-500/80 pointer-events-none z-10" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full-page Lined Paper Scratchpad Modal */}
      <AnimatePresence>
        {isScratchpadOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsScratchpadOpen(false)}
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 lg:p-8"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 350, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              className="relative rounded-2xl overflow-hidden border-2 border-zinc-300 bg-[#FAFAFA] w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl"
            >
              {/* Modal tear-off perforated header */}
              <div className="h-11 border-b-2 border-dashed border-zinc-300 bg-zinc-100 flex items-center justify-between px-6 shrink-0 select-none">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500 shadow-sm" />
                  <div className="w-3 h-3 rounded-full bg-amber-400 shadow-sm" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm" />
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs font-mono font-bold text-zinc-600 uppercase tracking-widest">
                    SCRATCHPAD PAGE
                  </span>
                  <button 
                    onClick={() => setIsScratchpadOpen(false)}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="relative flex-1 flex flex-col min-h-0">
                <textarea
                  value={scratchpad}
                  onChange={(e) => setScratchpad(e.target.value)}
                  autoFocus
                  placeholder="Jot down quick thoughts, notes, or ideas..."
                  className="w-full flex-1 bg-transparent pl-14 pr-6 py-4 text-zinc-900 placeholder-zinc-400 focus:outline-none resize-none transition-colors lined-paper-white-textarea min-h-0 font-cursive text-2xl font-medium"
                  style={{
                    fontFamily: "'Caveat', cursive, sans-serif",
                    paddingTop: '12px',
                    paddingBottom: '12px',
                    lineHeight: '28px',
                    backgroundSize: '100% 28px',
                    fontSize: '26px',
                    backgroundPosition: '0 12px'
                  }}
                />
                {/* Notepad vertical left red margin line */}
                <div className="absolute left-11 top-0 bottom-0 w-[2px] bg-red-500/80 pointer-events-none z-10" />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
