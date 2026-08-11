import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Download, ExternalLink, X } from 'lucide-react';
import { requestNotificationPermission, sendBrowserNotification } from '../utils/notifications';

interface CalendarExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'sync' | 'feed' | 'notifications';

const TABS: { id: TabType; label: string }[] = [
  { id: 'sync',          label: 'Direct OAuth' },
  { id: 'feed',          label: 'iCal Feed' },
  { id: 'notifications', label: 'Reminders' },
];

export const CalendarExportModal: React.FC<CalendarExportModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<TabType>('sync');
  const [copiedFeed, setCopiedFeed] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<NotificationPermission>('default');
  const [syncMode, setSyncMode] = useState<'all' | 'disabled' | 'selected'>('all');
  const [gcalConnected, setGcalConnected] = useState(false);
  const [isCheckingGcal, setIsCheckingGcal] = useState(false);

  const baseFeedUrl = `${window.location.origin.replace(':5173', ':3001')}/api/calendar/feed.ics`;
  const feedUrl = syncMode === 'all' 
    ? baseFeedUrl 
    : `${baseFeedUrl}?mode=${syncMode}`;

  const checkGcalStatus = async () => {
    try {
      setIsCheckingGcal(true);
      const res = await fetch(`${window.location.origin.replace(':5173', ':3001')}/api/calendar/oauth/status`);
      const data = await res.json();
      setGcalConnected(!!data.connected);
    } catch (e) {
      console.warn('Failed to check GCal OAuth status:', e);
    } finally {
      setIsCheckingGcal(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if ('Notification' in window) {
        setNotificationStatus(Notification.permission);
      }
      checkGcalStatus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GCAL_CONNECTED') {
        setGcalConnected(true);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleConnectGoogleCalendar = async () => {
    try {
      const res = await fetch(`${window.location.origin.replace(':5173', ':3001')}/api/calendar/oauth/url`);
      const data = await res.json();
      if (data.url) {
        window.open(data.url, 'Connect Google Calendar', 'width=550,height=650');
      }
    } catch (e) {
      alert('Could not start Google Calendar OAuth flow.');
    }
  };

  const handleDisconnectGoogleCalendar = async () => {
    try {
      await fetch(`${window.location.origin.replace(':5173', ':3001')}/api/calendar/oauth/disconnect`, { method: 'POST' });
      setGcalConnected(false);
    } catch (e) {
      console.error('Failed to disconnect Google Calendar:', e);
    }
  };

  const handleEnableNotifications = async () => {
    const perm = await requestNotificationPermission();
    setNotificationStatus(perm);
    if (perm === 'granted') {
      sendBrowserNotification('Notifications Enabled!', {
        body: 'You will now receive alerts for upcoming task blocks in Chrono Planner.',
      });
    }
  };

  const handleTestNotification = () => {
    sendBrowserNotification('Chrono Test Reminder', {
      body: 'Your upcoming block "Deep Work Session" starts in 10 minutes.',
    });
  };

  const handleCopyFeedUrl = () => {
    navigator.clipboard.writeText(feedUrl);
    setCopiedFeed(true);
    setTimeout(() => setCopiedFeed(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 10 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          className="bg-[#050505] w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col overflow-hidden font-sans"
          style={{ maxHeight: '86vh' }}
        >
          {/* ── Header ─────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-8 pt-8 pb-5 shrink-0">
            <div>
              <h2 className="text-xl font-heading font-black text-white">
                Google Calendar & Reminders
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Sync schedules silently & manage task alerts
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-zinc-500 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ── Minimal Underlined Tab Bar ── */}
          <div className="flex gap-6 px-8 border-b border-white/[0.04] shrink-0">
            {TABS.map(({ id, label }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`relative py-2.5 text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                    isActive ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {label}
                  {isActive && (
                    <motion.div
                      initial={{ opacity: 0, scaleX: 0 }}
                      animate={{ opacity: 1, scaleX: 1 }}
                      transition={{ duration: 0.15 }}
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-white origin-left"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Clean Body Content with fixed height to prevent layout shift ── */}
          <div className="flex-1 overflow-y-auto px-8 py-6 min-h-[300px]">
            {/* ── DIRECT OAUTH ──────────────────────────────────── */}
            {activeTab === 'sync' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest block">
                      Live Integration
                    </span>
                    <span className="text-[10px] font-mono font-bold tracking-wider text-zinc-400 uppercase">
                      {isCheckingGcal ? 'Checking...' : gcalConnected ? 'Connected & Active' : 'Disconnected'}
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tight">
                    Instant OAuth Auto-Sync
                  </h3>
                  <p className="text-[11px] text-zinc-400 leading-relaxed max-w-lg">
                    Connect your Google Account to push scheduled task blocks <strong className="text-white">silently and instantly</strong> into your primary Google Calendar in real-time.
                  </p>
                </div>

                <div className="pt-2">
                  {!gcalConnected ? (
                    <button
                      onClick={handleConnectGoogleCalendar}
                      className="bg-white text-black px-6 py-2.5 rounded-full font-bold text-xs hover:bg-zinc-200 transition cursor-pointer uppercase tracking-wider shadow-lg shadow-white/5"
                    >
                      Connect Google Account
                    </button>
                  ) : (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-white font-medium flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-white inline-block animate-pulse" />
                        Live background sync active
                      </span>
                      <button
                        onClick={handleDisconnectGoogleCalendar}
                        className="text-xs text-zinc-500 hover:text-zinc-300 underline font-mono cursor-pointer transition"
                      >
                        Disconnect
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── ICAL FEED ─────────────────────────────────────── */}
            {activeTab === 'feed' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest block">
                    Subscription Feed
                  </span>
                  <h3 className="text-xl font-black text-white uppercase tracking-tight">
                    iCal Sync Feed
                  </h3>
                  <p className="text-[11px] text-zinc-400 leading-relaxed max-w-lg">
                    Choose how blocks are exported, then copy your personalized feed URL directly into Google Calendar.
                  </p>
                </div>

                {/* Scope Selection */}
                <div className="space-y-2">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest block">
                    Sync Scope
                  </span>
                  <div className="flex items-center gap-6">
                    <button
                      type="button"
                      onClick={() => setSyncMode('all')}
                      className={`text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center gap-2 ${
                        syncMode === 'all' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${syncMode === 'all' ? 'bg-white' : 'bg-zinc-700'}`} />
                      All Blocks
                    </button>

                    <button
                      type="button"
                      onClick={() => setSyncMode('selected')}
                      className={`text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center gap-2 ${
                        syncMode === 'selected' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${syncMode === 'selected' ? 'bg-white' : 'bg-zinc-700'}`} />
                      Selected Only
                    </button>

                    <button
                      type="button"
                      onClick={() => setSyncMode('disabled')}
                      className={`text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center gap-2 ${
                        syncMode === 'disabled' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${syncMode === 'disabled' ? 'bg-white' : 'bg-zinc-700'}`} />
                      Disabled
                    </button>
                  </div>
                </div>

                {/* Minimalist Underlined Input */}
                <div className="space-y-2 pt-2">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest block">
                    Feed Address
                  </span>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      readOnly
                      value={feedUrl}
                      className="flex-1 bg-transparent border-b border-white/10 pb-2 text-xs font-mono text-zinc-300 focus:outline-none focus:border-white/30"
                    />
                    <button
                      onClick={handleCopyFeedUrl}
                      className="bg-white text-black px-5 py-1.5 rounded-full font-bold text-xs hover:bg-zinc-200 transition cursor-pointer uppercase tracking-wider shrink-0"
                    >
                      {copiedFeed ? 'Copied' : 'Copy URL'}
                    </button>
                  </div>
                </div>

                {/* Action Links */}
                <div className="pt-4 flex items-center gap-6 text-xs font-bold uppercase tracking-wider">
                  <a
                    href={feedUrl}
                    download="chrono-planner.ics"
                    className="text-zinc-400 hover:text-white transition flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" /> Download `.ics`
                  </a>
                  <a
                    href="https://calendar.google.com/calendar/r/settings/addbyurl"
                    target="_blank"
                    rel="noreferrer"
                    className="transition flex items-center gap-1.5 font-extrabold hover:opacity-90"
                  >
                    <Calendar className="w-3.5 h-3.5 text-[#4285F4]" />
                    <span className="bg-gradient-to-r from-[#4285F4] via-[#EA4335] to-[#FBBC05] bg-clip-text text-transparent">
                      Google Calendar
                    </span>
                  </a>
                </div>
              </motion.div>
            )}

            {/* ── NOTIFICATIONS ─────────────────────────────────── */}
            {activeTab === 'notifications' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest block">
                      Desktop Alerts
                    </span>
                    <span className="text-[10px] font-mono font-bold tracking-wider text-zinc-400 uppercase">
                      {notificationStatus === 'granted' ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tight">
                    Browser Task Reminders
                  </h3>
                  <p className="text-[11px] text-zinc-400 leading-relaxed max-w-lg">
                    Receive instant desktop notifications and audio reminders when scheduled time blocks are starting.
                  </p>
                </div>

                <div className="pt-2">
                  {notificationStatus !== 'granted' ? (
                    <button
                      onClick={handleEnableNotifications}
                      className="bg-white text-black px-6 py-2.5 rounded-full font-bold text-xs hover:bg-zinc-200 transition cursor-pointer uppercase tracking-wider"
                    >
                      Enable Browser Notifications
                    </button>
                  ) : (
                    <button
                      onClick={handleTestNotification}
                      className="bg-white text-black px-6 py-2.5 rounded-full font-bold text-xs hover:bg-zinc-200 transition cursor-pointer uppercase tracking-wider"
                    >
                      Test Sound & Notification
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
