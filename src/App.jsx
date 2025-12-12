import React, { useState, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';
import { api, setupApi } from './api.js';
import { stopAllPlayers } from './utils/playerManager.js';
import LoginScreen from './components/LoginScreen.jsx';
import Header from './components/Header.jsx';
import VideoList from './components/VideoList.jsx';
import VideoDetail from './components/VideoDetail.jsx';
import Pagination from './components/Pagination.jsx';
import Toast from './components/Toast.jsx';
import './player.css';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authPassword, setAuthPassword] = useState("");
  const [toastMessage, setToastMessage] = useState("");

  const [sources, setSources] = useState([]);
  const [currentSource, setCurrentSource] = useState(null);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState('list');
  const [lastView, setLastView] = useState('list');
  const [currentVideo, setCurrentVideo] = useState(null);
  const [currentEpisodeIndex, setCurrentEpisodeIndex] = useState(0);
  const [parsedEpisodes, setParsedEpisodes] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState("");
  const [recommendVideos, setRecommendVideos] = useState([]); // 推荐视频（来自搜索结果）

  // 应用卸载时清理所有播放器
  useEffect(() => () => stopAllPlayers(), []);

  // 页面隐藏/关闭时停止所有视频
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) stopAllPlayers();
    };
    const handleBeforeUnload = () => stopAllPlayers();

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // 视图切换时清理播放器
  useEffect(() => {
    if (view !== 'player') {
      stopAllPlayers();
    }
  }, [view]);

  // 初始化 API 拦截器 & 恢复登录状态
  useEffect(() => {
    setupApi({
      onUnauthorized: handleLogout
    });

    // 检查 sessionStorage 中是否有有效 token
    const token = sessionStorage.getItem('auth_token');
    if (token) {
      setIsAuthenticated(true);
      // 无需显式调用 checkAuth，后续的 getSources 会验证 token 有效性
    }
  }, []);

  // 获取源列表
  useEffect(() => {
    if (isAuthenticated) {
      api.getSources().then(list => {
        if (Array.isArray(list) && list.length > 0) {
          setSources(list);
          if (!currentSource) {
            setCurrentSource(list[0]);
          }
        }
      }).catch(err => console.error("Failed to fetch sources:", err));
    }
  }, [isAuthenticated]);

  // 动态更新页面标题
  useEffect(() => {
    const baseTitle = "极影 - 全网聚合搜索";
    if (view === 'search_results' && searchQuery) {
      document.title = `搜索 ${searchQuery} - ${baseTitle}`;
    } else if (view === 'player' && currentVideo) {
      document.title = `${currentVideo.vod_name} - ${baseTitle}`;
    } else {
      document.title = baseTitle;
    }
  }, [view, searchQuery, currentVideo]);

  const handleLogin = () => {
    // Session 已在服务器端设置，只需更新前端状态
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    try {
      await api.logout(); // 调用后端登出接口
    } catch (err) {
      console.error('登出失败:', err);
    }
    setAuthPassword("");
    setIsAuthenticated(false);
    stopAllPlayers(); // 登出时清理播放器
  };

  // 获取单个源的视频列表
  const fetchSingleSource = async (source, pageNum) => {
    if (!source?.key) return;

    setLoading(true);
    try {
      const data = await api.getVideoList(source.key, pageNum);
      if (data?.list) {
        setVideos(data.list.map(v => ({
          ...v,
          sourceName: source.name,
          sourceDesc: source.desc, // 透传描述
          sourceKey: source.key,
          uniqueId: `${source.key}_${v.vod_id}`
        })));
        setTotalPages(Number(data.pagecount) || 1);
        setPage(Number(data.page) || 1);
      } else {
        setVideos([]);
      }
    } catch (err) {
      console.error('获取视频列表失败:', err);
      if (err.message !== "Unauthorized") setVideos([]);
    } finally {
      setLoading(false);
    }
  };

  // 多源搜索
  const fetchMultiSourceSearch = async (keyword) => {
    if (!keyword.trim() || sources.length === 0) return;

    setLoading(true);
    setIsSearching(true);
    setVideos([]);
    let completed = 0;
    setSearchProgress(`搜索 0/${sources.length} 个源...`);

    try {
      const promises = sources.map(async (source) => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);

          const data = await api.searchVideos(source.key, keyword, controller.signal);
          clearTimeout(timeoutId);

          completed++;
          setSearchProgress(`搜索 ${completed}/${sources.length} 个源...`);

          const list = data?.list?.map(v => ({
            ...v,
            sourceName: source.name,
            sourceDesc: source.desc, // 透传描述
            sourceKey: source.key,
            uniqueId: `${source.key}_${v.vod_id}`
          })) || [];

          return { source, list };
        } catch (err) {
          console.error(`搜索 ${source.name} 失败:`, err);
          completed++;
          setSearchProgress(`搜索 ${completed}/${sources.length} 个源...`);
          return { source, list: [] };
        }
      });

      const results = await Promise.all(promises);
      setVideos(results);
    } catch (err) {
      console.error('搜索失败:', err);
    } finally {
      setLoading(false);
      setIsSearching(false);
      setTotalPages(1);
    }
  };

  // 列表数据加载
  useEffect(() => {
    if (isAuthenticated && view === 'list') {
      fetchSingleSource(currentSource, page);
    }
  }, [page, currentSource, view, isAuthenticated]);

  // 处理搜索提交
  const handleSearch = (e) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    stopAllPlayers();
    setView('search_results');
    setPage(1);
    fetchMultiSourceSearch(query);
  };

  // 解析播放地址
  const parsePlayUrl = (urlStr) => {
    if (!urlStr) return [];
    return urlStr.split('#')
      .map(s => {
        const p = s.split('$');
        return p.length >= 2 ? { name: p[0], url: p[1] } : null;
      })
      .filter(Boolean);
  };

  // 处理视频点击
  const handleVideoClick = (v) => {
    stopAllPlayers(); // 清理之前的播放器

    const eps = parsePlayUrl(v.vod_play_url);
    if (eps.length === 0) {
      setToastMessage("该资源暂无播放地址");
      return;
    }

    setParsedEpisodes(eps);
    setCurrentVideo(v);
    setCurrentEpisodeIndex(0);
    setLastView(view);

    // 如果是从搜索结果页点击的，保存搜索结果作为推荐
    if (view === 'search_results' && Array.isArray(videos) && videos.length > 0) {
      // 过滤掉当前视频
      const filtered = videos.map(sourceGroup => ({
        ...sourceGroup,
        list: sourceGroup.list?.filter(video => video.uniqueId !== v.uniqueId) || []
      })).filter(sourceGroup => sourceGroup.list.length > 0);

      setRecommendVideos(filtered);
    } else {
      setRecommendVideos([]);
    }

    setView('player');
    window.scrollTo(0, 0);
  };

  // 未登录状态
  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-[#0f1014] text-slate-200 font-sans pb-10">
      <Header
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        handleSearch={handleSearch}
        view={view}
        isSearching={isSearching}
        setView={setView}
        setPage={setPage}
        setIsSearching={setIsSearching}
        currentSource={currentSource}
        setCurrentSource={setCurrentSource}
        sources={sources}
      />

      <main className="max-w-7xl mx-auto px-4 py-6">
        {view === 'player' && currentVideo ? (
          <VideoDetail
            currentVideo={currentVideo}
            parsedEpisodes={parsedEpisodes}
            currentEpisodeIndex={currentEpisodeIndex}
            setCurrentEpisodeIndex={setCurrentEpisodeIndex}
            stopAllPlayers={stopAllPlayers}
            recommendVideos={recommendVideos}
            onVideoClick={handleVideoClick}
            onBack={() => {
              setCurrentVideo(null);
              setParsedEpisodes([]);
              setCurrentEpisodeIndex(0);
              setRecommendVideos([]);
              setView(lastView);
              window.scrollTo(0, 0);
            }}
          />
        ) : (
          <>
            {view === 'search_results' && (
              <div className="flex items-center gap-4 mb-6 animate-fade-in">
                <button
                  onClick={() => {
                    setView('list');
                    setSearchQuery('');
                    setIsSearching(false);
                    setVideos([]); // 清空搜索结果，让 useEffect 重新加载列表数据
                  }}
                  className="flex items-center justify-center w-8 h-8 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-all"
                  aria-label="返回列表"
                >
                  <ChevronLeft size={24} />
                </button>
                <div className="h-6 w-px bg-white/10"></div>
                <h2 className="text-xl font-bold text-white truncate">
                  搜索 <span className="text-blue-400">{searchQuery}</span> 的结果
                </h2>
              </div>
            )}

            <VideoList
              videos={videos}
              loading={loading}
              view={view}
              searchProgress={searchProgress}
              handleVideoClick={handleVideoClick}
            />

            {view === 'list' && !loading && videos.length > 0 && (
              <Pagination
                page={page}
                totalPages={totalPages}
                setPage={setPage}
              />
            )}
          </>
        )}
      </main>

      <footer className="border-t border-white/5 py-8 mt-auto text-center px-4">
        <p className="text-slate-600 text-sm mb-2">© 2025 极影 · 仅供学习交流</p>
        <p className="text-slate-700 text-xs max-w-2xl mx-auto">
          本站不提供任何视频存储和制作服务，所有内容均来源于互联网，仅提供Web页面浏览服务。若本站收录内容无意侵犯了贵司版权，请联系源站删除。
        </p>
      </footer>

      <Toast
        message={toastMessage}
        onClose={() => setToastMessage("")}
      />
    </div>
  );
}
