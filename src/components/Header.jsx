import React, { useState, useRef, useEffect } from 'react';
import { Search, Play, Settings, X } from 'lucide-react';
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
    sources = [],
    selectedSearchSources,
    setSelectedSearchSources,
    searchSourceMode,
    setSearchSourceMode
}) => {
    const [hoveredSource, setHoveredSource] = useState(null);
    const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
    const [showSearchDropdown, setShowSearchDropdown] = useState(false);
    const [showSettingsPanel, setShowSettingsPanel] = useState(false);

    // 添加refs用于跟踪下拉菜单和设置面板
    const searchDropdownRef = useRef(null);
    const settingsPanelRef = useRef(null);
    const searchButtonRef = useRef(null);

    // 点击外部区域关闭下拉菜单和设置面板
    useEffect(() => {
        const handleClickOutside = (event) => {
            // 检查是否点击了搜索按钮内部
            const isClickInsideSearchButton = searchButtonRef.current && searchButtonRef.current.contains(event.target);

            // 检查是否点击了下拉菜单内部
            const isClickInsideDropdown = searchDropdownRef.current && searchDropdownRef.current.contains(event.target);

            // 检查是否点击了设置面板内部
            const isClickInsideSettings = settingsPanelRef.current && settingsPanelRef.current.contains(event.target);

            // 如果点击了外部且下拉菜单或设置面板是打开的，则关闭它们
            if (!isClickInsideSearchButton && !isClickInsideDropdown && showSearchDropdown) {
                setShowSearchDropdown(false);
            }

            if (!isClickInsideSettings && showSettingsPanel) {
                setShowSettingsPanel(false);
            }
        };

        // 添加事件监听器
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);

        // 清理事件监听器
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [showSearchDropdown, showSettingsPanel]);
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

                    {/* 搜索按钮下拉菜单 */}
                    <div className="absolute right-0 top-0 bottom-0 flex items-center" ref={searchButtonRef}>
                        <button
                            type="submit"
                            className="bg-slate-700 hover:bg-blue-600 text-xs px-3 py-2.5 rounded-l-lg transition-colors flex items-center justify-center"
                            style={{ height: '100%', borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
                        >
                            全网搜
                        </button>

                        {/* 下拉箭头按钮 */}
                        <button
                            type="button"
                            className="bg-slate-700 hover:bg-blue-600 text-xs w-8 flex items-center justify-center transition-colors border-l border-slate-600"
                            onClick={() => setShowSearchDropdown(!showSearchDropdown)}
                            onMouseEnter={() => setShowSearchDropdown(true)}
                            onMouseLeave={() => {
                                // 延迟检查，确保鼠标不是移动到下拉菜单
                                setTimeout(() => {
                                    if (!searchDropdownRef.current || !searchDropdownRef.current.matches(':hover')) {
                                        setShowSearchDropdown(false);
                                    }
                                }, 100);
                            }}
                            style={{ height: '100%', borderTopRightRadius: '0.75rem', borderBottomRightRadius: '0.75rem' }}
                        >
                            <span className="text-slate-300">▼</span>
                        </button>

                        {/* 下拉菜单 */}
                        {showSearchDropdown && sources.length > 0 && (
                            <div
                                ref={searchDropdownRef}
                                className="absolute right-0 top-full mt-1 bg-slate-800 rounded-lg shadow-xl border border-white/10 w-[120px] z-50"
                                onMouseEnter={() => setShowSearchDropdown(true)}
                                onMouseLeave={() => setShowSearchDropdown(false)}
                                style={{ borderRadius: '0.5rem', borderTopRightRadius: 0 }}
                            >
                                <button
                                    onClick={() => {
                                        setSearchSourceMode('all');
                                        setSelectedSearchSources([]);
                                        setShowSearchDropdown(false);
                                    }}
                                    className={`w-full text-left px-3 py-2.5 text-sm ${searchSourceMode === 'all'
                                        ? 'bg-blue-600/20 text-blue-400'
                                        : 'text-slate-300 hover:bg-slate-700'
                                        }`}
                                >
                                    全网搜索
                                </button>
                                <div className={`flex items-center justify-between px-3 py-2.5 text-sm cursor-pointer ${(searchSourceMode === 'selected' && selectedSearchSources.includes(currentSource.key))
                                    ? 'bg-blue-600/20'
                                    : 'hover:bg-slate-700'
                                    }`}>
                                    <button
                                        onClick={() => {
                                            setSearchSourceMode('selected');
                                            setSelectedSearchSources([currentSource.key]);
                                            setShowSearchDropdown(false);
                                        }}
                                        className={`w-full text-left ${(searchSourceMode === 'selected' && selectedSearchSources.includes(currentSource.key))
                                            ? 'text-blue-400'
                                            : 'text-slate-300'
                                            } transition-colors`}
                                    >
                                        仅当前源
                                    </button>
                                    {/* 设置图标 - 放在仅当前数据源选项右侧 */}
                                    <button
                                        type="button"
                                        className={`p-1 ${(searchSourceMode === 'selected' && selectedSearchSources.includes(currentSource.key))
                                            ? 'text-blue-400'
                                            : 'text-slate-500 hover:text-white'
                                            } transition-colors`}
                                        onMouseEnter={() => {
                                            setShowSettingsPanel(true);
                                            setShowSearchDropdown(false);
                                        }}
                                        onClick={() => {
                                            setShowSettingsPanel(!showSettingsPanel);
                                            setShowSearchDropdown(false);
                                        }}
                                    >
                                        <Settings size={14} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* 数据源多选面板 */}
                        {showSettingsPanel && sources.length > 0 && (
                            <div
                                ref={settingsPanelRef}
                                className="absolute right-0 top-full mt-1 bg-slate-800 rounded-lg shadow-xl border border-white/10 w-[250px] z-50 p-3"
                                style={{
                                    borderRadius: '0.5rem',
                                    borderTopRightRadius: 0,
                                    /* 美化滚动条 */
                                    scrollbarWidth: 'thin',
                                    scrollbarColor: '#4B5563 transparent'
                                }}
                                onMouseEnter={() => setShowSettingsPanel(true)}
                                onMouseLeave={() => setShowSettingsPanel(false)}
                            >
                                {/* 自定义滚动条样式 (WebKit) */}
                                <style jsx>{`
                                    div::-webkit-scrollbar {
                                        width: 4px;
                                    }
                                    div::-webkit-scrollbar-track {
                                        background: transparent;
                                    }
                                    div::-webkit-scrollbar-thumb {
                                        background-color: #4B5563;
                                        border-radius: 2px;
                                    }
                                    div::-webkit-scrollbar-thumb:hover {
                                        background-color: #6B7280;
                                    }
                                `}</style>
                                {/* 面板头部 */}
                                <div className="flex justify-between items-center mb-3 pb-2 border-b border-white/10">
                                    <h3 className="text-sm font-medium text-white">选择数据源</h3>
                                    <button
                                        type="button"
                                        className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full transition-colors"
                                        onClick={() => setShowSettingsPanel(false)}
                                    >
                                        <X size={14} />
                                    </button>
                                </div>

                                {/* 数据源列表 */}
                                <div className="space-y-1 max-h-60 overflow-y-auto mb-3">
                                    {sources.map((source) => (
                                        <div
                                            key={source.key}
                                            className="flex flex-col px-2 py-1.5 rounded-md hover:bg-slate-700/50 transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    id={`source-${source.key}`}
                                                    checked={selectedSearchSources.includes(source.key)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedSearchSources((prev) => [...prev, source.key]);
                                                        } else {
                                                            setSelectedSearchSources((prev) =>
                                                                prev.filter((key) => key !== source.key)
                                                            );
                                                        }
                                                    }}
                                                    className="rounded text-blue-500 focus:ring-blue-500"
                                                />
                                                <label
                                                    htmlFor={`source-${source.key}`}
                                                    className="text-xs text-slate-300 cursor-pointer flex-1"
                                                >
                                                    {source.name}
                                                </label>
                                            </div>
                                            {/* 数据源介绍 */}
                                            {source.desc && (
                                                <div className="ml-4 mt-1 text-xs text-slate-500 truncate">
                                                    {source.desc}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* 操作按钮 */}
                                <div className="flex justify-between gap-2">
                                    <button
                                        type="button"
                                        className="flex-1 px-3 py-1.5 text-xs text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-md transition-colors"
                                        onClick={() => {
                                            setSelectedSearchSources(sources.map((s) => s.key));
                                        }}
                                    >
                                        全选
                                    </button>
                                    <button
                                        type="button"
                                        className="flex-1 px-3 py-1.5 text-xs text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-md transition-colors"
                                        onClick={() => {
                                            setSelectedSearchSources([]);
                                        }}
                                    >
                                        清空
                                    </button>
                                    <button
                                        type="button"
                                        className="flex-1 px-3 py-1.5 text-xs text-white bg-blue-600 hover:bg-blue-500 rounded-md transition-colors"
                                        onClick={() => {
                                            setSearchSourceMode('selected');
                                            setShowSettingsPanel(false);
                                        }}
                                    >
                                        确认
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </form>
            </div>

            {/* 资源源选择器 (仅在列表页显示) */}
            {!isSearching && view === 'list' && currentSource && (
                <div className="border-t border-white/5 bg-black/20 relative">
                    <div className="max-w-7xl mx-auto px-4 py-2 overflow-x-auto thin-scrollbar flex items-center gap-2">
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