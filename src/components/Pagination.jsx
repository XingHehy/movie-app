import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const Pagination = ({ page, totalPages, setPage }) => {
  return (
    <div className="flex justify-center items-center gap-4 mt-12 mb-8">
      <button
        disabled={page <= 1}
        onClick={() => {
          setPage(p => p - 1);
          window.scrollTo(0, 0);
        }}
        className="flex items-center px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700"
      >
        <ChevronLeft size={16} className="mr-1" /> 上一页
      </button>
      <span className="text-slate-400 font-mono text-sm bg-slate-900 px-3 py-1 rounded">
        {page} / {totalPages}
      </span>
      <button
        disabled={page >= totalPages}
        onClick={() => {
          setPage(p => p + 1);
          window.scrollTo(0, 0);
        }}
        className="flex items-center px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700"
      >
        下一页 <ChevronRight size={16} className="ml-1" />
      </button>
    </div>
  );
};

export default Pagination;

