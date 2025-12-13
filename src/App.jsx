import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { api, setupApi } from './api.js';
import { stopAllPlayers } from './utils/playerManager.js';
import LoginScreen from './components/LoginScreen.jsx';
import Header from './components/Header.jsx';
import Toast from './components/Toast.jsx';
import Home from './pages/Home.jsx';
import Search from './pages/Search.jsx';
import Player from './pages/Player.jsx';
import NotFound from './pages/NotFound.jsx';
import './player.css';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [sources, setSources] = useState([]);
  const [currentSource, setCurrentSource] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSearchSources, setSelectedSearchSources] = useState([]);
  const [searchSourceMode, setSearchSourceMode] = useState('all'); // 'all' or 'selected'
  const [searchTrigger, setSearchTrigger] = useState(0);

  const navigate = useNavigate();
  const location = useLocation();

  // Determine 'view' and 'isSearching' for Header compatibility
  const isSearching = location.pathname.startsWith('/search');
  const isPlayer = location.pathname.startsWith('/play');
  const view = isPlayer ? 'player' : (isSearching ? 'search_results' : 'list');

  // Cleanup players on navigation
  useEffect(() => {
    stopAllPlayers();
  }, [location.pathname]);

  // Handle visibility change
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

  // Auth setup
  useEffect(() => {
    setupApi({
      onUnauthorized: handleLogout
    });
    const token = sessionStorage.getItem('auth_token');
    if (token) {
      setIsAuthenticated(true);
    }
  }, []);

  // Fetch sources
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
    if (isSearching) {
      // Decode URL encoded keyword
      const keyword = decodeURIComponent(location.pathname.split('/').pop() || '');
      document.title = `搜索 ${keyword} - ${baseTitle}`;
    } else {
      document.title = baseTitle;
    }
  }, [location.pathname, isSearching]);

  // 当访问搜索页面时，将URL中的关键词同步到搜索框
  useEffect(() => {
    if (isSearching) {
      // Decode URL encoded keyword
      const keyword = decodeURIComponent(location.pathname.split('/').pop() || '');
      // 更新搜索框的内容
      setSearchQuery(keyword);
    } else if (!isSearching && location.pathname === '/') {
      // 在首页时清空搜索框
      setSearchQuery('');
    }
  }, [location.pathname, isSearching]);

  const handleLogin = () => setIsAuthenticated(true);

  const handleLogout = async () => {
    try { await api.logout(); } catch (err) { }
    setIsAuthenticated(false);
    stopAllPlayers();
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;
    // 增加搜索触发次数，确保即使关键词不变也会触发新搜索
    setSearchTrigger(prev => prev + 1);
    navigate(`/search/${encodeURIComponent(query)}`);
  };

  // Header props adapter
  const headerProps = {
    searchQuery,
    setSearchQuery,
    handleSearch,
    view: view === 'search_results' ? 'list' : view,
    isSearching,
    setView: (v) => {
      if (v === 'list') {
        setSearchQuery('');
        navigate('/');
      }
    },
    setPage: () => { }, // Handled by Home internally via URL
    setIsSearching: () => { }, // Handled by route
    currentSource,
    setCurrentSource,
    sources,
    selectedSearchSources,
    setSelectedSearchSources,
    searchSourceMode,
    setSearchSourceMode
  };

  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-[#0f1014] text-slate-200 font-sans pb-10">
      <Header {...headerProps} />

      <main className="max-w-7xl mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<Home currentSource={currentSource} />} />
          <Route path="/search/:keyword" element={<Search
            sources={sources}
            selectedSearchSources={selectedSearchSources}
            searchSourceMode={searchSourceMode}
            searchTrigger={searchTrigger}
          />} />
          <Route path="/play/:sourceKey/:videoId" element={<Player />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
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
