import React, { useState, useEffect, useRef } from 'react';
import Hls from 'hls.js';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';
import { ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';
import { hlsInstances, plyrInstances, stopAllPlayers } from '../utils/playerManager.js';
import '../player.css';

const VideoPlayer = ({ src, poster, title, sourceName, sourceDesc, onBack }) => {
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const videoRef = useRef(null);
  const playerContainerRef = useRef(null);
  const hlsRef = useRef(null);
  const plyrRef = useRef(null);
  const isInitialized = useRef(false);

  // 初始化播放器
  useEffect(() => {
    if (!src || !videoRef.current || isInitialized.current) return;

    const video = videoRef.current;

    // 标记为已初始化
    isInitialized.current = true;

    const initPlayer = async () => {
      try {
        // HLS 处理
        if (src.includes('.m3u8') && Hls.isSupported()) {
          const hls = new Hls({
            maxBufferLength: 30,
            maxMaxBufferLength: 60,
            startLevel: -1, // 自动选择最佳质量
            enableWorker: true,
            lowLatencyMode: false,
            debug: false
          });

          hlsRef.current = hls;

          hls.loadSource(src);
          hls.attachMedia(video);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            // HLS加载完成后初始化Plyr
            initPlyr();
          });

          hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  console.error('网络错误，尝试恢复...');
                  hls.startLoad();
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  console.error('媒体错误，尝试恢复...');
                  hls.recoverMediaError();
                  break;
                default:
                  console.error('HLS播放错误:', data);
                  setError('播放出错，请尝试切换源');
                  setIsLoading(false);
                  hls.destroy();
                  break;
              }
            }
          });

        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          // 原生 HLS 支持 (iOS/Mac)
          video.src = src;
          video.addEventListener('loadedmetadata', initPlyr);
          video.addEventListener('error', handleVideoError);
        } else {
          // 普通视频
          video.src = src;
          video.addEventListener('loadedmetadata', initPlyr);
          video.addEventListener('error', handleVideoError);
        }

      } catch (err) {
        console.error('❌ 初始化播放器失败:', err);
        setError('播放器初始化失败');
        setIsLoading(false);
      }
    };

    // 初始化Plyr
    const initPlyr = () => {
      if (plyrRef.current) return;

      const plyr = new Plyr(video, {
        controls: [
          'play-large',
          'play',
          'progress',
          'current-time',
          'mute',
          'volume',
          'settings',
          'fullscreen'
        ],
        ratio: '16:9', // 强制 16:9 比例，防止竖屏视频撑破容器
        autoplay: true,
        muted: false,
        hideControls: true,
        resetOnEnd: false,
        keyboard: { focused: true, global: true },
        tooltips: { controls: true, seek: true },
        speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] }
      });

      plyrRef.current = plyr;

      // 监听Plyr事件
      plyr.on('ready', () => {
        setIsLoading(false);
      });

      plyr.on('canplay', () => {
        setIsLoading(false);
      });

      plyr.on('error', (event) => {
        console.error('播放器错误:', event);
        setError('播放出错，请尝试切换源');
        setIsLoading(false);
      });

      // 尝试自动播放
      plyr.play().catch(err => {
        console.warn('自动播放失败:', err);
        setIsLoading(false);
      });
    };

    // 视频错误处理
    const handleVideoError = (e) => {
      console.error('❌ Video元素错误:', e);
      setError('播放出错，请尝试切换源');
      setIsLoading(false);
    };

    initPlayer();

    // 清理函数
    return () => {
      if (plyrRef.current) {
        plyrRef.current.destroy();
        plyrRef.current = null;
      }

      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }

      isInitialized.current = false;
    };
  }, [src, poster]);

  return (
    <div className="animate-fade-in w-full">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => {
            stopAllPlayers();
            onBack();
          }}
          className="flex items-center text-slate-400 hover:text-white transition-colors group px-3 py-1.5 rounded-lg hover:bg-slate-800"
        >
          <ArrowLeft size={18} className="mr-2 group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">返回列表</span>
        </button>

        <div className="flex items-center gap-1.5 text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20 text-xs">
          <AlertCircle size={14} />
          <span>请勿相信视频内任何广告</span>
        </div>

      </div>

      <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 group" ref={playerContainerRef}>
        {/* 视频元素 - 按照文档推荐的方式 */}
        <video
          ref={videoRef}
          className="plyr-video w-full h-full"
          playsInline
          crossOrigin="anonymous"
        ></video>

        {/* 加载状态 */}
        {isLoading && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
            <Loader2 size={40} className="text-blue-500 animate-spin" />
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 z-20">
            <AlertCircle size={48} className="text-red-500 mb-4" />
            <p className="text-slate-300 text-lg">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
            >
              重试
            </button>
          </div>
        )}
      </div>

      <div className="mt-5 space-y-2">
        <h1 className="text-xl md:text-2xl font-bold text-white leading-tight">{title}</h1>
        <div className="flex gap-2 text-xs text-slate-400 items-center">
          {sourceName && (
            <div className="relative group">
              <span className="bg-blue-600/80 text-white px-2 py-0.5 rounded">
                {sourceName}
              </span>
              {/* Tooltip - 右下角显示 */}
              {sourceDesc && (
                <div className="absolute top-full mt-2 left-0 z-[100] pointer-events-none invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200">
                  <div className="bg-slate-900 text-slate-200 text-[10px] px-2 py-1 rounded border border-white/10 whitespace-nowrap shadow-xl max-w-xs">
                    {sourceDesc}
                  </div>
                  {/* 小三角 */}
                  <div className="w-2 h-2 bg-slate-900 border-l border-t border-white/10 absolute -top-1 left-3 rotate-45"></div>
                </div>
              )}
            </div>
          )}
          <span className="bg-slate-800 px-2 py-0.5 rounded">HLS</span>
          <span className="bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded">高清</span>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
