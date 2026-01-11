import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import VideoDetail from '../components/VideoDetail';
import { api } from '../api';
import { stopAllPlayers } from '../utils/playerManager';
import { getVideoWatchHistory } from '../utils/historyManager';

export default function Player() {
  const { sourceKey, videoId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [currentVideo, setCurrentVideo] = useState(location.state?.video || null);
  const [loading, setLoading] = useState(!location.state?.video);
  const [parsedEpisodes, setParsedEpisodes] = useState([]);
  const [currentEpisodeIndex, setCurrentEpisodeIndex] = useState(0);
  const [recommendVideos, setRecommendVideos] = useState(location.state?.recommendations || []);
  const [resumeTime, setResumeTime] = useState(0);

  useEffect(() => {
    // Stop players when entering/leaving
    return () => stopAllPlayers();
  }, []);

  useEffect(() => {
    // When URL params change, update video content
    const newVideo = location.state?.video;
    const resumeEpisode = location.state?.resumeEpisode;
    const resumeTimeFromState = location.state?.resumeTime || 0;

    if (newVideo) {
      // If video data is passed in state, use it directly
      setCurrentVideo(newVideo);
      // 使用过滤函数只获取m3u8格式的播放数据
      const episodes = parseAndFilterM3u8PlayUrl(newVideo);
      setParsedEpisodes(episodes);
      
      // 检查是否需要恢复播放进度
      if (resumeEpisode !== undefined && resumeEpisode >= 0 && resumeEpisode < episodes.length) {
        setCurrentEpisodeIndex(resumeEpisode);
        setResumeTime(resumeTimeFromState);
      } else {
        // 尝试从观看历史中恢复
        const watchHistory = getVideoWatchHistory(newVideo.vod_id, newVideo.sourceKey || sourceKey);
        if (watchHistory && watchHistory.episodeIndex >= 0 && watchHistory.episodeIndex < episodes.length) {
          setCurrentEpisodeIndex(watchHistory.episodeIndex);
          setResumeTime(watchHistory.currentTime || 0);
        } else {
          setCurrentEpisodeIndex(0);
          setResumeTime(0);
        }
      }
    } else if (sourceKey && videoId) {
      // Otherwise fetch from API
      fetchDetail();
      // 在 fetchDetail 中会处理恢复逻辑
    }
  }, [sourceKey, videoId, location.state]);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const data = await api.getVideoDetail(sourceKey, videoId);
      if (data && data.list && data.list.length > 0) {
        const video = data.list[0];
        // Add sourceKey as it's needed for context
        video.sourceKey = sourceKey;
        // We might be missing sourceName/Desc if fetched directly, 
        // but VideoDetail mostly uses vod_ data. 
        // If needed, we could fetch source info too, but let's assume it's fine.

        setCurrentVideo(video);
        // 使用过滤函数只获取m3u8格式的播放数据
        const episodes = parseAndFilterM3u8PlayUrl(video);
        setParsedEpisodes(episodes);
        
        // 检查是否需要恢复播放进度
        const resumeEpisode = location.state?.resumeEpisode;
        const resumeTimeFromState = location.state?.resumeTime || 0;
        
        if (resumeEpisode !== undefined && resumeEpisode >= 0 && resumeEpisode < episodes.length) {
          setCurrentEpisodeIndex(resumeEpisode);
          setResumeTime(resumeTimeFromState);
        } else {
          // 尝试从观看历史中恢复
          const watchHistory = getVideoWatchHistory(video.vod_id, sourceKey);
          if (watchHistory && watchHistory.episodeIndex >= 0 && watchHistory.episodeIndex < episodes.length) {
            setCurrentEpisodeIndex(watchHistory.episodeIndex);
            setResumeTime(watchHistory.currentTime || 0);
          } else {
            setCurrentEpisodeIndex(0);
            setResumeTime(0);
          }
        }
      } else {
        // Handle not found
        console.error("Video not found");
      }
    } catch (err) {
      console.error("Failed to fetch video detail", err);
    } finally {
      setLoading(false);
    }
  };

  // 过滤并解析m3u8格式的播放数据
  const parseAndFilterM3u8PlayUrl = (video) => {
    if (!video || !video.vod_play_from || !video.vod_play_url) {
      return [];
    }

    // 分割不同的播放源
    const playFromList = video.vod_play_from.split('$$$');
    const playUrlList = video.vod_play_url.split('$$$');

    // 找到包含m3u8的播放源索引
    const m3u8Index = playFromList.findIndex(source => source.toLowerCase().includes('m3u8'));

    if (m3u8Index === -1 || !playUrlList[m3u8Index]) {
      // 如果没有找到m3u8源，尝试从url中直接过滤
      console.warn('未找到m3u8播放源，尝试直接从URL过滤');
      return parsePlayUrl(video.vod_play_url || '')
        .filter(item => item.url.includes('.m3u8'));
    }

    // 只解析m3u8源的播放URL
    return parsePlayUrl(playUrlList[m3u8Index]);
  };

  // 基础解析播放URL函数
  const parsePlayUrl = (urlStr) => {
    if (!urlStr) return [];
    return urlStr.split('#')
      .map(s => {
        const p = s.split('$');
        return p.length >= 2 ? { name: p[0], url: p[1] } : null;
      })
      .filter(Boolean);
  };

  const handleVideoClick = (v) => {
    stopAllPlayers();
    navigate(`/play/${v.sourceKey}/${v.vod_id}`, { state: { video: v, recommendations: recommendVideos } });
  };

  if (loading) return <div className="text-center py-10 text-slate-400">正在加载视频信息...</div>;
  if (!currentVideo) return <div className="text-center py-10 text-slate-400">未找到视频</div>;

  const handleBack = () => {
    // 检查是否是从搜索页过来的
    if (location.state?.searchResults && location.state?.searchKeyword) {
      // 如果是从搜索页过来的，返回搜索页并携带搜索结果和fromPlayer标记
      navigate(`/search/${location.state.searchKeyword}`, {
        state: {
          fromPlayer: true,
          searchResults: location.state.searchResults,
          searchKeyword: location.state.searchKeyword
        }
      });
    } else {
      // 否则使用默认的返回方式
      navigate(-1);
    }
  };

  return (
    <VideoDetail
      currentVideo={currentVideo}
      parsedEpisodes={parsedEpisodes}
      currentEpisodeIndex={currentEpisodeIndex}
      setCurrentEpisodeIndex={setCurrentEpisodeIndex}
      stopAllPlayers={stopAllPlayers}
      recommendVideos={recommendVideos}
      onVideoClick={handleVideoClick}
      onBack={handleBack}
      resumeTime={resumeTime}
    />
  );
}
