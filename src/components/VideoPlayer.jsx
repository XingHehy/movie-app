import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, AlertCircle, Loader2 } from 'lucide-react';
import { hlsInstances, plyrInstances, stopAllPlayers } from '../utils/playerManager.js';
import { updateWatchHistory } from '../utils/historyManager.js';
import '../player.css';

const VideoPlayer = ({ src, poster, title, sourceName, sourceDesc, onBack, currentVideo, currentEpisodeIndex, parsedEpisodes, resumeTime }) => {
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const videoRef = useRef(null);
  const playerContainerRef = useRef(null);
  const hlsRef = useRef(null);
  const plyrRef = useRef(null);
  const isInitialized = useRef(false);
  const [retryKey, setRetryKey] = useState(0);
  const playerId = useRef(Date.now() + Math.random().toString(36).substring(2, 10)); // 生成唯一ID
  const saveProgressIntervalRef = useRef(null);
  const hasRestoredTimeRef = useRef(false);

  // 初始化播放器
  useEffect(() => {
    if (!src || !videoRef.current || isInitialized.current) return;

    const video = videoRef.current;

    // 标记为已初始化
    isInitialized.current = true;

    const initPlayer = async () => {
      try {
        // 动态导入plyr及其样式
        const PlyrModule = await import('plyr');
        const Plyr = PlyrModule.default;
        await import('plyr/dist/plyr.css');

        // HLS 处理
        if (src.includes('.m3u8')) {
          // 动态导入hls.js
          const HlsModule = await import('hls.js');
          const Hls = HlsModule.default;

          if (Hls.isSupported()) {
            const hls = new Hls({
              maxBufferLength: 30,
              maxMaxBufferLength: 60,
              startLevel: -1, // 自动选择最佳质量
              enableWorker: true,
              lowLatencyMode: false,
              debug: false
            });

            hlsRef.current = hls;
            hlsInstances.set(playerId.current, hls);

            hls.loadSource(src);
            hls.attachMedia(video);

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              // HLS加载完成后初始化Plyr
              initPlyr(Plyr);
            });

            // HLS 加载完成后，也尝试恢复播放进度
            hls.on(Hls.Events.LEVEL_LOADED, () => {
              // 延迟一点时间，确保视频元数据已加载
              setTimeout(() => {
                if (video.duration > 0 && resumeTime > 0 && !hasRestoredTimeRef.current) {
                  // 恢复时间减去5秒，让用户有一些上下文
                  const adjustedResumeTime = Math.max(0, resumeTime - 5);
                  const safeResumeTime = Math.min(adjustedResumeTime, video.duration - 1);
                  if (safeResumeTime > 0) {
                    hasRestoredTimeRef.current = true;
                    video.currentTime = safeResumeTime;
                    if (plyrRef.current) {
                      plyrRef.current.currentTime = safeResumeTime;
                    }
                    console.log('✅ HLS 恢复播放进度:', safeResumeTime, '/', video.duration, '(原始时间:', resumeTime, ')');
                  }
                }
              }, 300);
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
          } else {
            // HLS不支持，尝试原生播放
            video.src = src;
            video.addEventListener('loadedmetadata', () => initPlyr(Plyr));
            video.addEventListener('error', handleVideoError);
          }
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          // 原生 HLS 支持 (iOS/Mac)
          video.src = src;
          video.addEventListener('loadedmetadata', () => initPlyr(Plyr));
          video.addEventListener('error', handleVideoError);
        } else {
          // 普通视频
          video.src = src;
          video.addEventListener('loadedmetadata', () => initPlyr(Plyr));
          video.addEventListener('error', handleVideoError);
        }

      } catch (err) {
        console.error('❌ 初始化播放器失败:', err);
        setError('播放器初始化失败');
        setIsLoading(false);
      }
    };

    // 初始化Plyr
    const initPlyr = (Plyr) => {
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
        speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
        fullscreen: { enabled: true, fallback: true, iosNative: true }
      });

      plyrRef.current = plyr;
      plyrInstances.set(playerId.current, plyr);

      // 恢复播放进度的函数
      const restorePlaybackTime = () => {
        if (resumeTime && resumeTime > 0 && !hasRestoredTimeRef.current && video.duration > 0) {
          // 恢复时间减去5秒，让用户有一些上下文
          const adjustedResumeTime = Math.max(0, resumeTime - 5);
          // 确保恢复时间不超过视频总时长
          const safeResumeTime = Math.min(adjustedResumeTime, video.duration - 1);
          if (safeResumeTime > 0) {
            hasRestoredTimeRef.current = true;
            video.currentTime = safeResumeTime;
            plyr.currentTime = safeResumeTime;
            console.log('✅ 恢复播放进度:', safeResumeTime, '/', video.duration, '(原始时间:', resumeTime, ')');
          }
        }
      };

      // 监听Plyr事件
      plyr.on('ready', () => {
        setIsLoading(false);
        // 尝试恢复播放进度
        restorePlaybackTime();

        // 拦截全屏按钮点击事件，优先使用 iOS 原生全屏
        // 使用 capture 阶段捕获事件，并在检测到 iPad/iOS 时阻止 Plyr 的默认行为
        const fullscreenBtn = playerContainerRef.current?.querySelector('button[data-plyr="fullscreen"]');

        if (fullscreenBtn) {
          fullscreenBtn.addEventListener('click', (e) => {
            // 检测 iPad (iPadOS 13+ 默认显示为 Macintosh) 或其他 iOS 设备
            const isIpad = /Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints && navigator.maxTouchPoints > 1;
            const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

            if ((isIpad || isIos) && video.webkitEnterFullscreen) {
              // 阻止 Plyr 的默认全屏处理
              e.preventDefault();
              e.stopPropagation();
              e.stopImmediatePropagation();

              // 调用原生全屏
              try {
                video.webkitEnterFullscreen();
              } catch (err) {
                console.warn('调用原生全屏失败:', err);
                // 如果原生失败，允许冒泡回 Plyr 处理（虽然通常已经停止冒泡了，这里做个日志）
              }
            }
          }, true); // useCapture = true 确保先于 Plyr 执行
        }

        // 拦截双击全屏事件
        const plyrContainer = playerContainerRef.current?.querySelector('.plyr');
        if (plyrContainer) {
          plyrContainer.addEventListener('dblclick', (e) => {
            // 检测 iPad (iPadOS 13+ 默认显示为 Macintosh) 或其他 iOS 设备
            const isIpad = /Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints && navigator.maxTouchPoints > 1;
            const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

            if ((isIpad || isIos) && video.webkitEnterFullscreen) {
              // 阻止 Plyr 的默认双击全屏处理
              e.preventDefault();
              e.stopPropagation();
              e.stopImmediatePropagation();

              // 调用原生全屏
              try {
                video.webkitEnterFullscreen();
              } catch (err) {
                console.warn('调用原生全屏失败:', err);
              }
            }
          }, true); // useCapture = true
        }
      });

      plyr.on('canplay', () => {
        setIsLoading(false);
        // 如果 ready 事件时还没有 duration，在这里尝试恢复
        restorePlaybackTime();
      });

      // 监听 loadedmetadata 事件，确保视频元数据已加载
      video.addEventListener('loadedmetadata', () => {
        restorePlaybackTime();
      });

      // 监听 loadeddata 事件，作为另一个恢复时机
      video.addEventListener('loadeddata', () => {
        restorePlaybackTime();
      });

      // 监听 timeupdate 事件，如果还没有恢复且视频已经开始播放，尝试恢复
      const checkResumeOnTimeUpdate = () => {
        if (resumeTime && resumeTime > 0 && !hasRestoredTimeRef.current && video.duration > 0) {
          restorePlaybackTime();
        }
      };
      
      // 延迟检查，给视频一些时间加载
      setTimeout(() => {
        if (video.readyState >= 2) { // HAVE_CURRENT_DATA
          checkResumeOnTimeUpdate();
        }
      }, 500);

      // 监听播放进度变化，用于立即保存（当用户滑动进度条时）
      let lastSaveTime = 0;
      const handleTimeUpdate = () => {
        // 使用最新的 ref 值，避免闭包问题
        const video = videoRef.current;
        const currentVideoData = currentVideo;
        const currentIndex = currentEpisodeIndex;
        const episodes = parsedEpisodes;
        
        if (!currentVideoData || !video) return;
        const currentTime = video.currentTime || 0;
        const duration = video.duration || 0;
        
        // 只要有播放时间就保存（移除5秒限制，让用户滑动进度条也能立即保存）
        if (currentTime > 0 && duration > 0) {
          updateWatchHistory({
            vod_id: currentVideoData.vod_id,
            sourceKey: currentVideoData.sourceKey || '',
            vod_name: currentVideoData.vod_name,
            vod_pic: currentVideoData.vod_pic || '',
            episodeIndex: currentIndex || 0,
            episodeName: episodes?.[currentIndex]?.name || '',
            currentTime: currentTime,
            duration: duration
          });
        }
      };

      // 节流函数，避免频繁保存
      const throttledTimeUpdate = () => {
        const now = Date.now();
        // 每2秒最多保存一次
        if (now - lastSaveTime >= 2000) {
          lastSaveTime = now;
          handleTimeUpdate();
        }
      };

      plyr.on('timeupdate', throttledTimeUpdate);
      
      // 监听用户拖动进度条（seeked 事件）
      plyr.on('seeked', () => {
        // 用户拖动进度条后立即保存
        handleTimeUpdate();
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
        plyrInstances.delete(playerId.current);
      }

      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
        hlsInstances.delete(playerId.current);
      }

      if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }

      isInitialized.current = false;
      hasRestoredTimeRef.current = false;
      
      // 清理保存进度的定时器
      if (saveProgressIntervalRef.current) {
        clearInterval(saveProgressIntervalRef.current);
        saveProgressIntervalRef.current = null;
      }
    };
  }, [src, poster, retryKey, resumeTime, currentVideo, currentEpisodeIndex, parsedEpisodes]);

  // 当 resumeTime 变化时，重置恢复标志，以便新的 resumeTime 能够生效
  useEffect(() => {
    if (resumeTime > 0) {
      hasRestoredTimeRef.current = false;
      console.log('🔄 resumeTime 已更新，准备恢复播放:', resumeTime);
    }
  }, [resumeTime]);

  // 定期保存播放进度（作为备份机制，即使事件监听失效也能保存）
  useEffect(() => {
    if (!currentVideo || !plyrRef.current || !videoRef.current) return;

    // 每10秒保存一次播放进度（作为备份）
    saveProgressIntervalRef.current = setInterval(() => {
      const video = videoRef.current;
      if (!video) return;

      const currentTime = video.currentTime || 0;
      const duration = video.duration || 0;
      
      // 只要有播放时间和总时长就保存（移除5秒限制）
      if (currentTime > 0 && duration > 0) {
        updateWatchHistory({
          vod_id: currentVideo.vod_id,
          sourceKey: currentVideo.sourceKey || '',
          vod_name: currentVideo.vod_name,
          vod_pic: currentVideo.vod_pic || '',
          episodeIndex: currentEpisodeIndex || 0,
          episodeName: parsedEpisodes?.[currentEpisodeIndex]?.name || '',
          currentTime: currentTime,
          duration: duration
        });
      }
    }, 10000); // 每10秒保存一次作为备份

    return () => {
      if (saveProgressIntervalRef.current) {
        clearInterval(saveProgressIntervalRef.current);
        saveProgressIntervalRef.current = null;
      }
    };
  }, [currentVideo, currentEpisodeIndex, parsedEpisodes]);

  // 在组件卸载或视频切换时保存最终进度
  useEffect(() => {
    return () => {
      if (currentVideo && videoRef.current) {
        const video = videoRef.current;
        const currentTime = video.currentTime || 0;
        const duration = video.duration || 0;
        
        // 只要有播放时间和总时长就保存
        if (currentTime >= 0 && duration > 0) {
          updateWatchHistory({
            vod_id: currentVideo.vod_id,
            sourceKey: currentVideo.sourceKey || '',
            vod_name: currentVideo.vod_name,
            vod_pic: currentVideo.vod_pic || '',
            episodeIndex: currentEpisodeIndex || 0,
            episodeName: parsedEpisodes?.[currentEpisodeIndex]?.name || '',
            currentTime: currentTime,
            duration: duration
          });
        }
      }
    };
  }, [currentVideo, currentEpisodeIndex, parsedEpisodes]);

  return (
    <div className="animate-fade-in w-full">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => {
            stopAllPlayers();
            onBack();
          }}
          className="flex items-center justify-center w-8 h-8 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-all"
          aria-label="返回"
        >
          <ChevronLeft size={24} />
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
              onClick={() => {
                setError(null);
                setIsLoading(true);
                setRetryKey(k => k + 1);
              }}
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
                    {sourceDesc?.replace(/&nbsp;/g, ' ')}
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
