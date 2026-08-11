import { useCallback, useRef, useEffect } from 'react';

interface FrameRateStats {
  fps: number;
  averageFps: number;
  minFps: number;
  maxFps: number;
}

interface UseFrameRateReturn {
  stats: FrameRateStats;
  startMonitoring: () => void;
  stopMonitoring: () => void;
}

/**
 * Hook for monitoring frame rate during animations
 * Useful for development and performance testing
 */
export const useFrameRate = (): UseFrameRateReturn => {
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const fpsHistoryRef = useRef<number[]>([]);
  const animationIdRef = useRef<number>();
  const statsRef = useRef<FrameRateStats>({
    fps: 0,
    averageFps: 0,
    minFps: Infinity,
    maxFps: 0,
  });

  const calculateFps = useCallback(() => {
    const now = performance.now();
    frameCountRef.current++;

    if (now - lastTimeRef.current >= 1000) {
      const currentFps = Math.round((frameCountRef.current * 1000) / (now - lastTimeRef.current));
      
      fpsHistoryRef.current.push(currentFps);
      
      // Keep only last 60 measurements (1 minute at 1fps)
      if (fpsHistoryRef.current.length > 60) {
        fpsHistoryRef.current.shift();
      }

      const avgFps = fpsHistoryRef.current.reduce((sum, fps) => sum + fps, 0) / fpsHistoryRef.current.length;
      const minFps = Math.min(...fpsHistoryRef.current);
      const maxFps = Math.max(...fpsHistoryRef.current);

      statsRef.current = {
        fps: currentFps,
        averageFps: Math.round(avgFps),
        minFps: minFps === Infinity ? 0 : minFps,
        maxFps,
      };

      frameCountRef.current = 0;
      lastTimeRef.current = now;
    }

    animationIdRef.current = requestAnimationFrame(calculateFps);
  }, []);

  const startMonitoring = useCallback(() => {
    if (!animationIdRef.current) {
      frameCountRef.current = 0;
      lastTimeRef.current = performance.now();
      animationIdRef.current = requestAnimationFrame(calculateFps);
    }
  }, [calculateFps]);

  const stopMonitoring = useCallback(() => {
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
      animationIdRef.current = undefined;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopMonitoring();
    };
  }, [stopMonitoring]);

  return {
    stats: statsRef.current,
    startMonitoring,
    stopMonitoring,
  };
};

/**
 * Performance monitor component for development
 * Shows FPS stats overlay
 */
export const FrameRateMonitor: React.FC<{ enabled?: boolean }> = ({ enabled = false }) => {
  const { stats, startMonitoring, stopMonitoring } = useFrameRate();

  useEffect(() => {
    if (enabled) {
      startMonitoring();
    } else {
      stopMonitoring();
    }
  }, [enabled, startMonitoring, stopMonitoring]);

  if (!enabled || process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 bg-surface border border-border rounded-sm p-2 z-50 font-mono text-2xs">
      <div>FPS: {stats.fps}</div>
      <div>Avg: {stats.averageFps}</div>
      <div>Min: {stats.minFps}</div>
      <div>Max: {stats.maxFps}</div>
    </div>
  );
};