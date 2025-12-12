import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import VideoList from '../components/VideoList';
import { api } from '../api';

export default function Search({ sources }) {
  const { keyword } = useParams();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchProgress, setSearchProgress] = useState("");
  const navigate = useNavigate();
  const searchAbortController = useRef(null);

  useEffect(() => {
    if (keyword && sources.length > 0) {
      fetchMultiSourceSearch(keyword);
    }
    return () => {
      if (searchAbortController.current) {
        searchAbortController.current.abort();
      }
    };
  }, [keyword, sources]);

  const fetchMultiSourceSearch = async (kw) => {
    setLoading(true);
    setVideos([]);
    let completed = 0;
    setSearchProgress(`搜索 0/${sources.length} 个源...`);

    // Cancel previous requests if any (though usually useEffect cleanup handles this, 
    // but here we might want to ensure we don't have overlapping searches)

    try {
      const promises = sources.map(async (source) => {
        try {
          const controller = new AbortController();
          // We don't store individual controllers here easily to abort them all, 
          // but we rely on the fact that when component unmounts we don't care,
          // or we could use a global signal. 
          // For now, let's just let them run or timeout.
          const timeoutId = setTimeout(() => controller.abort(), 8000);

          const data = await api.searchVideos(source.key, kw, controller.signal);
          clearTimeout(timeoutId);

          completed++;
          setSearchProgress(`搜索 ${completed}/${sources.length} 个源...`);

          const list = data?.list?.map(v => ({
            ...v,
            sourceName: source.name,
            sourceDesc: source.desc,
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
    }
  };

  const handleVideoClick = (v) => {
    // Prepare recommendation list from search results (filtering out clicked video)
    let recommendations = [];
    if (Array.isArray(videos)) {
      recommendations = videos.map(sourceGroup => ({
        ...sourceGroup,
        list: sourceGroup.list?.filter(video => video.uniqueId !== v.uniqueId) || []
      })).filter(sourceGroup => sourceGroup.list.length > 0);
    }

    navigate(`/play/${v.sourceKey}/${v.vod_id}`, { state: { video: v, recommendations } });
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
