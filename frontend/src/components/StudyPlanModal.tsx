import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, FileCode2, WifiOff, Compass, Tv, Calendar } from 'lucide-react';
import { generateStudyPlan, recommendChannels, parseMarkdown, createBlocksBatch, createResourcesBatch } from '../api';
import { OfflineBanner } from './OfflineBanner';
import { getTodayStr } from '../utils/dateUtils';
import {
  OutlineBlock,
  OutlineResource,
  RecommendedChannel,
  SkillLevel,
  LearningGoal,
  WizardGenStep,
  StudyPlanModalTab,
  SearchedResource,
  SearchMeta,
  VideoType,
} from './studyPlan/types';
import { StudyPlanDiagnosticForm } from './studyPlan/StudyPlanDiagnosticForm';
import { StudyPlanChannelSelector } from './studyPlan/StudyPlanChannelSelector';
import { StudyPlanWorkspace } from './studyPlan/StudyPlanWorkspace';
import { StudyPlanMarkdownImporter } from './studyPlan/StudyPlanMarkdownImporter';

interface StudyPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshData: () => void;
  selectedModel: string;
}

export const StudyPlanModal: React.FC<StudyPlanModalProps> = ({
  isOpen,
  onClose,
  onRefreshData,
  selectedModel,
}) => {
  const [activeTab, setActiveTab] = useState<StudyPlanModalTab>('generator');

  // Generator Parameters
  const [topic, setTopic] = useState('');
  const [category, setCategory] = useState('Study');
  const [startDate, setStartDate] = useState(getTodayStr());
  const [hoursPerDay, setHoursPerDay] = useState(2);
  const [durationDays, setDurationDays] = useState(7);
  const [skillLevel, setSkillLevel] = useState<SkillLevel>('beginner');
  const [learningGoal, setLearningGoal] = useState<LearningGoal>('comprehensive');
  const [learningContext, setLearningContext] = useState(''); // What user wants to build/achieve
  const [specificFocus, setSpecificFocus] = useState('');   // Specific subtopic to focus on
  const [videoType, setVideoType] = useState<VideoType>('playlist');
  const [longCourseUrl, setLongCourseUrl] = useState('');

  // Channel state
  const [allRecommendedChannels, setAllRecommendedChannels] = useState<RecommendedChannel[]>([]);
  /** Current batch index (0-based). Each batch shows 3 completely new unpinned channels. */
  const [channelBatch, setChannelBatch] = useState(0);
  const CHANNELS_PER_BATCH = 3;

  // Wizard Steps: 'parameters' -> 'channels' -> 'review'
  const [genStep, setGenStep] = useState<WizardGenStep>('parameters');
  const [isGenerating, setIsGenerating] = useState(false);

  // Outline Review State
  const [outlineBlocks, setOutlineBlocks] = useState<OutlineBlock[]>([]);
  const [outlineResources, setOutlineResources] = useState<OutlineResource[]>([]);
  const [isConfirmingGen, setIsConfirmingGen] = useState(false);
  const [genSuccessMsg, setGenSuccessMsg] = useState<string | null>(null);
  const [isOfflinePlan, setIsOfflinePlan] = useState(false);

  // Resource search results from the pipeline
  const [searchedResources, setSearchedResources] = useState<SearchedResource[]>([]);
  const [searchMeta, setSearchMeta] = useState<SearchMeta | null>(null);

  // Markdown Parser State
  const [mdContent, setMdContent] = useState('');
  const [mdCategory, setMdCategory] = useState('GPT Import');
  const [isParsing, setIsParsing] = useState(false);
  const [parsedBlocks, setParsedBlocks] = useState<Array<OutlineBlock & { selected: boolean }>>([]);
  const [parsedResources, setParsedResources] = useState<Array<OutlineResource & { selected: boolean }>>([]);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Helper to extract clickable URLs from notes text
  const extractUrls = (text: string) => {
    if (!text) return [];
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = text.match(urlRegex) || [];
    return Array.from(new Set(matches));
  };

  const [isFetchingChannels, setIsFetchingChannels] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);

  React.useEffect(() => {
    let interval: any;
    if (isFetchingChannels || isGenerating) {
      setLoadingStep(0);
      interval = setInterval(() => {
        setLoadingStep((prev) => prev + 1);
      }, 2500);
    } else {
      setLoadingStep(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isFetchingChannels, isGenerating]);

  // Phase 1: Fetch Recommended YT Channels for Topic via AI Search
  const handleFetchChannels = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setIsFetchingChannels(true);
    try {
      const res = await recommendChannels({
        topic: topic.trim(),
        skill_level: skillLevel,
        learning_goal: learningGoal,
        learning_context: learningContext.trim(),
        specific_focus: specificFocus.trim(),
        video_type: videoType,
      });

      if (res.channels && res.channels.length > 0) {
        // Assign rank (1-based) based on position returned by backend (already sorted best-first)
        const ranked: RecommendedChannel[] = res.channels.map((ch: RecommendedChannel, idx: number) => ({
          ...ch,
          rank: idx + 1,
          selected: idx < 3,   // auto-select top 3
          pinned: false,
        }));
        setAllRecommendedChannels(ranked);
      } else {
        // Minimal fallback — at least 3 search-based entries
        const t = topic.trim();
        const enc = encodeURIComponent(t);
        setAllRecommendedChannels([
          { name: `${t} Full Course`, handle: `@search`, description: `Full course search results for ${t}.`, url: `https://www.youtube.com/results?search_query=${enc}+full+course`, playlistLength: 'Multiple', approxTime: 'Varies', selected: true, rank: 1, pinned: false },
          { name: `${t} Tutorial (freeCodeCamp)`, handle: `@freecodecamp`, description: `freeCodeCamp comprehensive guide for ${t}.`, url: `https://www.youtube.com/results?search_query=freecodecamp+${enc}`, playlistLength: 'Full Bootcamp', approxTime: '~8 hrs', selected: true, rank: 2, pinned: false },
          { name: `${t} Crash Course`, handle: `@search`, description: `Quick crash course videos for ${t}.`, url: `https://www.youtube.com/results?search_query=${enc}+crash+course`, playlistLength: '~10 Videos', approxTime: '~2 hrs', selected: false, rank: 3, pinned: false },
        ]);
      }
      setChannelBatch(0);
      setGenStep('channels');
    } catch (err) {
      console.error('Failed to fetch recommended channels:', err);
    } finally {
      setIsFetchingChannels(false);
    }
  };

  /**
   * Pin / unpin a channel by URL.
   * Pinned channels are always visible and survive "Suggest Other" rotations.
   */
  const togglePin = (url: string) => {
    setAllRecommendedChannels(prev =>
      prev.map(c => (c.url === url ? { ...c, pinned: !c.pinned, selected: !c.pinned ? true : c.selected } : c))
    );
  };

  /**
   * Suggest Other Channels — advances to the next BATCH of unpinned channels.
   * Each batch is a clean non-overlapping slice: batch 0 = [0,1,2], batch 1 = [3,4,5], etc.
   * Pinned channels are never in the rotation pool.
   */
  const handleSuggestOtherChannels = () => {
    const unpinned = allRecommendedChannels.filter(c => !c.pinned);
    if (unpinned.length === 0) return;
    const totalBatches = Math.ceil(unpinned.length / CHANNELS_PER_BATCH);
    setChannelBatch(prev => (prev + 1) % totalBatches);
  };

  // Channel Selection Toggle
  const toggleChannelSelect = (url: string) => {
    setAllRecommendedChannels((prev) =>
      prev.map((c) => (c.url === url ? { ...c, selected: !c.selected } : c))
    );
  };

  // Add Custom Channel / Playlist — called from the selector with the input value
  const handleAddCustomChannel = (inputValue: string) => {
    if (!inputValue.trim()) return;

    const input = inputValue.trim();
    let name = input;
    let url = input;

    if (!input.startsWith('http')) {
      name = input.startsWith('@') ? input : `@${input}`;
      url = `https://www.youtube.com/${name}`;
    }

    const newCh: RecommendedChannel = {
      name: `Custom: ${name}`,
      handle: name.startsWith('@') ? name : '@custom_resource',
      description: `User-provided custom channel or playlist resource for ${topic || 'Study'}.`,
      url,
      playlistLength: 'Custom Playlist',
      approxTime: 'Flexible Pace',
      selected: true,
      pinned: true,  // custom channels are auto-pinned
      rank: 0,       // rank 0 = shows first
      source: 'custom',
    };

    setAllRecommendedChannels((prev) => [newCh, ...prev]);
  };


  // Phase 2: Generate Study Plan Outline based on Selected Channels & Parameters
  const handleGenerateOutline = async () => {
    const selectedChannels = allRecommendedChannels.filter((c) => c.selected);
    if (!topic.trim() || selectedChannels.length === 0) return;

    setIsGenerating(true);
    setGenSuccessMsg(null);
    setSearchedResources([]);
    setSearchMeta(null);

    try {
      const channelNames = selectedChannels.map((c) => c.name);

      const res = await generateStudyPlan({
        topic: topic.trim(),
        durationDays: durationDays,
        hoursPerDay: hoursPerDay,
        category: category.trim() || 'Study',
        startDate: startDate,
        referenceUrl: selectedChannels.length > 0 ? selectedChannels[0].url : '',
        selectedChannels: selectedChannels,
        model: selectedModel,
        skillLevel,
        learningGoal,
        videoType,
        longCourseUrl: longCourseUrl.trim(),
        learningContext: [
          learningContext.trim(),
          specificFocus.trim(),
        ].filter(Boolean).join('. '), // Combine both context fields
      });

      // Capture search results from the pipeline
      if (res.searchedResources && Array.isArray(res.searchedResources)) {
        setSearchedResources(res.searchedResources);
      }
      if (res.searchMeta) {
        setSearchMeta(res.searchMeta);
      }

      const blocksList = res.blocks || (res.data?.outline?.blocks);
      const resourcesList = res.resources || (res.data?.outline?.resources);

      if (blocksList && Array.isArray(blocksList)) {
        const blocksWithId: OutlineBlock[] = blocksList.map(
          (b: any, idx: number) => ({
            tempId: `gen_b_${idx}_${Date.now()}`,
            title: b.title || 'Study Session',
            category: b.category || category.trim() || 'Study',
            date: b.date || startDate,
            start_time: b.start_time || '09:00',
            end_time: b.end_time || '10:30',
            custom_link: b.custom_link || (selectedChannels[0] ? selectedChannels[0].url : ''),
            notes: b.notes || '',
          })
        );

        const resourcesWithId: OutlineResource[] = (resourcesList || []).map(
          (r: any, idx: number) => ({
            tempId: `gen_r_${idx}_${Date.now()}`,
            title: r.title || 'Resource Link',
            type: r.type || 'link',
            url_or_content: r.url_or_content || (selectedChannels[0] ? selectedChannels[0].url : ''),
          })
        );

        setOutlineBlocks(blocksWithId);
        setOutlineResources(resourcesWithId);
        setIsOfflinePlan(!!res.offline);
        setGenStep('review');
      }
    } catch (err) {
      console.error('Failed to generate study plan outline:', err);
      setGenSuccessMsg('Failed to generate outline. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Card Block Update Handlers
  const updateOutlineBlock = (tempId: string, field: keyof OutlineBlock, value: any) => {
    setOutlineBlocks((prev) =>
      prev.map((b) => (b.tempId === tempId ? { ...b, [field]: value } : b))
    );
  };

  const deleteOutlineBlock = (tempId: string) => {
    setOutlineBlocks((prev) => prev.filter((b) => b.tempId !== tempId));
  };

  const addExtraOutlineBlock = () => {
    const lastBlock = outlineBlocks[outlineBlocks.length - 1];
    const newBlock: OutlineBlock = {
      tempId: `gen_b_add_${Date.now()}`,
      title: `${topic || 'Topic'} - Additional Deep Dive Session`,
      category: category.trim() || 'Study',
      date: lastBlock ? lastBlock.date : startDate,
      start_time: '14:00',
      end_time: '15:30',
      custom_link: allRecommendedChannels[0] ? allRecommendedChannels[0].url : '',
      notes: `Key Concepts: Comprehensive practice & code implementation.\nRecommended Docs: https://developer.mozilla.org`,
    };
    setOutlineBlocks((prev) => [...prev, newBlock]);
  };

  const addExtraOutlineResource = () => {
    const newRes: OutlineResource = {
      tempId: `gen_r_add_${Date.now()}`,
      title: `${topic || 'Topic'} Official Documentation & Reference Guide`,
      type: 'link',
      url_or_content: 'https://dev.to',
    };
    setOutlineResources((prev) => [...prev, newRes]);
  };

  // Confirm Generated Plan & Add to Backend Schedule — uses batch endpoints:
  // 2 HTTP calls + 1 telemetry recalc per unique date instead of N calls + N recalcs.
  const handleConfirmGeneratedPlan = async () => {
    if (outlineBlocks.length === 0 && outlineResources.length === 0) return;
    setIsConfirmingGen(true);

    try {
      const blockPayloads = outlineBlocks.map((b) => ({
        title: b.title,
        category: b.category,
        date: b.date,
        start_time: b.start_time,
        end_time: b.end_time,
        custom_link: b.custom_link || '',
        notes: b.notes || '',
        status: 'planned',
      }));

      const resourcePayloads = outlineResources.map((r) => ({
        title: r.title,
        type: r.type,
        url_or_content: r.url_or_content,
      }));

      await Promise.all([
        blockPayloads.length > 0 ? createBlocksBatch(blockPayloads) : Promise.resolve(),
        resourcePayloads.length > 0 ? createResourcesBatch(resourcePayloads) : Promise.resolve(),
      ]);

      setGenSuccessMsg(`Successfully added ${outlineBlocks.length} blocks and ${outlineResources.length} resources!`);
      onRefreshData();
      setTimeout(() => {
        onClose();
        setGenStep('parameters');
        setOutlineBlocks([]);
        setOutlineResources([]);
        setGenSuccessMsg(null);
      }, 1200);
    } catch (err) {
      console.error('Failed to save study plan:', err);
      setGenSuccessMsg('Error adding items to schedule. Please try again.');
    } finally {
      setIsConfirmingGen(false);
    }
  };

  // Markdown Parser Handlers
  const handleParseMarkdown = async () => {
    if (!mdContent.trim()) return;
    setIsParsing(true);

    try {
      const res = await parseMarkdown(mdContent, mdCategory, startDate);
      const rawBlocks = res.data?.blocks || res.parsedBlocks || res.blocks || [];
      const rawResources = res.data?.resources || res.parsedResources || res.resources || [];

      if (rawBlocks.length > 0 || rawResources.length > 0) {
        const blocks = rawBlocks.map((b: any, idx: number) => ({
          ...b,
          tempId: `parsed_b_${idx}_${Date.now()}`,
          selected: true,
        }));
        const resources = rawResources.map((r: any, idx: number) => ({
          ...r,
          tempId: `parsed_r_${idx}_${Date.now()}`,
          selected: true,
        }));

        setParsedBlocks(blocks);
        setParsedResources(resources);
      }
    } catch (err) {
      console.error('Failed to parse markdown:', err);
      setImportSuccessMsg('Error parsing markdown content.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (text) {
        setMdContent(text);
      }
    };
    reader.readAsText(file);
  };

  const handleImportSelected = async () => {
    const selectedB = parsedBlocks.filter((b) => b.selected);
    const selectedR = parsedResources.filter((r) => r.selected);

    if (selectedB.length === 0 && selectedR.length === 0) return;
    setIsImporting(true);

    try {
      const blockPayloads = selectedB.map((b) => {
        let notes = b.notes || '';
        if (b.links && b.links.length > 1) {
          const extraLinks = b.links.slice(1).map((lnk: string) => `- ${lnk}`).join('\n');
          notes = notes ? `${notes}\n\nAdditional Resources:\n${extraLinks}` : `Additional Resources:\n${extraLinks}`;
        }
        return {
          title: b.title,
          category: b.category,
          date: b.date,
          start_time: b.start_time,
          end_time: b.end_time,
          custom_link: b.custom_link || '',
          notes,
          status: 'planned',
        };
      });

      const resourcePayloads = selectedR.map((r) => ({
        title: r.title,
        type: r.type,
        url_or_content: r.url_or_content,
      }));

      await Promise.all([
        blockPayloads.length > 0 ? createBlocksBatch(blockPayloads) : Promise.resolve(),
        resourcePayloads.length > 0 ? createResourcesBatch(resourcePayloads) : Promise.resolve(),
      ]);

      setImportSuccessMsg(`Imported ${selectedB.length} blocks and ${selectedR.length} resources!`);
      setParsedBlocks([]);
      setParsedResources([]);
      setMdContent('');
      onRefreshData();
    } catch (err) {
      console.error('Failed to import items:', err);
      setImportSuccessMsg('Error importing items. Please try again.');
    } finally {
      setIsImporting(false);
    }
  };

  // Compute visible channels:
  // 1. Always show all pinned channels first (sorted by rank)
  // 2. Fill the rest with the current BATCH of unpinned channels (strictly non-overlapping slices)
  // 3. Guarantee at least 3 total channels shown by showing pinned + up to 3 unpinned
  const pinnedChannels = allRecommendedChannels
    .filter(c => c.pinned)
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  const unpinnedPool = allRecommendedChannels
    .filter(c => !c.pinned)
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));

  // Batch slice: strictly non-overlapping. Last batch may be smaller than 3.
  const batchStart = channelBatch * CHANNELS_PER_BATCH;
  const unpinnedSlice = unpinnedPool.slice(batchStart, batchStart + CHANNELS_PER_BATCH);

  // If last batch has fewer than 3 and we need min 3 total (with no pinned), backfill from start
  // but only if the pool has enough channels to show something different.
  const visibleUnpinned = unpinnedSlice.length > 0
    ? unpinnedSlice
    : unpinnedPool.slice(0, CHANNELS_PER_BATCH); // fallback to first batch if something went wrong

  const visibleChannels = [
    ...pinnedChannels,
    ...visibleUnpinned.filter(u => !pinnedChannels.find(p => p.url === u.url)),
  ];

  // True when there is at least one more batch of completely new channels after the current one
  const totalBatches = Math.ceil(unpinnedPool.length / CHANNELS_PER_BATCH);
  const hasMoreChannels = totalBatches > 1;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-lg flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
        >
          <motion.div
            initial={{ scale: 0.98, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.98, opacity: 0, y: 10 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="bg-[#09090b] rounded-3xl p-5 sm:p-6 max-w-[1520px] w-[98vw] h-[95vh] shadow-2xl relative text-xs flex flex-col my-auto overflow-hidden"
          >
            {/* Streamlined Studio Workspace Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/5 shrink-0 gap-4 relative">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-white text-black flex items-center justify-center font-bold shadow-md">
                  <Sparkles className="w-4 h-4 text-black fill-black" />
                </div>
                <div className="flex items-center gap-2.5">
                  <h2 className="font-extrabold text-lg sm:text-xl text-white tracking-tight">
                    Study Plan Studio
                  </h2>

                  {/* Integrated Offline Status Pill */}
                  {isOfflinePlan && (
                    <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 ml-2">
                      <WifiOff className="w-3 h-3 text-amber-400" />
                      <span>Ollama Offline</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Segmented Tab Switcher merged here to save vertical row */}
              {genStep !== 'review' && (
                <div className="hidden md:flex items-center gap-6 font-heading text-sm self-stretch relative -mb-3">
                  <button
                    onClick={() => setActiveTab('generator')}
                    className="relative pb-3 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Sparkles className="w-4 h-4 text-zinc-450" />
                    <span className={`font-extrabold tracking-wider transition-colors ${
                      activeTab === 'generator' ? 'text-white' : 'text-zinc-500 hover:text-zinc-350'
                    }`}>
                      AI Wizard
                    </span>
                    {activeTab === 'generator' && (
                      <motion.div
                        layoutId="activeTabUnderline"
                        className="absolute bottom-[-1px] left-0 right-0 h-[2.5px] bg-white rounded-full z-10"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab('markdown')}
                    className="relative pb-3 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <FileCode2 className="w-4 h-4 text-zinc-450" />
                    <span className={`font-extrabold tracking-wider transition-colors ${
                      activeTab === 'markdown' ? 'text-white' : 'text-zinc-500 hover:text-zinc-350'
                    }`}>
                      Import Markdown
                    </span>
                    {activeTab === 'markdown' && (
                      <motion.div
                        layoutId="activeTabUnderline"
                        className="absolute bottom-[-1px] left-0 right-0 h-[2.5px] bg-white rounded-full z-10"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                  </button>
                </div>
              )}

              <button
                onClick={onClose}
                className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800/60 rounded-xl transition-colors cursor-pointer"
                title="Close Studio"
              >
                <X className="w-4.5 h-4.5 text-zinc-400 hover:text-white" />
              </button>
            </div>

            {/* AI THINKING LOADING OVERLAY */}
            {(isFetchingChannels || isGenerating) && (() => {
              const fetchingSteps = [
                { text: "Initializing search queries & parameters", done: loadingStep > 0, active: loadingStep === 0 },
                { text: `Searching top creators & playlists for "${topic}"`, done: loadingStep > 1, active: loadingStep === 1 },
                { text: "Verifying video URLs & chapter metadata", done: loadingStep > 2, active: loadingStep === 2 },
                { text: "Filtering out low-quality/outdated listings", done: loadingStep > 3, active: loadingStep === 3 },
                { text: loadingStep > 4 
                    ? (loadingStep === 5 ? "Running deep search on channel directories..." : "Contacting secondary playlist indexer...") 
                    : "Ranking matches based on curriculum suitability", 
                  done: false, 
                  active: loadingStep >= 4 
                },
              ];

              const generatingSteps = [
                { text: "Analyzing playlist topics & course flow", done: loadingStep > 0, active: loadingStep === 0 },
                { text: `Slicing chapters for ${hoursPerDay}h/day over ${durationDays} days`, done: loadingStep > 1, active: loadingStep === 1 },
                { text: "Generating block schedules & timetables", done: loadingStep > 2, active: loadingStep === 2 },
                { text: "Injecting active-recall notes & learning steps", done: loadingStep > 3, active: loadingStep === 3 },
                { text: loadingStep === 4 
                    ? "Assembling final workspace calendar layout"
                    : loadingStep === 5 
                    ? "Compiling custom markdown definitions..." 
                    : "Linking YouTube timestamps & lecture sections...", 
                  done: false, 
                  active: loadingStep >= 4 
                },
              ];

              const steps = isFetchingChannels ? fetchingSteps : generatingSteps;
              const currentStepObj = steps.find(s => s.active) || steps[steps.length - 1];
              
              // Asymptotic progress calculation (starts at 15%, gets closer to 99% but never hits 100%)
              const progressPercent = Math.min(
                99,
                Math.round(100 - 85 * Math.pow(0.75, loadingStep))
              );

              return (
                <div className="absolute inset-0 z-40 bg-zinc-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 space-y-8 select-none">
                  {/* Glowing Orbit Spinner Centerpiece */}
                  <div className="relative flex items-center justify-center w-28 h-28">
                    {/* Ring 1 - Outer slow spin */}
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 10, ease: "linear" }}
                      className="absolute inset-0 rounded-full border border-dashed border-white/20"
                    />
                    {/* Ring 2 - Inner fast counter-spin */}
                    <motion.div
                      animate={{ rotate: -360 }}
                      transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                      className="absolute inset-2 rounded-full border border-white/10 border-t-white/40"
                    />
                    {/* Center Text Indicator */}
                    <div className="flex flex-col items-center justify-center z-10">
                      <span className="text-xl font-bold text-white tracking-tighter">{progressPercent}%</span>
                      <span className="text-[8px] font-heading text-zinc-500 uppercase tracking-widest">Load</span>
                    </div>
                  </div>

                  {/* Heading & Status Text */}
                  <div className="text-center space-y-2 max-w-md">
                    <h4 className="font-heading font-black text-lg text-white tracking-tight">
                      {isFetchingChannels ? 'AI Searching YouTube...' : 'Generating Course Syllabus...'}
                    </h4>
                    <p className="font-body text-2xs text-zinc-500 uppercase tracking-widest animate-pulse h-4">
                      Current Task: {currentStepObj.text}
                    </p>
                  </div>

                  {/* Terminal Log Panel */}
                  <div className="w-full max-w-md bg-black/60 border border-white/5 rounded-2xl p-5 space-y-3 font-body text-[10px] text-zinc-400 shadow-2xl relative overflow-hidden">
                    <div className="flex items-center justify-between text-2xs text-zinc-600 border-b border-white/5 pb-2 uppercase tracking-wider">
                      <span>Pipeline Log</span>
                      <span className="animate-pulse">Active</span>
                    </div>

                    <div className="space-y-2.5 pt-1.5">
                      {steps.map((stepItem, idx) => (
                        <div
                          key={idx}
                          className={`flex items-center gap-2.5 transition-colors duration-300 ${
                            stepItem.done 
                              ? 'text-zinc-400' 
                              : stepItem.active 
                              ? 'text-white font-bold animate-pulse' 
                              : 'text-zinc-700'
                          }`}
                        >
                          <span className="shrink-0 font-bold">
                            {stepItem.done ? (
                              <span className="text-white bg-white/10 rounded px-1 text-[8px] py-0.5">✓ Done</span>
                            ) : stepItem.active ? (
                              <span className="text-black bg-white rounded px-1 text-[8px] py-0.5 animate-pulse">Running</span>
                            ) : (
                              <span className="text-zinc-800 border border-zinc-800 rounded px-1 text-[8px] py-0.5">Queued</span>
                            )}
                          </span>
                          <span className="truncate">{stepItem.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-64 space-y-2">
                    <div className="h-1 bg-zinc-900 rounded-full overflow-hidden border border-white/5">
                      <motion.div
                        className="h-full bg-white"
                        initial={{ width: '15%' }}
                        animate={{ width: `${progressPercent}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] text-zinc-600">
                      <span>Progress</span>
                      <span>{progressPercent}%</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Studio Workspace Body */}
            <div className="flex-grow flex min-h-0 mt-6 overflow-hidden">
              {/* Left Sidebar Stepper (only visible for generator wizard, not markdown import or review step) */}
              {activeTab === 'generator' && genStep !== 'review' && (
                <div className="w-44 shrink-0 hidden md:flex flex-col justify-between py-6 font-heading h-full relative">
                  <div className="flex-1 flex flex-col justify-around items-start w-full relative pl-6">
                    {/* Step 1 */}
                    <div 
                      onClick={() => setGenStep('parameters')}
                      className="flex items-center gap-3 cursor-pointer w-full py-4 relative z-20"
                    >
                      <motion.div
                        animate={{
                          height: genStep === 'parameters' ? 48 : 24,
                          backgroundColor: genStep === 'parameters' ? '#ffffff' : 'rgba(255,255,255,0.1)',
                          opacity: genStep === 'parameters' ? 1 : 0.4
                        }}
                        transition={{ duration: 0.35, ease: 'easeInOut' }}
                        className="w-1.5 rounded-full shrink-0 shadow-sm"
                      />
                      
                      <div className="flex items-center gap-2">
                        <Compass className={`w-4 h-4 transition-all duration-300 ${
                          genStep === 'parameters' ? 'text-white opacity-100' : 'text-zinc-500 opacity-40'
                        }`} />
                        
                        <AnimatePresence>
                          {genStep === 'parameters' && (
                            <motion.span
                              initial={{ opacity: 0, x: -6 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -6 }}
                              className="text-xs sm:text-sm font-heading font-extrabold tracking-wider uppercase text-white whitespace-nowrap z-20"
                            >
                              Goals &amp; Hours
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    {/* Step 2 */}
                    <div 
                      onClick={() => setGenStep('channels')}
                      className="flex items-center gap-3 cursor-pointer w-full py-4 relative z-20"
                    >
                      <motion.div
                        animate={{
                          height: genStep === 'channels' ? 48 : 24,
                          backgroundColor: genStep === 'channels' ? '#ffffff' : 'rgba(255,255,255,0.1)',
                          opacity: genStep === 'channels' ? 1 : 0.4
                        }}
                        transition={{ duration: 0.35, ease: 'easeInOut' }}
                        className="w-1.5 rounded-full shrink-0 shadow-sm"
                      />

                      <div className="flex items-center gap-2">
                        <Tv className={`w-4 h-4 transition-all duration-300 ${
                          genStep === 'channels' ? 'text-white opacity-100' : 'text-zinc-500 opacity-40'
                        }`} />

                        <AnimatePresence>
                          {genStep === 'channels' && (
                            <motion.span
                              initial={{ opacity: 0, x: -6 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -6 }}
                              className="text-xs sm:text-sm font-heading font-extrabold tracking-wider uppercase text-white whitespace-nowrap z-20"
                            >
                              YT Channels
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    {/* Step 3 */}
                    <div className="flex items-center gap-3 cursor-pointer w-full py-4 z-20">
                      <motion.div
                        animate={{
                          height: genStep === 'review' ? 48 : 24,
                          backgroundColor: genStep === 'review' ? '#ffffff' : 'rgba(255,255,255,0.1)',
                          opacity: genStep === 'review' ? 1 : 0.4
                        }}
                        transition={{ duration: 0.35, ease: 'easeInOut' }}
                        className="w-1.5 rounded-full shrink-0 shadow-sm"
                      />

                      <div className="flex items-center gap-2">
                        <Calendar className={`w-4 h-4 transition-all duration-300 ${
                          genStep === 'review' ? 'text-white opacity-100' : 'text-zinc-500 opacity-40'
                        }`} />

                        <AnimatePresence>
                          {genStep === 'review' && (
                            <motion.span
                              initial={{ opacity: 0, x: -6 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -6 }}
                              className="text-xs sm:text-sm font-heading font-extrabold tracking-wider uppercase text-white whitespace-nowrap z-20"
                            >
                              Schedule
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Main Content Area */}
              <div className="flex-grow overflow-hidden min-h-0 pl-4 md:pl-8">
                {/* PHASE 1A: Diagnostic Questions & Commitment Hours */}
                {activeTab === 'generator' && genStep === 'parameters' && (
                  <StudyPlanDiagnosticForm
                    topic={topic}
                    setTopic={setTopic}
                    hoursPerDay={hoursPerDay}
                    setHoursPerDay={setHoursPerDay}
                    durationDays={durationDays}
                    setDurationDays={setDurationDays}
                    skillLevel={skillLevel}
                    setSkillLevel={setSkillLevel}
                    learningGoal={learningGoal}
                    setLearningGoal={setLearningGoal}
                    learningContext={learningContext}
                    setLearningContext={setLearningContext}
                    specificFocus={specificFocus}
                    setSpecificFocus={setSpecificFocus}
                    videoType={videoType}
                    setVideoType={setVideoType}
                    longCourseUrl={longCourseUrl}
                    setLongCourseUrl={setLongCourseUrl}
                    category={category}
                    setCategory={setCategory}
                    startDate={startDate}
                    setStartDate={setStartDate}
                    onSubmit={handleFetchChannels}
                    isFetchingChannels={isFetchingChannels}
                  />
                )}

                {activeTab === 'generator' && genStep === 'channels' && (
                  <StudyPlanChannelSelector
                    topic={topic}
                    visibleChannels={visibleChannels}
                    allRecommendedChannels={allRecommendedChannels}
                    toggleChannelSelect={toggleChannelSelect}
                    togglePin={togglePin}
                    onSuggestOtherChannels={handleSuggestOtherChannels}
                    onAddCustomChannel={handleAddCustomChannel}
                    onBackToParameters={() => setGenStep('parameters')}
                    onGenerateOutline={handleGenerateOutline}
                    isGenerating={isGenerating}
                    hasMoreChannels={hasMoreChannels}
                  />
                )}



                {/* PHASE 2: Schedule Workspace */}
                {activeTab === 'generator' && genStep === 'review' && (
                  <div className="flex flex-col h-full gap-3">
                    <StudyPlanWorkspace
                    topic={topic}
                    outlineBlocks={outlineBlocks}
                    outlineResources={outlineResources}
                    updateOutlineBlock={updateOutlineBlock}
                    deleteOutlineBlock={deleteOutlineBlock}
                    addExtraOutlineBlock={addExtraOutlineBlock}
                    addExtraOutlineResource={addExtraOutlineResource}
                    extractUrls={extractUrls}
                    genSuccessMsg={genSuccessMsg}
                    onBackToChannels={() => setGenStep('channels')}
                    onConfirmGeneratedPlan={handleConfirmGeneratedPlan}
                    isConfirmingGen={isConfirmingGen}
                    searchedResources={searchedResources}
                    searchMeta={searchMeta}
                    />
                  </div>
                )}


                {/* Tab 2: GPT Markdown Importer */}
                {activeTab === 'markdown' && (
                  <StudyPlanMarkdownImporter
                    mdContent={mdContent}
                    setMdContent={setMdContent}
                    mdCategory={mdCategory}
                    setMdCategory={setMdCategory}
                    startDate={startDate}
                    setStartDate={setStartDate}
                    handleFileUpload={handleFileUpload}
                    handleParseMarkdown={handleParseMarkdown}
                    isParsing={isParsing}
                    parsedBlocks={parsedBlocks}
                    setParsedBlocks={setParsedBlocks}
                    parsedResources={parsedResources}
                    setParsedResources={setParsedResources}
                    handleImportSelected={handleImportSelected}
                    isImporting={isImporting}
                    importSuccessMsg={importSuccessMsg}
                  />
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
