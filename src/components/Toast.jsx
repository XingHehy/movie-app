import React, { useEffect } from 'react';

/**
 * Reusable toast component with simple type-based styling.
 * Defaults to an "info" look to avoid breaking existing callers.
 */
export default function Toast({ message, onClose, duration = 2000, type = 'info' }) {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [message, duration, onClose]);

  if (!message) return null;

  const styleByType = {
    success: 'bg-green-500/20 text-green-100 border border-green-500/30',
    error: 'bg-red-500/20 text-red-100 border border-red-500/30',
    info: 'bg-slate-800 text-white border border-white/10',
  };

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] px-4">
      <div
        className={`animate-fade-in-down px-6 py-3 rounded-lg shadow-xl flex items-center gap-3 min-w-[300px] justify-center backdrop-blur-md bg-opacity-90 ${styleByType[type] || styleByType.info}`}
      >
        <span className="text-sm font-medium">{message}</span>
      </div>
    </div>
  );
}
