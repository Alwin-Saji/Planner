import React, { useState } from 'react';
import { Clock, Youtube, Target, Lightbulb, Calendar, List, Timer, BookOpen, Hammer, Rocket, Zap, Briefcase, ArrowLeft, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SkillLevel, LearningGoal, VideoType } from './types';
import { SegmentedControl, RadioCard, StatCard, fluidSpring } from './primitives';

interface StudyPlanDiagnosticFormProps {
  topic: string;
  setTopic: (val: string) => void;
  hoursPerDay: number;
  setHoursPerDay: (val: number) => void;
  durationDays: number;
  setDurationDays: (val: number) => void;
  skillLevel: SkillLevel;
  setSkillLevel: (val: SkillLevel) => void;
  learningGoal: LearningGoal;
  setLearningGoal: (val: LearningGoal) => void;
  learningContext: string;
  setLearningContext: (val: string) => void;
  specificFocus: string;
  setSpecificFocus: (val: string) => void;
  videoType: VideoType;
  setVideoType: (val: VideoType) => void;
  longCourseUrl: string;
  setLongCourseUrl: (val: string) => void;
  category: string;
  setCategory: (val: string) => void;
  startDate: string;
  setStartDate: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isFetchingChannels?: boolean;
}

const HOUR_OPTIONS = [
  { value: 1, label: '1h' },
  { value: 1.5, label: '1.5h' },
  { value: 2, label: '2h' },
  { value: 3, label: '3h' },
  { value: 4, label: '4h' },
  { value: 5, label: '5h+' },
] as const;

