import React, { useState, useRef, useEffect } from 'react';
import { Search, Play, Settings, X, History, Clock, Trash2 } from 'lucide-react';
import { stopAllPlayers } from '../utils/playerManager.js';
import { 
    getSearchHistory, 
    addSearchHistory, 
    removeSearchHistory, 
    clearSearchHistory,
    getWatchHistory,
    removeWatchHistory,
    clearWatchHistory
} from '../utils/historyManager.js';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';

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
    setSearchSourceMode,
    userRole,
    handleLogout,
    showAdminDialog,
    setShowAdminDialog
}) => {
    const navigate = useNavigate();
    const [hoveredSource, setHoveredSource] = useState(null);
    const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
    const [showSearchDropdown, setShowSearchDropdown] = useState(false);
    const [showSettingsPanel, setShowSettingsPanel] = useState(false);
    const [showSearchHistory, setShowSearchHistory] = useState(false);
    const [showWatchHistory, setShowWatchHistory] = useState(false);
    const [searchHistory, setSearchHistory] = useState([]);
    const [watchHistory, setWatchHistory] = useState([]);

    // 添加refs用于跟踪下拉菜单和设置面板
    const searchDropdownRef = useRef(null);
    const settingsPanelRef = useRef(null);
    const searchButtonRef = useRef(null);
    const searchInputRef = useRef(null);
    const searchHistoryRef = useRef(null);
    const watchHistoryRef = useRef(null);
    const watchHistoryPanelRef = useRef(null);
    const watchHistoryMobileRef = useRef(null);
    const watchHistoryMobilePanelRef = useRef(null);

    // 合并相同名称的观看历史，只保留最后观看的那个源
    const mergeWatchHistoryByName = (history) => {
        if (!history || history.length === 0) return [];
        
        const mergedMap = new Map();
        
        history.forEach(item => {
            const name = item.vod_name;
            if (!name) return;
            
            if (!mergedMap.has(name)) {
                // 创建新记录
                mergedMap.set(name, { ...item });
            } else {
                // 如果已存在同名记录，比较更新时间，只保留最新的
                const existing = mergedMap.get(name);
                if ((item.updatedAt || 0) > (existing.updatedAt || 0)) {
                    // 替换为最新的记录
                    mergedMap.set(name, { ...item });
                }
            }
        });
        
        // 转换为数组并按更新时间排序
        const merged = Array.from(mergedMap.values());
        merged.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        
        return merged;
    };

    // 获取源名称
    const getSourceName = (sourceKey) => {
        const source = sources.find(s => s.key === sourceKey);
        return source ? source.name : sourceKey;
    };

    // 加载搜索历史和观看历史
    useEffect(() => {
        setSearchHistory(getSearchHistory());
        const rawHistory = getWatchHistory();
        setWatchHistory(mergeWatchHistoryByName(rawHistory));
    }, [sources]);

    // 监听搜索历史变化（从其他地方添加）
    useEffect(() => {
        const interval = setInterval(() => {
            setSearchHistory(getSearchHistory());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // 监听观看历史变化
    useEffect(() => {
        const interval = setInterval(() => {
            const rawHistory = getWatchHistory();
            setWatchHistory(mergeWatchHistoryByName(rawHistory));
        }, 2000);
        return () => clearInterval(interval);
    }, [sources]);

    // 点击外部区域关闭下拉菜单和设置面板
    useEffect(() => {
        const handleClickOutside = (event) => {
            // 检查是否点击了搜索按钮内部
            const isClickInsideSearchButton = searchButtonRef.current && searchButtonRef.current.contains(event.target);

            // 检查是否点击了下拉菜单内部
            const isClickInsideDropdown = searchDropdownRef.current && searchDropdownRef.current.contains(event.target);

            // 检查是否点击了设置面板内部
            const isClickInsideSettings = settingsPanelRef.current && settingsPanelRef.current.contains(event.target);

            // 检查是否点击了搜索输入框或搜索历史面板
            const isClickInsideSearchInput = searchInputRef.current && searchInputRef.current.contains(event.target);
            const isClickInsideSearchHistory = searchHistoryRef.current && searchHistoryRef.current.contains(event.target);

            // 检查是否点击了观看历史按钮或面板（桌面端和移动端）
            const isClickInsideWatchHistoryButton = watchHistoryRef.current && watchHistoryRef.current.contains(event.target);
            const isClickInsideWatchHistoryPanel = watchHistoryPanelRef.current && watchHistoryPanelRef.current.contains(event.target);
            const isClickInsideWatchHistoryMobileButton = watchHistoryMobileRef.current && watchHistoryMobileRef.current.contains(event.target);
            const isClickInsideWatchHistoryMobilePanel = watchHistoryMobilePanelRef.current && watchHistoryMobilePanelRef.current.contains(event.target);
            const isClickInsideWatchHistory = isClickInsideWatchHistoryButton || isClickInsideWatchHistoryPanel || isClickInsideWatchHistoryMobileButton || isClickInsideWatchHistoryMobilePanel;

            // 如果点击了外部且下拉菜单或设置面板是打开的，则关闭它们
            if (!isClickInsideSearchButton && !isClickInsideDropdown && showSearchDropdown) {
                setShowSearchDropdown(false);
            }

            if (!isClickInsideSettings && showSettingsPanel) {
                setShowSettingsPanel(false);
            }

            if (!isClickInsideSearchInput && !isClickInsideSearchHistory && showSearchHistory) {
                setShowSearchHistory(false);
            }

            if (!isClickInsideWatchHistory && showWatchHistory) {
                setShowWatchHistory(false);
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
    }, [showSearchDropdown, showSettingsPanel, showSearchHistory, showWatchHistory]);

    // 处理搜索历史点击
    const handleSearchHistoryClick = (query) => {
        setSearchQuery(query);
        setShowSearchHistory(false);
        // 导航到搜索页面
        navigate(`/search/${encodeURIComponent(query)}`);
    };

    // 格式化观看历史时间
    const formatTime = (seconds) => {
        if (!seconds || seconds < 0) return '00:00';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        if (hours > 0) {
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // 格式化观看时间（友好的时间显示）
    const formatWatchTime = (timestamp) => {
        if (!timestamp) return '';
        
        const now = new Date();
        const watchDate = new Date(timestamp);
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const watchDay = new Date(watchDate.getFullYear(), watchDate.getMonth(), watchDate.getDate());
        
        if (watchDay.getTime() === today.getTime()) {
            // 今天
            const hours = watchDate.getHours().toString().padStart(2, '0');
            const minutes = watchDate.getMinutes().toString().padStart(2, '0');
            return `今天 ${hours}:${minutes}`;
        } else if (watchDay.getTime() === yesterday.getTime()) {
            // 昨天
            const hours = watchDate.getHours().toString().padStart(2, '0');
            const minutes = watchDate.getMinutes().toString().padStart(2, '0');
            return `昨天 ${hours}:${minutes}`;
        } else {
            // 更早的日期
            const year = watchDate.getFullYear();
            const month = (watchDate.getMonth() + 1).toString().padStart(2, '0');
            const day = watchDate.getDate().toString().padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
    };

    // 处理观看历史点击
    const handleWatchHistoryClick = (historyItem) => {
        console.log('=== 点击观看历史 ===');
        console.log('历史项数据:', historyItem);
        
        if (!historyItem || !historyItem.sourceKey || !historyItem.vod_id) {
            console.error('观看历史项缺少必要信息:', historyItem);
            alert('观看历史项数据不完整');
            return;
        }

        const resumeEpisode = historyItem.episodeIndex !== undefined && historyItem.episodeIndex !== null ? historyItem.episodeIndex : 0;
        const resumeTime = historyItem.currentTime || 0;
        
        console.log('准备导航:', {
            sourceKey: historyItem.sourceKey,
            vod_id: historyItem.vod_id,
            resumeEpisode,
            resumeTime
        });

        stopAllPlayers();
        setShowWatchHistory(false);
        
        const targetPath = `/play/${historyItem.sourceKey}/${historyItem.vod_id}`;
        console.log('导航路径:', targetPath);
        
        // 直接导航，不等待 API 调用
        navigate(targetPath, {
            state: {
                resumeEpisode: resumeEpisode,
                resumeTime: resumeTime
            }
        });
        
        console.log('导航命令已执行');
    };

    // 截断文本
    const truncateText = (text, maxLength) => {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    };
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

                    {/* 观看历史和管理员设置按钮（移动端，跟在 Logo 后） */}
                    <div className="flex items-center gap-2 md:hidden">
                        {/* 观看历史按钮（移动端） */}
                        <div className="relative">
                            <button
                                ref={watchHistoryMobileRef}
                                onClick={() => setShowWatchHistory(!showWatchHistory)}
                                className="relative p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
                                title="观看历史"
                            >
                                <Clock size={18} />
                                {watchHistory.length > 0 && (
                                    <span className="absolute top-0 right-0 w-2 h-2 bg-blue-500 rounded-full"></span>
                                )}
                            </button>

                            {/* 观看历史面板（移动端） */}
                            {showWatchHistory && (
                                <div 
                                    ref={watchHistoryMobilePanelRef}
                                    className="absolute right-0 top-full mt-2 w-[calc(100vw-1rem)] sm:w-80 max-w-72 bg-slate-800 rounded-xl shadow-xl border border-white/10 z-50 max-h-96 overflow-hidden flex flex-col"
                                    onClick={(e) => e.stopPropagation()}
                                    onMouseDown={(e) => e.stopPropagation()}
                                >
                                    <div className="p-3 border-b border-white/10 flex items-center justify-between">
                                        <span className="text-sm font-medium text-white flex items-center gap-2">
                                            <Clock size={16} />
                                            观看历史
                                        </span>
                                        {watchHistory.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    clearWatchHistory();
                                                    setWatchHistory([]);
                                                }}
                                                className="text-xs text-slate-400 hover:text-red-400 transition-colors p-1"
                                                title="清空全部"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                    {watchHistory.length > 0 ? (
                                        <div className="overflow-y-auto custom-scrollbar p-2">
                                            {watchHistory.map((item, index) => (
                                                <div
                                                    key={index}
                                                    className="group flex items-start gap-3 p-2 rounded-lg hover:bg-slate-700/50 transition-colors cursor-pointer mb-1"
                                                    onMouseDown={(e) => {
                                                        e.stopPropagation();
                                                    }}
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        // 检查是否点击的是删除按钮（通过检查是否包含 X 图标）
                                                        const deleteButton = e.target.closest('button[type="button"]');
                                                        if (deleteButton && deleteButton.querySelector('svg')) {
                                                            console.log('点击了删除按钮，不触发导航');
                                                            return;
                                                        }
                                                        console.log('=== 点击事件触发 ===');
                                                        console.log('点击的元素:', e.target);
                                                        console.log('历史项:', item);
                                                        handleWatchHistoryClick(item);
                                                    }}
                                                >
                                                    {/* 封面 */}
                                                    <div className="w-12 h-16 flex-shrink-0 rounded overflow-hidden bg-slate-700/50">
                                                        <img
                                                            src={item.vod_pic || ''}
                                                            alt={item.vod_name}
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => {
                                                                e.target.style.display = 'none';
                                                            }}
                                                        />
                                                    </div>
                                                    {/* 信息 */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <h4 className="text-sm font-medium text-slate-200 line-clamp-1 group-hover:text-blue-400 transition-colors text-left truncate">
                                                                {item.vod_name}
                                                            </h4>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    // 删除所有相同名称的记录
                                                                    const rawHistory = getWatchHistory();
                                                                    const filteredHistory = rawHistory.filter(
                                                                        h => h.vod_name !== item.vod_name
                                                                    );
                                                                    localStorage.setItem('movie_app_watch_history', JSON.stringify(filteredHistory));
                                                                    setWatchHistory(mergeWatchHistoryByName(filteredHistory));
                                                                }}
                                                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-600 rounded transition-all flex-shrink-0"
                                                            >
                                                                <X size={14} className="text-slate-400 hover:text-red-400" />
                                                            </button>
                                                        </div>
                                                        {/* 显示选集和观看进度 */}
                                                        {item.episodeName && (
                                                            <p className="text-xs text-slate-400 mt-1 text-left truncate">
                                                                {item.episodeName}
                                                                {(() => {
                                                                    if (item.currentTime > 0 && item.duration > 0) {
                                                                        const percentage = (item.currentTime / item.duration) * 100;
                                                                        return percentage < 1 ? '（观看不足1%）' : `（观看至${Math.round(percentage)}%）`;
                                                                    } else {
                                                                        return '（观看不足1%）';
                                                                    }
                                                                })()}
                                                            </p>
                                                        )}
                                                        {!item.episodeName && (
                                                            <p className="text-xs text-slate-400 mt-1 text-left">
                                                                {(() => {
                                                                    if (item.currentTime > 0 && item.duration > 0) {
                                                                        const percentage = (item.currentTime / item.duration) * 100;
                                                                        return percentage < 1 ? '观看不足1%' : `观看至${Math.round(percentage)}%`;
                                                                    } else {
                                                                        return '观看不足1%';
                                                                    }
                                                                })()}
                                                            </p>
                                                        )}
                                                        {item.updatedAt && (
                                                            <p className="text-xs text-slate-500 mt-0.5 text-left flex items-center gap-1.5">
                                                                {item.sourceKey && (
                                                                    <>
                                                                        <span>{getSourceName(item.sourceKey)}</span>
                                                                        <span className="text-slate-600">·</span>
                                                                    </>
                                                                )}
                                                                <span>{formatWatchTime(item.updatedAt)}</span>
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="px-3 py-8 text-center text-sm text-slate-500">
                                            无观看历史
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* 管理员设置按钮（移动端） */}
                        {userRole === 'admin' && (
                            <button
                                onClick={() => setShowAdminDialog(true)}
                                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
                                title="管理员设置"
                            >
                                <Settings size={18} />
                            </button>
                        )}
                    </div>
                </div>

                <form onSubmit={handleSearch} className="flex-1 w-full max-w-lg relative group" ref={searchInputRef}>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        onFocus={() => setShowSearchHistory(true)}
                        onBlur={(e) => {
                            // 延迟关闭，以便点击搜索历史项时能够触发点击事件
                            setTimeout(() => {
                                // 检查焦点是否移到了搜索历史面板内
                                const activeElement = document.activeElement;
                                if (!searchHistoryRef.current || !searchHistoryRef.current.contains(activeElement)) {
                                    setShowSearchHistory(false);
                                }
                            }, 200);
                        }}
                        placeholder="搜索电影、电视剧、综艺..."
                        className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl pl-11 pr-4 py-2.5 text-sm focus:outline-none focus:border-blue-500/50 focus:bg-slate-800 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-500"
                    />
                    <Search className="absolute left-3.5 top-3 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={18} />

                    {/* 搜索历史下拉菜单 */}
                    {showSearchHistory && (
                        <div
                            ref={searchHistoryRef}
                            className="absolute top-full left-0 right-0 mt-2 bg-slate-800 rounded-xl shadow-xl border border-white/10 z-50 max-h-80 overflow-y-auto"
                        >
                            <div className="p-2">
                                <div className="flex items-center justify-between px-3 py-2 mb-1">
                                    <span className="text-xs text-slate-400 flex items-center gap-1.5">
                                        <History size={14} />
                                        搜索历史
                                    </span>
                                    {searchHistory.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                clearSearchHistory();
                                                setSearchHistory([]);
                                            }}
                                            className="text-xs text-slate-500 hover:text-red-400 transition-colors p-1"
                                            title="清空全部"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                                {searchHistory.length > 0 ? (
    // 1. 父容器保持 p-2，给挂在外面的“X”留出空间防止被父容器切掉
    <div className="flex flex-wrap gap-2 p-2 max-h-24 overflow-hidden">
        {searchHistory.map((query, index) => (
            <button
                key={index}
                type="button"
                onClick={() => handleSearchHistoryClick(query)}
                // 2. 这里的修改：
                //    - 移除了 'truncate' (这是导致遮挡的罪魁祸首)
                //    - 移除了 'pr-6'，改为统一的 'px-3' (解决左右宽度不一样的问题)
                className="group/search-item relative inline-flex items-center max-w-[140px] px-3 py-1 rounded-full bg-slate-700/80 hover:bg-slate-600 text-xs text-slate-200 transition-colors"
            >
                {/* 3. 将 truncate 移到文字 span 上，并加个 block 或 max-w 确保生效 */}
                <span className="truncate max-w-[100px]">{query}</span>
                
                <span
                    onClick={(e) => {
                        e.stopPropagation();
                        removeSearchHistory(query);
                        setSearchHistory(getSearchHistory());
                    }}
                    // 保持原样：挂在右上角
                    className="absolute top-[-6px] right-[-6px] w-4 h-4 bg-slate-900 text-slate-200 hover:text-red-400 transition-colors opacity-0 group-hover/search-item:opacity-100 group-focus-visible/search-item:opacity-100 rounded-full shadow-sm border border-slate-800 flex items-center justify-center z-10"
                >
                    <X size={10} />
                </span>
            </button>
        ))}
    </div>
) : (
    <div className="px-3 py-6 text-center text-sm text-slate-500">
        无搜索历史
    </div>
)}
                            </div>
                        </div>
                    )}

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
                                    {sources.filter(s => s.enabled === true).map((source) => (
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
                                            setSelectedSearchSources(
                                                sources
                                                    .filter((s) => s.enabled === true)
                                                    .map((s) => s.key)
                                            );
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

                {/* 观看历史和管理员设置按钮（桌面端，右上角） */}
                <div className="hidden md:flex items-center ml-auto gap-2">
                    {/* 观看历史按钮 */}
                    <div className="relative">
                        <button
                            ref={watchHistoryRef}
                            onClick={() => setShowWatchHistory(!showWatchHistory)}
                            className="relative p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
                            title="观看历史"
                        >
                            <Clock size={18} />
                            {watchHistory.length > 0 && (
                                <span className="absolute top-0 right-0 w-2 h-2 bg-blue-500 rounded-full"></span>
                            )}
                        </button>

                        {/* 观看历史面板 */}
                        {showWatchHistory && (
                            <div 
                                ref={watchHistoryPanelRef}
                                className="absolute right-0 top-full mt-2 w-80 bg-slate-800 rounded-xl shadow-xl border border-white/10 z-50 max-h-96 overflow-hidden flex flex-col"
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                            >
                                <div className="p-3 border-b border-white/10 flex items-center justify-between">
                                    <span className="text-sm font-medium text-white flex items-center gap-2">
                   	             <Clock size={16} />
                                        观看历史
                                    </span>
                                    {watchHistory.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                clearWatchHistory();
                                                setWatchHistory([]);
                                            }}
                                            className="text-xs text-slate-400 hover:text-red-400 transition-colors p-1"
                                            title="清空全部"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                                {watchHistory.length > 0 ? (
                                    <div className="overflow-y-auto custom-scrollbar p-2">
                                    {watchHistory.map((item, index) => (
                                    <div
                                        key={index}
                                        className="group flex items-start gap-3 p-2 rounded-lg hover:bg-slate-700/50 transition-colors cursor-pointer mb-1"
                                        onMouseDown={(e) => {
                                            e.stopPropagation();
                                        }}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            // 检查是否点击的是删除按钮（通过检查是否包含 X 图标）
                                            const deleteButton = e.target.closest('button[type="button"]');
                                            if (deleteButton && deleteButton.querySelector('svg')) {
                                                console.log('点击了删除按钮，不触发导航');
                                                return;
                                            }
                                            console.log('=== 点击事件触发 ===');
                                            console.log('点击的元素:', e.target);
                                            console.log('历史项:', item);
                                            handleWatchHistoryClick(item);
                                        }}
                                    >
                                            {/* 封面 */}
                                            <div className="w-12 h-16 flex-shrink-0 rounded overflow-hidden bg-slate-700/50">
                                                <img
                                                    src={item.vod_pic || ''}
                                                    alt={item.vod_name}
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                        e.target.style.display = 'none';
                                                    }}
                                                />
                                            </div>
                                            {/* 信息 */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <h4 className="text-sm font-medium text-slate-200 line-clamp-1 group-hover:text-blue-400 transition-colors text-left truncate">
                                                        {item.vod_name}
                                                    </h4>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            // 删除所有相同名称的记录
                                                            const rawHistory = getWatchHistory();
                                                            const filteredHistory = rawHistory.filter(
                                                                h => h.vod_name !== item.vod_name
                                                            );
                                                            localStorage.setItem('movie_app_watch_history', JSON.stringify(filteredHistory));
                                                            setWatchHistory(mergeWatchHistoryByName(filteredHistory));
                                                        }}
                                                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-600 rounded transition-all flex-shrink-0"
                                                    >
                                                        <X size={14} className="text-slate-400 hover:text-red-400" />
                                                    </button>
                                                </div>
                                                {/* 显示选集和观看进度 */}
                                                {item.episodeName && (
                                                    <p className="text-xs text-slate-400 mt-1 text-left truncate">
                                                        {item.episodeName}
                                                        {(() => {
                                                            if (item.currentTime > 0 && item.duration > 0) {
                                                                const percentage = (item.currentTime / item.duration) * 100;
                                                                return percentage < 1 ? '（观看不足1%）' : `（观看至${Math.round(percentage)}%）`;
                                                            } else {
                                                                return '（观看不足1%）';
                                                            }
                                                        })()}
                                                    </p>
                                                )}
                                                {!item.episodeName && (
                                                    <p className="text-xs text-slate-400 mt-1 text-left">
                                                        {(() => {
                                                            if (item.currentTime > 0 && item.duration > 0) {
                                                                const percentage = (item.currentTime / item.duration) * 100;
                                                                return percentage < 1 ? '观看不足1%' : `观看至${Math.round(percentage)}%`;
                                                            } else {
                                                                return '观看不足1%';
                                                            }
                                                        })()}
                                                    </p>
                                                )}
                                                {item.updatedAt && (
                                                    <p className="text-xs text-slate-500 mt-0.5 text-left flex items-center gap-1.5">
                                                        {item.sourceKey && (
                                                            <>
                                                                <span>{getSourceName(item.sourceKey)}</span>
                                                                <span className="text-slate-600">·</span>
                                                            </>
                                                        )}
                                                        <span>{formatWatchTime(item.updatedAt)}</span>
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    </div>
                                ) : (
                                    <div className="px-3 py-8 text-center text-sm text-slate-500">
                                        无观看历史
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* 管理员设置按钮 */}
                    {userRole === 'admin' && (
                        <button
                            onClick={() => setShowAdminDialog(true)}
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
                            title="管理员设置"
                        >
                            <Settings size={18} />
                        </button>
                    )}
                </div>

            </div>

            {/* 资源源选择器 (仅在列表页显示) */}
            {!isSearching && view === 'list' && currentSource && (
                <div className="border-t border-white/5 bg-black/20 relative">
                    <div className="max-w-7xl mx-auto px-4 py-2 overflow-x-auto thin-scrollbar flex items-center gap-2">
                        <span className="text-xs text-slate-500 whitespace-nowrap mr-2">数据源:</span>
                        {sources.filter(s => s.enabled === true).map(s => (
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