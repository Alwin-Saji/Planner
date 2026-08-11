import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  RefreshCw,
  CheckSquare,
  Square,
  Youtube,
  ExternalLink,
  Sparkles,
  Pin,
  PinOff,
  Trophy,
  Medal,
  Star,
} from 'lucide-react';
import { RecommendedChannel } from './types';

interface StudyPlanChannelSelectorProps {
  topic: string;
  visibleChannels: RecommendedChannel[];
  allRecommendedChannels: RecommendedChannel[];
  toggleChannelSelect: (url: string) => void;
  togglePin: (url: string) => void;
  onSuggestOtherChannels: () => void;
  onAddCustomChannel: (inputValue: string) => void;
  onBackToParameters: () => void;
  onGenerateOutline: () => void;
  isGenerating: boolean;
  /** True when there is at least one more batch of fresh channels to show */
  hasMoreChannels: boolean;
}

/** Minimalist rank badge — icon-only for top 3, text for others */
const RankBadge: React.FC<{ rank: number }> = ({ rank }) => {
  if (rank === 1)
    return (
      <span className="flex items-center text-[9px] font-mono font-bold text-text-muted" title="Top recommended">
        <Trophy className="w-3 h-3" />
      </span>
    );
  if (rank === 2)
    return (
      <span className="flex items-center text-[9px] font-mono font-bold text-text-muted" title="2nd recommended">
        <Medal className="w-3 h-3" />
      </span>
    );
  if (rank === 3)
    return (
      <span className="flex items-center text-[9px] font-mono font-bold text-text-muted" title="3rd recommended">
        <Star className="w-3 h-3" />
      </span>
    );
  if (rank > 0)
    return (
      <span className="text-[9px] font-mono text-text-muted">
        #{rank}
      </span>
    );
  return null;
};

