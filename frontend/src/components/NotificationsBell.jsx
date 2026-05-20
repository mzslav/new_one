import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function NotificationsBell({ notifications, onMarkAllRead, onMarkOneRead }) {
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState(null);
  const buttonRef = useRef(null);
  const count = notifications.length;
  const unread = notifications.filter((n) => !n.read).length;

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    function updatePosition() {
      const rect = buttonRef.current.getBoundingClientRect();
      setPanelStyle({
        top: rect.bottom + 8,
        right: Math.max(12, window.innerWidth - rect.right),
      });
    }
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    function handleClick(e) {
      if (buttonRef.current && !buttonRef.current.contains(e.target)) {
        const panel = document.getElementById('notifications-panel');
        if (panel && panel.contains(e.target)) return;
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  function handleOpen() {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen && unread > 0) onMarkAllRead?.();
  }

  const panel = open && panelStyle && createPortal(
    <div
      id="notifications-panel"
      className="fixed z-[9999] w-96 rounded-xl border border-neutral-800 overflow-hidden"
      style={{
        ...panelStyle,
        backgroundColor: '#000000',
        boxShadow: '0 20px 60px rgba(0,0,0,0.9)',
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-neutral-800"
        style={{ backgroundColor: '#0a0a0a' }}
      >
        <span className="text-sm font-semibold text-white">Notifications</span>
        <div className="flex items-center gap-3">
          {unread > 0 && (
            <button
              type="button"
              onClick={onMarkAllRead}
              className="text-xs text-mac-blue hover:text-mac-blue-hover transition-colors"
            >
              Mark all read
            </button>
          )}
          <span className="text-xs text-neutral-400">
            {unread > 0 ? `${unread} unread` : `${count} total`}
          </span>
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto" style={{ backgroundColor: '#000000' }}>
        {count === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 text-neutral-500"
              style={{ backgroundColor: '#141414' }}
            >
              <BellIcon />
            </div>
            <p className="text-sm text-neutral-200">No notifications yet</p>
            <p className="text-xs text-neutral-500 mt-1">Completed jobs will appear here</p>
          </div>
        ) : (
          <ul>
            {notifications.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => !n.read && onMarkOneRead?.(n.id)}
                  className={`w-full text-left px-4 py-3.5 border-b border-neutral-900 transition-colors
                    ${n.read ? 'opacity-60 hover:opacity-80' : 'hover:bg-neutral-950'}`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                        n.read
                          ? 'bg-neutral-600'
                          : n.status === 'Completed'
                          ? 'bg-mac-green'
                          : 'bg-mac-blue'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm leading-snug ${n.read ? 'text-neutral-300' : 'text-white font-medium'}`}>
                        {n.message}
                      </p>
                      <p className="text-xs text-neutral-400 mt-1">
                        {new Date(n.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {!n.read && (
                      <span className="text-[10px] uppercase tracking-wide text-mac-blue shrink-0 mt-0.5">
                        New
                      </span>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>,
    document.body
  );

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleOpen}
        className="btn-icon relative"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <BellIcon />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-mac-red text-[10px] font-bold text-white shadow-[0_0_8px_rgba(255,69,58,0.6)]">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {panel}
    </div>
  );
}
