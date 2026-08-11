import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, LayoutGrid, BookOpen, Activity, MessageSquare, Plus, Sparkles, Command, ChevronDown, Check, Download, Loader2, Bot, Zap, Brain, ShieldCheck, AlertCircle, ArrowUpRight, Signal, Star, ThumbsUp, Copy, Terminal, X, HardDrive, Cpu, Compass, User, LogOut, Bell } from 'lucide-react';
import { OllamaStatus } from '../types';
import { pullOllamaModel } from '../api';
import logoImg from '../../assets/chrono-logo.png';

interface NavbarProps {
  activeTab: 'weekly' | 'daily' | 'resources' | 'adherence';
  setActiveTab: (tab: 'weekly' | 'daily' | 'resources' | 'adherence') => void;
  ollamaStatus: OllamaStatus | null;
  selectedModel: string;
  onSelectModel: (model: string) => void;
  onOpenQuickCapture: () => void;
  onOpenRagChat: () => void;
  onOpenWeeklyReview: () => void;
  onOpenStudyPlan: () => void;
  onOpenAdvisor: () => void;
  onOpenCalendarExport?: () => void;
  onReloadStatus?: () => void;
  user?: any;
  onOpenAuth?: () => void;
  onLogout?: () => void;
}

// Clean Text Renderer
const Text3D: React.FC<{ text: string; className?: string }> = ({ text, className = "" }) => {
  return (
    <span className={`inline-block font-body font-bold uppercase text-xs tracking-wider ${className}`}>
      {text}
    </span>
  );
};



interface ModelMeta {
  speed: number;
  reasoning: number;
  badge: string;
  targetHardware: string;
  fileSize: string;
  ramRequirement: string;
  bestFor: string;
  isProjectRecommended?: boolean;
  recommendationReason?: string;
}

