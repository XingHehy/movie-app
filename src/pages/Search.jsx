import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import VideoList from '../components/VideoList';
import { api } from '../api';
import { stopAllPlayers } from '../utils/playerManager';

export default function Search({ sources, selectedSearchSources, searchSourceMode, searchTrigger, setToastMessage }) {
  const { keyword } = useParams();
  const location = useLocation();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchProgress, setSearchProgress] = useState("搜索 0/0 个源...");
  const navigate = useNavigate();
  const searchAbortController = useRef(null);
  const hasSearchedRef = useRef(false);
  const lastSearchTriggerRef = useRef(searchTrigger);
  const isSearchingRef = useRef(false);

  // 添加状态来跟踪上一次的搜索条件
  const [previousSearch, setPreviousSearch] = useState({
    keyword: keyword,
    selectedSources: [...selectedSearchSources],
    sourceMode: searchSourceMode
  });

  // 处理搜索条件变化的逻辑
  useEffect(() => {
    if (keyword && sources.length > 0) {
      // 检查是否是从播放页返回
      if (location.state && location.state.fromPlayer && location.state.searchResults && location.state.searchKeyword === keyword) {
        // 使用从播放页返回时带回来的搜索结果
        setVideos(location.state.searchResults);
        setLoading(false);
        hasSearchedRef.current = true;

        // 更新上一次搜索条件
        setPreviousSearch({
          keyword: keyword,
          selectedSources: [...selectedSearchSources],
          sourceMode: searchSourceMode
        });

        isSearchingRef.current = false;
      } else {
        // 不是从播放页返回，只在关键词变化或首次加载时执行搜索
        const searchConditionsChanged = (
          keyword !== previousSearch.keyword
        );

        if (searchConditionsChanged || !hasSearchedRef.current) {
          // 关键词变化或初始加载，执行新搜索
          fetchMultiSourceSearch(keyword);
        }
      }
    } else if (!keyword) {
      setLoading(false);
    }

    return () => {
      if (searchAbortController.current) {
        searchAbortController.current.abort();
      }
    };
  }, [keyword, sources, location.state]);

  // 单独处理搜索触发的逻辑
  useEffect(() => {
    if (searchTrigger === lastSearchTriggerRef.current || !keyword || sources.length === 0) return;

    // 检查搜索条件是否真正变化
    const searchConditionsChanged = (
      keyword !== previousSearch.keyword ||
      selectedSearchSources.length !== previousSearch.selectedSources.length ||
      selectedSearchSources.some(source => !previousSearch.selectedSources.includes(source)) ||
      searchSourceMode !== previousSearch.sourceMode
    );

    // 检查搜索状态
    const isSearchInProgress = isSearchingRef.current;

    if (searchConditionsChanged || !isSearchInProgress) {
      // 如果搜索条件变化，或者没有搜索在进行中，执行新搜索
      fetchMultiSourceSearch(keyword);
    }

    // 更新最后一次触发的搜索值
    lastSearchTriggerRef.current = searchTrigger;
  }, [searchTrigger, keyword, sources, selectedSearchSources, searchSourceMode]);



  const fetchMultiSourceSearch = async (kw) => {
    // 设置搜索状态为进行中
    isSearchingRef.current = true;

    // 取消之前的搜索请求
    if (searchAbortController.current) {
      searchAbortController.current.abort();
    }

    // 创建新的AbortController
    const currentAbortController = new AbortController();
    searchAbortController.current = currentAbortController;

    // 更新上一次搜索条件
    setPreviousSearch({
      keyword: kw,
      selectedSources: [...selectedSearchSources],
      sourceMode: searchSourceMode
    });

    // 根据搜索源模式过滤需要搜索的源（只搜索显式启用的源）
    const enabledSources = sources.filter(source => source.enabled === true);
    const sourcesToSearch = searchSourceMode === 'selected' && selectedSearchSources.length > 0
      ? enabledSources.filter(source => selectedSearchSources.includes(source.key))
      : enabledSources;


    // 初始化已完成搜索的源计数
    let completed = 0;

    // 首先更新状态，确保UI立即反映搜索开始
    setLoading(true);
    setVideos([]);
    setSearchProgress(`搜索 0/${sourcesToSearch.length} 个源...`);

    // 强制UI更新，确保搜索进度界面显示出来
    await new Promise(resolve => requestAnimationFrame(resolve)); // 使用requestAnimationFrame确保UI更新

    try {
      // 使用局部completed变量来跟踪当前搜索的进度
      const localCompleted = { count: 0 };

      const promises = sourcesToSearch.map(async (source) => {
        try {
          // 直接使用API请求，不设置前端超时，由后端接口控制
          const searchPromise = api.searchVideos(source.key, kw, currentAbortController.signal);
          const data = await searchPromise;

          localCompleted.count++;
          // 只有当当前搜索控制器仍然是活跃的时，才更新进度
          if (searchAbortController.current === currentAbortController) {
            setSearchProgress(`搜索 ${localCompleted.count}/${sourcesToSearch.length} 个源...`);
          }

          // 限制每个源返回的结果数量，避免列表过长
          const MAX_RESULTS_PER_SOURCE = 12;
          const list = (data?.list?.map(v => ({
            ...v,
            sourceName: source.name,
            sourceDesc: source.desc,
            sourceKey: source.key,
            uniqueId: `${source.key}_${v.vod_id}`
          })) || []).slice(0, MAX_RESULTS_PER_SOURCE);

          return { source, list };
        } catch (err) {
          console.error(`搜索 ${source.name} 失败:`, err);
          localCompleted.count++;
          // 只有当当前搜索控制器仍然是活跃的时，才更新进度
          if (searchAbortController.current === currentAbortController) {
            setSearchProgress(`搜索 ${localCompleted.count}/${sourcesToSearch.length} 个源...`);
          }
          return { source, list: [] };
        }
      });

      // 使用Promise.allSettled而不是Promise.all，确保即使某些请求失败，也能收集所有结果
      const results = await Promise.allSettled(promises);
      // 只保留成功的结果
      const successfulResults = results
        .filter(result => result.status === 'fulfilled')
        .map(result => result.value);
      setVideos(successfulResults);
      hasSearchedRef.current = true;
    } catch (err) {
      console.error('搜索失败:', err);
    } finally {
      // 只有当前搜索请求仍然是活跃的（没有被新请求替换），才更新loading状态
      if (searchAbortController.current === currentAbortController) {
        setLoading(false);
        // 设置搜索状态为已完成
        isSearchingRef.current = false;
      }
    }
  };

  const handleVideoClick = (v) => {
    // 如果没有播放地址，则提示无法播放
    if (!v.vod_play_url || !String(v.vod_play_url).trim()) {
      setToastMessage && setToastMessage("此视频暂无法播放");
      return;
    }

    stopAllPlayers();
    // Prepare recommendation list from search results (filtering out clicked video)
    let recommendations = [];
    if (Array.isArray(videos)) {
      recommendations = videos.map(sourceGroup => ({
        ...sourceGroup,
        list: sourceGroup.list?.filter(video => video.uniqueId !== v.uniqueId) || []
      })).filter(sourceGroup => sourceGroup.list.length > 0);
    }

    // 导航到播放页时，将当前搜索结果和关键词存入state
    navigate(`/play/${v.sourceKey}/${v.vod_id}`, {
      state: {
        video: v,
        recommendations,
        searchResults: videos, // 存储当前搜索结果
        searchKeyword: keyword // 存储当前搜索关键词
      }
    });
  };

  return (
    <>
      <div className="flex items-center gap-4 mb-6 animate-fade-in">
        <Link
          to="/"
          className="flex items-center justify-center w-8 h-8 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-all"
          aria-label="返回列表"
        >
          <ChevronLeft size={24} />
        </Link>
        <div className="h-6 w-px bg-white/10"></div>
        <h2 className="text-xl font-bold text-white truncate">
          搜索 <span className="text-blue-400">{keyword}</span> 的结果
        </h2>
      </div>

      <VideoList
        videos={videos}
        loading={loading}
        view="search_results"
        searchProgress={searchProgress}
        handleVideoClick={handleVideoClick}
      />
    </>
  );
}
