import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, RefreshCw, ArrowRight, Brain, AlertCircle, Lightbulb, PlayCircle, Coffee, Notebook } from 'lucide-react';
import { AISuggestion } from '../types';

interface SuggestionsPanelProps {
  suggestions: AISuggestion[];
  onRefreshSuggestions: () => void;
  onExecuteAction: (suggestion: AISuggestion) => void;
  onOpenStudyPlan?: () => void;
  onOpenDiary?: () => void;
  isLoading?: boolean;
}

export const SuggestionsPanel: React.FC<SuggestionsPanelProps> = ({
  suggestions,
  onRefreshSuggestions,
  onExecuteAction,
  onOpenStudyPlan,
  onOpenDiary,
  isLoading = false,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const activeSug = suggestions && suggestions.length > 0 ? suggestions[selectedIndex] : null;

  if (!activeSug) return null;

  const isWarning = activeSug.type === 'warning';
  const isVideo = activeSug.actionType === 'add_video';
  const isBreak = activeSug.actionType === 'INSERT_BREAK';

  return (
    <div className="w-full py-3 space-y-3 select-none relative">
      {/* Compact Header Bar (0 Cards, 0 Borders) */}
      <div className="flex items-center justify-between gap-4 pb-2 border-b border-white/[0.05]">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-white/5 text-white flex items-center justify-center shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="flex items-center gap-2">
            <h3 className="font-heading font-black text-xs text-white tracking-wider uppercase">
              AI Optimization Matrix
            </h3>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-3">
          {onOpenStudyPlan && (
            <div className="relative flex items-center justify-end">
              <button
                onClick={onOpenStudyPlan}
                className="flex items-center gap-2 text-xs font-mono font-medium text-zinc-400 hover:text-black bg-transparent hover:bg-white p-2 hover:px-3.5 rounded-xl transition-all duration-300 cursor-pointer border-0 group overflow-hidden"
                title="Study Plan"
              >
                <Brain className="w-4 h-4 text-zinc-400 group-hover:text-black transition-colors shrink-0" />
                <span className="max-w-0 group-hover:max-w-[100px] opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap overflow-hidden">
                  Study Plan
                </span>
              </button>
            </div>
          )}

          {onOpenDiary && (
            <div className="relative flex items-center justify-end">
              <button
                onClick={onOpenDiary}
                className="flex items-center gap-2 text-xs font-mono font-medium text-zinc-400 hover:text-black bg-transparent hover:bg-white p-2 hover:px-3.5 rounded-xl transition-all duration-300 cursor-pointer border-0 group overflow-hidden"
                title="Diary"
              >
                <Notebook className="w-4 h-4 text-zinc-400 group-hover:text-black transition-colors shrink-0" />
                <span className="max-w-0 group-hover:max-w-[100px] opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap overflow-hidden">
                  Diary
                </span>
              </button>
            </div>
          )}

          <button
            onClick={onRefreshSuggestions}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-xs font-mono text-zinc-500 hover:text-white transition disabled:opacity-30 cursor-pointer group shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Compact 2-Column Matrix Area (STRICTLY NO BOX CARDS, NO BORDERS) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Hero Focus Column (Cols 1-7) */}
        <div className="lg:col-span-7 space-y-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSug.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="space-y-2"
            >
              <div className="flex items-center gap-2">
                <span className={`p-1 rounded-lg shrink-0 ${
                  isBreak ? 'bg-emerald-400/10 text-emerald-400' : isWarning ? 'bg-amber-400/10 text-amber-400' : isVideo ? 'bg-purple-400/10 text-purple-400' : 'bg-blue-400/10 text-blue-400'
                }`}>
                  {isBreak ? <Coffee className="w-3.5 h-3.5" /> : isWarning ? <AlertCircle className="w-3.5 h-3.5" /> : isVideo ? <PlayCircle className="w-3.5 h-3.5" /> : <Lightbulb className="w-3.5 h-3.5" />}
                </span>
                <span className={`text-[10px] font-mono font-bold tracking-wider uppercase ${
                  isBreak ? 'text-emerald-400' : isWarning ? 'text-amber-400' : isVideo ? 'text-purple-400' : 'text-blue-400'
                }`}>
                  {isBreak ? 'Smart Rest Break' : isWarning ? 'Warning Alert' : isVideo ? 'Resource' : 'Optimization Tip'}
                </span>
              </div>

              <h4 className="font-heading font-black text-sm sm:text-lg text-white tracking-tight leading-snug">
                {activeSug.title}
              </h4>

              <p className="text-xs font-sans text-zinc-400 tracking-wide leading-relaxed max-w-xl">
                {activeSug.description}
              </p>

              {activeSug.actionLabel && (
                <div className="pt-1.5">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onExecuteAction(activeSug)}
                    className="flex items-center gap-1.5 text-xs font-body font-bold text-black bg-white hover:bg-zinc-200 px-4 py-1.5 rounded-full transition-all duration-200 shadow-md cursor-pointer"
                  >
                    <span>{activeSug.actionLabel}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-black" />
                  </motion.button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Right Side Pure Text Stream with Selected White Border */}
        <div className="lg:col-span-5 space-y-2 lg:pl-6">
          <span className="text-[10px] text-white uppercase tracking-wider font-semibold block mb-1">
            Select Optimization ({suggestions.length})
          </span>

          <div className="space-y-1">
            {suggestions.map((sug, idx) => {
              const isActive = idx === selectedIndex;

              return (
                <button
                  key={sug.id}
                  onClick={() => setSelectedIndex(idx)}
                  className={`group flex items-center justify-between w-full py-1.5 px-3 rounded-lg text-left transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'text-white font-bold border border-white/60 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <span className={`text-[11px] transition-colors ${
                      isActive ? 'text-white font-black' : 'text-zinc-600 group-hover:text-zinc-400'
                    }`}>
                      0{idx + 1}.
                    </span>
                    <span className="text-xs font-heading truncate leading-tight">
                      {sug.title}
                    </span>
                  </div>

                  <span className={`text-[10px] font-body uppercase tracking-wider transition-colors shrink-0 ${
                    isActive ? 'text-white font-bold' : 'text-zinc-600 group-hover:text-zinc-400'
                  }`}>
                    {sug.type}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};