// Project-aware model metadata with exact file payload sizes and RAM hardware specs
const MODEL_META: Record<string, ModelMeta> = {
  'llama3.2': {
    speed: 5,
    reasoning: 4,
    badge: 'Recommended',
    targetHardware: 'Mid-tier PCs / Macs',
    fileSize: '2.0 GB',
    ramRequirement: '8 GB RAM',
    bestFor: 'Daily schedule generation, quick block capture & fast response',
    isProjectRecommended: true,
    recommendationReason: 'Best overall choice for Chrono. Ultra-fast local response for block captures and instant daily planning.'
  },
  'mistral': {
    speed: 4,
    reasoning: 4,
    badge: 'Balanced',
    targetHardware: 'Standard Workstations',
    fileSize: '4.1 GB',
    ramRequirement: '16 GB RAM',
    bestFor: 'Weekly reviews, schedule synthesis & detailed resource study plans',
    isProjectRecommended: true,
    recommendationReason: 'Excellent for Weekly Review synthesis and comprehensive study plan markdown parsing.'
  },
  'deepseek-r1': {
    speed: 2,
    reasoning: 5,
    badge: 'Deep Logic',
    targetHardware: 'High-end Workstations',
    fileSize: '4.7 GB',
    ramRequirement: '16 GB+ RAM',
    bestFor: 'Step-by-step reasoning, mathematical problem solving & diagnostic logs',
    isProjectRecommended: false,
    recommendationReason: 'Ideal for deep mathematical problem solving, though slower for real-time task capture.'
  },
  'qwen2.5': {
    speed: 5,
    reasoning: 4,
    badge: 'RAG & Code',
    targetHardware: 'Modern Laptops / Desktops',
    fileSize: '4.7 GB',
    ramRequirement: '12 GB+ RAM',
    bestFor: 'RAG chat document retrieval, URL extraction & resource search',
    isProjectRecommended: true,
    recommendationReason: 'Top choice for Chrono RAG Chat. Highly optimized for PDF, Markdown, and URL text retrieval.'
  },
  'phi3': {
    speed: 5,
    reasoning: 3,
    badge: 'Lightweight',
    targetHardware: 'Light Laptops / Ultra-books',
    fileSize: '2.3 GB',
    ramRequirement: '4-8 GB RAM',
    bestFor: 'Background adherence tracking on low-power devices',
    isProjectRecommended: false,
    recommendationReason: 'Good fallback for lightweight laptops with limited RAM.'
  },
};

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  ollamaStatus,
  selectedModel,
  onSelectModel,
  onOpenQuickCapture,
  onOpenRagChat,
  onOpenWeeklyReview,
  onOpenStudyPlan,
  onOpenAdvisor,
  onOpenCalendarExport,
  onReloadStatus,
  user,
  onOpenAuth,
  onLogout,
}) => {
  const [downloadingModel, setDownloadingModel] = useState<string | null>(null);
  const [pullMessage, setPullMessage] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [hoveredModel, setHoveredModel] = useState<string>(selectedModel ? selectedModel.toLowerCase() : 'llama3.2');
  const [installModalModel, setInstallModalModel] = useState<string | null>(null);
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const installed = (ollamaStatus?.installedModels || []).filter(
    m => !m.toLowerCase().includes('nomic') && !m.toLowerCase().includes('embed')
  );
  const popular = ollamaStatus?.popularModels || ['llama3.2', 'mistral', 'deepseek-r1', 'qwen2.5', 'phi3'];
  const uninstalled = popular.filter(p => !installed.some(inst => inst.toLowerCase().includes(p.toLowerCase())));

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectModel = async (val: string) => {
    setIsDropdownOpen(false);
    if (val.startsWith('PULL:')) {
      const modelToPull = val.replace('PULL:', '');
      setInstallModalModel(modelToPull);
    } else {
      onSelectModel(val);
    }
  };

  const handleCopyCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCommand(cmd);
    setTimeout(() => setCopiedCommand(null), 2000);
  };

  const activeMeta = MODEL_META[hoveredModel.toLowerCase()] || {
    speed: 3,
    reasoning: 3,
    badge: 'Local AI',
    targetHardware: 'Standard PC',
    fileSize: '~3.0 GB',
    ramRequirement: '8 GB RAM',
    bestFor: 'General AI planning tasks',
    isProjectRecommended: false,
    recommendationReason: 'General purpose local AI model.'
  };

  const modalMeta = installModalModel ? (MODEL_META[installModalModel.toLowerCase()] || activeMeta) : activeMeta;

  const tabs: Array<{ id: 'weekly' | 'daily' | 'resources' | 'adherence'; label: string; shortcut: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'weekly', label: 'Weekly Grid', shortcut: '1', icon: LayoutGrid },
    { id: 'daily', label: 'Daily View', shortcut: '2', icon: Calendar },
    { id: 'resources', label: 'Resources', shortcut: '3', icon: BookOpen },
    { id: 'adherence', label: 'Adherence', shortcut: '4', icon: Activity },
  ];

  // Keyboard Shortcuts (Alt+1..4 for nav tabs, Alt+R for RAG Chat, Alt+W for Weekly Review)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when user is typing in input, textarea, or contenteditable elements
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        if (e.key === '1') {
          e.preventDefault();
          setActiveTab('weekly');
        } else if (e.key === '2') {
          e.preventDefault();
          setActiveTab('daily');
        } else if (e.key === '3') {
          e.preventDefault();
          setActiveTab('resources');
        } else if (e.key === '4') {
          e.preventDefault();
          setActiveTab('adherence');
        } else if (e.key.toLowerCase() === 'c') {
          e.preventDefault();
          onOpenRagChat();
        } else if (e.key.toLowerCase() === 'w') {
          e.preventDefault();
          onOpenWeeklyReview();
        } else if (e.key.toLowerCase() === 'a') {
          e.preventDefault();
          onOpenAdvisor();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveTab, onOpenRagChat, onOpenWeeklyReview, onOpenAdvisor]);

  return (
    <header className="sticky top-0 z-50 px-4 sm:px-8 py-3 bg-transparent font-body">
      <div className="max-w-[1550px] mx-auto flex items-center justify-between gap-4">

        {/* BRAND EMBLEM & AI MODEL TRIGGER */}
        <div className="flex items-center gap-4 shrink-0">
          <div
            onClick={() => setActiveTab('weekly')}
            className="flex items-center gap-3 cursor-pointer select-none group"
          >
            <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center transition-transform group-hover:scale-105">
              <img src={logoImg} alt="Chrono Logo" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col">
              <span className="font-heading font-black text-white text-base tracking-widest group-hover:text-zinc-200 transition-colors">
                CHRONO
              </span>
            </div>
          </div>

          <div className="h-5 w-px bg-white/15 hidden md:block" />

          {/* AI MODEL SELECTOR */}
          <div className="relative hidden md:block" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className={`group flex items-center gap-3 px-4 py-2 rounded-xl border border-white/20 transition-all duration-300 shadow-lg cursor-pointer ${isDropdownOpen
                  ? 'bg-white text-black font-extrabold'
                  : ' hover:bg-white/10 text-white backdrop-blur-xl'
                }`}
            >
              <div className="relative flex items-center justify-center">
                {installed.length === 0 ? (
                  <AlertCircle className={`w-4 h-4 ${isDropdownOpen ? 'text-black' : 'text-white'}`} />
                ) : (
                  <Bot className={`w-4 h-4 transition-transform group-hover:scale-110 ${isDropdownOpen ? 'text-black' : 'text-zinc-300 group-hover:text-white'}`} />
                )}
                <span className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${ollamaStatus?.available && installed.length > 0 ? 'bg-emerald-400' : 'bg-amber-400'
                  }`} />
              </div>

              {installed.length > 0 ? (
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs uppercase tracking-wider">
                    {selectedModel}
                  </span>
                  {MODEL_META[selectedModel.toLowerCase()]?.isProjectRecommended && (
                    <ThumbsUp className={`w-3 h-3 ${isDropdownOpen ? 'text-black' : 'text-emerald-400'}`} />
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className={`font-bold uppercase tracking-wider text-xs ${isDropdownOpen ? 'text-black' : 'text-white'}`}>
                    No Model Installed
                  </span>
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${isDropdownOpen ? 'bg-black text-white' : 'bg-white text-black'
                    }`}>
                    Install +
                  </span>
                </div>
              )}

              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180 text-black' : 'text-zinc-400 group-hover:text-white'
                }`} />
            </button>

            {/* BORDERLESS MONOCHROME DUAL-PANE MODEL DROPDOWN */}
            {isDropdownOpen && (
              <div className="absolute top-full left-0 mt-3 w-[580px] bg-[#050505] rounded-3xl p-6 shadow-2xl backdrop-blur-2xl z-50 text-white font-sans transition-all">
                {/* Header bar inside dropdown */}
                <div className="flex items-center justify-between pb-3 mb-4">
                  <div className="flex items-center gap-2 text-xs text-zinc-400 font-extrabold uppercase tracking-wider">
                    <Cpu className="w-3.5 h-3.5 text-white" />
                    <span>Select AI Model</span>
                  </div>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Ollama Engine</span>
                </div>

                <div className="flex gap-5">
                  {/* Left Pane: INSTALLED & RECOMMENDED ENGINES */}
                  <div className="w-1/2 flex flex-col justify-between space-y-4">
                    <div>
                      <div className="px-1 py-1 text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider flex justify-between items-center mb-1.5">
                        <span>INSTALLED ENGINES</span>
                        <span className="text-[10px] font-bold bg-white/10 text-white px-2 py-0.5 rounded-full">{installed.length}</span>
                      </div>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {installed.length > 0 ? (
                          installed.map((m) => {
                            const isSelected = selectedModel.toLowerCase() === m.toLowerCase();
                            const isHovered = hoveredModel.toLowerCase() === m.toLowerCase();
                            const meta = MODEL_META[m.toLowerCase()];

                            return (
                              <button
                                key={m}
                                onMouseEnter={() => setHoveredModel(m)}
                                onClick={() => handleSelectModel(m)}
                                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-left transition-all cursor-pointer ${isSelected
                                    ? 'bg-white text-black font-extrabold'
                                    : isHovered
                                      ? 'bg-white/10 text-white font-bold'
                                      : 'bg-[#0B0B0C] text-zinc-300 hover:text-white'
                                  }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="uppercase tracking-wider text-xs font-bold">{m}</span>
                                  {meta?.isProjectRecommended && (
                                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase ${isSelected ? 'bg-black text-white' : 'bg-white/15 text-white'
                                      }`}>
                                      REC
                                    </span>
                                  )}
                                </div>
                                {isSelected && <Check className="w-4 h-4 text-black stroke-[3]" />}
                              </button>
                            );
                          })
                        ) : (
                          <div className="p-4 rounded-2xl bg-[#0B0B0C] space-y-1.5 text-left">
                            <div className="flex items-center gap-1.5 text-white font-extrabold text-xs uppercase tracking-wider">
                              <AlertCircle className="w-3.5 h-3.5 text-white" />
                              <span>No Models Installed</span>
                            </div>
                            <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
                              Recommended for Chrono: <span className="text-white font-bold">llama3.2</span> (2.0 GB) or <span className="text-white font-bold">qwen2.5</span> (4.7 GB). Select below to copy install command.
                            </p>
                          </div>
                        )}
                      </div>

                      {uninstalled.length > 0 && (
                        <>
                          <div className="px-1 py-1 text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider pt-3 flex justify-between items-center mb-1.5">
                            <span>RECOMMENDED TO INSTALL</span>
                            <Download className="w-3.5 h-3.5 text-zinc-500" />
                          </div>
                          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                            {uninstalled.map((m) => {
                              const isHovered = hoveredModel.toLowerCase() === m.toLowerCase();
                              const meta = MODEL_META[m.toLowerCase()];

                              return (
                                <button
                                  key={`pull-${m}`}
                                  onMouseEnter={() => setHoveredModel(m)}
                                  onClick={() => handleSelectModel(`PULL:${m}`)}
                                  className={`w-full flex items-center justify-between px-3.5 py-2 rounded-2xl text-left transition-all text-xs cursor-pointer ${isHovered ? 'bg-white/10 text-white font-bold' : 'bg-[#0B0B0C] text-zinc-400 hover:text-white'
                                    }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="uppercase tracking-wider font-bold text-xs text-white">+ {m}</span>
                                    {meta?.isProjectRecommended && (
                                      <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase bg-white/10 text-zinc-300">
                                        REC
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] font-sans text-zinc-400">
                                    {meta?.fileSize}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right Pane: SPECS & HARDWARE TECH MATRIX INSPECTOR */}
                  <div className="w-1/2 flex flex-col justify-between bg-[#0B0B0C] p-5 rounded-2xl">
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-white uppercase text-base tracking-wider">{hoveredModel}</span>
                        <span className="text-[9px] font-black text-black bg-white px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                          {activeMeta.badge}
                        </span>
                      </div>

                      {/* Specs Stats Row */}
                      <div className="flex items-center justify-between text-xs py-2 px-3 rounded-xl bg-black/40">
                        <div className="flex flex-col">
                          <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">FILE PAYLOAD</span>
                          <span className="font-extrabold text-white text-xs mt-0.5">{activeMeta.fileSize}</span>
                        </div>
                        <div className="flex flex-col text-right">
                          <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">MIN MEMORY</span>
                          <span className="font-extrabold text-white text-xs mt-0.5">{activeMeta.ramRequirement}</span>
                        </div>
                      </div>

                      {/* Speed & Reasoning Rating Bars */}
                      <div className="space-y-2.5 text-xs bg-black/40 p-3 rounded-xl">
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-400 font-bold flex items-center gap-1.5 text-[11px]">
                            <Zap className="w-3.5 h-3.5 text-white" /> Speed
                          </span>
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 rounded-full bg-white/10 overflow-hidden">
                              <div className="h-full bg-white rounded-full transition-all duration-300" style={{ width: `${(activeMeta.speed / 5) * 100}%` }} />
                            </div>
                            <span className="text-[10px] font-black text-white font-sans">{activeMeta.speed}/5</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-zinc-400 font-bold flex items-center gap-1.5 text-[11px]">
                            <Brain className="w-3.5 h-3.5 text-white" /> Reasoning
                          </span>
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 rounded-full bg-white/10 overflow-hidden">
                              <div className="h-full bg-white rounded-full transition-all duration-300" style={{ width: `${(activeMeta.reasoning / 5) * 100}%` }} />
                            </div>
                            <span className="text-[10px] font-black text-white font-sans">{activeMeta.reasoning}/5</span>
                          </div>
                        </div>
                      </div>

                      {/* Project Fit Description */}
                      <div className="pt-1">
                        <span className="text-[9px] text-zinc-500 uppercase font-black tracking-widest block mb-1">CHRONO SUITABILITY</span>
                        <p className="text-[11px] text-zinc-300 leading-relaxed font-medium bg-black/40 p-3 rounded-xl">
                          {activeMeta.recommendationReason}
                        </p>
                      </div>
                    </div>

                    <div className="text-[9px] text-zinc-500 pt-3 text-center uppercase tracking-widest font-extrabold flex items-center justify-center gap-1">
                      <Signal className="w-3 h-3 text-zinc-500" />
                      <span>HARDWARE TARGET: {activeMeta.targetHardware}</span>
                    </div>
                  </div>

                </div>
              </div>
            )}
          </div>
        </div>

        {/* CENTER NAVIGATION DOCK NAV TABS */}
        <nav className="flex items-center border border-white/20 p-1.5 rounded-2xl gap-1.5 shadow-2xl">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`group relative flex items-center justify-center h-10 transition-all duration-300 ease-out select-none whitespace-nowrap rounded-xl ${isActive
                    ? 'w-36 bg-white text-black font-black shadow-[0_0_20px_rgba(255,255,255,0.35)] shrink-0'
                    : 'w-10 hover:w-36 bg-transparent hover:bg-white/[0.12] text-zinc-400 hover:text-white shrink-0'
                  }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Icon className={`w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-black' : 'text-zinc-400 group-hover:text-white'}`} />

                  <div className={`transition-all duration-300 ease-out overflow-hidden whitespace-nowrap ${isActive
                      ? 'max-w-[100px] opacity-100 ml-1'
                      : 'max-w-0 opacity-0 group-hover:max-w-[100px] group-hover:opacity-100 group-hover:ml-1'
                    }`}>
                    <span className={`inline-block font-body font-bold text-[11px] uppercase tracking-wider transition-all duration-300 ${isActive
                        ? 'text-black font-extrabold'
                        : 'text-zinc-300 group-hover:text-white group-hover:translate-x-0.5 group-hover:tracking-widest'
                      }`}>
                      {tab.label}
                    </span>
                  </div>
                </div>

                {/* Minimal Borderless Title + Shortcut Hover Badge */}
                <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 pointer-events-none opacity-0 group-hover:opacity-100 group-hover:translate-y-0 translate-y-1 transition-all duration-200 z-50 flex flex-col items-center">
                  <div className="px-2.5 py-1 rounded-lg bg-black/95 text-white shadow-2xl flex items-center gap-1.5 whitespace-nowrap">
                    <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider">
                      {tab.label}
                    </span>
                    <kbd className="text-[9px] font-mono font-bold text-white bg-white/20 px-1.5 py-0.5 rounded">
                      Alt+{tab.shortcut}
                    </kbd>
                  </div>
                </div>
              </button>
            );
          })}
        </nav>

        {/* RIGHT ACTION BUTTONS */}
        <div className="flex items-center gap-3 shrink-0">


          {/* RAG Chat Button */}
          <button
            onClick={onOpenRagChat}
            className="group relative flex items-center justify-center h-10 bg-transparent hover:bg-white text-white hover:text-black px-3.5 hover:px-4.5 rounded-xl text-xs transition-all duration-300 ease-out shadow-sm backdrop-blur-md"
          >
            <MessageSquare className="w-4 h-4 text-zinc-300 group-hover:text-black transition-colors duration-200 shrink-0" />
            <div className="max-w-0 opacity-0 group-hover:max-w-[90px] group-hover:opacity-100 group-hover:ml-2 overflow-hidden transition-all duration-300 ease-out whitespace-nowrap">
              <Text3D text="RAG Chat" />
            </div>

            {/* Minimal Borderless Title + Shortcut Hover Badge */}
            <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 pointer-events-none opacity-0 group-hover:opacity-100 group-hover:translate-y-0 translate-y-1 transition-all duration-200 z-50 flex flex-col items-center">
              <div className="px-2.5 py-1 rounded-lg bg-black/95 text-white shadow-2xl flex items-center gap-1.5 whitespace-nowrap">
                <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider">
                  RAG Chat
                </span>
                <kbd className="text-[9px] font-mono font-bold text-white bg-white/20 px-1.5 py-0.5 rounded">
                  Alt+C
                </kbd>
              </div>
            </div>
          </button>

          {/* Weekly Review Button */}
          <button
            onClick={onOpenWeeklyReview}
            className="group relative flex items-center justify-center h-10 bg-transparent hover:bg-white text-white hover:text-black px-3.5 hover:px-4.5 rounded-xl text-xs transition-all duration-300 ease-out shadow-md backdrop-blur-md"
          >
            <Sparkles className="w-4 h-4 text-zinc-300 group-hover:text-black transition-colors duration-200 group-hover:rotate-180 shrink-0" />
            <div className="max-w-0 opacity-0 group-hover:max-w-[80px] group-hover:opacity-100 group-hover:ml-2 overflow-hidden transition-all duration-300 ease-out whitespace-nowrap">
              <Text3D text="Review" />
            </div>

            {/* Minimal Borderless Title + Shortcut Hover Badge */}
            <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 pointer-events-none opacity-0 group-hover:opacity-100 group-hover:translate-y-0 translate-y-1 transition-all duration-200 z-50 flex flex-col items-center">
              <div className="px-2.5 py-1 rounded-lg bg-black/95 text-white shadow-2xl flex items-center gap-1.5 whitespace-nowrap">
                <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider">
                  Weekly Review
                </span>
                <kbd className="text-[9px] font-mono font-bold text-white bg-white/20 px-1.5 py-0.5 rounded">
                  Alt+W
                </kbd>
              </div>
            </div>
          </button>

          {/* Tech Advisor Button */}
          <button
            onClick={onOpenAdvisor}
            className="group relative flex items-center justify-center h-10 bg-transparent hover:bg-white text-white hover:text-black px-3.5 hover:px-4.5 rounded-xl text-xs transition-all duration-300 ease-out shadow-md backdrop-blur-md"
          >
            <Compass className="w-4 h-4 text-zinc-300 group-hover:text-black transition-colors duration-200 group-hover:rotate-45 shrink-0" />
            <div className="max-w-0 opacity-0 group-hover:max-w-[80px] group-hover:opacity-100 group-hover:ml-2 overflow-hidden transition-all duration-300 ease-out whitespace-nowrap">
              <Text3D text="Advisor" />
            </div>

            {/* Minimal Borderless Title + Shortcut Hover Badge */}
            <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 pointer-events-none opacity-0 group-hover:opacity-100 group-hover:translate-y-0 translate-y-1 transition-all duration-200 z-50 flex flex-col items-center">
              <div className="px-2.5 py-1 rounded-lg bg-black/95 text-white shadow-2xl flex items-center gap-1.5 whitespace-nowrap">
                <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider">
                  Tech & Break Advisor
                </span>
                <kbd className="text-[9px] font-mono font-bold text-white bg-white/20 px-1.5 py-0.5 rounded">
                  Alt+A
                </kbd>
              </div>
            </div>
          </button>

          {/* Google Calendar & Notifications Sync Button */}
          {onOpenCalendarExport && (
            <button
              onClick={onOpenCalendarExport}
              className="group relative flex items-center justify-center h-10 bg-transparent hover:bg-blue-500 text-blue-400 hover:text-white px-3.5 hover:px-4 rounded-xl text-xs transition-all duration-300 ease-out shadow-md backdrop-blur-md border border-blue-500/20"
            >
              <Bell className="w-4 h-4 transition-colors duration-200 shrink-0" />
              <div className="max-w-0 opacity-0 group-hover:max-w-[90px] group-hover:opacity-100 group-hover:ml-2 overflow-hidden transition-all duration-300 ease-out whitespace-nowrap">
                <Text3D text="Sync Cal" />
              </div>

              <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 pointer-events-none opacity-0 group-hover:opacity-100 group-hover:translate-y-0 translate-y-1 transition-all duration-200 z-50 flex flex-col items-center">
                <div className="px-2.5 py-1 rounded-lg bg-black/95 text-white shadow-2xl flex items-center gap-1.5 whitespace-nowrap">
                  <span className="text-[10px] font-bold text-blue-300 uppercase tracking-wider">
                    Google Calendar & Notifications
                  </span>
                </div>
              </div>
            </button>
          )}

          {/* Quick Capture Primary CTA */}
          <button
            onClick={onOpenQuickCapture}
            className="group flex items-center h-10 bg-white hover:bg-zinc-200 text-black px-4 rounded-xl text-xs font-bold transition-all shadow-[0_0_20px_rgba(255,255,255,0.25)] hover:shadow-[0_0_28px_rgba(255,255,255,0.45)]"
          >
            <Plus className="w-4 h-4 stroke-[3] text-black transition-transform group-hover:rotate-90 duration-300" />
            <span className="hidden sm:inline-block ml-2 tracking-wider uppercase text-xs font-extrabold">
              CAPTURE
            </span>
            <kbd className="hidden md:inline-flex items-center gap-0.5 text-[9px] bg-black/10 px-1.5 py-0.5 rounded-xl text-black/80 font-bold ml-2">
              <Command className="w-2.5 h-2.5 inline" />K
            </kbd>
          </button>

          {/* User Auth Control */}
          {user ? (
            <div className="relative group/user flex items-center shrink-0">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/[0.02] border border-white/[0.06] text-zinc-300 font-medium text-xs select-none hover:text-white hover:border-white/20 transition-all cursor-pointer">
                {user.email ? user.email.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
              </div>
              
              <div className="absolute right-0 top-full mt-2 p-4 bg-[#0a0a0a] border border-white/[0.04] rounded-2xl shadow-2xl flex flex-col gap-3 opacity-0 invisible group-hover/user:opacity-100 group-hover/user:visible transition-all duration-200 z-50 min-w-[200px]">
                <div className="flex flex-col">
                  <span className="text-[9px] uppercase tracking-[0.15em] text-zinc-500 font-medium">Account</span>
                  <span className="text-[11px] text-zinc-300 truncate mt-1" title={user.email}>
                    {user.email}
                  </span>
                </div>
                <div className="h-px bg-white/[0.04] w-full" />
                <button
                  onClick={onLogout}
                  className="flex items-center justify-center gap-1.5 w-full py-2 hover:bg-white/[0.03] text-zinc-400 hover:text-white border border-white/[0.06] rounded-lg text-xs font-medium transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5 text-zinc-550" />
                  <span>Log Out</span>
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="group flex items-center h-10 bg-transparent border border-white/10 hover:border-white/20 hover:bg-white/5 text-white px-3.5 rounded-xl text-xs font-bold transition-all"
              title="Sign In / Register"
            >
              <User className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors" />
              <span className="hidden sm:inline-block ml-2 tracking-wider uppercase text-2xs font-extrabold">
                SIGN IN
              </span>
            </button>
          )}
        </div>

      </div>

      {/* STREAMLINED CYBER TERMINAL INSTALL MODAL (PULL & RUN CLI COMMANDS) */}
      {installModalModel && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200 font-body">
          <div className="w-full max-w-lg rounded-3xl bg-[#060608] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.98)] text-white space-y-4 relative">

            {/* Window Controls Header */}
            <div className="flex items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
                </div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-2 flex items-center gap-1.5 font-mono">
                  <Terminal className="w-3.5 h-3.5 text-zinc-300" /> bash // install-{installModalModel}.sh
                </span>
              </div>
              <button
                onClick={() => setInstallModalModel(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Terminal Shell Display (Pull & Run Commands) */}
            <div className="bg-[#020203] rounded-2xl p-4 text-xs space-y-3 shadow-inner">
              <div className="space-y-1 text-zinc-400 text-[11px] pb-1 font-body">
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-emerald-400 font-bold">chrono@os</span>
                  <span>:</span>
                  <span className="text-white">~</span>
                  <span>$</span>
                  <span className="text-zinc-300"># Model specs for {installModalModel}</span>
                </div>
                <div className="flex items-center gap-4 text-[11px] text-zinc-300 pl-4 pt-1 font-body">
                  <span>Payload: <strong className="text-white font-bold">{modalMeta.fileSize}</strong></span>
                  <span>RAM: <strong className="text-white font-bold">{modalMeta.ramRequirement}</strong></span>
                  <span>Target: <strong className="text-white font-bold">{modalMeta.targetHardware}</strong></span>
                </div>
              </div>

              {/* Command 1: ollama pull (Download Only) */}
              <div className="space-y-1">
                <div className="text-[10px] text-zinc-400 uppercase font-black tracking-widest">
                  1. Download Model Files (CLI Pull):
                </div>
                <div className="flex items-center justify-between bg-white/[0.04] p-3 rounded-xl text-emerald-400 font-mono font-bold">
                  <span>$ ollama pull {installModalModel}</span>
                  <button
                    onClick={() => handleCopyCommand(`ollama pull ${installModalModel}`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-black font-body font-extrabold text-[11px] hover:bg-zinc-200 transition-colors shadow"
                  >
                    {copiedCommand === `ollama pull ${installModalModel}` ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Pull</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Command 2: ollama run (Download & Launch Shell) */}
              <div className="space-y-1 pt-1">
                <div className="text-[10px] text-zinc-400 uppercase font-black tracking-widest">
                  2. Download & Instant Interactive Launch:
                </div>
                <div className="flex items-center justify-between bg-white/[0.02] p-3 rounded-xl text-zinc-300 font-mono font-bold">
                  <span className="text-emerald-400">$ ollama run {installModalModel}</span>
                  <button
                    onClick={() => handleCopyCommand(`ollama run ${installModalModel}`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-body font-bold text-[11px] transition-colors"
                  >
                    {copiedCommand === `ollama run ${installModalModel}` ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Run</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <p className="text-[10px] text-zinc-400 leading-normal font-body pt-1">
                Paste either command into your computer's Terminal or Command Prompt. Once finished, refresh Chrono to use the model.
              </p>
            </div>

            {/* Footer Close Button */}
            <div className="pt-1 flex justify-end font-body">
              <button
                onClick={() => setInstallModalModel(null)}
                className="bg-white/10 hover:bg-white/20 text-white px-5 py-2 rounded-xl text-xs font-bold transition-all"
              >
                Close Window
              </button>
            </div>

          </div>
        </div>
      )}
    </header>
  );
};
