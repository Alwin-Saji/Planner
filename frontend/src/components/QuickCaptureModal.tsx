import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, Calendar, Zap } from 'lucide-react';
import { Block, Resource } from '../types';
import { getTodayStr } from '../utils/dateUtils';

interface QuickCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateBlock: (blockData: Partial<Block>) => void;
  onCreateResource: (resourceData: Partial<Resource>) => void;
}

export const QuickCaptureModal: React.FC<QuickCaptureModalProps> = ({
  isOpen,
  onClose,
  onCreateBlock,
  onCreateResource,
}) => {
  const [captureType, setCaptureType] = useState<'note' | 'block'>('note');
  const [title, setTitle] = useState('');
  const [contentOrCategory, setContentOrCategory] = useState('');
  const [startTime, setStartTime] = useState('17:00');
  const [endTime, setEndTime] = useState('18:30');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (captureType === 'note') {
      onCreateResource({
        type: 'note',
        title: title.trim(),
        url_or_content: contentOrCategory.trim() || title.trim(),
        tags: JSON.stringify(['quick-capture']),
      });
    } else {
      const today = getTodayStr();
      onCreateBlock({
        title: title.trim(),
        category: contentOrCategory.trim() || 'General',
        date: today,
        start_time: startTime,
        end_time: endTime,
        status: 'planned',
      });
    }

    setTitle('');
    setContentOrCategory('');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="bg-[#0F0F0F] border border-white/[0.15] rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-5 shadow-2xl relative font-mono text-xs"
          >
            <div className="flex items-center justify-between border-b border-white/[0.1] pb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-white" />
                <h2 className="font-heading font-extrabold text-base text-white">Quick Capture</h2>
              </div>
              <button onClick={onClose} className="text-zinc-400 hover:text-white transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Type Switcher */}
            <div className="grid grid-cols-2 gap-2 bg-[#141414] p-1 rounded-2xl border border-white/[0.1]">
              <button
                type="button"
                onClick={() => setCaptureType('note')}
                className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-mono transition-all duration-200 ${
                  captureType === 'note'
                    ? 'bg-white text-black font-bold shadow-md'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Note / Resource</span>
              </button>
              <button
                type="button"
                onClick={() => setCaptureType('block')}
                className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-mono transition-all duration-200 ${
                  captureType === 'block'
                    ? 'bg-white text-black font-bold shadow-md'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Schedule Block</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block font-mono text-[10px] font-semibold text-zinc-400 uppercase mb-1">
                  {captureType === 'note' ? 'NOTE TITLE' : 'BLOCK TITLE'}
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  placeholder={captureType === 'note' ? 'Quick idea or link...' : 'e.g. Read FastAPI microservices chapter'}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[#141414] border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white font-mono shadow-inner"
                />
              </div>

              {captureType === 'note' ? (
                <div>
                  <label className="block font-mono text-[10px] font-semibold text-zinc-400 uppercase mb-1">CONTENT / DETAILS</label>
                  <textarea
                    rows={3}
                    placeholder="Markdown text or key summary..."
                    value={contentOrCategory}
                    onChange={(e) => setContentOrCategory(e.target.value)}
                    className="w-full bg-[#141414] border border-white/[0.1] rounded-xl p-3 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-white shadow-inner"
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className="block font-mono text-[10px] font-semibold text-zinc-400 uppercase mb-1">CATEGORY</label>
                    <input
                      type="text"
                      placeholder="e.g. DSA, Work, ML"
                      value={contentOrCategory}
                      onChange={(e) => setContentOrCategory(e.target.value)}
                      className="w-full bg-[#141414] border border-white/[0.1] rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white font-mono shadow-inner"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-mono text-[10px] font-semibold text-zinc-400 uppercase mb-1">START TIME</label>
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full bg-[#141414] border border-white/[0.1] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-mono text-[10px] font-semibold text-zinc-400 uppercase mb-1">END TIME</label>
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full bg-[#141414] border border-white/[0.1] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white font-mono"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.1]">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-zinc-400 hover:text-white transition font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-white hover:bg-zinc-200 text-black px-5 py-2 rounded-xl font-bold transition shadow-lg shadow-white/10"
                >
                  Capture
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
