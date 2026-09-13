import { useEffect, useId, useState } from 'react';

const unsupportedMessage = 'เบราว์เซอร์นี้ไม่รองรับ Full Screen — กด F11 เพื่อแสดงเต็มจอ';

function fullscreenAvailable() {
  return typeof document !== 'undefined'
    && typeof document.documentElement.requestFullscreen === 'function'
    && typeof document.exitFullscreen === 'function'
    && document.fullscreenEnabled !== false;
}

export function FullscreenButton({ className = '' }: { className?: string }) {
  const [available, setAvailable] = useState(fullscreenAvailable);
  const [fullscreen, setFullscreen] = useState(() => typeof document !== 'undefined' && Boolean(document.fullscreenElement));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const statusId = useId();

  useEffect(() => {
    const sync = () => {
      setAvailable(fullscreenAvailable());
      setFullscreen(Boolean(document.fullscreenElement));
      setError('');
    };
    sync();
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const toggleFullscreen = async () => {
    if (pending || !available) return;
    const exiting = Boolean(document.fullscreenElement);
    setPending(true);
    setError('');
    try {
      if (exiting) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
      setFullscreen(Boolean(document.fullscreenElement));
    } catch {
      setError(exiting
        ? 'ออกจาก Full Screen ไม่สำเร็จ — กด Esc หรือ F11 เพื่อออกจากเต็มจอ'
        : 'เปิด Full Screen ไม่สำเร็จ — กด F11 เพื่อแสดงเต็มจอ');
    } finally {
      setPending(false);
    }
  };

  const status = available ? error : unsupportedMessage;
  return <div className={`fullscreen-control ${className}`.trim()}>
    <button
      type="button"
      className="control-button fullscreen-button"
      disabled={!available || pending}
      aria-pressed={fullscreen}
      aria-busy={pending}
      aria-describedby={status ? statusId : undefined}
      onClick={toggleFullscreen}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <path d={fullscreen
          ? 'M9 3v6H3m18 0h-6V3M3 15h6v6m6 0v-6h6'
          : 'M3 9V3h6m6 0h6v6M3 15v6h6m6 0h6v-6'} />
      </svg>
      {fullscreen ? 'Exit Full Screen' : 'Full Screen'}
    </button>
    {status && <p id={statusId} className="fullscreen-status" role="status">{status}</p>}
  </div>;
}
