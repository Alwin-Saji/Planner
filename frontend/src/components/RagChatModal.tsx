import React, { useState, useEffect, useRef } from 'react';
import { getTodayStr } from '../utils/dateUtils';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Bot, User, Sparkles, Filter, Cpu, Download, WifiOff, ChevronDown, Check, AlertCircle, ThumbsUp, Zap, Brain, Signal, Terminal, MessageSquare } from 'lucide-react';
import { RagChatMessage, OllamaStatus } from '../types';
import { postRagChat, pullOllamaModel } from '../api';
import { OfflineBanner } from './OfflineBanner';

interface RagChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedModel?: string;
  onSelectModel?: (model: string) => void;
  ollamaStatus?: OllamaStatus | null;
  onReloadStatus?: () => void;
}

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
    speed: 2,
    reasoning: 5,
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
  'gemma2': {
    speed: 4,
    reasoning: 4,
    badge: 'Google AI',
    targetHardware: 'Modern PC / Mac',
    fileSize: '5.4 GB',
    ramRequirement: '16 GB RAM',
    bestFor: 'High precision text synthesis & reasoning',
    isProjectRecommended: true,
    recommendationReason: 'Google Gemma 2 model. Excellent accuracy for study notes analysis.'
  },
  'codellama': {
    speed: 4,
    reasoning: 5,
    badge: 'Coding Specialist',
    targetHardware: 'Standard Workstations',
    fileSize: '3.8 GB',
    ramRequirement: '12 GB RAM',
    bestFor: 'Code snippet generation, refactoring & algorithm analysis',
    isProjectRecommended: true,
    recommendationReason: 'Optimized for DSA and coding tasks.'
  },
  'neo': {
    speed: 4,
    reasoning: 3,
    badge: 'Fast Local',
    targetHardware: 'Mid-range Laptops',
    fileSize: '1.8 GB',
    ramRequirement: '8 GB RAM',
    bestFor: 'Quick notes retrieval',
    isProjectRecommended: false,
    recommendationReason: 'Compact model for fast local responses.'
  },
};

import { fetchRagConversations, fetchRagConversationById, saveRagConversationMessage, deleteRagConversation } from '../api';

