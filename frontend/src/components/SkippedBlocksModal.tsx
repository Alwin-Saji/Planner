import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, RotateCcw, Edit2, Trash2, AlertTriangle } from 'lucide-react';
import { Block, BlockStatus } from '../types';

interface SkippedBlocksModalProps {
  isOpen: boolean;
  onClose: () => void;
  skippedBlocks: Block[];
  onUpdateBlock: (id: string, updates: Partial<Block>) => void;
  onDeleteBlock: (id: string) => void;
  onEditBlock: (block: Block) => void;
}

export const SkippedBlocksModal: React.FC<SkippedBlocksModalProps> = ({
  isOpen,
  onClose,
  skippedBlocks,
  onUpdateBlock,
  onDeleteBlock,
  onEditBlock,
}) => {
  const handleAutoAdd = (block: Block) => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;

    // Calculate duration in minutes
    const [startH, startM] = block.start_time.split(':').map(Number);
    const [endH, endM] = block.end_time.split(':').map(Number);
    const durationMin = (endH * 60 + endM) - (startH * 60 + startM);

    // Round up start time to next 15 minutes from now
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = Math.ceil(currentMinutes / 15) * 15;
    const endMinutes = startMinutes + durationMin;

    const formatMin = (m: number) => {
      const h = Math.floor(m / 60) % 24;
      const min = m % 60;
      return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    };

    onUpdateBlock(block.id, {
      date: todayStr,
      start_time: formatMin(startMinutes),
      end_time: formatMin(endMinutes),
      status: 'planned',
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-lg bg-[#0a0a0a] rounded-2xl p-6 shadow-2xl z-10 overflow-hidden flex flex-col max-h-[80vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6 shrink-0">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 stroke-[1.5]" />
                <span className="text-[10px] font-medium tracking-[0.2em] uppercase text-zinc-400">
                  Skipped Blocks Review
                </span>
              </div>
              <button
                onClick={onClose}
                className="p-1 text-zinc-500 hover:text-zinc-200 rounded transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-1 custom-scrollbar min-h-[200px]">
              {skippedBlocks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-2">
                  <span className="text-xs text-zinc-500 font-medium">All caught up! No skipped blocks.</span>
                </div>
              ) : (
                skippedBlocks.map((block) => (
                  <div
                    key={block.id}
                    className="flex items-center justify-between gap-4 py-3.5 border-b border-white/[0.02] last:border-b-0 hover:bg-white/[0.01] px-2 rounded-lg transition-colors"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-medium font-sans">
                          {block.category}
                        </span>
                        <span className="text-zinc-700 text-xs select-none">&middot;</span>
                        <span className="text-[10px] text-zinc-500">
                          {block.date} @ {block.start_time} - {block.end_time}
                        </span>
                      </div>
                      <h4 className="text-xs font-medium text-white truncate">
                        {block.title}
                      </h4>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        onClick={() => handleAutoAdd(block)}
                        title="Auto-reschedule to today"
                        className="p-1 hover:text-emerald-400 text-zinc-500 rounded transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4 stroke-[1.5]" />
                      </button>
                      <button
                        onClick={() => {
                          onEditBlock(block);
                          onClose();
                        }}
                        title="Edit block details"
                        className="p-1 hover:text-white text-zinc-500 rounded transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-4 h-4 stroke-[1.5]" />
                      </button>
                      <button
                        onClick={() => onDeleteBlock(block.id)}
                        title="Delete block"
                        className="p-1 hover:text-red-400 text-zinc-500 rounded transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4 stroke-[1.5]" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {/* Footer */}
            <div className="mt-6 pt-4 flex justify-end shrink-0">
              <button
                onClick={onClose}
                className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
