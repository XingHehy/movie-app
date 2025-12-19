import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import VideoList from '../components/VideoList';
import Pagination from '../components/Pagination';
import { api } from '../api';
import { stopAllPlayers } from '../utils/playerManager';

export default function Home({ currentSource, setToastMessage }) {
  const [page, setPage] = useState(1);

  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const navigate = useNavigate();

  useEffect(() => {
    if (currentSource?.key) {
      fetchSingleSource(currentSource, page);
    }
  }, [currentSource, page]);

  const fetchSingleSource = async (source, pageNum) => {
    setLoading(true);
    try {
      const data = await api.getVideoList(source.key, pageNum);
      if (data?.list) {
        setVideos(data.list.map(v => ({
          ...v,
          sourceName: source.name,
          sourceDesc: source.desc,
          sourceKey: source.key,
          uniqueId: `${source.key}_${v.vod_id}`
        })));
        setTotalPages(Number(data.pagecount) || 1);
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
