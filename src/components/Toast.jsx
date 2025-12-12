import React, { useEffect } from 'react';

export default function Toast({ message, onClose, duration = 2000 }) {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [message, duration, onClose]);

  if (!message) return null;

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[200]">
      <div className="animate-fade-in-down bg-slate-800 text-white px-6 py-3 rounded-lg shadow-xl border border-white/10 flex items-center gap-3 min-w-[300px] justify-center backdrop-blur-md bg-opacity-90">
        <span className="text-sm font-medium">{message}</span>
      </div>
    </div>
  );
}
