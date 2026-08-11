import React, { useState } from 'react';
import { Upload, FileCode2, Youtube, Link as LinkIcon, Plus, Check, Copy, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { OutlineBlock, OutlineResource } from './types';

const getYoutubeVideoId = (url: string): string | null => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

interface StudyPlanMarkdownImporterProps {
  mdContent: string;
  setMdContent: (val: string) => void;
  mdCategory: string;
  setMdCategory: (val: string) => void;
  startDate: string;
  setStartDate: (val: string) => void;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleParseMarkdown: () => void;
  isParsing: boolean;
  parsedBlocks: Array<OutlineBlock & { selected: boolean }>;
  setParsedBlocks: React.Dispatch<React.SetStateAction<Array<OutlineBlock & { selected: boolean }>>>;
  parsedResources: Array<OutlineResource & { selected: boolean }>;
  setParsedResources: React.Dispatch<React.SetStateAction<Array<OutlineResource & { selected: boolean }>>>;
  handleImportSelected: () => void;
  isImporting: boolean;
  importSuccessMsg: string | null;
}

const getCategoryStyle = (cat: string) => {
  const c = (cat || '').toLowerCase();
  if (c.includes('work') || c.includes('code') || c.includes('dev') || c.includes('dsa')) {
    return {
      stripeColor: 'bg-[#FF5722]',
      dotBg: 'bg-[#FF5722]',
      tagColor: 'text-[#FF5722] border-[#FF5722]/25 bg-[#FF5722]/5',
      titleColor: 'text-white'
    };
  }
  if (c.includes('study') || c.includes('read') || c.includes('learn') || c.includes('review') || c.includes('import')) {
    return {
      stripeColor: 'bg-[#FFC107]',
      dotBg: 'bg-[#FFC107]',
      tagColor: 'text-[#FFC107] border-[#FFC107]/25 bg-[#FFC107]/5',
      titleColor: 'text-white'
    };
  }
  if (c.includes('health') || c.includes('gym') || c.includes('sport') || c.includes('run') || c.includes('exercise')) {
    return {
      stripeColor: 'bg-[#E91E63]',
      dotBg: 'bg-[#E91E63]',
      tagColor: 'text-[#E91E63] border-[#E91E63]/25 bg-[#E91E63]/5',
      titleColor: 'text-white'
    };
  }
  return {
    stripeColor: 'bg-[#8BC34A]',
    dotBg: 'bg-[#8BC34A]',
    tagColor: 'text-[#8BC34A] border-[#8BC34A]/25 bg-[#8BC34A]/5',
    titleColor: 'text-white'
  };
};

export const StudyPlanMarkdownImporter: React.FC<StudyPlanMarkdownImporterProps> = ({
  mdContent,
  setMdContent,
  mdCategory,
  setMdCategory,
  startDate,
  setStartDate,
  handleFileUpload,
  handleParseMarkdown,
  isParsing,
  parsedBlocks,
  setParsedBlocks,
  parsedResources,
  setParsedResources,
  handleImportSelected,
  isImporting,
  importSuccessMsg,
}) => {
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null);

  const handleCopyPrompt = () => {
    const PROMPT_TEMPLATE = `Generate a structured study plan for: [Insert Topic Here].
For EVERY single block, you MUST provide BOTH a relevant YouTube video playlist or crash course, AND other supplementary resources (like official documentation, GitHub repositories, or guides).

Please output the response strictly in Markdown format adhering exactly to the following template:

# Topic: React Learning Path

## 2026-08-07
- 09:00 - 10:30: Introduction to React Components and Props
- Reference: https://youtube.com/playlist?list=PL4Gr5tOAP1crV428l9f5c2X0x_R0K7U18
- Reference: https://react.dev/learn/your-first-component

## 2026-08-08
- 10:00 - 12:00: Managing State with hooks (useState and useEffect)
- Reference: https://www.youtube.com/watch?v=Ke90Tje7VS0
- Reference: https://react.dev/reference/react

Important Rules:
1. Dates must be in YYYY-MM-DD format.
2. Time blocks must match: - HH:MM - HH:MM: Task Description
3. You MUST include multiple specific references (including YouTube playlist/video AND documentation/articles) for each study block. Format them as raw text links on separate lines:
   - Reference: URL1
   - Reference: URL2
4. You MUST cross-check and ensure all links are genuine, currently existing, active, and correct. Do not hallucinate or guess any URLs.`;

    navigator.clipboard.writeText(PROMPT_TEMPLATE);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 py-2 overflow-y-auto max-h-full pr-1 font-sans">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-8 items-start">
        {/* Left Side: Upload & Input */}
        <div className="space-y-6">
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-[10px] font-heading font-bold uppercase tracking-wider text-zinc-500">
                  Upload Custom GPT Markdown (.md) File
                </label>
                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  className="text-[10px] text-zinc-400 hover:text-white font-heading font-bold uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer"
                >
                  {copiedPrompt ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span>Copied Prompt!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy ChatGPT Prompt</span>
                    </>
                  )}
                </button>
              </div>
              <label className="border border-dashed border-white/10 hover:border-white/20 bg-white/[0.01] hover:bg-white/[0.02] p-8 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all duration-300 text-center group">
                <Upload className="w-5 h-5 text-zinc-400 mb-2 group-hover:text-white transition-colors" />
                <span className="text-xs text-zinc-350 font-bold tracking-wide font-heading">
                  Click to select a .md file or drag &amp; drop
                </span>
                <span className="text-[9px] text-zinc-500 font-heading tracking-wide uppercase mt-1">Exported from ChatGPT / Custom GPT</span>
                <input
                  type="file"
                  accept=".md,.txt,.markdown"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-heading font-bold uppercase tracking-wider text-zinc-500 mb-2">
                Or Paste Markdown Content Directly
              </label>
              <textarea
                rows={6}
                placeholder={`Paste your markdown study schedule plan here...\nFormat:\n# React Path\n## 2026-08-07\n- 09:00 - 10:30: Components\n- Reference: [React Docs](https://react.dev)`}
                value={mdContent}
                onChange={(e) => setMdContent(e.target.value)}
                className="w-full bg-white/[0.02] border border-white/5 focus:border-white/10 p-4 text-xs text-white placeholder-zinc-700 focus:outline-none transition-all duration-300 resize-none rounded-2xl font-sans"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-heading font-bold uppercase tracking-wider text-zinc-500">
                Default Category
              </label>
              <input
                type="text"
                value={mdCategory}
                onChange={(e) => setMdCategory(e.target.value)}
                className="w-full bg-white/[0.02] border border-white/5 focus:border-white/10 py-2.5 px-3.5 text-xs text-white focus:outline-none transition-colors rounded-xl font-sans"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-heading font-bold uppercase tracking-wider text-zinc-500">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-white/[0.02] border border-white/5 focus:border-white/10 py-2.5 px-3.5 text-xs text-white focus:outline-none transition-colors rounded-xl font-sans [color-scheme:dark]"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleParseMarkdown}
            disabled={isParsing || !mdContent.trim()}
            className="w-full bg-white text-black hover:bg-[#eaeaea] transition-all py-3 rounded-xl font-heading font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-sm"
          >
            {isParsing ? (
              <span>Scanning and Extracting Data...</span>
            ) : (
              <>
                <FileCode2 className="w-4 h-4" />
                <span>Scan and Extract Schedule</span>
              </>
            )}
          </button>
        </div>

        {/* Right Side: Preview & Import */}
        <div className="space-y-6">
          {(parsedBlocks.length > 0 || parsedResources.length > 0) ? (
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-2 border-b border-white/5">
                <span className="font-body font-bold text-xs text-zinc-200">
                  Extracted Items Preview &amp; Edit
                </span>
                <span className="text-[10px] text-zinc-500 font-body font-bold tracking-wider uppercase">
                  {parsedBlocks.filter((b) => b.selected).length} Blocks, {parsedResources.filter((r) => r.selected).length} Resources
                </span>
              </div>

              {/* Blocks List */}
              {parsedBlocks.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] uppercase text-zinc-500 block font-body font-bold tracking-wider">
                    Extracted Time Blocks ({parsedBlocks.length})
                  </span>

                  <div className="relative space-y-2 max-h-[440px] overflow-y-auto pr-1 pt-2">
                    {parsedBlocks.map((b, idx) => {
                      const displayTitle = b.title.replace(/^:\s*/, '');
                      const isExpanded = expandedBlockId === b.tempId;
                      const allLinks = ((b.links && b.links.length > 0) ? b.links : (b.custom_link ? [b.custom_link] : [])).filter(Boolean);
                      const ytLinks = allLinks.filter(link => link.includes('youtube.com') || link.includes('youtu.be'));
                      const otherLinks = allLinks.filter(link => !link.includes('youtube.com') && !link.includes('youtu.be'));
                      return (
                        <div
                          key={b.tempId}
                          onClick={() =>
                            setParsedBlocks((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, selected: !item.selected } : item))
                            )
                          }
                          className={`group flex flex-col gap-2 p-3 rounded-xl border transition-all duration-300 cursor-pointer select-none font-body
                            ${b.selected
                              ? 'bg-white/5 border-white/10 text-white opacity-100 shadow-sm'
                              : 'bg-transparent border-white/5 text-zinc-500 opacity-40 hover:opacity-75'
                            }
                            hover:bg-white hover:text-black hover:border-white hover:opacity-100
                          `}
                        >
                          <div className="flex items-center justify-between gap-4 w-full">
                            <div className="flex items-center gap-3 flex-grow min-w-0">
                              {/* Index */}
                              <span className="text-[10px] font-body font-bold tracking-wider opacity-60 text-current">
                                {String(idx + 1).padStart(2, '0')}
                              </span>

                              {/* Session Title (editable input) */}
                              <div className="flex-grow min-w-0">
                                <input
                                  type="text"
                                  value={displayTitle}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setParsedBlocks((prev) =>
                                      prev.map((item, i) => (i === idx ? { ...item, title: val } : item))
                                    );
                                  }}
                                  className="w-full bg-transparent border-none focus:outline-none text-xs font-semibold text-current cursor-text truncate"
                                  placeholder="Untitled Session"
                                />
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0 text-current">
                              {/* Time info */}
                              <div className="flex items-center gap-1.5 text-[10px] opacity-60">
                                <Clock className="w-3.5 h-3.5" />
                                <span className="font-semibold">{b.start_time} - {b.end_time}</span>
                              </div>

                              {/* Expand Toggle */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedBlockId(isExpanded ? null : b.tempId);
                                }}
                                className="p-0.5 rounded hover:bg-white/10 group-hover:hover:bg-black/10 transition-colors"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Dropdown details */}
                          {isExpanded && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="w-full pt-3 mt-1 border-t border-white/5 group-hover:border-black/10 space-y-3 transition-colors duration-300"
                            >
                              <div className="space-y-1">
                                <span className="block text-[9px] uppercase tracking-wider font-bold opacity-60 text-current">
                                  Content / Notes
                                </span>
                                <textarea
                                  rows={2}
                                  value={b.notes || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setParsedBlocks((prev) =>
                                      prev.map((item, i) => (i === idx ? { ...item, notes: val } : item))
                                    );
                                  }}
                                  placeholder="Enter topic details or notes..."
                                  className="w-full bg-white/5 border border-white/10 group-hover:bg-black/5 group-hover:border-black/10 rounded-lg p-2 text-xs text-white group-hover:text-black placeholder-white/30 group-hover:placeholder-black/30 focus:outline-none focus:border-white/30 group-hover:focus:border-black/30 resize-none font-body transition-colors"
                                />
                              </div>

                              <div className="space-y-3">
                                <span className="block text-[9px] uppercase tracking-wider font-bold opacity-60 text-current">
                                  Resource Links
                                </span>
                                <div className="space-y-3">
                                  {/* YouTube links with thumbnails */}
                                  {ytLinks.length > 0 && (
                                    <div className="space-y-1.5">
                                      <span className="block text-[8px] uppercase tracking-widest font-extrabold opacity-40 text-current">
                                        YouTube Videos & Playlists
                                      </span>
                                      <div className="space-y-2">
                                        {ytLinks.map((link) => {
                                          const videoId = getYoutubeVideoId(link);
                                          const thumbUrl = videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null;
                                          return (
                                            <div key={link} className="flex items-center gap-3 p-1.5 rounded-lg bg-white/5 border border-white/10 group-hover:bg-black/5 group-hover:border-black/10 transition-colors">
                                              {thumbUrl ? (
                                                <img
                                                  src={thumbUrl}
                                                  alt="YT Thumbnail"
                                                  className="w-14 h-9 object-cover rounded-md bg-zinc-900 border border-white/10 shrink-0"
                                                />
                                              ) : (
                                                <div className="w-14 h-9 flex items-center justify-center rounded-md bg-white/10 shrink-0 text-current border border-white/10">
                                                  <Youtube className="w-4 h-4" />
                                                </div>
                                              )}
                                              <a
                                                href={link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-white group-hover:text-black underline break-all font-body hover:opacity-85 transition-all truncate"
                                              >
                                                {link}
                                              </a>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setParsedBlocks((prev) =>
                                                    prev.map((item, i) => {
                                                      if (i === idx) {
                                                        const currentLinks = item.links || (item.custom_link ? [item.custom_link] : []);
                                                        const updatedLinks = currentLinks.filter(l => l !== link);
                                                        return {
                                                          ...item,
                                                          links: updatedLinks,
                                                          custom_link: updatedLinks[0] || '',
                                                        };
                                                      }
                                                      return item;
                                                    })
                                                  );
                                                }}
                                                className="text-[9px] font-bold uppercase tracking-wider text-red-400 hover:text-red-300 ml-auto shrink-0 pr-1"
                                              >
                                                Remove
                                              </button>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}

                                  {/* Other Links */}
                                  {otherLinks.length > 0 && (
                                    <div className="space-y-1.5">
                                      <span className="block text-[8px] uppercase tracking-widest font-extrabold opacity-40 text-current">
                                        Other Resources
                                      </span>
                                      <div className="space-y-1">
                                        {otherLinks.map((link) => (
                                          <div key={link} className="flex items-center gap-2 py-1">
                                            <LinkIcon className="w-3.5 h-3.5 opacity-60 text-current shrink-0" />
                                            <a
                                              href={link}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-xs text-white group-hover:text-black underline break-all font-body hover:opacity-80 transition-opacity"
                                            >
                                              {link}
                                            </a>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setParsedBlocks((prev) =>
                                                  prev.map((item, i) => {
                                                    if (i === idx) {
                                                      const currentLinks = item.links || (item.custom_link ? [item.custom_link] : []);
                                                      const updatedLinks = currentLinks.filter(l => l !== link);
                                                      return {
                                                        ...item,
                                                        links: updatedLinks,
                                                        custom_link: updatedLinks[0] || '',
                                                      };
                                                    }
                                                    return item;
                                                  })
                                                );
                                              }}
                                              className="text-[9px] font-bold uppercase tracking-wider text-red-400 hover:text-red-300 ml-auto shrink-0"
                                            >
                                              Remove
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  <div className="flex items-center gap-2 bg-white/5 border border-white/10 group-hover:bg-black/5 group-hover:border-black/10 rounded-lg px-2.5 py-1.5 transition-colors mt-1">
                                    <LinkIcon className="w-3.5 h-3.5 opacity-60 text-current" />
                                    <input
                                      type="text"
                                      placeholder="Paste resource link & press Enter..."
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          const val = e.currentTarget.value.trim();
                                          if (val) {
                                            setParsedBlocks((prev) =>
                                              prev.map((item, i) => {
                                                if (i === idx) {
                                                  const currentLinks = item.links || (item.custom_link ? [item.custom_link] : []);
                                                  if (!currentLinks.includes(val)) {
                                                    const newLinks = [...currentLinks, val];
                                                    return {
                                                      ...item,
                                                      links: newLinks,
                                                      custom_link: newLinks[0],
                                                    };
                                                  }
                                                }
                                                return item;
                                              })
                                            );
                                            e.currentTarget.value = '';
                                          }
                                        }
                                      }}
                                      className="w-full bg-transparent border-none focus:outline-none text-xs text-white group-hover:text-black placeholder-white/30 group-hover:placeholder-black/30 font-body"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleImportSelected}
                disabled={isImporting || (parsedBlocks.filter((b) => b.selected).length === 0 && parsedResources.filter((r) => r.selected).length === 0)}
                className="w-full bg-white text-black hover:bg-[#eaeaea] transition-all py-3 rounded-xl font-heading font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {isImporting ? (
                  <span>Importing...</span>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Confirm and Add Selected to Schedule</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="py-16 text-center flex flex-col items-center justify-center space-y-3 text-zinc-650 h-80 bg-white/[0.01] border border-white/5 rounded-2xl">
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-1">
                <FileCode2 className="w-5 h-5 text-zinc-400" />
              </div>
              <p className="text-xs font-heading font-extrabold text-zinc-300 tracking-wide uppercase">No schedule parsed yet</p>
              <p className="text-[10px] max-w-[240px] leading-relaxed text-zinc-500 font-sans">
                Upload or paste your study plan outline on the left, then click Scan to preview extracted blocks here.
              </p>
            </div>
          )}
        </div>
      </div>

      {importSuccessMsg && (
        <div className="p-3 bg-zinc-900 border border-white/5 rounded-xl text-zinc-300 text-xs flex items-center gap-2.5 shrink-0 animate-fade-in">
          <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <span className="font-sans font-medium">{importSuccessMsg}</span>
        </div>
      )}
    </div>
  );
};
