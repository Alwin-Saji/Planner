import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Copy, Check, AlertTriangle, TrendingDown, Clock, Coffee } from 'lucide-react';
import { WeeklyReviewData } from '../types';
import { fetchWeeklyReview } from '../api';

interface WeeklyReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WeeklyReviewModal: React.FC<WeeklyReviewModalProps> = ({ isOpen, onClose }) => {

  const [data, setData] = useState<WeeklyReviewData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'diagnostics' | 'export'>('diagnostics');

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      fetchWeeklyReview()
        .then(setData)
        .catch(console.error)
        .finally(() => setIsLoading(false));
    }
  }, [isOpen]);

  const handleCopyMarkdown = () => {
    if (data?.markdownSummary) {
      navigator.clipboard.writeText(data.markdownSummary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // SVG Radial progress calculations (large, sleek gauge)
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const adherence = data?.metrics.adherencePct || 0;
  const strokeDashoffset = circumference - (adherence / 100) * circumference;

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
            className="bg-[#050505] w-full max-w-4xl h-[580px] rounded-3xl p-8 shadow-2xl flex flex-col justify-between space-y-6 overflow-hidden relative font-sans"
          >
            {/* Header - No Border */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <h2 className="font-bold text-lg text-white tracking-wider uppercase">Weekly Analytics Report</h2>
              </div>
              <button onClick={onClose} className="p-1 text-zinc-500 hover:text-white transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Main Split Layout */}
            {isLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center space-y-3">
                <div className="w-8 h-8 border-2 border-white/10 border-t-white rounded-full animate-spin" />
                <p className="text-xs text-zinc-500 tracking-wider uppercase">Syncing local logs...</p>
              </div>
            ) : (
              <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-8 items-stretch overflow-hidden">
                
                {/* Left Column: Core Overview (Width: 5 Cols) */}
                <div className="md:col-span-5 flex flex-col justify-between bg-[#0B0B0C] p-6 rounded-2xl">
                  
                  {/* Gauge & Main Rating */}
                  <div className="flex flex-col items-center space-y-4">
                    <div className="relative w-32 h-32 flex items-center justify-center">
                      <svg className="w-full h-full -rotate-90">
                        <circle
                          cx="64"
                          cy="64"
                          r={radius}
                          className="stroke-zinc-900 fill-none"
                          strokeWidth="4"
                        />
                        <circle
                          cx="64"
                          cy="64"
                          r={radius}
                          className="stroke-white fill-none transition-all duration-700 ease-out"
                          strokeWidth="4"
                          strokeDasharray={circumference}
                          strokeDashoffset={strokeDashoffset}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute text-center">
                        <span className="text-3xl font-extrabold text-white">{adherence}%</span>
                        <span className="text-[9px] text-zinc-500 uppercase tracking-widest block mt-0.5">Adherence</span>
                      </div>
                    </div>

                    <div className="text-center space-y-1">
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">Routine Integrity</h3>
                      <p className="text-zinc-400 text-[11px] leading-relaxed max-w-[200px] mx-auto">
                        Percentage of planned slots completed over the past 7 days.
                      </p>
                    </div>
                  </div>

                  {/* Core Metrics Cards (Done & Skipped) */}
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="bg-[#111112] p-3.5 rounded-xl text-center">
                      <div className="text-xl font-bold text-white">{data?.metrics.completedCount}</div>
                      <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold mt-1">Completed</div>
                    </div>
                    <div className="bg-[#111112] p-3.5 rounded-xl text-center">
                      <div className="text-xl font-bold text-zinc-400">{data?.metrics.skippedCount}</div>
                      <div className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold mt-1">Skipped</div>
                    </div>
                  </div>

                  {/* Tab Selector Links */}
                  <div className="flex gap-4 mt-6 justify-center">
                    {(['diagnostics', 'export'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`py-1 text-xs font-bold uppercase tracking-wider transition relative ${
                          activeTab === tab ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        {tab === 'diagnostics' ? 'Diagnostics' : 'Markdown Summary'}
                        {activeTab === tab && (
                          <motion.div
                            layoutId="activeUnderline"
                            className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"
                          />
                        )}
                      </button>
                    ))}
                  </div>

                </div>

                {/* Right Column: Contextual Content (Width: 7 Cols) */}
                <div className="md:col-span-7 overflow-y-auto pr-1 flex flex-col">
                  <AnimatePresence mode="wait">
                    {activeTab === 'diagnostics' && (
                      <motion.div
                        key="diagnostics"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="space-y-5 flex-1"
                      >
                        {/* Time slot density */}
                        {data?.metrics.timeOfDayStats && (
                          <div className="bg-[#0B0B0C] rounded-2xl p-5 space-y-3">
                            <div className="flex items-center gap-2 text-zinc-400">
                              <Clock className="w-4 h-4 text-zinc-500" />
                              <span className="text-[10px] font-bold tracking-widest uppercase text-white">Time Slot Adherence</span>
                            </div>
                            <div className="space-y-3 font-sans text-xs">
                              {Object.entries(data.metrics.timeOfDayStats).map(([timeSlot, stat]) => {
                                const pct = stat.total > 0 ? Math.round((stat.completed / stat.total) * 100) : 0;
                                return (
                                  <div key={timeSlot} className="space-y-1.5">
                                    <div className="flex justify-between text-zinc-400">
                                      <span className="capitalize">{timeSlot}</span>
                                      <span>{stat.completed}/{stat.total} completed ({pct}%)</span>
                                    </div>
                                    <div className="h-1 w-full bg-zinc-900 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-white rounded-full transition-all duration-500"
                                        style={{ width: `${pct}%` }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Fatigue Diagnostics */}
                        <div className="bg-[#0B0B0C] rounded-2xl p-5 space-y-3">
                          <div className="flex items-center gap-2 text-zinc-400">
                            <Coffee className="w-4 h-4 text-zinc-500" />
                            <span className="text-[10px] font-bold tracking-widest uppercase text-white">Fatigue & Break spacing</span>
                          </div>
                          <p className="text-[11px] text-zinc-400 leading-relaxed">
                            {data?.metrics.backToBackWarningCount && data.metrics.backToBackWarningCount > 0 ? (
                              <>
                                We detected <strong className="text-white font-bold">{data.metrics.backToBackWarningCount}</strong> sessions scheduled back-to-back without rest buffers. Plan rest breaks to maintain peak retention.
                              </>
                            ) : (
                              "Your pacing looks healthy. No spacing issues detected."
                            )}
                          </p>
                        </div>

                        {/* Weak categories focus */}
                        {data?.metrics.weakCategories && data.metrics.weakCategories.length > 0 && (
                          <div className="bg-[#0B0B0C] rounded-2xl p-5 space-y-3">
                            <div className="flex items-center gap-2 text-zinc-400">
                              <TrendingDown className="w-4 h-4 text-zinc-500" />
                              <span className="text-[10px] font-bold tracking-widest uppercase text-white">Low Adherence Categories</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {data.metrics.weakCategories.map((c) => (
                                <div key={c.category} className="flex items-center justify-between bg-black/40 rounded-xl px-3 py-2 text-xs">
                                  <span className="text-zinc-300 font-semibold">{c.category}</span>
                                  <span className="text-white font-bold bg-white/10 px-2 py-0.5 rounded-lg text-[11px]">
                                    {c.pct}% completed
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}

                    {activeTab === 'export' && (
                      <motion.div
                        key="export"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="flex flex-col flex-1"
                      >
                        <div className="bg-[#0B0B0C] rounded-2xl p-5 flex-1 flex flex-col justify-between space-y-3">
                          <div className="space-y-1.5 flex-1 flex flex-col">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">
                              Markdown Format Log
                            </span>
                            <pre className="bg-[#040405] rounded-xl p-4 text-[11px] text-zinc-300 whitespace-pre-wrap flex-1 overflow-y-auto leading-relaxed max-h-[300px]">
                              {data?.markdownSummary}
                            </pre>
                          </div>
                          <div className="flex justify-end pt-2">
                            <button
                              onClick={handleCopyMarkdown}
                              className="flex items-center gap-2 text-zinc-400 hover:text-white text-xs font-bold uppercase tracking-wider transition cursor-pointer"
                            >
                              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              <span>{copied ? 'Copied' : 'Copy markdown'}</span>
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

              </div>
            )}

            {/* Footer - Clean spacing */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-[10px] text-zinc-600 uppercase tracking-widest">SQLite local analytics logs</span>
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
