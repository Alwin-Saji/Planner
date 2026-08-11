import React from 'react';
import { motion } from 'framer-motion';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  CheckCircle2,
  Circle,
  XCircle,
  GripVertical,
  Repeat,
  FileText,
  Trash2,
  Edit2,
  Link as LinkIcon,
  Youtube,
  ExternalLink,
  Calendar,
} from 'lucide-react';
import { getGoogleCalendarUrl } from '../utils/notifications';
import { Block, BlockStatus } from '../types';

interface BlockCardProps {
  block: Block;
  onStatusToggle: (id: string, newStatus: BlockStatus) => void;
  onEditBlock: (block: Block) => void;
  onDeleteBlock: (id: string) => void;
  onViewNote?: (notesId: string) => void;
  isInverted?: boolean;
}

const getCategoryTheme = (cat: string, isDone: boolean, isSkipped: boolean, isInverted: boolean) => {
  // Fallback defaults
  const defaultTheme = {
    tabBg: 'bg-zinc-700/80',
    tabText: 'text-zinc-200',
    bodyBg: isInverted 
      ? 'bg-zinc-50/50 border-zinc-200/80 group-hover:bg-zinc-100 group-hover:border-zinc-300' 
      : 'bg-zinc-950/25 border-white/[0.04] group-hover:bg-zinc-900/35 group-hover:border-white/[0.07]',
    titleColor: isInverted ? 'text-zinc-800' : 'text-zinc-200',
    checkColor: isInverted ? 'text-zinc-500 hover:text-black' : 'text-zinc-500 hover:text-white',
  };

  if (isDone) {
    return {
      tabBg: isInverted ? 'bg-zinc-300' : 'bg-zinc-800/60',
      tabText: isInverted ? 'text-zinc-500' : 'text-zinc-400',
      bodyBg: isInverted
        ? 'bg-zinc-100/50 border-zinc-200/50 opacity-60'
        : 'bg-zinc-900/10 border-white/[0.015] opacity-50 hover:opacity-85',
      titleColor: isInverted ? 'text-zinc-450 line-through' : 'text-zinc-500 line-through',
      checkColor: isInverted ? 'text-zinc-400' : 'text-zinc-550',
    };
  }

  if (isSkipped) {
    return {
      tabBg: isInverted ? 'bg-zinc-150' : 'bg-zinc-900/40',
      tabText: isInverted ? 'text-zinc-400' : 'text-zinc-600',
      bodyBg: isInverted
        ? 'bg-zinc-50/30 border-zinc-100/50 opacity-40'
        : 'bg-zinc-950/20 border-white/[0.01] opacity-30',
      titleColor: isInverted ? 'text-zinc-400 line-through' : 'text-zinc-650 line-through',
      checkColor: isInverted ? 'text-zinc-400' : 'text-zinc-600',
    };
  }

  const c = (cat || '').toLowerCase();

  if (c.includes('work') || c.includes('code') || c.includes('dev') || c.includes('dsa')) {
    return {
      tabBg: 'bg-[#FF5722]',
      tabText: 'text-white font-extrabold',
      bodyBg: isInverted
        ? 'bg-white border-[#FF5722]/20 hover:bg-[#FFF8F6] hover:border-[#FF5722]/45 shadow-sm'
        : 'bg-[#FF5722]/[0.02] border-[#FF5722]/15 hover:border-[#FF5722]/30 hover:bg-[#FF5722]/[0.05] shadow-[0_2px_8px_rgba(0,0,0,0.5)]',
      titleColor: isInverted ? 'text-[#BF360C]' : 'text-zinc-150',
      checkColor: isInverted ? 'text-[#FF5722] hover:text-[#BF360C]' : 'text-[#FF5722] hover:text-[#FF8A65]',
    };
  }

  if (c.includes('study') || c.includes('read') || c.includes('learn') || c.includes('review')) {
    return {
      tabBg: 'bg-[#FFC107]',
      tabText: 'text-[#451A03] font-extrabold',
      bodyBg: isInverted
        ? 'bg-white border-[#FFC107]/20 hover:bg-[#FFFDF6] hover:border-[#FFC107]/45 shadow-sm'
        : 'bg-[#FFC107]/[0.02] border-[#FFC107]/15 hover:border-[#FFC107]/30 hover:bg-[#FFC107]/[0.05] shadow-[0_2px_8px_rgba(0,0,0,0.5)]',
      titleColor: isInverted ? 'text-[#7F5F00]' : 'text-zinc-150',
      checkColor: isInverted ? 'text-[#FFC107] hover:text-[#7F5F00]' : 'text-[#FFC107] hover:text-[#FFE082]',
    };
  }

  if (c.includes('health') || c.includes('gym') || c.includes('sport') || c.includes('run') || c.includes('exercise')) {
    return {
      tabBg: 'bg-[#E91E63]',
      tabText: 'text-white font-extrabold',
      bodyBg: isInverted
        ? 'bg-white border-[#E91E63]/20 hover:bg-[#FFF6F9] hover:border-[#E91E63]/45 shadow-sm'
        : 'bg-[#E91E63]/[0.02] border-[#E91E63]/15 hover:border-[#E91E63]/30 hover:bg-[#E91E63]/[0.05] shadow-[0_2px_8px_rgba(0,0,0,0.5)]',
      titleColor: isInverted ? 'text-[#880E4F]' : 'text-zinc-150',
      checkColor: isInverted ? 'text-[#E91E63] hover:text-[#880E4F]' : 'text-[#E91E63] hover:text-[#F06292]',
    };
  }

  if (c.includes('life') || c.includes('personal') || c.includes('chill') || c.includes('break')) {
    return {
      tabBg: 'bg-[#8BC34A]',
      tabText: 'text-[#1A2F0F] font-extrabold',
      bodyBg: isInverted
        ? 'bg-white border-[#8BC34A]/20 hover:bg-[#F9FCF6] hover:border-[#8BC34A]/45 shadow-sm'
        : 'bg-[#8BC34A]/[0.02] border-[#8BC34A]/15 hover:border-[#8BC34A]/30 hover:bg-[#8BC34A]/[0.05] shadow-[0_2px_8px_rgba(0,0,0,0.5)]',
      titleColor: isInverted ? 'text-[#33691E]' : 'text-zinc-150',
      checkColor: isInverted ? 'text-[#8BC34A] hover:text-[#33691E]' : 'text-[#8BC34A] hover:text-[#AED581]',
    };
  }

  return defaultTheme;
};

