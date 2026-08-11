import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Plus,
  Clock,
  Calendar,
  Trash2,
  Youtube,
  ExternalLink,
  BookOpen,
  Check,
  Play,
  Search,
  Github,
  Globe,
  MessageSquare,
  FileText,
  ChevronDown,
  ChevronUp,
  Link as LinkIcon,
} from 'lucide-react';
import { OutlineBlock, OutlineResource, SearchedResource, SearchMeta } from './types';

interface StudyPlanWorkspaceProps {
  topic: string;
  outlineBlocks: OutlineBlock[];
  outlineResources: OutlineResource[];
  updateOutlineBlock: (tempId: string, field: keyof OutlineBlock, value: any) => void;
  deleteOutlineBlock: (tempId: string) => void;
  addExtraOutlineBlock: () => void;
  addExtraOutlineResource: () => void;
  extractUrls: (text: string) => string[];
  genSuccessMsg: string | null;
  onBackToChannels: () => void;
  onConfirmGeneratedPlan: () => void;
  isConfirmingGen: boolean;
  searchedResources?: SearchedResource[];
  searchMeta?: SearchMeta | null;
}

// Helper to extract YouTube ID
const getYouTubeId = (url?: string) => {
  if (!url) return null;
  const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regExp);
  return match && match[1] ? match[1] : null;
};

// Source icon + brand color theme + inverse hover effect mapping (No default background color)
const sourceConfig: Record<string, { icon: React.ReactNode; label: string; normalStyle: string; hoverStyle: string }> = {
  youtube: {
    icon: <Youtube className="w-3.5 h-3.5" />,
    label: 'YouTube',
    normalStyle: 'bg-transparent text-red-400 border border-red-500/40',
    hoverStyle: 'hover:bg-red-500 hover:text-white hover:border-red-500',
  },
  github: {
    icon: <Github className="w-3.5 h-3.5" />,
    label: 'GitHub',
    normalStyle: 'bg-transparent text-zinc-300 border border-zinc-700',
    hoverStyle: 'hover:bg-white hover:text-black hover:border-white',
  },
  google: {
    icon: <Globe className="w-3.5 h-3.5" />,
    label: 'Docs',
    normalStyle: 'bg-transparent text-sky-400 border border-sky-500/40',
    hoverStyle: 'hover:bg-sky-500 hover:text-white hover:border-sky-500',
  },
  stackoverflow: {
    icon: <MessageSquare className="w-3.5 h-3.5" />,
    label: 'Stack Overflow',
    normalStyle: 'bg-transparent text-amber-400 border border-amber-500/40',
    hoverStyle: 'hover:bg-amber-500 hover:text-white hover:border-amber-500',
  },
  local: {
    icon: <FileText className="w-3.5 h-3.5" />,
    label: 'Notes',
    normalStyle: 'bg-transparent text-emerald-400 border border-emerald-500/40',
    hoverStyle: 'hover:bg-emerald-500 hover:text-white hover:border-emerald-500',
  },
};

