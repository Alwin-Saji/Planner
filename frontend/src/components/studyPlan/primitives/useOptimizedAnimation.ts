import { useCallback, useRef } from 'react';

interface UseOptimizedAnimationReturn {
  onAnimationStart: () => void;
  onAnimationComplete: () => void;
  getOptimizedProps: () => {
    onAnimationStart?: () => void;
    onAnimationComplete?: () => void;
  };
}

/**
 * Hook for optimizing Framer Motion animations by managing will-change property
 * Automatically adds will-change when animation starts and removes it when complete
 */
export const useOptimizedAnimation = (): UseOptimizedAnimationReturn => {
  const elementRef = useRef<HTMLElement | null>(null);

  const onAnimationStart = useCallback(() => {
    if (elementRef.current) {
      elementRef.current.style.willChange = 'transform, opacity';
    }
  }, []);

  const onAnimationComplete = useCallback(() => {
    if (elementRef.current) {
      elementRef.current.style.willChange = 'auto';
    }
  }, []);

  const getOptimizedProps = useCallback(() => ({
    onAnimationStart,
    onAnimationComplete,
  }), [onAnimationStart, onAnimationComplete]);

  return {
    onAnimationStart,
    onAnimationComplete,
    getOptimizedProps,
  };
};

/**
 * Optimized spring transition configuration for snappy, performant animations
 */
export const optimizedSpring = {
  type: 'spring' as const,
  stiffness: 500,
  damping: 30,
  mass: 0.6,
};

/**
 * Optimized spring transition for layout animations (lighter settings)
 */
export const optimizedLayoutSpring = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 35,
  mass: 0.8,
};

/**
 * Optimized transition for simple fades and small movements
 */
export const optimizedFade = {
  type: 'spring' as const,
  stiffness: 600,
  damping: 35,
  mass: 0.4,
};

/** Fluid spring — slower, smoother motion with slight overshoot */
export const fluidSpring = {
  type: 'spring' as const,
  stiffness: 280,
  damping: 24,
  mass: 0.95,
};