export const BlockCard: React.FC<BlockCardProps> = ({
  block,
  onStatusToggle,
  onEditBlock,
  onDeleteBlock,
  onViewNote,
  isInverted = false,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    touchAction: 'none',
  };

  const isYouTube =
    block.custom_link &&
    (block.custom_link.includes('youtube.com') || block.custom_link.includes('youtu.be'));

  const isDone = block.status === 'done';
  const isSkipped = block.status === 'skipped';

  const theme = getCategoryTheme(block.category, isDone, isSkipped, isInverted);

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      whileHover={{ x: 2.5 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className="group relative flex items-center w-full min-h-[46px] cursor-grab active:cursor-grabbing select-none overflow-visible"
    >
      {/* Left Compartment: Solid Time Tab (Rips to the left on done) */}
      <motion.div
        animate={isDone ? { x: -10, y: 5, rotate: -4, opacity: 0.45 } : { x: 0, y: 0, rotate: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className={`flex flex-col items-center justify-center py-2.5 px-2 shrink-0 text-center min-w-[76px] self-stretch rounded-l-xl transition-colors duration-200 relative overflow-visible ${theme.tabBg} ${theme.tabText}`}
      >
        <span className="font-numbers font-bold text-[10px] tracking-tight leading-none">{block.start_time}</span>
        <span className="font-numbers text-[8px] opacity-75 mt-1 leading-none">{block.end_time}</span>

        {/* Perforations on the ripped right edge */}
        {isDone ? (
          <svg 
            viewBox="0 0 10 100" 
            preserveAspectRatio="none" 
            className="absolute right-0 top-0 bottom-0 w-[6px] h-full translate-x-[3px] pointer-events-none z-10"
          >
            <path
              d="M10,0 L0,0 L2,8 L0,16 L3,24 L1,32 L2,40 L0,48 L3,56 L1,64 L2,72 L0,80 L3,88 L1,96 L0,100 L10,100 Z"
              fill={isInverted ? '#f4f5f7' : '#09090b'}
              stroke={isInverted ? '#d4d4d8' : 'rgba(0,0,0,0.45)'}
              strokeWidth="1.5"
            />
          </svg>
        ) : (
          <div className="absolute right-0 top-1 bottom-1 w-[1px] border-r border-dashed border-black/25 z-20" />
        )}
      </motion.div>

      {/* Right Compartment: Card Body (Rips to the right on done) */}
      <motion.div
        animate={isDone ? { x: 8, y: -2, rotate: 2, opacity: 0.6 } : { x: 0, y: 0, rotate: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className={`flex items-center gap-2.5 flex-1 min-w-0 py-2 px-3 relative self-stretch rounded-r-xl border border-l-0 transition-all duration-200 overflow-hidden ${theme.bodyBg}`}
      >
        {/* Perforations on the ripped left edge */}
        {isDone ? (
          <svg 
            viewBox="0 0 10 100" 
            preserveAspectRatio="none" 
            className="absolute left-0 top-0 bottom-0 w-[6px] h-full -translate-x-[3px] pointer-events-none z-10"
          >
            <path
              d="M0,0 L10,0 L8,8 L10,16 L7,24 L9,32 L8,40 L10,48 L7,56 L9,64 L8,72 L10,80 L7,88 L9,96 L10,100 L0,100 Z"
              fill={isInverted ? '#f4f5f7' : '#09090b'}
              stroke={isInverted ? '#d4d4d8' : 'rgba(0,0,0,0.45)'}
              strokeWidth="1.5"
            />
          </svg>
        ) : (
          <div className="absolute left-0 top-1 bottom-1 w-[1px] border-l border-dashed border-black/25 z-20" />
        )}

        {/* Status checkbox */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onStatusToggle(block.id, isDone ? 'planned' : 'done');
          }}
          className={`shrink-0 ${theme.checkColor} transition-colors focus:outline-none cursor-pointer`}
          title={isDone ? 'Mark planned' : 'Mark done'}
        >
          {isDone ? (
            <CheckCircle2 className={`w-3.5 h-3.5 ${isInverted ? 'text-black fill-black stroke-white' : 'text-white fill-white stroke-black'}`} />
          ) : isSkipped ? (
            <XCircle className="w-3.5 h-3.5 text-zinc-400" />
          ) : (
            <Circle className="w-3.5 h-3.5 transition-colors" />
          )}
        </button>

        {/* Task Title */}
        <h4
          className={`font-heading font-medium text-xs leading-snug flex-grow min-w-0 pr-[72px] ${theme.titleColor}`}
          title={block.title}
        >
          {block.title}
        </h4>

        {/* Actions Overlay Container (Positioned absolutely on the right) */}
        <div className="absolute right-3 flex items-center justify-end h-6 min-w-[70px] select-none">
          {/* Default View: Category Pill */}
          <div className="group-hover:opacity-0 group-hover:pointer-events-none opacity-100 transition-all duration-150 flex items-center gap-1.5 absolute right-0">
            {block.recurrence_rule && <Repeat className="w-3 h-3 text-zinc-550 shrink-0" />}
            {block.notes_id && <FileText className="w-3 h-3 text-zinc-550 shrink-0" />}
            {block.custom_link && (isYouTube ? <Youtube className="w-3 h-3 text-red-500 shrink-0" /> : <ExternalLink className="w-3 h-3 text-zinc-550 shrink-0" />)}
            
            <span className={`font-mono text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded ${isInverted ? 'bg-black/[0.05] border border-black/[0.04] text-zinc-500' : 'bg-white/[0.04] border border-white/[0.03] text-zinc-450'} font-semibold`}>
              {block.category}
            </span>
          </div>

          {/* Hover View: Action Icons */}
          <div className="opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-150 flex items-center gap-0.5 absolute right-0 bg-transparent">
            {block.notes_id && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onViewNote) onViewNote(block.notes_id!);
                }}
                className={`p-1 ${isInverted ? 'text-zinc-500 hover:text-black hover:bg-black/[0.04]' : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'} rounded cursor-pointer`}
                title="View note"
              >
                <FileText className="w-3.5 h-3.5" />
              </button>
            )}
            
            {block.custom_link && (
              <a
                href={block.custom_link}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className={`p-1 ${isInverted ? 'text-zinc-500 hover:text-black hover:bg-black/[0.04]' : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'} rounded cursor-pointer`}
                title={isYouTube ? 'Open YouTube Video' : 'Open Link'}
              >
                {isYouTube ? <Youtube className="w-3.5 h-3.5 text-red-500" /> : <ExternalLink className="w-3.5 h-3.5" />}
              </a>
            )}

            {!block.custom_link && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEditBlock(block);
                }}
                className={`p-1 ${isInverted ? 'text-zinc-500 hover:text-black hover:bg-black/[0.04]' : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'} rounded cursor-pointer`}
                title="Attach link"
              >
                <LinkIcon className="w-3.5 h-3.5" />
              </button>
            )}

            <a
              href={getGoogleCalendarUrl(block)}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={`p-1 ${isInverted ? 'text-zinc-500 hover:text-blue-600 hover:bg-black/[0.04]' : 'text-zinc-400 hover:text-blue-400 hover:bg-white/[0.04]'} rounded cursor-pointer`}
              title="Add to Google Calendar"
            >
              <Calendar className="w-3.5 h-3.5" />
            </a>

            <div
              className={`p-1 ${isInverted ? 'text-zinc-500 hover:text-black hover:bg-black/[0.04]' : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'} rounded cursor-pointer`}
              title="Drag to reschedule"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditBlock(block);
              }}
              className={`p-1 ${isInverted ? 'text-zinc-500 hover:text-black hover:bg-black/[0.04]' : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'} rounded cursor-pointer`}
              title="Edit block"
            >
              <Edit2 className="w-3 h-3" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteBlock(block.id);
              }}
              className={`p-1 ${isInverted ? 'text-zinc-500 hover:text-rose-600 hover:bg-black/[0.04]' : 'text-zinc-400 hover:text-rose-450 hover:bg-white/[0.04]'} rounded cursor-pointer`}
              title="Delete block"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
