import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, Calendar, Tag, Link2, FileText } from 'lucide-react';
import { Block, BlockStatus, Resource } from '../types';
import { getTodayStr } from '../utils/dateUtils';

interface BlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (blockData: Partial<Block>) => void;
  initialBlock?: Block | null;
  defaultDate?: string;
  resources: Resource[];
}

export const BlockModal: React.FC<BlockModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialBlock,
  defaultDate,
  resources,
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('DSA');
  const [date, setDate] = useState(defaultDate || getTodayStr());
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:30');
  const [status, setStatus] = useState<BlockStatus>('planned');
  const [recurrenceRule, setRecurrenceRule] = useState<string>('');
  const [notesId, setNotesId] = useState<string>('');
  const [customLink, setCustomLink] = useState<string>('');
  const [calendarSyncEnabled, setCalendarSyncEnabled] = useState<boolean>(true);

  useEffect(() => {
    if (initialBlock) {
      setTitle(initialBlock.title);
      setCategory(initialBlock.category);
      setDate(initialBlock.date);
      setStartTime(initialBlock.start_time);
      setEndTime(initialBlock.end_time);
      setStatus(initialBlock.status);
      setRecurrenceRule(initialBlock.recurrence_rule || '');
      setNotesId(initialBlock.notes_id || '');
      setCustomLink(initialBlock.custom_link || '');
      setCalendarSyncEnabled(initialBlock.calendar_sync_enabled !== 0 && initialBlock.calendar_sync_enabled !== false);
    } else {
      setTitle('');
      setCategory('DSA');
      setDate(defaultDate || getTodayStr());
      setStartTime('09:00');
      setEndTime('10:30');
      setStatus('planned');
      setRecurrenceRule('');
      setNotesId('');
      setCustomLink('');
      setCalendarSyncEnabled(true);
    }
  }, [initialBlock, defaultDate, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSave({
      id: initialBlock?.id,
      title: title.trim(),
      category: category.trim(),
      date,
      start_time: startTime,
      end_time: endTime,
      status,
      recurrence_rule: recurrenceRule.trim() || null,
      notes_id: notesId || null,
      custom_link: customLink.trim() || null,
      calendar_sync_enabled: calendarSyncEnabled ? 1 : 0,
    });
    onClose();
  };

  const statusOptions: { value: BlockStatus; label: string }[] = [
    { value: 'planned', label: 'Planned' },
    { value: 'done', label: 'Done' },
    { value: 'skipped', label: 'Skipped' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="bg-[#0C0C0F] rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl relative text-xs"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <h2 className="font-sans font-bold text-sm text-white">
                {initialBlock ? 'Edit Block' : 'New Block'}
              </h2>
              <button
                onClick={onClose}
                className="p-1 text-white hover:text-zinc-300 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Title */}
              <div>
                <input
                  type="text"
                  required
                  placeholder="Block title..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[#141418] rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:bg-[#1A1A20] transition-all font-sans font-medium"
                />
              </div>

              {/* Category & Date */}
              <div className="grid grid-cols-2 gap-2 font-body">
                <div>
                  <div className="flex items-center gap-1 text-[10px] text-zinc-400 mb-1">
                    <Tag className="w-2.5 h-2.5 text-white" /> Category
                  </div>
                  <input
                    type="text"
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-[#141418] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:bg-[#1A1A20] transition-all font-sans"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1 text-[10px] text-zinc-400 mb-1">
                    <Calendar className="w-2.5 h-2.5 text-white" /> Date
                  </div>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    style={{ colorScheme: 'dark' }}
                    className="w-full bg-[#141418] rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:bg-[#1A1A20] transition-all cursor-pointer [&::-webkit-calendar-picker-indicator]:brightness-0 [&::-webkit-calendar-picker-indicator]:invert font-sans"
                  />
                </div>
              </div>

              {/* Start & End Time */}
              <div className="grid grid-cols-2 gap-2 font-body">
                <div>
                  <div className="flex items-center gap-1 text-[10px] text-zinc-400 mb-1">
                    <Clock className="w-2.5 h-2.5 text-white" /> Start
                  </div>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    style={{ colorScheme: 'dark' }}
                    className="w-full bg-[#141418] rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:bg-[#1A1A20] transition-all cursor-pointer [&::-webkit-calendar-picker-indicator]:brightness-0 [&::-webkit-calendar-picker-indicator]:invert font-sans"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1 text-[10px] text-zinc-400 mb-1">
                    <Clock className="w-2.5 h-2.5 text-white" /> End
                  </div>
                  <input
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    style={{ colorScheme: 'dark' }}
                    className="w-full bg-[#141418] rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:bg-[#1A1A20] transition-all cursor-pointer [&::-webkit-calendar-picker-indicator]:brightness-0 [&::-webkit-calendar-picker-indicator]:invert font-sans"
                  />
                </div>
              </div>

              {/* Status Segmented Toggle */}
              <div>
                <div className="grid grid-cols-3 gap-1 bg-[#141418] p-1 rounded-xl">
                  {statusOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setStatus(opt.value)}
                      className={`py-1.5 rounded-lg font-sans text-[10px] font-bold transition-all ${
                        status === opt.value
                          ? 'bg-white text-black shadow'
                          : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Link */}
              <div>
                <div className="flex items-center gap-1 text-[10px] text-zinc-400 mb-1">
                  <Link2 className="w-2.5 h-2.5 text-white" /> URL / Video Link
                </div>
                <input
                  type="url"
                  placeholder="https://youtube.com/..."
                  value={customLink}
                  onChange={(e) => setCustomLink(e.target.value)}
                  className="w-full bg-[#141418] rounded-xl px-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:bg-[#1A1A20] transition-all font-sans"
                />
              </div>

              {/* Linked Note */}
              {resources.length > 0 && (
                <div>
                  <div className="flex items-center gap-1 text-[10px] text-zinc-400 mb-1">
                    <FileText className="w-2.5 h-2.5 text-white" /> Linked Note
                  </div>
                  <select
                    value={notesId}
                    onChange={(e) => setNotesId(e.target.value)}
                    className="w-full bg-[#141418] rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none cursor-pointer font-sans"
                  >
                    <option value="">None (No note attached)</option>
                    {resources.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Calendar Sync Toggle */}
              <div className="flex items-center justify-between bg-[#141418] p-2.5 rounded-xl border border-white/5">
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-[11px] text-zinc-300 font-medium">Include in Google Calendar Feed</span>
                </div>
                <input
                  type="checkbox"
                  checked={calendarSyncEnabled}
                  onChange={(e) => setCalendarSyncEnabled(e.target.checked)}
                  className="w-4 h-4 rounded accent-blue-500 cursor-pointer"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-between pt-2">
                {title.trim() ? (
                  <a
                    href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${date.replace(/-/g, '')}T${startTime.replace(/:/g, '')}00/${date.replace(/-/g, '')}T${endTime.replace(/:/g, '')}00&details=Chrono+Planner+Task`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
                  >
                    <Calendar className="w-3 h-3" /> Add to GCal
                  </a>
                ) : <div />}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3 py-1.5 text-zinc-500 hover:text-white transition-colors text-xs font-sans"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-white hover:bg-zinc-200 text-black px-4 py-1.5 rounded-xl font-bold text-xs transition-all font-sans"
                  >
                    {initialBlock ? 'Update' : 'Save'}
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