export const StudyPlanDiagnosticForm: React.FC<StudyPlanDiagnosticFormProps> = ({
  topic,
  setTopic,
  hoursPerDay,
  setHoursPerDay,
  durationDays,
  setDurationDays,
  skillLevel,
  setSkillLevel,
  learningGoal,
  setLearningGoal,
  learningContext,
  setLearningContext,
  specificFocus,
  setSpecificFocus,
  videoType,
  setVideoType,
  longCourseUrl,
  setLongCourseUrl,
  category,
  setCategory,
  startDate,
  setStartDate,
  onSubmit,
  isFetchingChannels,
}) => {
  const totalSessions = durationDays * (hoursPerDay > 1.5 ? 2 : 1);
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);
  const [hoveredSkill, setHoveredSkill] = useState<string | null>(null);
  const [hoveredGoal, setHoveredGoal] = useState<string | null>(null);

  // Sub-wizard step tracking: 1, 2, or 3
  const [subStep, setSubStep] = useState(1);

  return (
    <form onSubmit={onSubmit} className="max-w-6xl mx-auto py-8 overflow-y-auto max-h-full pr-2 space-y-10">
      {/* Sub-step indicator */}
      <div className="flex items-center gap-4 mb-4 font-mono text-[10px] text-zinc-550 font-bold uppercase tracking-widest">
        <span>Step {subStep} of 3</span>
        <div className="flex-1 h-0.5 bg-white/5 rounded-full overflow-hidden">
          <div 
            className="h-full bg-white transition-all duration-300" 
            style={{ width: `${(subStep / 3) * 100}%` }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* Step 1: Core Topic & Format */}
        {subStep === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="space-y-2">
              <h3 className="font-heading font-bold text-lg text-white">What is the focus of your study plan?</h3>
              <p className="text-xs font-mono text-zinc-555">Provide the primary topic and select how you want to consume the learning material.</p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500 mb-2">
                  Topic / Course Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Go language, React, Machine Learning, DSA"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full bg-transparent border-b border-white/10 hover:border-white/20 focus:border-white py-2.5 text-sm text-white placeholder-zinc-700 transition-colors focus:outline-none rounded-none"
                />
              </div>

              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500">
                    Learning Format
                  </label>
                </div>

                <SegmentedControl
                  options={[
                    {
                      value: 'playlist' as const,
                      label: 'Playlist',
                      icon: List,
                      description: 'AI recommends playlists with multiple videos. Each session covers 1–2 videos in sequence.',
                    },
                    {
                      value: 'long_course' as const,
                      label: 'Long Course',
                      icon: Timer,
                      description: 'One long video (6–20 hrs). Split into sessions by chapter timestamps automatically.',
                    },
                  ]}
                  value={videoType}
                  onChange={setVideoType}
                  ariaLabel="Select learning format"
                  className="w-full"
                />

                <AnimatePresence mode="wait">
                  {videoType === 'long_course' && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={fluidSpring}
                      className="overflow-hidden"
                    >
                      <div className="pt-2 space-y-2">
                        <label className="block text-[10px] font-mono text-zinc-500 flex items-center gap-1.5 justify-between w-full">
                          <span className="flex items-center gap-1.5">
                            <Youtube className="w-3.5 h-3.5 text-red-500" />
                            Long Course YouTube URL *
                          </span>
                          {!longCourseUrl.trim() && (
                            <span className="text-[9px] text-red-400 font-bold uppercase tracking-wider animate-pulse">Required</span>
                          )}
                        </label>
                        <input
                          type="url"
                          required
                          placeholder="https://www.youtube.com/watch?v=..."
                          value={longCourseUrl}
                          onChange={(e) => setLongCourseUrl(e.target.value)}
                          className="w-full bg-transparent border-b border-white/10 hover:border-white/20 focus:border-white py-2 text-xs text-white placeholder-zinc-700 transition-colors focus:outline-none rounded-none"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 2: Depth & Goals */}
        {subStep === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="space-y-2">
              <h3 className="font-heading font-bold text-lg text-white">Define your learning path & objectives</h3>
              <p className="text-xs font-mono text-zinc-555">Tailor the scope of generated material by sharing your goals and experience level.</p>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-2">
                  <Target className="w-4 h-4 text-zinc-500" />
                  <span>What do you want to build or achieve? <span className="text-zinc-650 font-normal">(Recommended)</span></span>
                </label>
                <textarea
                  rows={2}
                  placeholder='"Build a web server with Go", "Prepare for a React developer interview", "Understand ML for data science"'
                  value={learningContext}
                  onChange={(e) => setLearningContext(e.target.value)}
                  className="w-full bg-transparent border-b border-white/10 hover:border-white/20 focus:border-white py-2 text-xs text-white placeholder-zinc-700 transition-colors focus:outline-none rounded-none resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-amber-500/80" />
                  <span>Specific area or subtopic to focus on <span className="text-zinc-650 font-normal">(Optional)</span></span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. goroutines & concurrency, hooks & state management, neural networks"
                  value={specificFocus}
                  onChange={(e) => setSpecificFocus(e.target.value)}
                  className="w-full bg-transparent border-b border-white/10 hover:border-white/20 focus:border-white py-2 text-xs text-white placeholder-zinc-700 transition-colors focus:outline-none rounded-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
                <div className="space-y-3">
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500">
                    Current Skill Level
                  </label>
                  <div className="flex flex-col space-y-1" onMouseLeave={() => setHoveredSkill(null)}>
                    <RadioCard
                      itemId="beginner"
                      groupHoveredId={hoveredSkill}
                      onGroupHover={setHoveredSkill}
                      layoutId="skill-level-selection"
                      icon={BookOpen}
                      title="Beginner"
                      description="Start from fundamentals and core syntax"
                      selected={skillLevel === 'beginner'}
                      onClick={() => setSkillLevel('beginner')}
                    />
                    <RadioCard
                      itemId="intermediate"
                      groupHoveredId={hoveredSkill}
                      onGroupHover={setHoveredSkill}
                      layoutId="skill-level-selection"
                      icon={Hammer}
                      title="Intermediate"
                      description="Build real projects and applications"
                      selected={skillLevel === 'intermediate'}
                      onClick={() => setSkillLevel('intermediate')}
                    />
                    <RadioCard
                      itemId="advanced"
                      groupHoveredId={hoveredSkill}
                      onGroupHover={setHoveredSkill}
                      layoutId="skill-level-selection"
                      icon={Rocket}
                      title="Advanced"
                      description="Deep dive into optimization and patterns"
                      selected={skillLevel === 'advanced'}
                      onClick={() => setSkillLevel('advanced')}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500">
                    Primary Learning Goal
                  </label>
                  <div className="flex flex-col space-y-1" onMouseLeave={() => setHoveredGoal(null)}>
                    <RadioCard
                      itemId="comprehensive"
                      groupHoveredId={hoveredGoal}
                      onGroupHover={setHoveredGoal}
                      layoutId="learning-goal-selection"
                      icon={Target}
                      title="Comprehensive"
                      description="Complete mastery with depth and breadth"
                      selected={learningGoal === 'comprehensive'}
                      onClick={() => setLearningGoal('comprehensive')}
                    />
                    <RadioCard
                      itemId="crash_course"
                      groupHoveredId={hoveredGoal}
                      onGroupHover={setHoveredGoal}
                      layoutId="learning-goal-selection"
                      icon={Zap}
                      title="Crash Course"
                      description="Fast overview of essential concepts"
                      selected={learningGoal === 'crash_course'}
                      onClick={() => setLearningGoal('crash_course')}
                    />
                    <RadioCard
                      itemId="interview"
                      groupHoveredId={hoveredGoal}
                      onGroupHover={setHoveredGoal}
                      layoutId="learning-goal-selection"
                      icon={Briefcase}
                      title="Interview Prep"
                      description="Problem solving and technical interviews"
                      selected={learningGoal === 'interview'}
                      onClick={() => setLearningGoal('interview')}
                    />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 3: Commitment & Schedule */}
        {subStep === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="grid grid-cols-1 md:grid-cols-12 gap-12 items-start"
          >
            {/* Left side: Clean visual big readout block */}
            <div className="md:col-span-5 space-y-8 py-4">
              <div className="space-y-1">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-500">Estimated Plan Output</span>
                <h4 className="text-zinc-400 font-mono text-xs">Based on your committed time details:</h4>
              </div>
              
              <div className="space-y-6">
                <div>
                  <div className="text-4xl font-heading font-extrabold text-white">{durationDays}</div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-550 mt-1">Study Days</div>
                </div>
                <div>
                  <div className="text-4xl font-heading font-extrabold text-white">{hoursPerDay}h</div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-550 mt-1">Hours Per Day</div>
                </div>
                <div>
                  <div className="text-4xl font-heading font-extrabold text-white">≈ {totalSessions}</div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-550 mt-1">Total Learning Sessions</div>
                </div>
              </div>
            </div>

            {/* Right side: Sliders and metadata input */}
            <div className="md:col-span-7 space-y-6">
              <div className="space-y-4 pb-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-500">Configure Commitment</span>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-zinc-400">Duration Days</span>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={durationDays}
                      onChange={(e) => {
                        const v = Math.max(1, Math.min(60, Number(e.target.value) || 7));
                        setDurationDays(v);
                      }}
                      className="w-16 bg-transparent border-b border-white/10 hover:border-white/20 focus:border-white text-white text-center text-sm font-bold py-1 focus:outline-none transition-colors rounded-none [color-scheme:dark]"
                    />
                  </div>

                  <div className="relative pt-2">
                    <input
                      type="range"
                      min={1}
                      max={60}
                      step={1}
                      value={durationDays}
                      onChange={(e) => setDurationDays(Number(e.target.value))}
                      className="w-full accent-white cursor-pointer h-1 bg-white/10"
                      style={{
                        background: `linear-gradient(to right, white 0%, white ${(durationDays / 60) * 100}%, rgba(255,255,255,0.08) ${(durationDays / 60) * 100}%, rgba(255,255,255,0.08) 100%)`
                      }}
                    />
                    <div className="flex justify-between mt-2 px-1">
                      {[7, 14, 21, 30].map((milestone) => (
                        <button
                          key={milestone}
                          type="button"
                          onClick={() => setDurationDays(milestone)}
                          className={`text-[10px] font-mono font-bold transition-colors duration-300 tactile ${
                            Math.abs(durationDays - milestone) < 3 ? 'text-white' : 'text-zinc-600 hover:text-zinc-400'
                          }`}
                        >
                          {milestone}d
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <span className="text-xs font-mono text-zinc-400">Hours committed per day</span>
                  <div className="grid grid-cols-6 gap-2" onMouseLeave={() => setHoveredHour(null)}>
                    {HOUR_OPTIONS.map((option) => {
                      const isSelected = hoursPerDay === option.value;
                      const isHovered = hoveredHour === option.value;
                      const isDimmed = hoveredHour !== null && !isHovered;

                      return (
                        <motion.button
                          key={option.value}
                          type="button"
                          onClick={() => setHoursPerDay(option.value)}
                          onMouseEnter={() => setHoveredHour(option.value)}
                          animate={{ opacity: isDimmed ? 0.4 : 1 }}
                          className={`
                            px-1 py-2.5 font-mono text-xs font-bold cursor-pointer transition-colors duration-300 text-center
                            ${isSelected ? 'text-white border-b-2 border-white' : 'text-zinc-600 hover:text-zinc-400 border-b border-white/5'}
                          `}
                        >
                          {option.label}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8 pt-4">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500">
                      Category
                    </label>
                    <input
                      type="text"
                      placeholder="DSA, WebDev, ML"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full bg-transparent border-b border-white/10 hover:border-white/20 focus:border-white py-2 text-xs text-white placeholder-zinc-700 transition-colors focus:outline-none rounded-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500">
                      Start Date
                    </label>
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-transparent border-b border-white/10 hover:border-white/20 focus:border-white py-2 text-xs text-white placeholder-zinc-700 transition-colors focus:outline-none rounded-none [color-scheme:dark]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between pt-8 mt-4 border-t border-white/10">
        {subStep > 1 ? (
          <button
            type="button"
            onClick={() => setSubStep(prev => prev - 1)}
            className="flex items-center gap-2 text-xs font-mono text-zinc-500 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
        ) : (
          <div />
        )}

        {subStep < 3 ? (
          <button
            type="button"
            onClick={() => setSubStep(prev => prev + 1)}
            disabled={subStep === 1 && (!topic.trim() || (videoType === 'long_course' && !longCourseUrl.trim()))}
            className="flex items-center gap-2 bg-white text-black hover:bg-zinc-900 hover:text-white transition-colors px-6 py-2.5 rounded-lg text-xs font-bold font-mono disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <span>Continue</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <motion.button
            type="submit"
            disabled={!topic.trim() || isFetchingChannels || (videoType === 'long_course' && !longCourseUrl.trim())}
            whileHover={{ scale: 1.01, y: -1 }}
            whileTap={{ scale: 0.98 }}
            transition={fluidSpring}
            className="bg-white text-black hover:bg-zinc-900 hover:text-white transition-all duration-300 px-8 py-3.5 rounded-lg font-heading font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isFetchingChannels ? (
              <span>AI Reasoning &amp; Searching Resources...</span>
            ) : (
              <>
                <Youtube className="w-5 h-5" />
                <span>
                  {videoType === 'playlist'
                    ? 'Find Recommended Playlists & Channels →'
                    : 'Analyse Course & Build Schedule →'}
                </span>
              </>
            )}
          </motion.button>
        )}
      </div>
    </form>
  );
};
