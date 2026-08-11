import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Terminal, ChevronRight, X, Play, Loader2 } from 'lucide-react';

interface OfflineBannerProps {
  /** Show the banner — set to true when ollamaStatus.available === false */
  show: boolean;
  /** Optional dismiss handler. If omitted, the banner is not dismissible. */
  onDismiss?: () => void;
  /** Compact mode — used inside modals (no icon strip, slimmer padding) */
  compact?: boolean;
  /** Optional callback to start Ollama service */
  onStartOllama?: () => Promise<void>;
}

/**
 * A globally styled offline warning banner for when Ollama is not reachable.
 * Uses the app's monochrome dark palette with an amber accent for visibility.
 */
export const OfflineBanner: React.FC<OfflineBannerProps> = ({ show, onDismiss, compact = false, onStartOllama }) => {
  const [isStarting, setIsStarting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // If the banner shows up again or status changes, reset starting state
  React.useEffect(() => {
    if (!show) {
      setIsStarting(false);
      setErrorMsg(null);
    }
  }, [show]);

  const handleStart = async () => {
    if (!onStartOllama) return;
    setIsStarting(true);
    setErrorMsg(null);
    try {
      await onStartOllama();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to start Ollama');
      setIsStarting(false);
    }
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: compact ? -6 : -12, scaleY: 0.92 }}
          animate={{ opacity: 1, y: 0, scaleY: 1 }}
          exit={{ opacity: 0, y: compact ? -6 : -12, scaleY: 0.92 }}
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
          className={`w-full ${compact ? '' : 'rounded-2xl'} overflow-hidden`}
          style={{ transformOrigin: 'top center' }}
        >
          <div
            className={`
              relative flex items-start gap-3 
              bg-[#141008] border border-amber-500/30
              ${compact ? 'px-4 py-3 rounded-xl' : 'px-5 py-4 rounded-2xl'}
              shadow-[0_0_24px_-4px_rgba(245,158,11,0.15)]
            `}
          >
            {/* Amber glow strip on the left */}
            <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-amber-500/70 rounded-l-2xl" />

            {/* Icon */}
            <div className="mt-0.5 p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 shrink-0">
              <WifiOff className="w-3.5 h-3.5 text-amber-400" />
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className="text-amber-300 font-semibold text-xs leading-snug">
                Ollama Offline — AI features are in template mode
              </p>
              {!compact && (
                <p className="text-amber-400/60 text-[11px] mt-1 leading-relaxed font-mono">
                  Start Ollama to get real AI-generated study plans, smart channel picks, and grounded chat answers.
                </p>
              )}

              {/* Start Ollama button inside banner */}
              {onStartOllama && !compact && (
                <div className="mt-3 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleStart}
                      disabled={isStarting}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-black bg-amber-400 hover:bg-amber-300 disabled:bg-amber-500/20 disabled:text-amber-400/50 rounded-lg transition shadow-md shadow-amber-950/20 cursor-pointer"
                    >
                      {isStarting ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Starting Ollama...
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 fill-current" />
                          Start Ollama
                        </>
                      )}
                    </button>
                    {isStarting && (
                      <span className="text-[10px] text-amber-400/60 animate-pulse font-mono">
                        Connecting to service...
                      </span>
                    )}
                  </div>
                  {errorMsg && (
                    <p className="text-[10px] text-red-400 font-mono">
                      Error: {errorMsg}
                    </p>
                  )}
                </div>
              )}

              {/* Quick command hint */}
              {!compact && (
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-black/40 border border-amber-500/20 rounded-lg px-2.5 py-1">
                    <Terminal className="w-3 h-3 text-amber-500/70 shrink-0" />
                    <code className="text-[10px] font-mono text-amber-300 select-all">ollama serve</code>
                  </div>
                  <ChevronRight className="w-3 h-3 text-amber-500/40" />
                  <div className="flex items-center gap-1.5 bg-black/40 border border-amber-500/20 rounded-lg px-2.5 py-1">
                    <Terminal className="w-3 h-3 text-amber-500/70 shrink-0" />
                    <code className="text-[10px] font-mono text-amber-300 select-all">ollama pull llama3.2</code>
                  </div>
                </div>
              )}
            </div>

            {/* Dismiss button */}
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="shrink-0 mt-0.5 p-1 rounded-lg text-amber-400/50 hover:text-amber-300 hover:bg-amber-500/10 transition"
                aria-label="Dismiss offline warning"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
