import { useEffect, useState } from 'react';
import { Clock3 } from 'lucide-react';

function formatRemainingTime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return `${days}d ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

export function MentorshipCountdown({ deadline }) {
  const [remainingSeconds, setRemainingSeconds] = useState(null);

  useEffect(() => {
    let timer;
    const update = () => {
      const seconds = Math.max(
        0,
        Math.floor((new Date(deadline).getTime() - Date.now()) / 1000),
      );
      setRemainingSeconds(seconds);
      if (seconds === 0 && timer) window.clearInterval(timer);
    };
    const initialUpdate = window.setTimeout(update, 0);
    timer = window.setInterval(update, 1000);
    return () => {
      window.clearTimeout(initialUpdate);
      window.clearInterval(timer);
    };
  }, [deadline]);

  if (remainingSeconds === null) return <span>Starting countdown…</span>;

  return (
    <span className="inline-flex items-center gap-1.5">
      <Clock3 size={14} aria-hidden="true" />
      {remainingSeconds === 0 ? 'Deadline reached' : `${formatRemainingTime(remainingSeconds)} remaining`}
    </span>
  );
}
