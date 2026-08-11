/**
 * Demo component to showcase all UI primitives
 * This can be used for testing and visual verification
 * To use: Import and render in your app temporarily
 */

import React, { useState } from 'react';
import { BookOpen, Target, Zap, Calendar } from 'lucide-react';
import { SegmentedControl } from './SegmentedControl';
import { RadioCard } from './RadioCard';
import { StatCard } from './StatCard';
import { useHoverScale } from './useHoverScale';
import { motion } from 'framer-motion';

export const PrimitivesDemo: React.FC = () => {
  const [selectedFormat, setSelectedFormat] = useState<'playlist' | 'course'>('playlist');
  const [selectedSkill, setSelectedSkill] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
  const [sessionCount, setSessionCount] = useState(14);

  const { hoverProps, animatedStyle } = useHoverScale();

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-8 bg-background min-h-screen">
      <div className="space-y-2">
        <h1 className="font-heading text-2xl font-bold text-white">UI Primitives Demo</h1>
        <p className="text-sm text-text-secondary font-mono">
          Testing SegmentedControl, RadioCard, StatCard, and useHoverScale hook
        </p>
      </div>

      {/* SegmentedControl Demo */}
      <section className="space-y-3">
        <h2 className="font-heading text-lg font-bold text-white">SegmentedControl</h2>
        <SegmentedControl
          options={[
            {
              value: 'playlist',
              label: 'Playlist',
              icon: BookOpen,
              description: 'Multiple videos in sequence',
            },
            {
              value: 'course',
              label: 'Long Course',
              icon: Target,
              description: 'Single long-form video',
            },
          ]}
          value={selectedFormat}
          onChange={setSelectedFormat}
          ariaLabel="Learning format selector"
        />
        <p className="text-xs text-text-muted font-mono">
          Selected: <span className="text-white">{selectedFormat}</span>
        </p>
      </section>

      {/* RadioCard Demo */}
      <section className="space-y-3">
        <h2 className="font-heading text-lg font-bold text-white">RadioCard Grid</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <RadioCard
            icon={BookOpen}
            title="Beginner"
            description="Start from fundamentals and core concepts"
            selected={selectedSkill === 'beginner'}
            onClick={() => setSelectedSkill('beginner')}
          />
          <RadioCard
            icon={Target}
            title="Intermediate"
            description="Build real projects and applications"
            selected={selectedSkill === 'intermediate'}
            onClick={() => setSelectedSkill('intermediate')}
          />
          <RadioCard
            icon={Zap}
            title="Advanced"
            description="Deep dive into optimization and patterns"
            selected={selectedSkill === 'advanced'}
            onClick={() => setSelectedSkill('advanced')}
          />
        </div>
        <p className="text-xs text-text-muted font-mono">
          Selected skill: <span className="text-white">{selectedSkill}</span>
        </p>
      </section>

      {/* StatCard Demo */}
      <section className="space-y-3">
        <h2 className="font-heading text-lg font-bold text-white">StatCard</h2>
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={Calendar}
            label="Sessions Total"
            value={sessionCount}
            animate={true}
          />
          <StatCard
            label="Days Remaining"
            value="7d"
            animate={false}
          />
        </div>
        <button
          onClick={() => setSessionCount(prev => prev + 1)}
          className="px-4 py-2 bg-white text-black rounded-lg font-mono text-xs font-bold hover:bg-surface-hover hover:text-white border border-white transition-all"
        >
          Increment Session Count
        </button>
      </section>

      {/* useHoverScale Demo */}
      <section className="space-y-3">
        <h2 className="font-heading text-lg font-bold text-white">useHoverScale Hook</h2>
        <motion.div
          {...hoverProps}
          style={animatedStyle}
          className="p-6 bg-surface border border-border rounded-xl cursor-pointer"
        >
          <p className="text-sm text-white font-mono">
            Hover and click me to see scale interactions
          </p>
        </motion.div>
      </section>

      {/* Disabled State Demo */}
      <section className="space-y-3">
        <h2 className="font-heading text-lg font-bold text-white">Disabled States</h2>
        <RadioCard
          icon={BookOpen}
          title="Disabled Option"
          description="This card is disabled"
          selected={false}
          onClick={() => {}}
          disabled={true}
        />
      </section>
    </div>
  );
};
