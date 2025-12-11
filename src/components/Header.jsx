import React, { useState } from 'react';
import { Search, Play } from 'lucide-react';
import { stopAllPlayers } from '../utils/playerManager.js';

const Header = ({
    searchQuery,
    setSearchQuery,
    handleSearch,
    view,
    isSearching,
    setView,
    setPage,
    setIsSearching,
    currentSource,
    setCurrentSource,
    sources = []
}) => {
    const [hoveredSource, setHoveredSource] = useState(null);
    const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
    return (
        <header className="sticky top-0 z-50 backdrop-blur-md bg-[#0f1014]/80 border-b border-white/5 transition-all duration-200">
            <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col md:flex-row items-center gap-4">
                <div className="flex w-full md:w-auto justify-between items-center">
                    <div
                        className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => {
                            stopAllPlayers();
                            setView('list');
                            setPage(1);
                            setSearchQuery('');
                            setIsSearching(false);
                        }}
                    >
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <Play className="text-white fill-current w-4 h-4 ml-0.5" />
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 leading-none">极影</span>
                            <span className="text-[10px] text-slate-500 font-medium tracking-wider transform scale-90 origin-center">全网聚合搜索</span>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSearch} className="flex-1 w-full max-w-lg relative group">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="搜索电影、电视剧、综艺..."
                        className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl pl-11 pr-4 py-2.5 text-sm focus:outline-none focus:border-blue-500/50 focus:bg-slate-800 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-500"
                    />
                    <Search className="absolute left-3.5 top-3 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={18} />
                    <button
                        type="submit"
                        className="absolute right-2 top-1.5 bg-slate-700 hover:bg-blue-600 text-xs px-3 py-1.5 rounded-lg transition-colors"
                    >
                        搜索
                    </button>
                </form>
            </div>

            {/* 资源源选择器 (仅在列表页显示) */}
            {!isSearching && view === 'list' && currentSource && (
                <div className="border-t border-white/5 bg-black/20 relative">
                    <div className="max-w-7xl mx-auto px-4 py-2 overflow-x-auto no-scrollbar flex items-center gap-2">
                        <span className="text-xs text-slate-500 whitespace-nowrap mr-2">数据源:</span>
                        {sources.map(s => (
                            <div key={s.key} className="relative flex-shrink-0">
                                <button
                                    onMouseEnter={(e) => {
                                        if (s.desc) {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const windowWidth = window.innerWidth;
                                            // 默认向右展开，如果超出屏幕则向左
                                            const isOverflow = rect.left + 200 > windowWidth;

                                            setTooltipPosition({
                                                x: isOverflow ? (windowWidth - rect.right) : rect.left,
                                                y: rect.bottom + 8,
                                                align: isOverflow ? 'right' : 'left',
                                                arrowOffset: rect.width / 2
                                            });
                                            setHoveredSource(s.key);
                                        }
                                    }}
                                    onMouseLeave={() => {
                                        setHoveredSource(null);
                                    }}
                                    onClick={() => {
                                        setCurrentSource(s);
                                        setPage(1);
                                        stopAllPlayers();
                                    }}
                                    className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${currentSource.key === s.key
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                                        }`}
                                >
                                    {s.name}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Tooltip - 使用 fixed 定位 */}
            {hoveredSource && sources.find(s => s.key === hoveredSource)?.desc && (
                <div
                    className="fixed z-[9999] pointer-events-none transition-opacity duration-200"
                    style={{
                        top: `${tooltipPosition.y}px`,
                        left: tooltipPosition.align === 'left' ? `${tooltipPosition.x}px` : 'auto',
                        right: tooltipPosition.align === 'right' ? `${tooltipPosition.x}px` : 'auto',
                    }}
                >
                    <div className="bg-slate-900 text-slate-200 text-[10px] px-2 py-1 rounded border border-white/10 whitespace-nowrap shadow-xl">
                        {sources.find(s => s.key === hoveredSource)?.desc}
                    </div>
                    {/* 小三角 */}
                    <div
                        className="w-2 h-2 bg-slate-900 border-l border-t border-white/10 absolute -top-1"
                        style={{
                            left: tooltipPosition.align === 'left' ? `${tooltipPosition.arrowOffset}px` : 'auto',
                            right: tooltipPosition.align === 'right' ? `${tooltipPosition.arrowOffset}px` : 'auto',
                            transform: tooltipPosition.align === 'left'
                                ? 'translateX(-50%) rotate(45deg)'
                                : 'translateX(50%) rotate(45deg)'
                        }}
                    ></div>
                </div>
            )}
        </header>
    );
};

export default Header;

