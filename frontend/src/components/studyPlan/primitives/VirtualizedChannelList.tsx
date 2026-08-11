import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RecommendedChannel } from '../types';

interface VirtualizedChannelListProps {
  channels: RecommendedChannel[];
  renderChannel: (channel: RecommendedChannel, index: number) => React.ReactNode;
  maxVisibleItems?: number;
  className?: string;
}

/**
 * Virtualized channel list that only renders visible items for performance
 * Automatically handles large lists by limiting rendered items
 */
export const VirtualizedChannelList: React.FC<VirtualizedChannelListProps> = ({
  channels,
  renderChannel,
  maxVisibleItems = 20,
  className = '',
}) => {
  const visibleChannels = useMemo(() => {
    // For now, we'll use simple slicing. In a real implementation,
    // we could use react-window or react-virtualized for true virtualization
    return channels.length > maxVisibleItems 
      ? channels.slice(0, maxVisibleItems)
      : channels;
  }, [channels, maxVisibleItems]);

  const hasMoreItems = channels.length > maxVisibleItems;

  return (
    <div className={className}>
      <AnimatePresence mode="popLayout" initial={false}>
        {visibleChannels.map((channel, index) => 
          renderChannel(channel, index)
        )}
      </AnimatePresence>
      
      {hasMoreItems && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-4 text-center"
        >
          <p className="text-xs font-mono text-text-muted">
            Showing {visibleChannels.length} of {channels.length} channels
            <br />
            <span className="text-2xs">Use "Suggest Other Channels" to see more</span>
          </p>
        </motion.div>
      )}
    </div>
  );
};