export const RagChatModal: React.FC<RagChatModalProps> = ({
  isOpen,
  onClose,
  selectedModel = 'llama3.2',
  onSelectModel,
  ollamaStatus,
  onReloadStatus,
}) => {
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<RagChatMessage[]>([]);

  const [activeModel, setActiveModel] = useState<string>(selectedModel);
  const [inputQuery, setInputQuery] = useState('');
  const [scope, setScope] = useState<string>('everything');
  const [customScopes, setCustomScopes] = useState<string[]>(['everything', 'dsa', 'ml', 'notes']);

  useEffect(() => {
    if (isOpen) {
      // Auto-extract tags from database resources
      fetch('/api/resources')
        .then(res => res.json())
        .then((data: any[]) => {
          const dbTags = new Set<string>(['everything', 'dsa', 'ml', 'notes']);
          data.forEach(r => {
            try {
              const tags: string[] = JSON.parse(r.tags || '[]');
              tags.forEach(t => dbTags.add(t.toLowerCase()));
            } catch (e) { }
          });
          setCustomScopes(Array.from(dbTags));
        })
        .catch(err => console.error('Failed to load database resource tags:', err));
    }
  }, [isOpen]);
  const [newScopeInput, setNewScopeInput] = useState('');
  const [isAddingScope, setIsAddingScope] = useState(false);

  const handleAddScope = () => {
    const trimmed = newScopeInput.trim().toLowerCase();
    if (!trimmed) return;
    if (!customScopes.includes(trimmed)) {
      setCustomScopes(prev => [...prev, trimmed]);
    }
    setScope(trimmed);
    setNewScopeInput('');
    setIsAddingScope(false);
  };

  const [isLoading, setIsLoading] = useState(false);
  const [downloadingModel, setDownloadingModel] = useState<string | null>(null);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [hoveredModel, setHoveredModel] = useState<string>(selectedModel ? selectedModel.toLowerCase() : 'llama3.2');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const INITIAL_BOT_MSG: RagChatMessage = {
    id: 'msg-init',
    sender: 'ai',
    text: 'Hello! Ask me anything grounded in your study notes & resources (e.g. "What did I read about backprop?" or "Summarize system design notes").',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };

  const loadConversations = async () => {
    try {
      const data = await fetchRagConversations();
      setConversations(data);
    } catch (err) {
      console.error('Failed to load RAG chat history from DB:', err);
    }
  };

  const loadConversationThread = async (id: string) => {
    try {
      const data = await fetchRagConversationById(id);
      setActiveConvId(data.id);
      if (data.scope) setScope(data.scope);
      if (data.messages && data.messages.length > 0) {
        setMessages(data.messages);
      } else {
        setMessages([INITIAL_BOT_MSG]);
      }
    } catch (err) {
      console.error('Failed to load thread:', err);
      setMessages([INITIAL_BOT_MSG]);
    }
  };

  const handleStartNewChat = () => {
    setActiveConvId(null);
    setMessages([INITIAL_BOT_MSG]);
  };

  const handleDeleteChat = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await deleteRagConversation(id);
      if (activeConvId === id) {
        handleStartNewChat();
      }
      loadConversations();
    } catch (err) {
      console.error('Failed to delete chat:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadConversations();
      handleStartNewChat();
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedModel) {
      setActiveModel(selectedModel);
    }
  }, [selectedModel]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [searchMode, setSearchMode] = useState<'grounded' | 'web'>('grounded');

  const installed = (ollamaStatus?.installedModels || []).filter(
    m => !m.toLowerCase().includes('nomic') && !m.toLowerCase().includes('embed')
  );
  const popular = ollamaStatus?.popularModels || ['llama3.2', 'mistral', 'deepseek-r1', 'qwen2.5', 'phi3'];
  const uninstalled = popular.filter(p => !installed.some(inst => inst.toLowerCase().includes(p.toLowerCase())));

  const handleModelSelect = async (val: string) => {
    setIsDropdownOpen(false);
    if (val.startsWith('PULL:')) {
      const modelToPull = val.replace('PULL:', '');
      setDownloadingModel(modelToPull);
      try {
        const res = await pullOllamaModel(modelToPull);
        if (res.success) {
          setActiveModel(modelToPull);
          if (onSelectModel) onSelectModel(modelToPull);
          if (onReloadStatus) onReloadStatus();
        }
      } catch (err) {
        console.error('Failed to pull model', err);
      } finally {
        setDownloadingModel(null);
      }
    } else {
      setActiveModel(val);
      if (onSelectModel) onSelectModel(val);
    }
  };

  const getModelMeta = (name: string): ModelMeta => {
    const cleanName = name.toLowerCase();
    for (const key of Object.keys(MODEL_META)) {
      if (cleanName.includes(key)) {
        return MODEL_META[key];
      }
    }
    return {
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
  };

  const activeMeta = getModelMeta(hoveredModel);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputQuery.trim() || isLoading) return;

    const userText = inputQuery.trim();
    setInputQuery('');

    const userMsg: RagChatMessage = {
      id: `msg-user-${Date.now()}`,
      sender: 'user',
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const savedUser = await saveRagConversationMessage({
        id: activeConvId || undefined,
        scope,
        model: activeModel,
        message: userMsg,
      });

      const currentConvId = savedUser.conversationId;
      if (!activeConvId) {
        setActiveConvId(currentConvId);
      }

      const data = await postRagChat(userText, scope, activeModel, searchMode);
      const aiMsg: RagChatMessage = {
        id: `msg-ai-${Date.now()}`,
        sender: 'ai',
        text: data.answer,
        sources: data.sources,
        offline: data.offline,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      if ((data as any).suggestedBlock) {
        (aiMsg as any).suggestedBlock = (data as any).suggestedBlock;
      }

      setMessages(prev => [...prev, aiMsg]);
      await saveRagConversationMessage({
        id: currentConvId,
        scope,
        model: activeModel,
        message: aiMsg,
      });

      loadConversations();
    } catch (err: any) {
      const errorMsg: RagChatMessage = {
        id: `msg-err-${Date.now()}`,
        sender: 'ai',
        text: 'Apologies, could not process query over notes.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 bg-[#050508]/98 backdrop-blur-2xl flex flex-col font-body text-xs"
        >
          {/* Top Bar Header */}
          <div className="px-8 py-4 border-b border-white/10 flex items-center justify-between bg-[#08080d] shrink-0 relative z-40">
            <div className="flex items-center gap-4">
              <div className="w-9 h-9 rounded-2xl bg-white text-black flex items-center justify-center font-black shadow-[0_0_25px_rgba(255,255,255,0.4)]">
                <Bot className="w-5 h-5 text-black stroke-[2.5]" />
              </div>
              <div>
                <h1 className="font-heading font-black text-white text-base tracking-wider">RAG STUDIO WORKSPACE</h1>
                <span className="text-[10px] font-mono text-zinc-400">Integrated Grounded Context Engine</span>
              </div>
            </div>

            <div className="flex items-center gap-4 font-mono">
              {/* Dropdown Engine Selector */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className={`flex items-center gap-2.5 px-4 py-2 rounded-2xl border text-xs font-bold transition-all shadow ${isDropdownOpen
                    ? 'bg-white text-black border-white'
                    : 'bg-white/[0.05] border-white/15 text-white hover:bg-white/10'
                    }`}
                >
                  <Cpu className="w-4 h-4" />
                  <span className="uppercase">{ollamaStatus?.available && installed.length > 0 ? activeModel : (ollamaStatus?.available ? 'No Model' : 'Offline')}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isDropdownOpen ? 'rotate-180 text-black' : 'text-zinc-400'}`} />
                </button>

                {/* Reused Dropdown HUD */}
                {isDropdownOpen && (
                  <div className="absolute top-full right-0 mt-2 w-[480px] sm:w-[520px] rounded-3xl bg-[#0d0d14] border border-white/20 p-4 shadow-[0_30px_90px_rgba(0,0,0,0.99)] z-[100] text-xs flex gap-4 font-body">
                    {/* Left Pane */}
                    <div className="w-1/2 space-y-1.5 pr-1">
                      <div className="px-2 py-1 text-[10px] font-black text-zinc-400 uppercase tracking-wider flex justify-between">
                        <span>INSTALLED ENGINES</span>
                        <span className="text-white font-bold">{installed.length}</span>
                      </div>

                      <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
                        {installed.length > 0 ? (
                          installed.map((m) => {
                            const isSelected = activeModel.toLowerCase() === m.toLowerCase();
                            const isHovered = hoveredModel.toLowerCase() === m.toLowerCase();
                            const meta = getModelMeta(m);

                            return (
                              <button
                                key={m}
                                onMouseEnter={() => setHoveredModel(m)}
                                onClick={() => handleModelSelect(m)}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-2xl text-left transition-all ${isSelected
                                  ? 'bg-white text-black font-extrabold shadow-md'
                                  : isHovered
                                    ? 'bg-white/10 text-white font-bold'
                                    : 'text-zinc-400 hover:text-white'
                                  }`}
                              >
                                <div className="flex items-center gap-1.5">
                                  <span className="uppercase tracking-wider text-xs font-bold">{m}</span>
                                  {meta?.isProjectRecommended && (
                                    <span className={`text-[8px] font-black px-1.5 py-0.2 rounded-full uppercase ${isSelected ? 'bg-black text-white' : 'bg-emerald-400/20 text-emerald-300'
                                      }`}>
                                      PROJ BEST
                                    </span>
                                  )}
                                </div>
                                {isSelected && <Check className="w-4 h-4 text-black stroke-[3]" />}
                              </button>
                            );
                          })
                        ) : (
                          <div className="p-3 rounded-2xl bg-white/[0.05] space-y-1 text-left">
                            <div className="flex items-center gap-1.5 text-white font-extrabold text-xs uppercase tracking-wider">
                              <AlertCircle className="w-4 h-4 text-white" />
                              <span>No Models Installed</span>
                            </div>
                            <p className="text-[11px] text-zinc-400 leading-snug">
                              Ollama is offline or no models found.
                            </p>
                          </div>
                        )}
                      </div>

                      {uninstalled.length > 0 && (
                        <>
                          <div className="px-2 py-1 text-[10px] font-black text-zinc-400 uppercase tracking-wider pt-2 flex justify-between">
                            <span>RECOMMENDED TO INSTALL</span>
                            <Download className="w-3.5 h-3.5 text-zinc-400" />
                          </div>
                          <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                            {uninstalled.map((m) => {
                              const isHovered = hoveredModel.toLowerCase() === m.toLowerCase();
                              const meta = getModelMeta(m);

                              return (
                                <button
                                  key={`pull-${m}`}
                                  onMouseEnter={() => setHoveredModel(m)}
                                  onClick={() => handleModelSelect(`PULL:${m}`)}
                                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-2xl text-left transition-all text-xs ${isHovered ? 'bg-white/10 text-white font-bold' : 'text-zinc-400 hover:text-white'
                                    }`}
                                >
                                  <div className="flex items-center gap-1.5">
                                    <span className="uppercase tracking-wider font-bold text-xs text-white">+ {m}</span>
                                    {meta?.isProjectRecommended && (
                                      <span className="text-[8px] font-black px-1.5 py-0.2 rounded-full uppercase bg-white/15 text-white">
                                        REC
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] font-mono text-zinc-400">
                                    {meta?.fileSize}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Right Pane */}
                    <div className="w-1/2 flex flex-col justify-between bg-white/[0.03] p-3.5 rounded-2xl">
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-white uppercase text-sm tracking-wider">{hoveredModel}</span>
                          <span className="text-[8px] font-black text-black bg-white px-2 py-0.5 rounded-full uppercase tracking-wider">
                            {activeMeta.badge}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs py-0.5">
                          <div className="flex flex-col">
                            <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">PAYLOAD</span>
                            <span className="font-extrabold text-white text-xs">{activeMeta.fileSize}</span>
                          </div>
                          <div className="h-5 w-px bg-white/10" />
                          <div className="flex flex-col">
                            <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">MIN RAM</span>
                            <span className="font-extrabold text-white text-xs">{activeMeta.ramRequirement}</span>
                          </div>
                        </div>

                        <div className="space-y-1.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-zinc-400 font-bold flex items-center gap-1 text-[10px]">
                              <Zap className="w-3 h-3 text-white" /> Speed
                            </span>
                            <div className="flex items-center gap-1">
                              <div className="w-16 h-1 rounded-full bg-white/10 overflow-hidden">
                                <div className="h-full bg-white rounded-full" style={{ width: `${(activeMeta.speed / 5) * 100}%` }} />
                              </div>
                              <span className="text-[9px] font-black text-white font-mono">{activeMeta.speed}/5</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-zinc-400 font-bold flex items-center gap-1 text-[10px]">
                              <Brain className="w-3 h-3 text-white" /> Logic
                            </span>
                            <div className="flex items-center gap-1">
                              <div className="w-16 h-1 rounded-full bg-white/10 overflow-hidden">
                                <div className="h-full bg-white rounded-full" style={{ width: `${(activeMeta.reasoning / 5) * 100}%` }} />
                              </div>
                              <span className="text-[9px] font-black text-white font-mono">{activeMeta.reasoning}/5</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="text-[8px] text-zinc-500 pt-1 text-center uppercase tracking-widest font-extrabold flex items-center justify-center gap-1">
                        <Signal className="w-2.5 h-2.5 text-zinc-500" />
                        <span>{activeMeta.targetHardware}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={onClose}
                className="w-9 h-9 rounded-2xl bg-white/5 hover:bg-white/15 text-zinc-400 hover:text-white flex items-center justify-center transition-all border border-white/10"
              >
                <X className="w-5 h-5 stroke-[2.5]" />
              </button>
            </div>
          </div>

          {/* Fullscreen Body Workspace Split */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left Scope & Previous Chat History Sidebar */}
            <div className="w-80 bg-black/90 border-r border-zinc-800 p-5 flex flex-col justify-between shrink-0 space-y-5 font-mono">
              <div className="space-y-5 overflow-hidden flex flex-col h-full">
                {/* Search Mode Toggle (Grounded Notes vs General AI/Web) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[10px] text-zinc-400 font-bold tracking-widest uppercase">
                    <span>SEARCH MODE</span>
                    <span className="text-white font-extrabold">{searchMode === 'grounded' ? 'GROUNDED' : 'WEB / AI'}</span>
                  </div>
                  <div className="p-1 bg-zinc-900/90 rounded-2xl border border-zinc-800 grid grid-cols-2 gap-1 font-mono">
                    <button
                      onClick={() => setSearchMode('grounded')}
                      className={`py-2 rounded-xl text-[10px] font-extrabold uppercase transition-all text-center flex items-center justify-center gap-1 ${searchMode === 'grounded'
                        ? 'bg-white text-black shadow'
                        : 'text-zinc-400 hover:text-white'
                        }`}
                    >
                      <Bot className="w-3 h-3" />
                      <span>NOTES</span>
                    </button>
                    <button
                      onClick={() => setSearchMode('web')}
                      className={`py-2 rounded-xl text-[10px] font-extrabold uppercase transition-all text-center flex items-center justify-center gap-1 ${searchMode === 'web'
                        ? 'bg-white text-black shadow'
                        : 'text-zinc-400 hover:text-white'
                        }`}
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>WEB / AI</span>
                    </button>
                  </div>
                </div>

                {/* Compact Dropdown & Filter Chips Scope Selector */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-[10px] text-zinc-400 font-medium">
                    <div className="relative group flex items-center gap-1 cursor-help">
                      <span className="capitalize text-zinc-300">Knowledge Scope</span>
                      <span className="text-[10px] text-zinc-500 hover:text-zinc-300">ⓘ</span>

                      {/* Pure Minimalist Floating Tooltip (No Borders, Sentence Case) */}
                      <div className="absolute font-body left-0 top-full mt-1.5 w-52 p-2.5 rounded-xl bg-black/90 text-zinc-300 text-[12px] normal-case opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50 shadow-2xl leading-snug backdrop-blur-md">
                        Filters AI context to notes with this tag.
                      </div>
                    </div>
                    <button
                      onClick={() => setIsAddingScope(!isAddingScope)}
                      className="text-[9px] font-bold text-white bg-black/40 font-body hover:bg-white hover:text-black px-2 py-0.5 rounded-lg border border-zinc-700 transition"
                    >
                      + ADD
                    </button>
                  </div>

                  {/* Dropdown Select Menu for unlimited scopes */}
                  <div className="relative font-mono">
                    <select
                      value={scope}
                      onChange={(e) => setScope(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700/80 rounded-xl px-3 py-2 text-xs text-white uppercase font-bold appearance-none cursor-pointer focus:outline-none focus:border-white transition shadow-sm"
                    >
                      {customScopes.map(sc => (
                        <option key={sc} value={sc} className="bg-zinc-950 text-white font-mono">
                          {sc === scope ? `• ${sc.toUpperCase()} (ACTIVE)` : sc.toUpperCase()}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-3 top-3 pointer-events-none" />
                  </div>

                  {/* Inline Add Scope Input */}
                  {isAddingScope && (
                    <div className="flex items-center gap-1.5 pt-1">
                      <input
                        type="text"
                        placeholder="New tag (e.g. physics)..."
                        value={newScopeInput}
                        onChange={(e) => setNewScopeInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddScope();
                        }}
                        className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-1.5 text-[10px] text-white focus:outline-none focus:border-white font-mono"
                        autoFocus
                      />
                      <button
                        onClick={handleAddScope}
                        className="bg-white text-black text-[10px] font-black px-2.5 py-1.5 rounded-xl uppercase hover:bg-zinc-200 transition"
                      >
                        ADD
                      </button>
                    </div>
                  )}

                  {/* Quick-Access Top 4 Scope Pills */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {customScopes.slice(0, 4).map(sc => (
                      <button
                        key={sc}
                        onClick={() => setScope(sc)}
                        className={`px-2 py-1 rounded-lg text-[9px] font-extrabold uppercase transition-all font-mono border ${scope === sc
                          ? 'bg-white text-black border-white shadow-sm'
                          : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-white hover:border-zinc-700'
                          }`}
                      >
                        {sc}
                      </button>
                    ))}
                    {customScopes.length > 4 && (
                      <span className="text-[9px] text-zinc-500 font-mono py-1 px-1">+{customScopes.length - 4} more</span>
                    )}
                  </div>
                </div>

                <div className="h-px bg-zinc-800/80" />

                {/* Cyber-Deck Chat History */}
                <div className="flex-1 flex flex-col overflow-hidden space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-zinc-400" />
                      <span>THREADS</span>
                    </span>
                    <button
                      onClick={handleStartNewChat}
                      className="text-[10px] font-bold text-white bg-black/40 px-3 py-1 rounded-lg font-body hover:bg-white hover:text-black flex items-center gap-1 transition border border-zinc-700"
                    >
                      <span>+ NEW</span>
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                    {conversations.length > 0 ? (
                      conversations.map((item) => {
                        const isActive = activeConvId === item.id;
                        return (
                          <div
                            key={item.id}
                            onClick={() => loadConversationThread(item.id)}
                            className={`w-full text-left p-3 rounded-2xl transition-all space-y-1 group relative cursor-pointer border ${isActive
                              ? 'bg-zinc-100 text-black border-white font-extrabold shadow-md'
                              : 'bg-zinc-900/50 hover:bg-zinc-800/80 text-zinc-300 border-zinc-800/60 hover:border-zinc-700'
                              }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className={`font-bold text-xs truncate max-w-[150px] ${isActive ? 'text-black' : 'text-zinc-100'}`}>{item.title}</span>
                              <button
                                onClick={(e) => handleDeleteChat(e, item.id)}
                                className={`opacity-0 group-hover:opacity-100 p-1 rounded-lg transition-opacity ${isActive ? 'hover:bg-black/10 text-black' : 'hover:bg-zinc-700 text-zinc-400'}`}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                            <p className={`text-[10px] truncate ${isActive ? 'text-black/70' : 'text-zinc-400'}`}>{item.snippet || 'No messages'}</p>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-4 text-center text-zinc-500 text-[11px] space-y-2 my-auto">
                        <MessageSquare className="w-5 h-5 mx-auto text-zinc-600 opacity-60" />
                        <p>No saved threads.</p>
                        <p className="text-[9px] text-zinc-600">Your study notes conversations automatically save here.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Status Banner */}
              {ollamaStatus && !ollamaStatus.available && (
                <OfflineBanner show compact />
              )}
            </div>

            {/* Right Full-Height Stream Workspace */}
            <div className="flex-1 flex flex-col justify-between bg-[#030306] relative">
              {/* Chat Timeline Stream */}
              <div className="flex-1 p-8 overflow-y-auto space-y-6 max-w-4xl mx-auto w-full">
                {messages.map(msg => {
                  const isAI = msg.sender === 'ai';
                  return (
                    <div key={msg.id} className={`flex items-start gap-4 ${isAI ? '' : 'flex-row-reverse'}`}>
                      <div className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 font-bold ${isAI ? 'bg-white text-black shadow-lg' : 'bg-zinc-800 text-white border border-white/20'}`}>
                        {isAI ? <Sparkles className="w-4 h-4 text-black stroke-[2.5]" /> : <User className="w-4 h-4 text-white stroke-[2.5]" />}
                      </div>

                      <div className={`max-w-[80%] rounded-3xl p-5 space-y-3 leading-relaxed text-base ${isAI ? 'bg-white/[0.04] border border-white/15 text-zinc-100 shadow-2xl backdrop-blur-md' : 'bg-white text-black font-extrabold shadow-xl'}`}>
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                        {isAI && (msg as any).offline && (
                          <div className="flex items-center gap-1.5 mt-2 px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 w-fit">
                            <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Template Mode</span>
                          </div>
                        )}
                        {msg.sources && msg.sources.length > 0 && (
                          <div className="pt-3 mt-1 border-t border-white/10 text-xs space-y-2 font-sans">
                            <span className="font-semibold text-[11px] text-zinc-400 block tracking-tight">Grounded Sources</span>
                            <div className="grid gap-1.5">
                              {msg.sources.map((src, idx) => (
                                <div
                                  key={idx}
                                  className="group flex items-center justify-between bg-white/[0.03] hover:bg-white/[0.07] px-3.5 py-2 rounded-xl border border-white/5 hover:border-white/15 transition cursor-default"
                                >
                                  <span className="text-xs text-zinc-200 truncate font-medium">{src.title || src.id}</span>
                                  {src.type && (
                                    <span className="text-[10px] text-zinc-500 group-hover:text-zinc-400 capitalize px-2 py-0.5 rounded-md bg-white/5 font-mono">
                                      {src.type}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {isAI && (msg as any).suggestedBlock && (
                          <div className="pt-3 mt-1 border-t border-white/10 font-sans">
                            <div className="bg-gradient-to-r from-zinc-900/90 to-zinc-900/50 border border-white/10 p-3.5 rounded-2xl flex items-center justify-between gap-4 shadow-xl">
                              <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                  <span className="text-[10px] font-medium text-amber-400/90 tracking-wide uppercase">Suggested Block</span>
                                </div>
                                <h4 className="text-white font-semibold text-xs truncate">{(msg as any).suggestedBlock.title}</h4>
                                <p className="text-[11px] text-zinc-400">
                                  {(msg as any).suggestedBlock.category} · 45 mins
                                </p>
                              </div>
                              <button
                                onClick={async () => {
                                  try {
                                    const today = getTodayStr();
                                    await createBlock({
                                      title: (msg as any).suggestedBlock.title,
                                      category: (msg as any).suggestedBlock.category || 'Study',
                                      date: today,
                                      start_time: '16:00',
                                      end_time: '16:45',
                                      status: 'planned',
                                    });
                                    if (onRefreshData) onRefreshData();
                                    alert(`Added "${(msg as any).suggestedBlock.title}" to today's schedule!`);
                                  } catch (err) {
                                    console.error('Failed to add block from chat:', err);
                                  }
                                }}
                                className="px-3 py-1.5 bg-white hover:bg-zinc-200 text-black text-xs font-bold rounded-xl transition shrink-0 shadow-sm flex items-center gap-1"
                              >
                                <span>+ Add Block</span>
                              </button>
                            </div>
                          </div>
                        )}
                        <div className={`text-[9px] text-right pt-1 ${isAI ? 'text-zinc-500' : 'text-black/60 font-bold'}`}>{msg.timestamp}</div>
                      </div>
                    </div>
                  );
                })}

                {isLoading && (
                  <div className="flex items-center gap-3 font-mono">
                    <div className="w-8 h-8 rounded-xl bg-white text-black flex items-center justify-center font-bold shadow-md">
                      <Sparkles className="w-4 h-4 text-black animate-spin" />
                    </div>
                    <div className="bg-zinc-900 border border-zinc-700/80 rounded-2xl px-4 py-2 text-xs text-zinc-200 flex items-center gap-2 shadow-xl">
                      <span className="font-bold text-white uppercase">{activeModel}</span>
                      <span className="text-zinc-500">•</span>
                      <span className="text-amber-400 font-bold">Est. ~3-8 secs</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Centered Floating Input Dock */}
              <div className="p-6 bg-[#030306]/90 border-t border-white/10">
                <form onSubmit={handleSend} className="max-w-4xl mx-auto flex items-center gap-3">
                  <input
                    type="text"
                    placeholder="Ask anything grounded in your study notes..."
                    value={inputQuery}
                    onChange={(e) => setInputQuery(e.target.value)}
                    className="flex-1 bg-white/[0.05] border border-white/15 rounded-2xl px-5 py-4 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white/40 transition-all shadow-inner"
                  />
                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.95 }}
                    type="submit"
                    disabled={isLoading || !inputQuery.trim()}
                    className="bg-white hover:bg-zinc-200 text-black p-4 rounded-2xl transition disabled:opacity-40 shadow-[0_0_25px_rgba(255,255,255,0.25)]"
                  >
                    <Send className="w-4 h-4 stroke-[2.5]" />
                  </motion.button>
                </form>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
