import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import VideoDetail from '../components/VideoDetail';
import { api } from '../api';
import { stopAllPlayers } from '../utils/playerManager';

export default function Player() {
  const { sourceKey, videoId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [currentVideo, setCurrentVideo] = useState(location.state?.video || null);
  const [loading, setLoading] = useState(!location.state?.video);
  const [parsedEpisodes, setParsedEpisodes] = useState([]);
  const [currentEpisodeIndex, setCurrentEpisodeIndex] = useState(0);
  const [recommendVideos, setRecommendVideos] = useState(location.state?.recommendations || []);

  useEffect(() => {
    // Stop players when entering/leaving
    return () => stopAllPlayers();
  }, []);

  useEffect(() => {
    if (!currentVideo) {
      // Fetch detail if not passed in state
      fetchDetail();
    } else {
      // Parse episodes from existing video data
      const eps = parsePlayUrl(currentVideo.vod_play_url);
      setParsedEpisodes(eps);
    }
  }, [currentVideo, sourceKey, videoId]);

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

  return (
    <VideoDetail
      currentVideo={currentVideo}
      parsedEpisodes={parsedEpisodes}
      currentEpisodeIndex={currentEpisodeIndex}
      setCurrentEpisodeIndex={setCurrentEpisodeIndex}
      stopAllPlayers={stopAllPlayers}
      recommendVideos={recommendVideos}
      onVideoClick={handleVideoClick}
      onBack={() => navigate(-1)}
    />
  );
}
