import React, { useRef, useLayoutEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { fluidSpring } from './useOptimizedAnimation';

interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  description?: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  ariaLabel?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = '',
  ariaLabel,
}: SegmentedControlProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const [hoveredValue, setHoveredValue] = useState<T | null>(null);
  const buttonRefs = useRef<Map<T, HTMLButtonElement>>(new Map());

  useLayoutEffect(() => {
    const selectedButton = buttonRefs.current.get(value);
    if (selectedButton && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const buttonRect = selectedButton.getBoundingClientRect();
      setIndicatorStyle({
        left: buttonRect.left - containerRect.left,
        width: buttonRect.width,
      });
    }
  }, [value, options]);

  const handleKeyDown = (e: React.KeyboardEvent, currentValue: T) => {
    const currentIndex = options.findIndex(opt => opt.value === currentValue);

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = (currentIndex + 1) % options.length;
      onChange(options[nextIndex].value);
      buttonRefs.current.get(options[nextIndex].value)?.focus();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = (currentIndex - 1 + options.length) % options.length;
      onChange(options[prevIndex].value);
      buttonRefs.current.get(options[prevIndex].value)?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      onChange(options[0].value);
      buttonRefs.current.get(options[0].value)?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      const lastOption = options[options.length - 1];
      onChange(lastOption.value);
      buttonRefs.current.get(lastOption.value)?.focus();
    }
  };

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label={ariaLabel}
      onMouseLeave={() => setHoveredValue(null)}
      className={`relative inline-flex bg-transparent border-b border-white/10 w-full ${className}`}
    >
      <motion.div
        className="absolute bottom-0 h-[2px] bg-white"
        initial={false}
        animate={{
          left: indicatorStyle.left,
          width: indicatorStyle.width,
        }}
        transition={fluidSpring}
        style={{ willChange: 'left, width' }}
      />

      {options.map((option) => {
        const Icon = option.icon;
        const isSelected = value === option.value;
        const isHovered = hoveredValue === option.value;
        const isDimmed = hoveredValue !== null && !isHovered;

        return (
          <motion.button
            key={option.value}
            ref={(el) => {
              if (el) buttonRefs.current.set(option.value, el);
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => handleKeyDown(e, option.value)}
            onMouseEnter={() => setHoveredValue(option.value)}
            title={option.description}
            animate={{
              opacity: isDimmed ? 0.45 : 1,
            }}
            transition={fluidSpring}
            className={`
              relative z-10 flex flex-1 items-center justify-center gap-2 px-4 py-2.5
              text-xs font-medium min-h-[44px] bg-transparent transition-colors duration-300
              ${isSelected ? 'text-white' : 'text-zinc-500'}
            `}
          >
            {Icon && <Icon className="w-4 h-4" aria-hidden="true" />}
            <span className="font-heading font-bold">{option.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
