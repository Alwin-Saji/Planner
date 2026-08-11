import React, { useEffect, useRef, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import gsap from 'gsap';
import { Flame, Trophy, CheckCircle, BarChart2, PieChart, Activity, Calendar } from 'lucide-react';
import { DailyLog, AdherenceSummary } from '../types';

interface HeatmapStreakProps {
  logs: DailyLog[];
  summary: AdherenceSummary | null;
}

const AnimatedCounter: React.FC<{ value: number; suffix?: string }> = ({ value, suffix = '' }) => {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const obj = { val: 0 };
    gsap.to(obj, {
      val: value,
      duration: 1.2,
      ease: 'power2.out',
      onUpdate: () => {
        if (ref.current) {
          ref.current.textContent = `${Math.round(obj.val)}${suffix}`;
        }
      },
    });
  }, [value, suffix]);

  return <span ref={ref}>0{suffix}</span>;
};

export const HeatmapStreak: React.FC<HeatmapStreakProps> = ({ logs, summary }) => {
  const [matrixView, setMatrixView] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');

  const getIntensityClass = (pct: number, count: number) => {
    if (count === 0) return 'bg-[#181820] text-zinc-700';
    if (pct >= 80) return 'bg-white text-black font-bold shadow-md shadow-white/10';
    if (pct >= 50) return 'bg-[#A8A8B4] text-black font-bold';
    if (pct >= 20) return 'bg-[#565664] text-zinc-100 font-semibold';
    return 'bg-[#32323E] text-zinc-200 font-semibold';
  };

  const logMap = useMemo(() => {
    const map = new Map<string, DailyLog>();
    logs.forEach(l => map.set(l.date, l));
    return map;
  }, [logs]);

  // Generate current week data grid (Sunday to Saturday)
  const weeklyGridData = useMemo(() => {
    const today = new Date();
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - today.getDay());

    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const result: { dateStr: string; dayNum: string; dayLabel: string; isToday: boolean; log?: DailyLog }[] = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const isToday = dateStr === today.toISOString().split('T')[0];

      result.push({
        dateStr,
        dayNum: String(d.getDate()),
        dayLabel: dayLabels[i],
        isToday,
        log: logMap.get(dateStr),
      });
    }
    return result;
  }, [logMap]);

  // Generate current month calendar grid (From 1st to Last Day of Month)
  const monthlyGridData = useMemo(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const result: { dateStr: string; dayNum: string; isToday: boolean; log?: DailyLog }[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      // Format YYYY-MM-DD
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isToday = dateStr === today.toISOString().split('T')[0];

      result.push({
        dateStr,
        dayNum: String(day),
        isToday,
        log: logMap.get(dateStr),
      });
    }
    return result;
  }, [logMap]);

  // Generate full calendar year (Jan 1st to Dec 31st) data grid structure
  const yearlyGridData = useMemo(() => {
    const today = new Date();
    const currentYear = today.getFullYear();

    const jan1 = new Date(currentYear, 0, 1);
    const dec31 = new Date(currentYear, 11, 31);

    // Align start to the preceding Sunday
    const startDate = new Date(jan1);
    while (startDate.getDay() !== 0) {
      startDate.setDate(startDate.getDate() - 1);
    }

    // Align end to the following Saturday
    const endDate = new Date(dec31);
    while (endDate.getDay() !== 6) {
      endDate.setDate(endDate.getDate() + 1);
    }

    const result: { dateStr: string; monthLabel?: string; dayOfWeek: number; isCurrentYear: boolean; log?: DailyLog }[][] = [];
    let currentWeek: { dateStr: string; monthLabel?: string; dayOfWeek: number; isCurrentYear: boolean; log?: DailyLog }[] = [];

    let lastMonth = -1;
    const curr = new Date(startDate);

    while (curr <= endDate) {
      const year = curr.getFullYear();
      const month = curr.getMonth();
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(curr.getDate()).padStart(2, '0')}`;
      const isCurrentYear = year === currentYear;

      let monthLabel: string | undefined = undefined;

      // Assign month label on the first occurrence of that month in the year grid
      if (isCurrentYear && month !== lastMonth && curr.getDate() <= 7) {
        monthLabel = curr.toLocaleString('default', { month: 'short' });
        lastMonth = month;
      }

      currentWeek.push({
        dateStr,
        monthLabel,
        dayOfWeek: curr.getDay(),
        isCurrentYear,
        log: logMap.get(dateStr),
      });

      if (currentWeek.length === 7) {
        result.push(currentWeek);
        currentWeek = [];
      }

      curr.setDate(curr.getDate() + 1);
    }

    if (currentWeek.length > 0) {
      result.push(currentWeek);
    }

    return result;
  }, [logMap]);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 400, damping: 30 } },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6 font-sans"
    >
      {/* Execution Summary - Hero Banner Concept */}
      <motion.div
        variants={itemVariants}
        className="rounded-3xl bg-[#08080B] p-6 hover:bg-white text-white hover:text-black transition-all duration-300 group/hero cursor-pointer space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-6">
          {/* Main Stat & Label */}
          <div className="flex items-center gap-5">
            <div className="font-heading font-black text-5xl tracking-tighter">
              <AnimatedCounter value={summary?.overallAdherence || 0} suffix="%" />
            </div>
            <div>
              <span className="font-sans text-[10px] uppercase tracking-widest text-zinc-500 group-hover/hero:text-zinc-600 font-extrabold block">
                Execution Performance
              </span>
              <h2 className="font-heading font-bold text-lg tracking-tight text-white group-hover/hero:text-black transition-colors">
                Overall Adherence Score
              </h2>
            </div>
          </div>

          {/* Metric Stats Strip */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white/5 group-hover/hero:bg-black/10 transition-colors">
              <Flame className="w-4 h-4 fill-current text-white group-hover/hero:text-black" />
              <div className="text-left">
                <span className="font-sans text-[9px] text-zinc-400 group-hover/hero:text-zinc-600 block uppercase font-bold">Current</span>
                <span className="font-sans text-xs font-extrabold block">{summary?.currentStreak || 0} Days Streak</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white/5 group-hover/hero:bg-black/10 transition-colors">
              <Trophy className="w-4 h-4 text-white group-hover/hero:text-black" />
              <div className="text-left">
                <span className="font-sans text-[9px] text-zinc-400 group-hover/hero:text-zinc-600 block uppercase font-bold">Best</span>
                <span className="font-sans text-xs font-extrabold block">{summary?.maxStreak || 0} Days Record</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white/5 group-hover/hero:bg-black/10 transition-colors">
              <CheckCircle className="w-4 h-4 text-white group-hover/hero:text-black" />
              <div className="text-left">
                <span className="font-sans text-[9px] text-zinc-400 group-hover/hero:text-zinc-600 block uppercase font-bold">Total</span>
                <span className="font-sans text-xs font-extrabold block">{summary?.totalCompleted || 0} / {summary?.totalPlanned || 0} Tasks</span>
              </div>
            </div>
          </div>
        </div>

        {/* Minimal Wide Progress Bar */}
        <div className="w-full bg-white/5 group-hover/hero:bg-black/10 h-2 rounded-full overflow-hidden transition-colors">
          <motion.div
            className="bg-white group-hover/hero:bg-black h-full transition-colors"
            initial={{ width: 0 }}
            animate={{ width: `${summary?.overallAdherence || 0}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </div>
      </motion.div>

      {/* GitHub-Style Adherence Matrix Section */}
      <motion.div
        variants={itemVariants}
        className="rounded-3xl bg-[#08080B] p-6 space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-white" />
            <h3 className="font-heading font-extrabold text-sm text-white tracking-tight">
              Adherence Matrix
            </h3>
          </div>

          {/* Kinetic Mode Toggle (Weekly vs Monthly vs Yearly) */}
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-[#121216] p-1 rounded-xl relative">
              <button
                onClick={() => setMatrixView('weekly')}
                className={`relative z-10 px-3.5 py-1.5 rounded-lg text-xs font-sans font-bold transition-colors ${
                  matrixView === 'weekly' ? 'text-black' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {matrixView === 'weekly' && (
                  <motion.span
                    layoutId="activeMatrixModePill"
                    className="absolute inset-0 bg-white rounded-lg shadow-sm"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <span className="relative z-10">Weekly</span>
              </button>

              <button
                onClick={() => setMatrixView('monthly')}
                className={`relative z-10 px-3.5 py-1.5 rounded-lg text-xs font-sans font-bold transition-colors ${
                  matrixView === 'monthly' ? 'text-black' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {matrixView === 'monthly' && (
                  <motion.span
                    layoutId="activeMatrixModePill"
                    className="absolute inset-0 bg-white rounded-lg shadow-sm"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <span className="relative z-10">Monthly</span>
              </button>

              <button
                onClick={() => setMatrixView('yearly')}
                className={`relative z-10 px-3.5 py-1.5 rounded-lg text-xs font-sans font-bold transition-colors ${
                  matrixView === 'yearly' ? 'text-black' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {matrixView === 'yearly' && (
                  <motion.span
                    layoutId="activeMatrixModePill"
                    className="absolute inset-0 bg-white rounded-lg shadow-sm"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <span className="relative z-10">Yearly</span>
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-2 text-[11px] font-sans text-zinc-400">
              <span>Less</span>
              <span className="w-3 h-3 rounded bg-[#181820]" />
              <span className="w-3 h-3 rounded bg-[#32323E]" />
              <span className="w-3 h-3 rounded bg-[#565664]" />
              <span className="w-3 h-3 rounded bg-[#A8A8B4]" />
              <span className="w-3 h-3 rounded bg-white" />
              <span>More</span>
            </div>
          </div>
        </div>

        {/* Matrix Render */}
        {matrixView === 'weekly' ? (
          <div className="grid grid-cols-7 gap-3 pt-1">
            {weeklyGridData.map(item => {
              const pct = item.log ? item.log.adherence_pct : 0;
              const count = item.log ? item.log.planned_count : 0;

              return (
                <motion.div
                  key={item.dateStr}
                  whileHover={{ scale: 1.08, zIndex: 10 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  className={`aspect-square rounded-2xl p-2.5 flex flex-col items-center justify-between transition-colors cursor-pointer ${
                    item.isToday ? 'ring-2 ring-white/50' : ''
                  } ${getIntensityClass(pct, count)}`}
                  title={`${item.dateStr}: ${item.log ? `${pct}% Adherence (${item.log.completed_count}/${count} Done)` : 'No activity planned'}`}
                >
                  <span className="font-sans text-[10px] font-bold uppercase tracking-wider opacity-70">{item.dayLabel}</span>
                  <span className="font-sans text-xs font-semibold">{item.dayNum}</span>
                  <span className="font-heading text-sm font-black">{item.log ? `${pct}%` : '0%'}</span>
                </motion.div>
              );
            })}
          </div>
        ) : matrixView === 'monthly' ? (
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2.5 pt-1">
            {monthlyGridData.map(item => {
              const pct = item.log ? item.log.adherence_pct : 0;
              const count = item.log ? item.log.planned_count : 0;

              return (
                <motion.div
                  key={item.dateStr}
                  whileHover={{ scale: 1.12, zIndex: 10 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  className={`aspect-square rounded-xl p-1.5 flex flex-col items-center justify-between transition-colors cursor-pointer ${getIntensityClass(
                    pct,
                    count
                  )}`}
                  title={`${item.dateStr}: ${item.log ? `${pct}% Adherence (${item.log.completed_count}/${count} Done)` : 'No activity planned'}`}
                >
                  <span className="font-sans text-[10px] opacity-70">{item.dayNum}</span>
                  <span className="font-sans text-[11px] font-bold">{item.log ? `${pct}%` : '0%'}</span>
                </motion.div>
              );
            })}
          </div>
        ) : (
          /* GitHub 52-Week Contribution Matrix */
          <div className="overflow-x-auto pb-2">
            <div className="min-w-[750px] space-y-2">
              {/* Month Header Row - Positioned over starting week columns */}
              <div className="relative h-4 text-[10px] font-sans text-zinc-400 font-bold select-none">
                {yearlyGridData.map((week, idx) => {
                  const label = week.find(d => d.monthLabel)?.monthLabel;
                  if (!label) return null;

                  // 2rem (32px) offset for day label column + 1.125rem (18px) per week column
                  const leftPos = 2.1 + idx * 1.125;

                  return (
                    <span
                      key={idx}
                      className="absolute top-0 leading-none whitespace-nowrap"
                      style={{ left: `${leftPos}rem` }}
                    >
                      {label}
                    </span>
                  );
                })}
              </div>

              {/* Day Rows (Sun - Sat) */}
              <div className="flex gap-1.5">
                {/* Day Labels */}
                <div className="flex flex-col justify-between text-[9px] font-sans text-zinc-600 font-bold pr-2 py-0.5 shrink-0 select-none">
                  <span>Sun</span>
                  <span>Tue</span>
                  <span>Thu</span>
                  <span>Sat</span>
                </div>

                {/* 52 Columns */}
                <div className="flex gap-1.5">
                  {yearlyGridData.map((week, weekIdx) => (
                    <div key={weekIdx} className="flex flex-col gap-1.5 shrink-0">
                      {week.map(day => {
                        const pct = day.log ? day.log.adherence_pct : 0;
                        const count = day.log ? day.log.planned_count : 0;

                        return (
                          <motion.div
                            key={day.dateStr}
                            whileHover={{ scale: 1.25, zIndex: 20 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                            className={`w-3 h-3 rounded-[3px] cursor-pointer transition-colors ${
                              !day.isCurrentYear ? 'opacity-25 pointer-events-none' : ''
                            } ${getIntensityClass(pct, count)}`}
                            title={`${day.dateStr}: ${day.log ? `${pct}% Adherence (${day.log.completed_count}/${count} Done)` : 'No activity planned'}`}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Category Breakdown - Circular Progress Rings with Content Inside */}
      {summary?.categorySplit && summary.categorySplit.length > 0 && (
        <motion.div
          variants={itemVariants}
          className="space-y-4"
        >
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <PieChart className="w-4 h-4 text-white" />
              <h3 className="font-heading font-extrabold text-sm text-white tracking-tight">Category Adherence Rings</h3>
            </div>
            <span className="font-sans text-xs text-zinc-500 font-bold">{summary.categorySplit.length} Categories</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 pt-2">
            {summary.categorySplit.map(cat => {
              const catPct = cat.total > 0 ? Math.round((cat.done / cat.total) * 100) : 0;

              return (
                <motion.div
                  key={cat.category}
                  whileHover={{ scale: 1.05 }}
                  className="flex flex-col items-center justify-center space-y-2 group/ring cursor-pointer"
                >
                  {/* Circular Ring Container with Centered Content */}
                  <div className="relative flex items-center justify-center w-36 h-36 rounded-full bg-[#08080B] group-hover/ring:bg-white transition-all duration-300 shadow-lg">
                    <svg className="w-32 h-32 transform -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r={52}
                        stroke="currentColor"
                        strokeWidth="5"
                        className="text-zinc-800/80 group-hover/ring:text-zinc-200 transition-colors"
                        fill="transparent"
                      />
                      <motion.circle
                        cx="64"
                        cy="64"
                        r={52}
                        stroke="currentColor"
                        strokeWidth="5"
                        className="text-white group-hover/ring:text-black transition-colors"
                        fill="transparent"
                        strokeDasharray={2 * Math.PI * 52}
                        initial={{ strokeDashoffset: 2 * Math.PI * 52 }}
                        animate={{ strokeDashoffset: 2 * Math.PI * 52 - (catPct / 100) * 2 * Math.PI * 52 }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        strokeLinecap="round"
                      />
                    </svg>

                    {/* Content Centered Inside Circle */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-3">
                      <span className="font-heading font-black text-xl text-white group-hover/ring:text-black transition-colors leading-none">
                        {catPct}%
                      </span>
                      <span className="font-heading font-extrabold text-xs text-white group-hover/ring:text-black transition-colors truncate max-w-[85px] mt-1">
                        {cat.category}
                      </span>
                      <span className="font-sans text-[10px] text-zinc-400 group-hover/ring:text-zinc-600 transition-colors mt-0.5 font-medium">
                        {cat.done}/{cat.total} Done
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};