export const StudyPlanWorkspace: React.FC<StudyPlanWorkspaceProps> = ({
  topic,
  outlineBlocks,
  outlineResources,
  updateOutlineBlock,
  deleteOutlineBlock,
  addExtraOutlineBlock,
  addExtraOutlineResource,
  extractUrls,
  genSuccessMsg,
  onBackToChannels,
  onConfirmGeneratedPlan,
  isConfirmingGen,
  searchedResources = [],
  searchMeta = null,
}) => {
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({});

  const toggleDropdown = (tempId: string) => {
    setOpenDropdowns((prev) => {
      const isCurrentlyOpen = prev[tempId];
      // Accordion style: collapse all other cards, toggle target card
      return isCurrentlyOpen ? {} : { [tempId]: true };
    });
  };

  const expandAll = () => {
    const allOpen: Record<string, boolean> = {};
    outlineBlocks.forEach((b) => (allOpen[b.tempId] = true));
    setOpenDropdowns(allOpen);
  };

  const collapseAll = () => {
    setOpenDropdowns({});
  };

  return (
    <div className="h-full flex flex-col space-y-3 font-['Inter',-apple-system,BlinkMacSystemFont,sans-serif] text-zinc-100 overflow-hidden">
      {/* 1. Streamlined Header Toolbar */}
      <div className="flex items-center justify-between py-1 shrink-0">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onBackToChannels}
            className="p-1.5 text-zinc-400 hover:text-white transition-colors cursor-pointer rounded-lg hover:bg-zinc-800/50"
            title="Back to Channels"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white tracking-tight">
              {topic}
            </h3>
            <span className="text-zinc-600 text-xs">•</span>
            <span className="text-[11px] font-medium text-zinc-400">
              {outlineBlocks.length} sessions
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {searchMeta && searchMeta.totalFound > 0 && (
            <button
              onClick={() => setShowSearchPanel(!showSearchPanel)}
              className="text-[11px] font-medium text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Search className="w-3 h-3 text-indigo-400" />
              <span>{searchMeta.totalFound} AI Web Resources</span>
            </button>
          )}

          <div className="flex items-center gap-2 text-[11px]">
            <button
              onClick={expandAll}
              className="font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              Expand all
            </button>
            <span className="text-zinc-700">|</span>
            <button
              onClick={collapseAll}
              className="font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              Collapse all
            </button>
            <button
              onClick={addExtraOutlineBlock}
              className="text-xs font-medium text-zinc-200 hover:text-white bg-zinc-800/80 hover:bg-zinc-700 px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ml-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Session</span>
            </button>
          </div>
        </div>
      </div>

      {showSearchPanel && (
        <div className="p-3 mb-2 space-y-2 bg-[#0d0d12] rounded-xl shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
            {searchedResources.slice(0, 12).map((sr) => {
              const config = sourceConfig[sr.source] || sourceConfig.google;
              return (
                <a
                  key={sr.id}
                  href={sr.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-2.5 p-2 bg-transparent text-zinc-300 rounded-lg transition-all duration-200 cursor-pointer truncate group/res ${config.hoverStyle}`}
                >
                  <span className="shrink-0 transition-transform group-hover/res:scale-110">{config.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{sr.title}</p>
                  </div>
                  <ExternalLink className="w-3 h-3 text-zinc-500 opacity-60 group-hover/res:opacity-100 group-hover/res:text-current transition-opacity shrink-0 ml-0.5" />
                </a>
              );
            })}
          </div>
        </div>
      )}
      {/* 3. ULTRA-MINIMALIST BORDERLESS DATE-GROUPED FLOW */}
      <div className="flex-1 overflow-y-auto space-y-5 pr-1">
        {Array.from(new Set(outlineBlocks.map((b) => b.date || 'Upcoming'))).map((dateGroup, gIdx) => {
          const groupBlocks = outlineBlocks.filter((b) => (b.date || 'Upcoming') === dateGroup);

          return (
            <div key={gIdx} className="space-y-2">
              {/* Borderless Minimalist Date Header */}
              <div className="flex items-center justify-between px-1 py-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-rose-400 tracking-wider">
                    {dateGroup}
                  </span>
                  <span className="text-zinc-600 text-xs">•</span>
                  <span className="text-[11px] font-medium text-zinc-400">
                    {groupBlocks.length} {groupBlocks.length === 1 ? 'session' : 'sessions'}
                  </span>
                </div>
              </div>

              {/* Session Cards (No borders, pure background contrast) */}
              <div className="space-y-1.5">
                {groupBlocks.map((b) => {
                  const blockIdx = outlineBlocks.findIndex((x) => x.tempId === b.tempId);
                  const ytId = getYouTubeId(b.custom_link);
                  const urls = extractUrls(b.notes || '');
                  const isOpen = !!openDropdowns[b.tempId];

                  return (
                    <div
                      key={b.tempId}
                      className={`rounded-xl transition-all duration-300 overflow-hidden group/card ${
                        isOpen
                          ? 'bg-[#f8f4ed] text-zinc-900 shadow-md border border-[#e3dacd]'
                          : 'bg-[#0d0d11] text-zinc-100 hover:bg-[#f8f4ed] hover:text-zinc-900 shadow-sm'
                      }`}
                    >
                      {/* Collapsed/Expanded Row Header */}
                      <div
                        onClick={() => toggleDropdown(b.tempId)}
                        className="w-full flex items-center justify-between px-4 py-3 cursor-pointer select-none gap-3"
                      >
                        {/* Left: Index + Stacked Title & Subtitle */}
                        <div className="flex items-center gap-3.5 flex-1 min-w-0">
                          <span className={`text-[13px] font-extrabold tracking-tight shrink-0 transition-colors ${
                            isOpen ? 'text-zinc-500' : 'text-zinc-500 group-hover/card:text-zinc-600'
                          }`}>
                            {String(blockIdx + 1).padStart(2, '0')}
                          </span>

                          <div className="flex flex-col flex-1 min-w-0">
                            <input
                              type="text"
                              value={b.title}
                              onClick={(e) => {
                                if (!isOpen) {
                                  // Let row click handler toggle the card when collapsed
                                  return;
                                }
                                e.stopPropagation();
                              }}
                              onChange={(e) => updateOutlineBlock(b.tempId, 'title', e.target.value)}
                              placeholder="Session Title..."
                              className={`w-full bg-transparent text-xs font-semibold focus:outline-none truncate transition-colors ${
                                isOpen
                                  ? 'text-zinc-900 placeholder-zinc-400 cursor-text'
                                  : 'text-white group-hover/card:text-zinc-900 placeholder-zinc-500 group-hover/card:placeholder-zinc-400 cursor-pointer pointer-events-none'
                              }`}
                            />
                            <span className={`text-[10px] font-medium tracking-wide uppercase transition-colors ${
                              isOpen ? 'text-indigo-700 font-bold' : 'text-indigo-400 group-hover/card:text-indigo-700'
                            }`}>
                              {b.category || 'STUDY'}
                            </span>
                          </div>
                        </div>

                        {/* Right: Time & Links & Arrow */}
                        <div className="flex items-center gap-3 shrink-0 text-xs">
                          <span className={`font-bold transition-colors ${
                            isOpen ? 'text-zinc-900' : 'text-zinc-300 group-hover/card:text-zinc-900'
                          }`}>
                            {b.start_time} - {b.end_time}
                          </span>

                          {(b.custom_link || urls.length > 0) && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 transition-colors ${
                              isOpen
                                ? 'bg-teal-200/60 text-teal-900'
                                : 'text-teal-300 bg-teal-500/15 group-hover/card:bg-teal-200/60 group-hover/card:text-teal-900'
                            }`}>
                              <LinkIcon className="w-3 h-3" />
                              <span>{(b.custom_link ? 1 : 0) + urls.length}</span>
                            </span>
                          )}

                          <div className={`transition-colors ${
                            isOpen ? 'text-zinc-900' : 'text-zinc-500 group-hover/card:text-zinc-900'
                          }`}>
                            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </div>
                        </div>
                      </div>

                      {/* Expanded Section */}
                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{
                              height: { duration: 0.35, ease: [0.25, 1, 0.5, 1] },
                              opacity: { duration: 0.25, ease: 'easeOut', delay: 0.05 },
                            }}
                            className="overflow-hidden"
                          >
                            <div className="px-5 pb-5 pt-3 space-y-4 bg-[#f8f4ed] border-t border-[#e3dacd] rounded-b-xl text-zinc-900">
                              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                                {/* Left Column (5 cols): Video Media Panel */}
                                <div className="lg:col-span-5 space-y-2 flex flex-col justify-between">
                                  <div className="flex items-center justify-between text-xs font-medium text-rose-500">
                                    <span className="flex items-center gap-1.5">
                                      <Youtube className="w-3.5 h-3.5" />
                                      <span>Video Resource</span>
                                    </span>
                                    {b.custom_link && (
                                      <a
                                        href={b.custom_link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[10px] text-zinc-600 hover:text-black flex items-center gap-1 transition-colors"
                                      >
                                        <span>Open link</span>
                                        <ExternalLink className="w-3 h-3" />
                                      </a>
                                    )}
                                  </div>

                                  {ytId ? (
                                    <a
                                      href={b.custom_link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="relative w-full aspect-video rounded-xl overflow-hidden block group/thumb bg-[#eee7dc] border border-[#dfd6c8]"
                                    >
                                      <img
                                        src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
                                        alt="Thumbnail"
                                        className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-300"
                                      />
                                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                        <div className="w-9 h-9 rounded-full bg-red-600/90 text-white flex items-center justify-center shadow-lg group-hover/thumb:scale-110 transition-transform">
                                          <Play className="w-4 h-4 fill-white ml-0.5" />
                                        </div>
                                      </div>
                                    </a>
                                  ) : (
                                    <div className="w-full aspect-video rounded-xl bg-[#eee7dc] border border-[#dfd6c8] flex flex-col items-center justify-center text-zinc-500 text-xs gap-1">
                                      <Youtube className="w-6 h-6 text-zinc-400" />
                                      <span>No video attached</span>
                                    </div>
                                  )}

                                  <input
                                    type="text"
                                    value={b.custom_link || ''}
                                    onChange={(e) => updateOutlineBlock(b.tempId, 'custom_link', e.target.value)}
                                    placeholder="Paste YouTube URL..."
                                    className="w-full bg-[#eee7dc] border border-[#dfd6c8] rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-zinc-400 placeholder-zinc-500 font-mono"
                                  />
                                </div>

                                {/* Right Column (7 cols): Time & Notes Editor */}
                                <div className="lg:col-span-7 space-y-3 flex flex-col justify-between">
                                  {/* Timing Controls */}
                                  <div className="flex items-center gap-3 bg-[#eee7dc] border border-[#dfd6c8] p-2.5 rounded-xl">
                                    <Clock className="w-4 h-4 text-indigo-700 shrink-0 ml-1" />
                                    <div className="flex items-center gap-2 flex-1 text-xs">
                                      <div className="flex flex-col">
                                        <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-medium">Start</span>
                                        <input
                                          type="time"
                                          value={b.start_time}
                                          onChange={(e) => updateOutlineBlock(b.tempId, 'start_time', e.target.value)}
                                          className="bg-transparent text-xs font-semibold text-zinc-900 focus:outline-none [color-scheme:light]"
                                        />
                                      </div>
                                      <span className="text-zinc-400 text-xs font-bold mt-3">•</span>
                                      <div className="flex flex-col">
                                        <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-medium">End</span>
                                        <input
                                          type="time"
                                          value={b.end_time}
                                          onChange={(e) => updateOutlineBlock(b.tempId, 'end_time', e.target.value)}
                                          className="bg-transparent text-xs font-semibold text-zinc-900 focus:outline-none [color-scheme:light]"
                                        />
                                      </div>
                                    </div>
                                  </div>

                                  {/* Notes Area */}
                                  <div className="flex-1 flex flex-col space-y-1">
                                    <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">Notes & Overview</label>
                                    <textarea
                                      rows={4}
                                      value={b.notes || ''}
                                      onChange={(e) => updateOutlineBlock(b.tempId, 'notes', e.target.value)}
                                      placeholder="Type session notes, key concepts, or links..."
                                      className="w-full flex-1 bg-[#eee7dc] border border-[#dfd6c8] rounded-xl p-3 text-xs text-zinc-900 focus:outline-none focus:border-zinc-400 leading-relaxed resize-none placeholder-zinc-500"
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* Extracted Sources Bar & Delete Session (Inline Header Layout) */}
                              <div className="pt-2 space-y-2 border-t border-zinc-200 transition-colors">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                                      Attached Sources ({urls.length + (b.custom_link ? 1 : 0)})
                                    </span>
                                  </div>

                                  <button
                                    onClick={() => deleteOutlineBlock(b.tempId)}
                                    className="text-xs text-rose-400 hover:text-rose-300 font-medium px-2.5 py-1 rounded-lg hover:bg-rose-500/10 transition-colors flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Delete Session</span>
                                  </button>
                                </div>

                                {(() => {
                                  const allUrls = [
                                    ...(b.custom_link ? [b.custom_link] : []),
                                    ...urls,
                                  ];
                                  const uniqueUrls = Array.from(new Set(allUrls));

                                  if (uniqueUrls.length === 0) return null;

                                  return (
                                    <div className="flex flex-wrap gap-2 pt-0.5">
                                      {uniqueUrls.map((url, uIdx) => {
                                        let detectedSource = 'google';
                                        if (url.includes('youtube.com') || url.includes('youtu.be')) detectedSource = 'youtube';
                                        else if (url.includes('github.com')) detectedSource = 'github';
                                        else if (url.includes('stackoverflow.com')) detectedSource = 'stackoverflow';

                                        const config = sourceConfig[detectedSource] || sourceConfig.google;
                                        const matchedResource = searchedResources.find((sr) => sr.url === url);
                                        const labelText = matchedResource ? matchedResource.title : url.replace(/^https?:\/\/(www\.)?/, '');

                                        return (
                                          <a
                                            key={uIdx}
                                            href={url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            title={labelText}
                                            className={`group/expand flex items-center p-2 rounded-full text-xs font-semibold cursor-pointer transition-all duration-300 ease-out shadow-sm max-w-[36px] hover:max-w-[280px] overflow-hidden whitespace-nowrap ${config.normalStyle} ${config.hoverStyle}`}
                                          >
                                            {/* Centered Brand Icon */}
                                            <div className="w-5 h-5 flex items-center justify-center shrink-0">
                                              {config.icon}
                                            </div>

                                            {/* Smooth Collapsible Title & External Arrow */}
                                            <div className="flex items-center gap-2 opacity-0 group-hover/expand:opacity-100 transition-opacity duration-200 delay-75 pl-2">
                                              <span className="truncate max-w-[180px] leading-none">
                                                {labelText}
                                              </span>
                                              <ExternalLink className="w-3 h-3 opacity-80 shrink-0" />
                                            </div>
                                          </a>
                                        );
                                      })}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {genSuccessMsg && (
        <div className="p-2.5 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs font-medium flex items-center gap-2 shrink-0">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{genSuccessMsg}</span>
        </div>
      )}

      {/* 4. Footer Actions Bar */}
      <div className="flex items-center justify-between pt-2 shrink-0 border-t border-zinc-800/40">
        <button
          type="button"
          onClick={onBackToChannels}
          className="text-zinc-400 hover:text-white transition-colors text-xs font-medium cursor-pointer"
        >
          ← Back to Channels
        </button>

        <button
          type="button"
          onClick={onConfirmGeneratedPlan}
          disabled={isConfirmingGen || (outlineBlocks.length === 0 && outlineResources.length === 0)}
          className="bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-all px-5 py-2.5 rounded-xl flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-sm"
        >
          {isConfirmingGen ? (
            <span>Saving schedule...</span>
          ) : (
            <>
              <Check className="w-4 h-4" />
              <span>Confirm & Save Schedule ({outlineBlocks.length})</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
