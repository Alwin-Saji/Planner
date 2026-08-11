import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { fluidSpring } from './useOptimizedAnimation';

interface RadioCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
  itemId?: string;
  groupHoveredId?: string | null;
  onGroupHover?: (id: string | null) => void;
  layoutId?: string;
}

export const RadioCard: React.FC<RadioCardProps> = ({
  icon: Icon,
  title,
  description,
  selected,
  onClick,
  className = '',
  disabled = false,
  itemId,
  groupHoveredId = null,
  onGroupHover,
  layoutId = 'radio-card-selection',
}) => {
  const isHovered = itemId != null && groupHoveredId === itemId;
  const isDimmed = itemId != null && groupHoveredId !== null && groupHoveredId !== itemId;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      role="radio"
      aria-checked={selected}
      aria-describedby={`${title.toLowerCase().replace(/\s+/g, '-')}-desc`}
      onMouseEnter={() => onGroupHover?.(itemId ?? null)}
      onMouseLeave={() => onGroupHover?.(null)}
      animate={{
        opacity: isDimmed ? 0.45 : 1,
      }}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      transition={fluidSpring}
      style={{ willChange: 'opacity' }}
      className={`
        relative py-4 pr-4 text-left min-h-[90px] bg-transparent
        transition-colors duration-300
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
    >
      <div className="relative z-10 space-y-1">
        <div className="flex items-center gap-2.5">
          <Icon
            className={`w-4 h-4 transition-colors duration-300 ${selected ? 'text-white' : 'text-zinc-500'}`}
            aria-hidden="true"
          />
          <h4
            className={`font-heading font-bold text-sm transition-colors duration-300 ${
              selected ? 'text-white' : 'text-zinc-400'
            }`}
          >
            {title}
          </h4>
          {selected && (
            <motion.div
              layoutId={layoutId + '-bullet'}
              className="w-1.5 h-1.5 rounded-full bg-white ml-1"
              transition={fluidSpring}
            />
          )}
        </div>
        <p
          id={`${title.toLowerCase().replace(/\s+/g, '-')}-desc`}
          className={`text-xs font-mono leading-relaxed transition-colors duration-300 ${
            selected ? 'text-zinc-300' : 'text-zinc-600'
          }`}
        >
          {description}
        </p>
      </div>
    </motion.button>
  );
};
