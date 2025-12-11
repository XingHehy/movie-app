import React, { useState, useRef } from 'react';
import { Film, Tv, Sparkles, Play, ChevronLeft, ChevronRight } from 'lucide-react';
import VideoPlayer from './VideoPlayer.jsx';

const VideoDetail = ({
  currentVideo,
  parsedEpisodes,
  currentEpisodeIndex,
  setCurrentEpisodeIndex,
  stopAllPlayers,
  recommendVideos = [],
  onVideoClick,
  onBack
}) => {
  const [mainTab, setMainTab] = useState('episodes'); // 'episodes' 或 'recommend'
  const [recommendTab, setRecommendTab] = useState(0);
  const tabScrollRef = useRef(null);

  // 过滤出有视频的推荐源
  const validRecommends = recommendVideos.filter(r => r.list && r.list.length > 0);

  // Tab滚动函数
  const scrollTabs = (direction) => {
    if (tabScrollRef.current) {
      const scrollAmount = 200;
      tabScrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
      {/* 左侧：播放器和简介 */}
      <div className="lg:col-span-2 space-y-6">
        <VideoPlayer
          key={`${currentVideo.uniqueId}-${currentEpisodeIndex}`}
          src={parsedEpisodes[currentEpisodeIndex]?.url}
          poster={currentVideo.vod_pic}
          title={`${currentVideo.vod_name} ${parsedEpisodes[currentEpisodeIndex]?.name}`}
          sourceName={currentVideo.sourceName}
          sourceDesc={currentVideo.sourceDesc}
          onBack={onBack}
        />

        {/* 剧情简介 */}
        <div className="bg-slate-800/30 rounded-xl p-5 border border-white/5">
          <h3 className="font-bold text-lg mb-2 flex items-center gap-2 text-slate-200">
            <Film size={18} className="text-blue-500" /> 影片详情
          </h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            {currentVideo.vod_content
              ? currentVideo.vod_content.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ')
              : '暂无简介...'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
            <span className="bg-slate-800 px-2 py-1 rounded border border-slate-700">年代: {currentVideo.vod_year}</span>
            <span className="bg-slate-800 px-2 py-1 rounded border border-slate-700">分类: {currentVideo.type_name}</span>
            <span className="bg-slate-800 px-2 py-1 rounded border border-slate-700">地区: {currentVideo.vod_area}</span>
          </div>
        </div>
      </div>

      {/* 右侧：选集和推荐 Tab切换 */}
      <div className="sticky top-24 self-start max-h-[calc(100vh-7rem)] overflow-hidden">
        <div className="bg-slate-800/50 backdrop-blur rounded-xl border border-white/5">
          {/* 主Tab栏：选集 / 推荐 */}
          <div className="flex border-b border-white/5">
            <button
              onClick={() => setMainTab('episodes')}
              className={`
                flex-1 px-4 py-3 text-sm font-medium transition-all flex items-center justify-center gap-2
                ${mainTab === 'episodes'
                  ? 'text-white border-b-2 border-blue-500 bg-slate-700/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/20'
                }
              `}
            >
              <Tv size={16} />
              选集播放
              <span className="text-xs bg-slate-700 px-2 py-0.5 rounded-full">
                {parsedEpisodes.length}
              </span>
            </button>

            {validRecommends.length > 0 && (
              <button
                onClick={() => setMainTab('recommend')}
                className={`
                  flex-1 px-4 py-3 text-sm font-medium transition-all flex items-center justify-center gap-2
                  ${mainTab === 'recommend'
                    ? 'text-white border-b-2 border-blue-500 bg-slate-700/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/20'
                  }
                `}
              >
                <Sparkles size={16} />
                推荐
              </button>
            )}
          </div>

          {/* Tab内容区域 */}
          <div className="overflow-hidden flex flex-col">
            {/* 选集内容 */}
            {mainTab === 'episodes' && (
              <div className="p-4 overflow-y-auto custom-scrollbar max-h-[calc(100vh-13rem)]">
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-3 gap-2">
                  {parsedEpisodes.map((ep, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setCurrentEpisodeIndex(i);
                        stopAllPlayers();
                      }}
                      className={`
                        relative overflow-hidden px-2 py-2.5 text-xs font-medium rounded-lg transition-all duration-200 border
                        ${currentEpisodeIndex === i
                          ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20'
                          : 'bg-slate-700/50 border-transparent text-slate-300 hover:bg-slate-700 hover:border-slate-600'
                        }
                      `}
                    >
                      {ep.name}
                      {currentEpisodeIndex === i && (
                        <span className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-white rounded-full m-1 animate-pulse"></span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 推荐内容 */}
            {mainTab === 'recommend' && validRecommends.length > 0 && (
              <div className="flex flex-col h-[calc(100vh-13rem)]">
                {/* 平台Tab切换 - 固定在顶部 */}
                <div className="relative mb-4 px-4 pt-4 flex-shrink-0">
                  <div className="relative flex items-center">
                    {/* 左滚动按钮 */}
                    <button
                      onClick={() => scrollTabs('left')}
                      className="absolute left-0 z-10 w-8 h-full bg-gradient-to-r from-slate-800/90 to-transparent flex items-center justify-center hover:from-slate-800 transition-all"
                      aria-label="向左滚动"
                    >
                      <ChevronLeft size={16} className="text-slate-400" />
                    </button>

                    {/* Tab容器 */}
                    <div
                      ref={tabScrollRef}
                      className="flex gap-2 overflow-x-auto no-scrollbar scroll-smooth px-8 w-full"
                    >
                      {validRecommends.map((sourceGroup, index) => (
                        <button
                          key={sourceGroup.source.key}
                          onClick={() => setRecommendTab(index)}
                          className={`
                            px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex-shrink-0
                            ${recommendTab === index
                              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                              : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                            }
                          `}
                        >
                          {sourceGroup.source.name}
                          <span className="ml-1 opacity-70">
                            ({sourceGroup.list.length})
                          </span>
                        </button>
                      ))}
                    </div>

                    {/* 右滚动按钮 */}
                    <button
                      onClick={() => scrollTabs('right')}
                      className="absolute right-0 z-10 w-8 h-full bg-gradient-to-l from-slate-800/90 to-transparent flex items-center justify-center hover:from-slate-800 transition-all"
                      aria-label="向右滚动"
                    >
                      <ChevronRight size={16} className="text-slate-400" />
                    </button>
                  </div>
                </div>

                {/* 推荐视频列表 - 可滚动区域 */}
                <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-4">
                  <div className="space-y-3">
                    {validRecommends[recommendTab]?.list.slice(0, 8).map((video) => (
                      <div
                        key={video.uniqueId}
                        onClick={() => onVideoClick(video)}
                        className="group cursor-pointer flex gap-3 hover:bg-slate-700/30 p-2 rounded-lg transition-all"
                      >
                        {/* 封面 */}
                        <div className="relative w-20 h-28 flex-shrink-0 rounded-lg overflow-hidden bg-slate-700/50 ring-1 ring-white/5 group-hover:ring-blue-500/50 transition-all">
                          <img
                            src={video.vod_pic}
                            alt={video.vod_name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />

                          {/* 悬浮播放按钮 */}
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                              <Play size={14} className="text-white ml-0.5" fill="white" />
                            </div>
                          </div>

                          {/* 备注标签 */}
                          {video.vod_remarks && (
                            <div className="absolute bottom-1 left-1 bg-blue-600/90 text-white text-[10px] px-1.5 py-0.5 rounded">
                              {video.vod_remarks}
                            </div>
                          )}
                        </div>

                        {/* 信息 */}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-medium text-slate-200 line-clamp-2 group-hover:text-blue-400 transition-colors leading-tight mb-1">
                            {video.vod_name}
                          </h3>

                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            {video.vod_score && (
                              <span className="text-yellow-500 font-medium">
                                ⭐ {video.vod_score}
                              </span>
                            )}
                            <span>{video.type_name}</span>
                          </div>

                          {video.vod_year && (
                            <div className="text-xs text-slate-600 mt-1">
                              {video.vod_year}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 显示更多提示 */}
                  {validRecommends[recommendTab]?.list.length > 8 && (
                    <div className="text-center mt-3 text-xs text-slate-500">
                      还有 {validRecommends[recommendTab].list.length - 8} 个相关视频
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoDetail;
