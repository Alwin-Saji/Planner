import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Youtube, Link as LinkIcon, Plus, Search, Trash2, ExternalLink, FileText, X, Tag, Globe, Play, Copy, Check, Sparkles, Cloud } from 'lucide-react';
import { Resource, ResourceType } from '../types';
import { fetchYouTubeOembed } from '../api';

interface ResourcesLibraryProps {
  resources: Resource[];
  onCreateResource: (
    resourceData: Partial<Resource>,
    file?: File,
    options?: { summarize?: boolean; model?: string }
  ) => void;
  onDeleteResource: (id: string) => void;
  installedModels?: string[];
  allModels?: string[];
}

const renderFormattedText = (text: string, isSummary: boolean = false) => {
  if (!text) return null;
  const lines = text.split('\n');

  return (
    <div className="space-y-2 font-sans">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1.5" />;

        const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ');
        const cleanLine = isBullet ? trimmed.replace(/^[-*•]\s*/, '') : trimmed;
        const isHeader = /^#+\s/.test(trimmed) || (/^\*\*.+\*\*:?$/.test(trimmed) && !isBullet);

        const parseInline = (str: string) => {
          const parts = str.split(/(\*\*.*?\*\*|https?:\/\/[^\s]+)/g);
          return parts.map((part, pIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              const boldText = part.slice(2, -2);
              return (
                <strong
                  key={pIdx}
                  className={isSummary ? 'font-bold text-emerald-300' : 'font-bold text-white'}
                >
                  {boldText}
                </strong>
              );
            } else if (part.startsWith('http://') || part.startsWith('https://')) {
              return (
                <a
                  key={pIdx}
                  href={part}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-blue-400 hover:text-blue-300 underline underline-offset-2 break-all inline-flex items-center gap-1 font-mono text-xs"
                >
                  {part} <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              );
            }
            return part;
          });
        };

        if (isBullet) {
          return (
            <div key={idx} className="flex items-start gap-2.5 my-1 pl-1">
              <div
                className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${
                  isSummary ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-zinc-400'
                }`}
              />
              <div className={`text-xs md:text-sm leading-relaxed ${isSummary ? 'text-emerald-100/90' : 'text-zinc-200'}`}>
                {parseInline(cleanLine)}
              </div>
            </div>
          );
        }

        if (isHeader) {
          const headerText = trimmed.replace(/^#+\s*/, '');
          return (
            <h4
              key={idx}
              className={`font-heading font-bold text-xs md:text-sm pt-2 pb-1 uppercase tracking-wide ${
                isSummary ? 'text-emerald-300 border-b border-emerald-500/20' : 'text-zinc-300 border-b border-zinc-800/60'
              }`}
            >
              {parseInline(headerText)}
            </h4>
          );
        }

        return (
          <p
            key={idx}
            className={`text-xs md:text-sm leading-relaxed ${isSummary ? 'text-emerald-100/90' : 'text-zinc-200'}`}
          >
            {parseInline(trimmed)}
          </p>
        );
      })}
    </div>
  );
};

export const ResourcesLibrary: React.FC<ResourcesLibraryProps> = ({
  resources,
  onCreateResource,
  onDeleteResource,
  installedModels = ['llama3.2', 'deepseek-r1', 'qwen2.5'],
  allModels = ['nomic-embed-text:latest', 'qwen2.5:7b', 'neo:latest'],
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'youtube' | 'note' | 'link' | 'file'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('');

  const [playingResourceId, setPlayingResourceId] = useState<string | null>(null);
  const [readingResource, setReadingResource] = useState<Resource | null>(null);
  const [copiedContent, setCopiedContent] = useState(false);

  const handleCopyContent = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedContent(true);
    setTimeout(() => setCopiedContent(false), 2000);
  };
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [type, setType] = useState<ResourceType>('note');
  const [title, setTitle] = useState('');
  const [urlOrContent, setUrlOrContent] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [isFetchingOembed, setIsFetchingOembed] = useState(false);

  // File Upload specific state variables
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [summarize, setSummarize] = useState(false);
  const [selectedModel, setSelectedModel] = useState('llama3.2');
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.txt', '.md'];
  const ACCEPTED_MIME = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
    'text/markdown',
  ];

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) setSelectedFile(file);
  };

  const isDocumentFile = (file: File | null) => {
    if (!file) return false;
    return ACCEPTED_MIME.includes(file.type) || ACCEPTED_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext));
  };

  const filteredResources = resources.filter(r => {
    if (activeTab !== 'all') {
      if (activeTab === 'file') {
        const isFileType = r.type === 'file' || r.type === 'image';
        let tagsList: string[] = [];
        try { tagsList = JSON.parse(r.tags || '[]'); } catch {}
        const isDocTag = tagsList.some(t => ['uploaded', 'pdf', 'docx', 'doc', 'txt', 'md', 'text', 'file', 'cn', 'study'].includes(t.toLowerCase()));
        
        if (!isFileType && !isDocTag) return false;
      } else if (r.type !== activeTab) {
        return false;
      }
    }
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = r.title.toLowerCase().includes(q);
      const matchContent = r.url_or_content.toLowerCase().includes(q);
      if (!matchTitle && !matchContent) return false;
    }

    if (selectedTag) {
      try {
        const tags: string[] = JSON.parse(r.tags || '[]');
        if (!tags.some(t => t.toLowerCase() === selectedTag.toLowerCase())) return false;
      } catch {
        return false;
      }
    }

    return true;
  });

  const allTags = Array.from(
    new Set(
      resources.flatMap(r => {
        try {
          return JSON.parse(r.tags || '[]');
        } catch {
          return [];
        }
      })
    )
  );

  const handleUrlBlur = async () => {
    if (type === 'youtube' && (urlOrContent.includes('youtube.com') || urlOrContent.includes('youtu.be'))) {
      setIsFetchingOembed(true);
      try {
        const data = await fetchYouTubeOembed(urlOrContent);
        if (data.title && !title) {
          setTitle(data.title);
        }
      } catch (err) {
        console.warn('Oembed fetch error', err);
      } finally {
        setIsFetchingOembed(false);
      }
    }
  };

  // Toast feedback state
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (type === 'file') {
      if (!selectedFile) return;

      // Client-side validation — match the server's 50 MB multer limit
      const MAX_FILE_SIZE_MB = 50;
      const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
      if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
        showToast(`File is too large (${(selectedFile.size / 1024 / 1024).toFixed(1)} MB). Maximum allowed size is ${MAX_FILE_SIZE_MB} MB.`, 'error');
        return;
      }

      // Client-side file type validation
      if (!isDocumentFile(selectedFile)) {
        showToast(`Unsupported file type. Accepted: PDF, DOCX, DOC, TXT, MD.`, 'error');
        return;
      }

      setIsUploading(true);
      try {
        const parsedTags = tagsInput
          .split(',')
          .map(t => t.trim())
          .filter(Boolean);

        await onCreateResource(
          {
            type: 'file',
            title: title.trim() || selectedFile.name,
            tags: JSON.stringify(parsedTags),
          },
          selectedFile,
          { summarize, model: selectedModel }
        );

        showToast(`Successfully uploaded "${selectedFile.name}"!`, 'success');
        setTitle('');
        setSelectedFile(null);
        setSummarize(false);
        setTagsInput('');
        setIsModalOpen(false);
      } catch (err: any) {
        console.error('File upload error', err);
        showToast(err.message || 'Failed to upload file. Check console.', 'error');
      } finally {
        setIsUploading(false);
      }

    } else {
      if (!title.trim() || !urlOrContent.trim()) return;

      const parsedTags = tagsInput
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);

      try {
        await onCreateResource({
          type,
          title: title.trim(),
          url_or_content: urlOrContent.trim(),
          tags: JSON.stringify(parsedTags),
        });

        showToast(`Added resource "${title.trim()}"!`, 'success');
        setTitle('');
        setUrlOrContent('');
        setTagsInput('');
        setIsModalOpen(false);
      } catch (err: any) {
        showToast(err.message || 'Failed to create resource', 'error');
      }
    }
  };

  const [oembedMeta, setOembedMeta] = useState<Record<string, { thumbnail?: string; videoUrl?: string; embedUrl?: string }>>({});

  const getYouTubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  const getYouTubeEmbedUrl = (url: string) => {
    const videoId = getYouTubeId(url);
    if (videoId) return `https://www.youtube.com/embed/${videoId}`;
    if (url.includes('youtube.com/playlist?list=')) {
      const listId = url.split('list=')[1]?.split('&')[0];
      if (listId) return `https://www.youtube.com/embed/videoseries?list=${listId}`;
    }
    if (oembedMeta[url]?.embedUrl) return oembedMeta[url].embedUrl!;
    return null;
  };

  const getYouTubeThumbnail = (url: string) => {
    const videoId = getYouTubeId(url);
    if (videoId) return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    if (oembedMeta[url]?.thumbnail) return oembedMeta[url].thumbnail!;
    return null;
  };

  React.useEffect(() => {
    resources.forEach((r) => {
      if (r.type === 'youtube' && r.url_or_content && !getYouTubeId(r.url_or_content) && !oembedMeta[r.url_or_content]) {
        fetchYouTubeOembed(r.url_or_content)
          .then((data) => {
            if (data?.thumbnail_url || data?.video_url) {
              const videoId = data.video_id;
              setOembedMeta((prev) => ({
                ...prev,
                [r.url_or_content]: {
                  thumbnail: data.thumbnail_url,
                  videoUrl: data.video_url || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : undefined),
                  embedUrl: videoId ? `https://www.youtube.com/embed/${videoId}` : undefined,
                },
              }));
            }
          })
          .catch(() => {});
      }
    });
  }, [resources]);

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
    <div className="space-y-6 font-sans relative">
      {/* Toast Notification Banner */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border font-sans text-xs font-bold ${
              toastMessage.type === 'success'
                ? 'bg-zinc-900 text-white border-emerald-500/50 shadow-emerald-950/40'
                : 'bg-zinc-900 text-white border-red-500/50 shadow-red-950/40'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${toastMessage.type === 'success' ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            <span>{toastMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Header Banner - Ultra-Minimal Borderless Concept */}
      <div className="flex flex-wrap items-center justify-between gap-6 py-2 px-1">
        <div className="space-y-1">
          <h2 className="font-heading font-black text-2xl md:text-3xl tracking-tight text-white">
            Resources & Notes
          </h2>
          <p className="font-sans text-xs text-zinc-400">
            Study notes, YouTube tutorials, and technical reference bookmarks.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={async () => {
              try {
                showToast('Syncing from Cloud...', 'success');
                const res = await fetch('/api/backup/restore', { method: 'POST' });
                if (res.ok) {
                  showToast('Sync complete! Refreshing...', 'success');
                  window.location.reload();
                } else {
                  showToast('No cloud backup found for this account.', 'error');
                }
              } catch (e) {
                showToast('Failed to sync from cloud.', 'error');
              }
            }}
            className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-400 text-white px-4 py-2 rounded-xl font-sans text-xs font-bold transition shrink-0"
          >
            <Cloud className="w-4 h-4 stroke-[2.5]" />
            <span>Sync Cloud</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 bg-white hover:bg-zinc-200 text-black px-4 py-2 rounded-xl font-sans text-xs font-bold transition shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Resource</span>
          </motion.button>
        </div>
      </div>

      {/* Filter Tabs & Search Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Kinetic Sliding Pill Filter Tabs */}
        <div className="relative flex items-center bg-[#0E0E12] p-1 rounded-xl">
          {(['all', 'youtube', 'note', 'link', 'file'] as const).map(t => {
            const isSelected = activeTab === t;
            return (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`relative z-10 px-3.5 py-1.5 rounded-lg font-sans text-xs font-bold capitalize transition-colors duration-200 ${
                  isSelected ? 'text-black' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {isSelected && (
                  <motion.span
                    layoutId="activeResourceTab"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    className="absolute inset-0 bg-white rounded-lg -z-10 shadow-sm"
                  />
                )}
                {t}
              </button>
            );
          })}
        </div>

        {/* Search & Tag Filter */}
        <div className="flex items-center gap-3 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3.5 top-2.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Search library..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0E0E12] rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:bg-[#141418] font-sans transition"
            />
          </div>

          {allTags.length > 0 && (
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="bg-[#0E0E12] rounded-xl px-3 py-2 text-xs text-zinc-300 font-sans focus:outline-none cursor-pointer"
            >
              <option value="">All Tags</option>
              {allTags.map((tag: any) => (
                <option key={tag} value={tag}>#{tag}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Borderless Ultra-Minimal Resource Grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {filteredResources.map(resource => {
          let tagsList: string[] = [];
          try {
            tagsList = JSON.parse(resource.tags || '[]');
          } catch {
            tagsList = [];
          }

          const targetVideoUrl = oembedMeta[resource.url_or_content]?.videoUrl || resource.url_or_content;
          const embedUrl = resource.type === 'youtube' ? getYouTubeEmbedUrl(resource.url_or_content) : null;
          const thumbnailUrl = resource.type === 'youtube' ? getYouTubeThumbnail(resource.url_or_content) : null;
          const isPlayingEmbed = playingResourceId === resource.id;

          return (
            <motion.div
              key={resource.id}
              variants={itemVariants}
              whileHover={{ y: -3 }}
              onClick={() => setReadingResource(resource)}
              className="group/res relative flex flex-col justify-between p-4 rounded-2xl bg-[#08080B] hover:bg-white text-zinc-300 hover:text-black transition-all duration-200 space-y-3 cursor-pointer select-none"
            >
              <div className="space-y-2.5">
                {/* Media Preview / Embed */}
                {resource.type === 'youtube' && (
                  <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black">
                    {isPlayingEmbed && embedUrl ? (
                      <iframe
                        src={`${embedUrl}?autoplay=1`}
                        title={resource.title}
                        className="w-full h-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : thumbnailUrl ? (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          if (embedUrl) setPlayingResourceId(resource.id);
                          else setReadingResource(resource);
                        }}
                        className="w-full h-full cursor-pointer relative group/yt flex items-center justify-center"
                      >
                        <img src={thumbnailUrl} alt={resource.title} className="w-full h-full object-cover group-hover/yt:scale-105 transition-transform duration-300" />
                        <div className="absolute inset-0 bg-black/40 group-hover/yt:bg-black/20 transition-colors flex items-center justify-center">
                          <div className="w-11 h-11 rounded-full bg-red-600 text-white flex items-center justify-center shadow-xl group-hover/yt:scale-110 transition-transform">
                            <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                          </div>
                        </div>
                        <span className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-sans font-bold text-white">
                          YouTube
                        </span>
                      </div>
                    ) : (
                      <a
                        href={targetVideoUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="w-full h-full flex flex-col items-center justify-center p-4 bg-[#121216] text-center space-y-1.5 cursor-pointer"
                      >
                        <div className="w-9 h-9 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center">
                          <Youtube className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-sans font-bold text-white group-hover/res:text-black flex items-center gap-1">
                          Open YouTube Video <ExternalLink className="w-3 h-3 text-zinc-400" />
                        </span>
                      </a>
                    )}
                  </div>
                )}

                {/* Resource Header */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="flex items-center gap-1.5 font-sans text-[9px] uppercase tracking-widest px-2 py-0.5 rounded bg-white/5 group-hover/res:bg-black/10 text-zinc-400 group-hover/res:text-black font-bold transition-colors">
                    {resource.type === 'youtube' && <Youtube className="w-3 h-3 text-red-400 group-hover/res:text-red-600" />}
                    {resource.type === 'note' && !tagsList.some(t => ['uploaded', 'pdf', 'docx', 'doc', 'txt', 'md'].includes(t.toLowerCase())) && (
                      <FileText className="w-3 h-3 text-amber-400 group-hover/res:text-amber-600" />
                    )}
                    {(resource.type === 'file' || tagsList.some(t => ['uploaded', 'pdf', 'docx', 'doc', 'txt', 'md'].includes(t.toLowerCase()))) && (
                      <FileText className="w-3 h-3 text-emerald-400 group-hover/res:text-emerald-600" />
                    )}
                    {resource.type === 'link' && <LinkIcon className="w-3 h-3 text-blue-400 group-hover/res:text-blue-600" />}
                    {resource.type === 'file' || tagsList.some(t => ['uploaded', 'pdf', 'docx', 'doc', 'txt', 'md'].includes(t.toLowerCase()))
                      ? 'FILE'
                      : resource.type}
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteResource(resource.id);
                    }}
                    className="opacity-0 group-hover/res:opacity-100 p-1 text-zinc-500 hover:text-red-600 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <h3 className="font-heading font-bold text-sm text-white group-hover/res:text-black line-clamp-2 leading-snug transition-colors">
                  {resource.title}
                </h3>

                {(resource.type === 'file' || resource.type === 'note') && (
                  <div className={`grid grid-cols-1 ${resource.summary ? 'sm:grid-cols-2' : ''} gap-2.5 p-3.5 rounded-xl bg-[#121216] group-hover/res:bg-black/5 transition-colors`}>
                    {/* Content or link preview */}
                    <div className="bg-black/30 group-hover/res:bg-black/5 p-2.5 rounded-lg text-xs text-zinc-300 group-hover/res:text-zinc-800 font-sans max-h-32 overflow-hidden line-clamp-4 whitespace-pre-wrap leading-relaxed">
                      {resource.url_or_content}
                    </div>

                    {/* Separate AI Summary box if available */}
                    {resource.summary && (
                      <div className="bg-emerald-950/20 group-hover/res:bg-emerald-50 p-2.5 rounded-lg text-[11px] text-zinc-300 group-hover/res:text-zinc-800 font-sans space-y-1 border border-emerald-500/20">
                        <div className="font-bold text-[9px] uppercase tracking-wider text-emerald-400 group-hover/res:text-emerald-700">AI Summary</div>
                        <div className="whitespace-pre-wrap leading-relaxed max-h-20 overflow-hidden line-clamp-3">{resource.summary}</div>
                      </div>
                    )}
                  </div>
                )}

                {resource.type === 'link' && (
                  <a
                    href={resource.url_or_content}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex flex-col justify-between p-3.5 rounded-xl bg-[#121216] group-hover/res:bg-black/5 transition-colors space-y-2.5 group/link"
                  >
                    <div className="flex items-center gap-2 text-zinc-400 group-hover/res:text-zinc-600 font-sans text-xs">
                      <div className="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-400 group-hover/res:bg-blue-500/20 flex items-center justify-center shrink-0">
                        <Globe className="w-3.5 h-3.5" />
                      </div>
                      <span className="truncate font-medium">
                        {(() => {
                          try {
                            return new URL(resource.url_or_content).hostname.replace('www.', '');
                          } catch {
                            return resource.url_or_content;
                          }
                        })()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs font-sans text-blue-400 group-hover/res:text-blue-600 font-bold">
                      <span className="truncate">{resource.url_or_content}</span>
                      <ExternalLink className="w-3.5 h-3.5 shrink-0 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
                    </div>
                  </a>
                )}
              </div>

              {tagsList.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap pt-2">
                  {tagsList.map(tag => (
                    <span
                      key={tag}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTag(tag);
                      }}
                      className="font-sans text-[10px] text-zinc-400 group-hover/res:text-zinc-700 bg-white/5 group-hover/res:bg-black/10 px-2 py-0.5 rounded cursor-pointer transition font-semibold"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </motion.div>
          );
        })}

        {filteredResources.length === 0 && (
          <div className="col-span-full rounded-2xl p-12 text-center text-zinc-500">
            <p className="font-sans text-xs">No resources saved in this category yet.</p>
          </div>
        )}
      </motion.div>

      {/* Resource Reader Modal Card - Rendered via React Portal directly in document.body to cover Navbar & Blur Background */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {readingResource && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setReadingResource(null)}
                className="fixed inset-0 z-[99999] bg-black/85 backdrop-blur-2xl flex items-center justify-center p-4 md:p-8 overflow-y-auto"
              >
                {/* Modal Container */}
                <motion.div
                  initial={{ scale: 0.93, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.93, opacity: 0, y: 20 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-[#0C0C10] border border-zinc-800/90 rounded-3xl p-6 md:p-8 max-w-6xl w-full space-y-6 shadow-[0_0_100px_rgba(0,0,0,0.98)] relative flex flex-col max-h-[90vh] text-white ring-1 ring-white/10"
                >
                  {/* Modal Top Header Bar */}
                  <div className="flex items-center justify-between gap-4 pb-4 border-b border-zinc-800/80">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <h2 className="font-heading font-black text-xl md:text-2xl text-white tracking-tight leading-snug truncate">
                        {readingResource.title}
                      </h2>
                      
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 font-sans text-xs font-bold text-zinc-300">
                          <div className={`w-1.5 h-1.5 rounded-full ${readingResource.type === 'file' ? 'bg-emerald-400' : readingResource.type === 'note' ? 'bg-amber-400' : readingResource.type === 'youtube' ? 'bg-red-400' : 'bg-blue-400'} animate-pulse`} />
                          <span className="uppercase tracking-widest text-[9px]">{readingResource.type}</span>
                        </div>

                        {readingResource.created_at && (
                          <span className="text-[11px] text-zinc-500 font-sans font-medium">
                            {new Date(readingResource.created_at).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleCopyContent(readingResource.url_or_content)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white text-xs font-sans font-bold transition cursor-pointer"
                      >
                        {copiedContent ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedContent ? 'Copied!' : 'Copy'}</span>
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          const idToDelete = readingResource.id;
                          setReadingResource(null);
                          onDeleteResource(idToDelete);
                        }}
                        className="p-1.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-red-500/50 hover:bg-red-500/10 text-zinc-400 hover:text-red-400 transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setReadingResource(null)}
                        className="p-1.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white transition cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </motion.button>
                    </div>
                  </div>

                  {/* Scrollable Main Body */}
                  <div className="space-y-5 overflow-y-auto pr-2 flex-1 font-sans">
                    {/* YouTube Video Player Embed */}
                    {readingResource.type === 'youtube' && (
                      <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black border border-zinc-800 shadow-2xl">
                        {getYouTubeEmbedUrl(readingResource.url_or_content) ? (
                          <iframe
                            src={`${getYouTubeEmbedUrl(readingResource.url_or_content)}?autoplay=1`}
                            title={readingResource.title}
                            className="w-full h-full border-0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        ) : (
                          <a
                            href={readingResource.url_or_content}
                            target="_blank"
                            rel="noreferrer"
                            className="w-full h-full flex flex-col items-center justify-center p-6 bg-[#121216] text-center space-y-2"
                          >
                            <Youtube className="w-10 h-10 text-red-500" />
                            <span className="text-sm font-bold text-white flex items-center gap-1.5">
                              Open YouTube Link <ExternalLink className="w-4 h-4 text-zinc-400" />
                            </span>
                          </a>
                        )}
                      </div>
                    )}

                    {/* External Link Card if Link Resource */}
                    {readingResource.type === 'link' && (
                      <a
                        href={readingResource.url_or_content}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between p-4 rounded-2xl bg-[#14141A] border border-blue-500/30 hover:border-blue-500/60 text-blue-400 transition group shadow-lg"
                      >
                        <div className="flex items-center gap-3 truncate">
                          <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                            <Globe className="w-4 h-4" />
                          </div>
                          <span className="truncate text-sm font-medium text-white group-hover:text-blue-300 transition">
                            {readingResource.url_or_content}
                          </span>
                        </div>
                        <ExternalLink className="w-4 h-4 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                      </a>
                    )}

                    {/* Side-by-Side Container for Content and AI Summary */}
                    <div className={`grid grid-cols-1 ${readingResource.summary ? 'lg:grid-cols-2' : ''} gap-5 items-stretch`}>
                      {/* Primary Text Content Area */}
                      <div className="bg-[#121218] border border-zinc-800/90 rounded-2xl p-5 md:p-6 flex flex-col justify-between space-y-4 shadow-xl">
                        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-emerald-400" />
                            <span className="font-mono text-xs font-bold uppercase tracking-wider text-zinc-400">
                              {readingResource.type === 'file' ? 'Document / File Content' : 'Content & Notes'}
                            </span>
                          </div>
                          {(readingResource.url_or_content.startsWith('http://') || readingResource.url_or_content.startsWith('https://')) && (
                            <a
                              href={readingResource.url_or_content}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-mono text-blue-400 hover:underline"
                            >
                              Open Link <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>

                        <div className="flex-1 max-h-[75vh] overflow-y-auto pr-2 selection:bg-emerald-500/30 selection:text-emerald-200">
                          {renderFormattedText(readingResource.url_or_content, false)}
                        </div>
                      </div>

                      {/* AI Summary Box */}
                      {readingResource.summary && (
                        <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-5 md:p-6 flex flex-col space-y-4 shadow-xl">
                          <div className="flex items-center gap-2 pb-3 border-b border-emerald-500/20">
                            <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
                            <span className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-400">
                              AI Summary
                            </span>
                          </div>

                          <div className="flex-1 max-h-[75vh] overflow-y-auto pr-2 selection:bg-emerald-500/40 selection:text-emerald-100">
                            {renderFormattedText(readingResource.summary, true)}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Tags Footer */}
                    {(() => {
                      try {
                        const tags: string[] = JSON.parse(readingResource.tags || '[]');
                        if (tags.length === 0) return null;
                        return (
                          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-800/60">
                            <Tag className="w-3.5 h-3.5 text-zinc-500" />
                            {tags.map(t => (
                              <span
                                key={t}
                                onClick={() => {
                                  setSelectedTag(t);
                                  setReadingResource(null);
                                }}
                                className="text-xs bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 px-2.5 py-1 rounded-lg cursor-pointer transition font-medium"
                              >
                                #{t}
                              </span>
                            ))}
                          </div>
                        );
                      } catch {
                        return null;
                      }
                    })()}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}

      {/* Add Resource Minimal Modal - Rendered via React Portal in document.body above Navbar */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {isModalOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[99999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
              >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: 'spring', stiffness: 450, damping: 30 }}
              className="bg-[#0C0C0F] rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl relative"
            >
              <div className="flex items-center justify-between pb-2">
                <h3 className="font-heading font-extrabold text-sm text-white">Add Resource</h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 text-zinc-500 hover:text-white rounded-lg transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="space-y-3 font-sans text-xs">
                {/* Resource Type Selection */}
                <div className="grid grid-cols-4 gap-1 bg-[#141418] p-1 rounded-xl">
                  {(['note', 'youtube', 'link', 'file'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={`py-1.5 rounded-lg capitalize text-[10px] font-bold transition-all ${
                        type === t
                           ? 'bg-white text-black shadow'
                           : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                {/* Title Input */}
                <div>
                  <div className="flex items-center gap-1 text-[10px] text-zinc-400 mb-1">
                    <FileText className="w-2.5 h-2.5 text-white" /> Title {type === 'file' && '(Optional)'}
                  </div>
                  <input
                    type="text"
                    required={type !== 'file'}
                    placeholder={type === 'file' ? 'Falls back to filename...' : 'Resource title...'}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-[#141418] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:bg-[#1A1A20] transition-all font-sans"
                  />
                  {isFetchingOembed && (
                    <span className="text-[10px] text-emerald-400 animate-pulse mt-1 inline-block">
                      Fetching video metadata...
                    </span>
                  )}
                </div>

                {/* Content / URL / File Input */}
                <div>
                  {type === 'file' ? (
                    <div>
                      <div className="flex items-center gap-1 text-[10px] text-zinc-400 mb-2">
                        <FileText className="w-2.5 h-2.5 text-white" /> Upload Document
                        <span className="ml-auto flex gap-1">
                          {['.pdf', '.docx', '.doc', '.txt', '.md'].map(ext => (
                            <span key={ext} className="bg-zinc-800 text-zinc-400 rounded px-1 py-0.5 text-[9px] font-mono">{ext}</span>
                          ))}
                        </span>
                      </div>

                      {/* Drag-and-drop zone */}
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`relative w-full rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center gap-2 py-5 px-3 ${
                          isDragging
                            ? 'border-white bg-white/5 scale-[1.01]'
                            : selectedFile
                            ? 'border-emerald-500/60 bg-emerald-950/20'
                            : 'border-zinc-700 bg-[#141418] hover:border-zinc-500 hover:bg-[#1A1A20]'
                        }`}
                      >
                        {selectedFile ? (
                          <>
                            <div className="flex items-center gap-2 w-full">
                              <FileText className="w-5 h-5 text-emerald-400 shrink-0" />
                              <div className="text-left min-w-0 flex-1">
                                <p className="text-[11px] text-white font-semibold truncate">{selectedFile.name}</p>
                                <p className="text-[9px] text-zinc-400">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                                className="p-1 rounded-full hover:bg-zinc-700 text-zinc-400 hover:text-white transition shrink-0"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                            {isDocumentFile(selectedFile) && (
                              <div className="flex items-center gap-1 text-[9px] text-emerald-400">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                                Content will be searchable in RAG Chat
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <FileText className={`w-6 h-6 transition ${isDragging ? 'text-white scale-110' : 'text-zinc-500'}`} />
                            <div className="text-center">
                              <p className="text-[11px] text-zinc-300 font-semibold">
                                {isDragging ? 'Drop it here!' : 'Drop file here or click to browse'}
                              </p>
                              <p className="text-[9px] text-zinc-500 mt-0.5">PDF, DOCX, DOC, TXT, MD · max 50MB</p>
                            </div>
                          </>
                        )}
                        <input
                          ref={fileInputRef}
                          type="file"
                          required
                          accept=".pdf,.docx,.doc,.txt,.md"
                          onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                          className="hidden"
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-1 text-[10px] text-zinc-400 mb-1">
                        {type === 'note' ? <FileText className="w-2.5 h-2.5 text-white" /> : <Globe className="w-2.5 h-2.5 text-white" />}
                        {type === 'note' ? 'Markdown Content' : 'URL Link'}
                      </div>
                      {type === 'note' ? (
                        <textarea
                          required
                          rows={4}
                          placeholder="Write study notes or markdown..."
                          value={urlOrContent}
                          onChange={(e) => setUrlOrContent(e.target.value)}
                          className="w-full bg-[#141418] rounded-xl px-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:bg-[#1A1A20] transition-all font-sans"
                        />
                      ) : (
                        <input
                          type="url"
                          required
                          placeholder="https://..."
                          value={urlOrContent}
                          onChange={(e) => setUrlOrContent(e.target.value)}
                          onBlur={handleUrlBlur}
                          className="w-full bg-[#141418] rounded-xl px-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:bg-[#1A1A20] transition-all font-sans"
                        />
                      )}
                    </>
                  )}
                </div>

                {/* Summarize options for file uploads */}
                {type === 'file' && (
                  <div className="pt-2 pb-1 space-y-3">
                    {/* Minimal Toggle Switch Header */}
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-white block">AI Summarization</span>
                        <span className="text-[10px] text-zinc-500 block">Extract key insights using local LLM</span>
                      </div>

                      {/* Custom Toggle Switch Slider */}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={summarize}
                        onClick={() => setSummarize(!summarize)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          summarize ? 'bg-white' : 'bg-zinc-800'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full shadow-lg ring-0 transition duration-200 ease-in-out ${
                            summarize ? 'translate-x-4 bg-black' : 'translate-x-0 bg-zinc-400'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Bordered Dropdown Select Menu */}
                    <AnimatePresence>
                      {summarize && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden space-y-2 pt-1.5"
                        >
                          <div className="space-y-1">
                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Target LLM Model</span>
                            <div className="relative">
                              <select
                                value={selectedModel}
                                onChange={(e) => setSelectedModel(e.target.value)}
                                className="w-full bg-[#141418] border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white uppercase font-bold appearance-none cursor-pointer focus:outline-none focus:border-zinc-600 transition shadow-sm"
                              >
                                {installedModels.map((model) => (
                                  <option key={model} value={model} className="bg-[#0C0C0F] text-white">
                                    {model}
                                  </option>
                                ))}
                              </select>
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400 text-xs">
                                ▾
                              </div>
                            </div>
                          </div>

                          {/* Recommendation card — Only rendered if nomic is NOT installed and user is online */}
                          {(() => {
                            const hasNomic =
                              allModels.some(m => m && m.toLowerCase().includes('nomic')) ||
                              installedModels.some(m => m && m.toLowerCase().includes('nomic')) ||
                              selectedModel.toLowerCase().includes('nomic');

                            if (hasNomic || !navigator.onLine) return null;

                            return (
                              <div className="p-3 rounded-2xl border border-zinc-800/90 bg-zinc-900/60 text-xs font-sans space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5 text-zinc-200 font-bold text-[11px]">
                                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                    <span>Faster Text Summarizing</span>
                                  </div>
                                  <span className="text-[10px] text-zinc-500 font-mono">274 MB</span>
                                </div>
                                <p className="text-zinc-400 text-[11px] leading-relaxed">
                                  Recommended model for lightweight document summaries:
                                </p>
                                <div className="p-2 rounded-xl bg-black/50 border border-zinc-800 text-zinc-300 font-mono text-[10px] flex items-center justify-between select-all">
                                  <span>ollama pull nomic-embed-text</span>
                                </div>
                              </div>
                            );
                          })()}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Tags Input */}
                <div>
                  <div className="flex items-center gap-1 text-[10px] text-zinc-400 mb-1">
                    <Tag className="w-2.5 h-2.5 text-white" /> Tags (comma separated)
                  </div>
                  <input
                    type="text"
                    placeholder="dsa, algorithms, notes"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    className="w-full bg-[#141418] rounded-xl px-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:bg-[#1A1A20] transition-all font-sans"
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => setIsModalOpen(false)}
                    className="px-3 py-1.5 text-zinc-500 hover:text-white transition-colors text-xs font-sans disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUploading}
                    className="bg-white hover:bg-zinc-200 text-black px-4 py-1.5 rounded-xl font-bold text-xs transition-all font-sans disabled:bg-zinc-700 disabled:text-zinc-400 flex items-center gap-1.5"
                  >
                    {isUploading ? (
                      <>
                        <span className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                        {summarize ? 'Summarizing...' : 'Uploading...'}
                      </>
                    ) : (
                      'Save Resource'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
    )}
    </div>
  );
};