export const StudyPlanChannelSelector: React.FC<StudyPlanChannelSelectorProps> = ({
  topic,
  visibleChannels,
  allRecommendedChannels,
  toggleChannelSelect,
  togglePin,
  onSuggestOtherChannels,
  onAddCustomChannel,
  onBackToParameters,
  onGenerateOutline,
  isGenerating,
  hasMoreChannels,
}) => {

  const [customInput, setCustomInput] = useState('');

  const pinnedChannels = visibleChannels.filter(c => c.pinned);
  const unpinnedVisible = visibleChannels.filter(c => !c.pinned);
  const totalPinned = allRecommendedChannels.filter(c => c.pinned).length;
  const totalUnpinned = allRecommendedChannels.filter(c => !c.pinned).length;
  const selectedCount = allRecommendedChannels.filter(c => c.selected).length;

  const handleSubmitCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim()) return;
    onAddCustomChannel(customInput);
    setCustomInput('');
  };

  const ChannelCard: React.FC<{ ch: RecommendedChannel; isPinned?: boolean }> = ({ ch, isPinned }) => {
    const [isHovered, setIsHovered] = useState(false);
    
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ 
          type: 'spring', 
          stiffness: 500, 
          damping: 35,
          mass: 0.6,
        }}
        style={{ willChange: 'transform, opacity' }}
        key={ch.url}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="group py-4 transition-all space-y-2 relative border-b border-white/5 bg-transparent"
      >
        {/* Checkbox indicator - top right corner */}
        <div 
          className={`absolute top-4 right-2 transition-opacity ${
            ch.selected || isHovered ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {ch.selected ? (
            <CheckSquare className="w-4 h-4 text-white" aria-hidden="true" />
          ) : (
            <Square className="w-4 h-4 text-text-muted" aria-hidden="true" />
          )}
        </div>

        {/* Main content - clickable for selection */}
        <div
          className="cursor-pointer"
          onClick={() => toggleChannelSelect(ch.url)}
          role="button"
          tabIndex={0}
          aria-pressed={ch.selected}
          aria-label={`${ch.selected ? 'Deselect' : 'Select'} channel ${ch.name}`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleChannelSelect(ch.url);
            }
          }}
        >
          <div className="flex items-start gap-3.5 pr-8">
            <Youtube className="w-4.5 h-4.5 text-red-500 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1 min-w-0 space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className={`font-heading font-bold text-sm transition-colors duration-300 ${ch.selected ? 'text-white' : 'text-zinc-450'}`}>
                  {ch.name}
                </h4>
                {ch.rank != null && ch.rank > 0 && <RankBadge rank={ch.rank} />}
              </div>
              <p className="font-mono text-2xs text-zinc-550">{ch.handle}</p>
              <p className={`text-xs font-mono transition-colors duration-300 leading-relaxed ${ch.selected ? 'text-zinc-300' : 'text-zinc-500'}`}>
                {ch.description}
              </p>
            </div>
          </div>
        </div>

        {/* Metadata + Actions - Shows on hover or always on mobile */}
        <div 
          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-opacity ${
            isHovered ? 'opacity-100' : 'opacity-100 sm:opacity-0'
          }`}
        >
          {/* Left: Metadata badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {ch.playlistLength && (
              <span className="font-mono text-2xs text-zinc-500 bg-white/5 px-2 py-0.5 rounded-sm">
                {ch.playlistLength}
              </span>
            )}
            {ch.source === 'custom' && (
              <span className="text-[9px] font-mono bg-white/5 text-zinc-500 px-2 py-0.5 rounded-sm">
                CUSTOM
              </span>
            )}
            {ch.source === 'reddit' && (
              <span className="text-[9px] font-mono bg-white/5 text-zinc-500 px-2 py-0.5 rounded-sm">
                REDDIT
              </span>
            )}
          </div>

          {/* Right: Action buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Pin button */}
            <button
              onClick={(e) => { e.stopPropagation(); togglePin(ch.url); }}
              aria-label={ch.pinned ? `Unpin ${ch.name} channel` : `Pin ${ch.name} channel (survives rotation)`}
              className={`p-1.5 rounded-md transition-all min-h-[36px] min-w-[36px] flex items-center justify-center ${
                ch.pinned
                  ? 'text-amber-450 hover:bg-white/5'
                  : 'text-zinc-500 hover:text-amber-450 hover:bg-white/5'
              }`}
            >
              {ch.pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
            </button>

            {/* Preview link - icon only on desktop */}
            <a
              href={ch.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              aria-label={`Preview ${ch.name} channel (opens in new tab)`}
              className="p-1.5 text-zinc-500 hover:text-white hover:bg-white/5 rounded-md transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4 overflow-y-auto max-h-full pr-1">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between py-4 gap-4 border-b border-white/10">
        <div className="flex items-center gap-3.5 min-w-0">
          <button
            onClick={onBackToParameters}
            aria-label="Back to parameters"
            className="p-2 text-zinc-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors shrink-0 min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h3 className="font-heading font-bold text-base text-white truncate">
              Channels for "{topic}"
            </h3>
            <p className="font-mono text-2xs text-zinc-500">
              {selectedCount} selected · {totalPinned} pinned · {totalUnpinned} in rotation
            </p>
          </div>
        </div>

        <button
          onClick={onSuggestOtherChannels}
          disabled={!hasMoreChannels}
          aria-label={!hasMoreChannels ? 'All channel batches shown — no more new ones' : 'Show next batch of completely different channels'}
          className="flex items-center justify-center gap-2 text-xs font-mono bg-transparent text-zinc-400 hover:text-white transition-all px-4 py-2 border-b border-transparent hover:border-white disabled:opacity-40 disabled:cursor-not-allowed tactile min-h-[40px] w-full sm:w-auto font-bold"
        >
          <RefreshCw className="w-4 h-4" />
          <span className="hidden sm:inline">Suggest Other Channels</span>
          <span className="sm:hidden">More Channels</span>
        </button>
      </div>

      {/* Pinned channels section */}
      {pinnedChannels.length > 0 && (
        <div className="space-y-3">
          <div className="pt-2">
            <p className="font-mono text-[10px] uppercase tracking-widest text-amber-500/80 pl-1 flex items-center gap-1.5 font-bold">
              <Pin className="w-3 h-3 text-amber-500" /> Pinned
            </p>
          </div>
          <AnimatePresence mode="popLayout" initial={false}>
            <div className="flex flex-col space-y-1">
              {pinnedChannels.map(ch => <ChannelCard key={ch.url} ch={ch} isPinned />)}
            </div>
          </AnimatePresence>
        </div>
      )}

      {/* Suggested / rotation channels section */}
      {unpinnedVisible.length > 0 && (
        <div className="space-y-3">
          {pinnedChannels.length > 0 && (
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 pl-1 font-bold">
              Suggestions
            </p>
          )}
          <AnimatePresence mode="popLayout" initial={false}>
            <div className="flex flex-col space-y-1">
              {unpinnedVisible.map(ch => <ChannelCard key={ch.url} ch={ch} />)}
            </div>
          </AnimatePresence>
        </div>
      )}

      {/* Add Custom Channel - Simplified */}
      <div className="pt-8">
        <form onSubmit={handleSubmitCustom} className="space-y-4">
          <label 
            htmlFor="custom-channel-input"
            className="block text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500"
          >
            Add Custom Channel
          </label>
          <div className="flex flex-col sm:flex-row items-stretch gap-4">
            <input
              id="custom-channel-input"
              type="text"
              placeholder="@Channel or https://youtube.com/playlist?list=..."
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              className="flex-1 bg-transparent border-b border-white/10 hover:border-white/20 focus:border-white py-2 text-xs text-white placeholder-zinc-700 focus:outline-none transition-colors rounded-none min-h-[40px]"
            />
            <button
              type="submit"
              disabled={!customInput.trim()}
              className="bg-white text-black hover:bg-zinc-900 hover:text-white transition-all font-mono text-xs px-5 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed font-bold shrink-0 tactile min-h-[40px]"
            >
              Add & Pin
            </button>
          </div>
          <p className="text-2xs font-mono text-zinc-650">
            Custom channels are automatically pinned and appear first.
          </p>
        </form>
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between pt-8">
        <button
          onClick={onBackToParameters}
          className="px-4 py-2 text-zinc-500 hover:text-white font-mono text-xs transition-colors"
        >
          ← Edit Parameters
        </button>

        <button
          onClick={onGenerateOutline}
          disabled={isGenerating || selectedCount === 0}
          className="bg-white text-black hover:bg-zinc-900 hover:text-white transition-all px-6 py-3 rounded-lg font-heading font-bold text-xs flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed tactile"
        >
          {isGenerating ? (
            <>
              <Sparkles className="w-5 h-5 animate-spin" />
              <span>Building Tailored Plan...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              <span>Generate Study Plan with {selectedCount} Channel{selectedCount !== 1 ? 's' : ''} →</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
