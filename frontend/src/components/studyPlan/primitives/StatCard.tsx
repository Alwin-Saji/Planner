import React from 'react';
import { LucideIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fluidSpring } from './useOptimizedAnimation';

interface StatCardProps {
  icon?: LucideIcon;
  label: string;
  value: string | number;
  className?: string;
  animate?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({
  icon: Icon,
  label,
  value,
  className = '',
  animate = true,
}) => {
  return (
    <div
      className={`
        p-3 rounded-sm bg-white/[0.03]
        ${className}
      `}
    >
      <div className="flex items-center justify-between gap-2">
        {Icon && (
          <Icon className="w-4 h-4 text-text-muted flex-shrink-0" />
        )}
        <div className="flex-1 text-right">
          <AnimatePresence mode="wait">
            {animate ? (
              <motion.p
                key={String(value)}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={fluidSpring}
                style={{ willChange: 'transform, opacity' }}
                className="text-lg font-heading font-bold text-white"
              >
                {value}
              </motion.p>
            ) : (
              <p className="text-lg font-heading font-bold text-white">
                {value}
              </p>
            )}
          </AnimatePresence>
          <p className="text-[10px] font-mono text-text-muted uppercase tracking-wide">
            {label}
          </p>
        </div>
      </div>
    </div>
  );
};
