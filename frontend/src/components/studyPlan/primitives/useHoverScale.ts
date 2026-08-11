import { useState } from 'react';
import { MotionStyle } from 'framer-motion';

interface UseHoverScaleOptions {
  scaleOnHover?: number;
  scaleOnPress?: number;
  transition?: {
    type?: string;
    stiffness?: number;
    damping?: number;
  };
}

interface UseHoverScaleReturn {
  isHovered: boolean;
  isPressed: boolean;
  hoverProps: {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    onMouseDown: () => void;
    onMouseUp: () => void;
  };
  animatedStyle: MotionStyle;
}

/**
 * Custom hook for consistent hover and press micro-interactions
 * Returns hover state and animated style props for Framer Motion
 */
export const useHoverScale = ({
  scaleOnHover = 1.02,
  scaleOnPress = 0.98,
  transition = {
    type: 'spring',
    stiffness: 400,
    damping: 25,
  },
}: UseHoverScaleOptions = {}): UseHoverScaleReturn => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const hoverProps = {
    onMouseEnter: () => setIsHovered(true),
    onMouseLeave: () => {
      setIsHovered(false);
      setIsPressed(false);
    },
    onMouseDown: () => setIsPressed(true),
    onMouseUp: () => setIsPressed(false),
  };

  const animatedStyle: MotionStyle = {
    scale: isPressed ? scaleOnPress : isHovered ? scaleOnHover : 1,
    transition,
  };

  return {
    isHovered,
    isPressed,
    hoverProps,
    animatedStyle,
  };
};
