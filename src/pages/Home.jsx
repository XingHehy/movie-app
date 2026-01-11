import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import VideoList from '../components/VideoList';
import Pagination from '../components/Pagination';
import { api } from '../api';
import { stopAllPlayers } from '../utils/playerManager';

export default function Home({ currentSource, setToastMessage, homeCache, setHomeCache }) {
  const navigate = useNavigate();
  const [page, setPage] = useState(homeCache.page || 1);
  const [videos, setVideos] = useState(homeCache.videos || []);
  const [loading, setLoading] = useState(false);
  const [totalPages, setTotalPages] = useState(homeCache.totalPages || 1);

  // 当数据源变化时
  useEffect(() => {
    if (!currentSource?.key) return;

    // 检查缓存是否有效（同一数据源，5分钟内，有数据）
    const cacheAge = Date.now() - (homeCache.timestamp || 0);
    const isCacheValid = homeCache.sourceKey === currentSource.key && 
                        cacheAge < 5 * 60 * 1000 && 
                        homeCache.videos.length > 0;

    // 如果缓存有效且页码匹配，使用缓存
    if (isCacheValid && page === homeCache.page) {
      setVideos(homeCache.videos);
      setTotalPages(homeCache.totalPages);
      return;
    }

    // 如果数据源变化或缓存无效，重新加载
    if (homeCache.sourceKey !== currentSource.key || !isCacheValid) {
      fetchSingleSource(currentSource, page);
    }
  }, [currentSource?.key]);

  // 当页码变化时
  useEffect(() => {
    if (!currentSource?.key) return;
    
    // 如果缓存的是当前页且有效，使用缓存
    const cacheAge = Date.now() - (homeCache.timestamp || 0);
    if (page === homeCache.page && 
        homeCache.sourceKey === currentSource.key && 
        homeCache.videos.length > 0 &&
        cacheAge < 5 * 60 * 1000) {
      setVideos(homeCache.videos);
      setTotalPages(homeCache.totalPages);
      return;
    }
    
    // 否则重新加载
    fetchSingleSource(currentSource, page);
  }, [page]);

  const fetchSingleSource = async (source, pageNum) => {
    setLoading(true);
    try {
      const data = await api.getVideoList(source.key, pageNum);
      if (data?.list) {
        const videoList = data.list.map(v => ({
          ...v,
          sourceName: source.name,
          sourceDesc: source.desc,
          sourceKey: source.key,
          uniqueId: `${source.key}_${v.vod_id}`
        }));
        setVideos(videoList);
        const total = Number(data.pagecount) || 1;
        setTotalPages(total);
        
        // 更新缓存（只缓存第一页）
        if (pageNum === 1) {
          setHomeCache({
            videos: videoList,
            page: pageNum,
            totalPages: total,
            sourceKey: source.key,
            timestamp: Date.now()
          });
        }
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

  const handlePageChange = (newPage) => {
    setPage(newPage);
    window.scrollTo(0, 0);
  };

  const handleVideoClick = (v) => {
    // 如果没有播放地址，则提示无法播放
    if (!v.vod_play_url || !String(v.vod_play_url).trim()) {
      setToastMessage && setToastMessage("此视频暂无法播放");
      return;
    }

    stopAllPlayers();
    navigate(`/play/${v.sourceKey}/${v.vod_id}`, { state: { video: v } });
  };

  return (
    <>
      <VideoList
        videos={videos}
        loading={loading}
        view="list"
        handleVideoClick={handleVideoClick}
      />
      {!loading && videos.length > 0 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          setPage={handlePageChange}
        />
      )}
    </>
  );
}
