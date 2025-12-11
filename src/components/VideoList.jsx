import React from 'react';
import { Search, Play } from 'lucide-react';

const VideoList = ({ videos, loading, view, searchProgress, handleVideoClick }) => {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-blue-400">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
          </div>
        </div>
        <p className="mt-6 text-slate-400 animate-pulse">
          {view === 'search_results' ? searchProgress : '正在加载资源...'}
        </p>
      </div>
    );
  }

  if (view === 'search_results') {
    return (
      <div className="space-y-8 animate-fade-in">
        {videos.map((group) => (
          group.list && group.list.length > 0 && (
            <div key={group.source.key} className="bg-slate-800/20 rounded-xl p-4 border border-white/5">
              <div className="flex items-center gap-2 mb-4">
                <span className="bg-blue-600 w-1 h-5 rounded-full"></span>
                <h2 className="text-lg font-bold text-white">{group.source.name}</h2>
                <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                  {group.list.length}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
                {group.list.map((v) => (
                  <VideoCard key={v.uniqueId} video={v} onClick={() => handleVideoClick(v)} />
                ))}
              </div>
            </div>
          )
        ))}
        {videos.every(g => !g.list || g.list.length === 0) && (
          <EmptyState />
        )}
      </div>
    );
  }

  // List View
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6 animate-fade-in">
      {videos.map((v) => (
        <VideoCard key={v.uniqueId} video={v} onClick={() => handleVideoClick(v)} />
      ))}

      {videos.length === 0 && (
        <EmptyState />
      )}
    </div>
  );
};

const VideoCard = ({ video, onClick }) => (
  <div
    onClick={onClick}
    className="group cursor-pointer relative flex flex-col gap-2"
  >
    <div className="aspect-[3/4] relative rounded-xl overflow-hidden bg-slate-800 shadow-lg group-hover:shadow-blue-500/20 transition-all duration-300 ring-1 ring-white/5 group-hover:ring-blue-500/50">
      <img
        src={video.vod_pic}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
        onError={e => {
          e.target.onerror = null;
          e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='450'%3E%3Crect width='100%25' height='100%25' fill='%231e293b'/%3E%3Ctext x='50%25' y='50%25' font-family='sans-serif' font-size='16' fill='%2364748b' text-anchor='middle'%3E%E6%9A%82%E6%97%A0%E5%B0%81%E9%9D%A2%3C/text%3E%3C/svg%3E";
        }}
        loading="lazy"
        alt={video.vod_name}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity"></div>

      <div className="absolute top-2 right-2">
        <span className="bg-black/60 backdrop-blur-sm text-[10px] text-amber-400 px-1.5 py-0.5 rounded border border-white/10 shadow-sm">
          {video.vod_remarks || 'HD'}
        </span>
      </div>

      {video.sourceName && (
        <div className="absolute top-2 left-2">
          <span className="bg-blue-600/80 backdrop-blur-sm text-[10px] text-white px-1.5 py-0.5 rounded shadow-sm">
            {video.sourceName}
          </span>
        </div>
      )}

      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-600/80 backdrop-blur-sm shadow-lg transform scale-50 group-hover:scale-100 transition-all duration-300">
          <Play size={24} className="text-white fill-current ml-1" />
        </div>
      </div>
    </div>

    <div className="space-y-1 px-1">
      <h3 className="text-sm font-medium text-slate-200 truncate group-hover:text-blue-400 transition-colors">
        {video.vod_name}
      </h3>
      <div className="flex items-center justify-between text-[11px] text-slate-500">
        <span>{video.vod_year || '未知'}</span>
        <span className="truncate max-w-[60px]">{video.type_name}</span>
      </div>
    </div>
  </div>
);

const EmptyState = () => (
  <div className="col-span-full flex flex-col items-center justify-center py-32 text-slate-500">
    <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
      <Search size={32} className="text-slate-600" />
    </div>
    <p className="text-lg font-medium text-slate-400">未找到相关资源</p>
    <p className="text-sm text-slate-600 mt-2">请尝试更换关键词或切换数据源</p>
  </div>
);

export default VideoList;

