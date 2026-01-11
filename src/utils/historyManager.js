// 搜索历史管理
const SEARCH_HISTORY_KEY = 'movie_app_search_history';
const WATCH_HISTORY_KEY = 'movie_app_watch_history';
const MAX_SEARCH_HISTORY = 10; // 最多保存10条搜索历史
const MAX_WATCH_HISTORY = 20; // 最多保存20条观看历史

// 获取搜索历史
export const getSearchHistory = () => {
  try {
    const history = localStorage.getItem(SEARCH_HISTORY_KEY);
    return history ? JSON.parse(history) : [];
  } catch (error) {
    console.error('读取搜索历史失败:', error);
    return [];
  }
};

// 添加搜索历史
export const addSearchHistory = (query) => {
  if (!query || !query.trim()) return;
  
  try {
    let history = getSearchHistory();
    // 移除重复项（不区分大小写）
    history = history.filter(item => item.toLowerCase() !== query.trim().toLowerCase());
    // 添加到最前面
    history.unshift(query.trim());
    // 限制数量
    if (history.length > MAX_SEARCH_HISTORY) {
      history = history.slice(0, MAX_SEARCH_HISTORY);
    }
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    console.error('保存搜索历史失败:', error);
  }
};

// 删除单个搜索历史
export const removeSearchHistory = (query) => {
  try {
    let history = getSearchHistory();
    history = history.filter(item => item !== query);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    console.error('删除搜索历史失败:', error);
  }
};

// 清空搜索历史
export const clearSearchHistory = () => {
  try {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  } catch (error) {
    console.error('清空搜索历史失败:', error);
  }
};

// 获取观看历史
export const getWatchHistory = () => {
  try {
    const history = localStorage.getItem(WATCH_HISTORY_KEY);
    return history ? JSON.parse(history) : [];
  } catch (error) {
    console.error('读取观看历史失败:', error);
    return [];
  }
};

// 添加或更新观看历史
export const updateWatchHistory = (videoInfo) => {
  if (!videoInfo || !videoInfo.vod_id || !videoInfo.vod_name) return;
  
  try {
    let history = getWatchHistory();
    // 查找是否已存在
    const existingIndex = history.findIndex(
      item => item.vod_id === videoInfo.vod_id && item.sourceKey === videoInfo.sourceKey
    );
    
    const historyItem = {
      vod_id: videoInfo.vod_id,
      sourceKey: videoInfo.sourceKey || '',
      vod_name: videoInfo.vod_name,
      vod_pic: videoInfo.vod_pic || '',
      episodeIndex: videoInfo.episodeIndex || 0,
      episodeName: videoInfo.episodeName || '',
      currentTime: videoInfo.currentTime || 0,
      duration: videoInfo.duration || 0,
      updatedAt: Date.now()
    };
    
    if (existingIndex >= 0) {
      // 更新现有记录
      history[existingIndex] = historyItem;
    } else {
      // 添加新记录
      history.unshift(historyItem);
    }
    
    // 按更新时间排序（最新的在前）
    history.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    
    // 限制数量
    if (history.length > MAX_WATCH_HISTORY) {
      history = history.slice(0, MAX_WATCH_HISTORY);
    }
    
    localStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    console.error('保存观看历史失败:', error);
  }
};

// 删除单个观看历史
export const removeWatchHistory = (vodId, sourceKey) => {
  try {
    let history = getWatchHistory();
    history = history.filter(
      item => !(item.vod_id === vodId && item.sourceKey === sourceKey)
    );
    localStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    console.error('删除观看历史失败:', error);
  }
};

// 清空观看历史
export const clearWatchHistory = () => {
  try {
    localStorage.removeItem(WATCH_HISTORY_KEY);
  } catch (error) {
    console.error('清空观看历史失败:', error);
  }
};

// 获取指定视频的观看历史
export const getVideoWatchHistory = (vodId, sourceKey) => {
  try {
    const history = getWatchHistory();
    return history.find(
      item => item.vod_id === vodId && item.sourceKey === sourceKey
    ) || null;
  } catch (error) {
    console.error('获取视频观看历史失败:', error);
    return null;
  }
};

