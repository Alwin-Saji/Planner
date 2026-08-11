// Notification utility helper for local web push alerts & sound reminders

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('This browser does not support desktop notifications.');
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  const permission = await Notification.requestPermission();
  return permission;
}

export function sendBrowserNotification(title: string, options?: NotificationOptions) {
  if (!('Notification' in window)) return;

  if (Notification.permission === 'granted') {
    const defaultOptions: NotificationOptions = {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      silent: false,
      ...options,
    };
    
    const notification = new Notification(title, defaultOptions);
    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    // Play subtle audio alert if possible
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
      // AudioContext playback optional
    }
  }
}

// Generate Google Calendar Link directly in frontend
export function getGoogleCalendarUrl(block: {
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  category?: string;
}): string {
  const cleanDate = block.date.replace(/-/g, '');
  const cleanStart = block.start_time.replace(/:/g, '') + '00';
  const cleanEnd = block.end_time.replace(/:/g, '') + '00';

  const dates = `${cleanDate}T${cleanStart}/${cleanDate}T${cleanEnd}`;

  const baseUrl = 'https://calendar.google.com/calendar/render';
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: block.title,
    dates,
    details: `Scheduled via Chrono Planner [Category: ${block.category || 'General'}]`,
  });

  return `${baseUrl}?${params.toString()}`;
}
