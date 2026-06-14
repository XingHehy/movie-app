import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, AlertCircle, Loader2 } from 'lucide-react';
import { hlsInstances, plyrInstances, stopAllPlayers } from '../utils/playerManager.js';
import { updateWatchHistory } from '../utils/historyManager.js';
import '../player.css';

const AUTO_SKIP_ADS_STORAGE_KEY = 'movie_app_auto_skip_ads';

const loadAutoSkipAdsFromStorage = () => {
  try {
    const raw = localStorage.getItem(AUTO_SKIP_ADS_STORAGE_KEY);
    if (raw === null) return true;
    return JSON.parse(raw) !== false;
  } catch {
    return true;
  }
};

const persistAutoSkipAds = (enabled) => {
  try {
    localStorage.setItem(AUTO_SKIP_ADS_STORAGE_KEY, JSON.stringify(enabled));
  } catch {
    /* ignore quota / private mode */
  }
};

/** 将秒数转为 HH:MM:SS[.mmm]，便于日志与提示阅读 */
const formatSecondsToHMS = (totalSeconds) => {
  if (totalSeconds == null || Number.isNaN(totalSeconds)) return '00:00:00';
  const t = Number(totalSeconds);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const whole = Math.floor(s);
  const ms = Math.round((s - whole) * 1000);
  const pad2 = (n) => String(n).padStart(2, '0');
  const msPart = ms > 0 ? `.${String(ms).padStart(3, '0')}` : '';
  return `${pad2(h)}:${pad2(m)}:${pad2(whole)}${msPart}`;
};

const VideoPlayer = ({ src, poster, title, sourceName, sourceDesc, onBack, currentVideo, currentEpisodeIndex, parsedEpisodes, resumeTime, setToastMessage, onEpisodeChange }) => {
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [controlsReady, setControlsReady] = useState(false);
  const [autoSkipAdsEnabled, setAutoSkipAdsEnabled] = useState(() => loadAutoSkipAdsFromStorage());
  /** 与 state 同步，供 HLS 回调 / timeupdate 闭包读取，避免把开关放进播放器 init 的 effect 依赖（否则会整实例重建导致黑屏） */
  const autoSkipAdsEnabledRef = useRef(autoSkipAdsEnabled);
  autoSkipAdsEnabledRef.current = autoSkipAdsEnabled;

  const videoRef = useRef(null);
  const playerContainerRef = useRef(null);
  const hlsRef = useRef(null);
  const plyrRef = useRef(null);
  const isInitialized = useRef(false);
  const currentSrcRef = useRef(null);
  const resumeTimeRef = useRef(resumeTime);
  const playbackMetaRef = useRef({ currentVideo, currentEpisodeIndex, parsedEpisodes });
  const [retryKey, setRetryKey] = useState(0);
  const playerId = useRef(Date.now() + Math.random().toString(36).substring(2, 10)); // 生成唯一ID
  const saveProgressIntervalRef = useRef(null);
  const hasRestoredTimeRef = useRef(false);
  const adRangesRef = useRef([]);
  const lastAutoSkipRef = useRef({ at: 0, target: 0 });
  const lastToastRef = useRef({ detectAt: 0, skipAt: 0 });
  const longPressTimerRef = useRef(null);
  const originalSpeedRef = useRef(1);
  const isLongPressingRef = useRef(false);
  const [showSpeedIndicator, setShowSpeedIndicator] = useState(false);
  const [adSkipStatus, setAdSkipStatus] = useState(null); // null | 'preparing' | 'skipped'
  const adSkipTimeoutRef = useRef(null);
  const sourceLoadTimeoutRef = useRef(null);
  const topOverlayTimeoutRef = useRef(null);
  const gestureRef = useRef(null);
  const playerReadyCleanupRef = useRef(null);
  const episodeButtonsCleanupRef = useRef(null);
  const lastNonZeroVolumeRef = useRef(1);
  const episodeNavRef = useRef({ currentEpisodeIndex, parsedEpisodes, onEpisodeChange });
  resumeTimeRef.current = resumeTime;
  playbackMetaRef.current = { currentVideo, currentEpisodeIndex, parsedEpisodes };
  episodeNavRef.current = { currentEpisodeIndex, parsedEpisodes, onEpisodeChange };
  const hasPreviousEpisode = currentEpisodeIndex > 0;
  const hasNextEpisode = currentEpisodeIndex < (parsedEpisodes?.length || 0) - 1;
  const showTopOverlayMessage = (message) => {
    const container = document.getElementById('speed-indicator-container');
    if (!container) return;
    if (topOverlayTimeoutRef.current) {
      clearTimeout(topOverlayTimeoutRef.current);
      topOverlayTimeoutRef.current = null;
    }
    container.innerHTML = `
      <div style="position: absolute; top: 40px; left: 50%; transform: translateX(-50%); pointer-events: none; z-index: 2147483647;">
        <div style="display: flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.3); padding: 8px 16px; border-radius: 8px; backdrop-filter: blur(4px);">
          <span style="font-size: 16px; font-weight: 600; color: white; text-shadow: 0 1px 2px rgba(0,0,0,0.5);">${message}</span>
        </div>
      </div>
    `;
    topOverlayTimeoutRef.current = setTimeout(() => {
      container.innerHTML = '';
      topOverlayTimeoutRef.current = null;
    }, 1600);
  };
  const handleEpisodeSwitch = (direction) => {
    const { currentEpisodeIndex: index, parsedEpisodes: episodes, onEpisodeChange: changeEpisode } = episodeNavRef.current;
    const nextIndex = index + direction;
    if (!changeEpisode || nextIndex < 0 || nextIndex >= (episodes?.length || 0)) return;
    showTopOverlayMessage(`播放：${episodes?.[nextIndex]?.name || `第 ${nextIndex + 1} 集`}`);
    changeEpisode(nextIndex);
  };

  const detectAdRangesFromLevel = (details, playlistUrl) => {
    const fragments = details?.fragments || [];
    if (fragments.length < 2) return [];

    const resolveTsUrl = (frag) => {
      const raw = frag?.url || frag?.relurl || '';
      if (!raw) return '';
      try {
        return new URL(raw, playlistUrl).toString();
      } catch {
        return raw;
      }
    };

    const groups = [];
    let currentGroup = [];

    const flushGroup = () => {
      if (currentGroup.length === 0) return;
      const first = currentGroup[0];
      const last = currentGroup[currentGroup.length - 1];
      const duration = currentGroup.reduce((sum, frag) => sum + (frag.duration || 0), 0);

      let pathKey = '';
      try {
        const absoluteUrl = new URL(first.url || first.relurl || '', playlistUrl);
        const parts = absoluteUrl.pathname.split('/').filter(Boolean);
        pathKey = parts.slice(0, 2).join('/');
      } catch {
        pathKey = '';
      }

      const hasAdKeyword = currentGroup.some((frag) => {
        const url = (frag.url || frag.relurl || '').toLowerCase();
        return /\/ads?\b|advert|guanggao|\/gg\//.test(url);
      });

      groups.push({
        start: first.start || 0,
        end: (last.start || 0) + (last.duration || 0),
        duration,
        pathKey,
        hasAdKeyword,
        tsUrls: currentGroup.map(resolveTsUrl).filter(Boolean)
      });
      currentGroup = [];
    };

    for (let i = 0; i < fragments.length; i += 1) {
      const frag = fragments[i];
      if (currentGroup.length === 0) {
        currentGroup.push(frag);
        continue;
      }

      const prev = currentGroup[currentGroup.length - 1];
      // 有些源不稳定提供 cc，额外用 discontinuity 标记切组
      if ((frag.cc || 0) !== (prev.cc || 0) || frag.discontinuity) {
        flushGroup();
      }
      currentGroup.push(frag);
    }
    flushGroup();

    if (groups.length < 2) return [];

    const mainGroup = groups.reduce((maxGroup, group) => (
      group.duration > maxGroup.duration ? group : maxGroup
    ), groups[0]);

    return groups
      .filter((group) => group !== mainGroup)
      .filter((group) => group.duration > 0.2 && group.duration <= 180)
      .filter((group) => group.hasAdKeyword || (mainGroup.pathKey && group.pathKey && group.pathKey !== mainGroup.pathKey))
      .map((group) => {
        const start = Math.max(0, group.start);
        const end = Math.max(group.start, group.end);
        return {
          start,
          end,
          startHMS: formatSecondsToHMS(start),
          endHMS: formatSecondsToHMS(end),
          tsUrls: group.tsUrls || []
        };
      });
  };

  // 初始化播放器
  useEffect(() => {
    if (!videoRef.current || isInitialized.current) return;

    const video = videoRef.current;

    // 标记为已初始化
    isInitialized.current = true;

    const initPlayer = async () => {
      try {
        // 动态导入plyr及其样式
        const PlyrModule = await import('plyr');
        const Plyr = PlyrModule.default;
        await import('plyr/dist/plyr.css');
        initPlyr(Plyr);

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
        // Plyr 控件文案中文化（i18n）
        i18n: {
          play: '播放',
          pause: '暂停',
          mute: '静音',
          unmute: '取消静音',
          volume: '音量',
          enterFullscreen: '进入全屏',
          exitFullscreen: '退出全屏',
          settings: '设置',
          speed: '播放速度',
          normal: '正常',
          quality: '画质',
          captions: '字幕',
          enableCaptions: '开启字幕',
          disableCaptions: '关闭字幕',
          rewind: '快退 {seektime} 秒',
          fastForward: '快进 {seektime} 秒',
          seek: '跳转',
          seekLabel: '{currentTime} / {duration}',
          currentTime: '当前时间',
          duration: '总时长',
          menuBack: '返回',
          restart: '重新播放'
        },
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
        const latestResumeTime = resumeTimeRef.current || 0;
        if (latestResumeTime > 0 && !hasRestoredTimeRef.current && video.duration > 0) {
          // 恢复时间减去5秒，让用户有一些上下文
          const adjustedResumeTime = Math.max(0, latestResumeTime - 5);
          // 确保恢复时间不超过视频总时长
          const safeResumeTime = Math.min(adjustedResumeTime, video.duration - 1);
          if (safeResumeTime > 0) {
            hasRestoredTimeRef.current = true;
            video.currentTime = safeResumeTime;
            plyr.currentTime = safeResumeTime;
            console.log('✅ 恢复播放进度:', safeResumeTime, '/', video.duration, '(原始时间:', latestResumeTime, ')');
          }
        }
      };

      // 监听Plyr事件
      const setupPlayerControls = () => {
        if (playerReadyCleanupRef.current) return;
        // 尝试恢复播放进度
        restorePlaybackTime();

        // 获取 Plyr 容器，用于添加指示器
        const plyrElement = playerContainerRef.current?.querySelector('.plyr');

        // 创建指示器容器并添加到 Plyr 容器中
        const indicatorContainer = document.createElement('div');
        indicatorContainer.id = 'speed-indicator-container';
        indicatorContainer.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 2147483647;';
        if (plyrElement) {
          plyrElement.appendChild(indicatorContainer);
        }

        const canUseOrientationLock = () => (
          typeof window !== 'undefined' &&
          navigator.maxTouchPoints > 0 &&
          window.screen?.orientation?.lock
        );
        const lockLandscape = async () => {
          if (!canUseOrientationLock()) return;
          try {
            await window.screen.orientation.lock('landscape');
          } catch (err) {
            console.warn('横屏锁定失败，浏览器可能不支持:', err);
          }
        };
        const unlockOrientation = () => {
          if (!window.screen?.orientation?.unlock) return;
          try {
            window.screen.orientation.unlock();
          } catch (err) {
            console.warn('解除横屏锁定失败:', err);
          }
        };
        const isFullscreenActive = () => (
          document.fullscreenElement ||
          document.webkitFullscreenElement ||
          plyr.fullscreen.active
        );
        const handleFullscreenOrientation = () => {
          setTimeout(() => {
            if (isFullscreenActive()) {
              lockLandscape();
            } else {
              unlockOrientation();
            }
          }, 0);
        };
        document.addEventListener('fullscreenchange', handleFullscreenOrientation);
        document.addEventListener('webkitfullscreenchange', handleFullscreenOrientation);
        video.addEventListener('webkitbeginfullscreen', lockLandscape);
        video.addEventListener('webkitendfullscreen', unlockOrientation);
        plyr.on('enterfullscreen', lockLandscape);
        plyr.on('exitfullscreen', unlockOrientation);

        const controlsElement = playerContainerRef.current?.querySelector('.plyr__controls');
        setControlsReady(Boolean(controlsElement));

        const volumeElement = controlsElement?.querySelector('.plyr__volume');
        const volumeInput = volumeElement?.querySelector('input[type="range"]');
        const muteButton = volumeElement?.querySelector('button[data-plyr="mute"]');
        let volumeValueEl = null;
        let volumeHitboxEl = null;
        const updateVolumeValue = () => {
          if (!volumeValueEl) return;
          if (!plyr.muted && plyr.volume > 0) {
            lastNonZeroVolumeRef.current = plyr.volume;
          }
          volumeValueEl.textContent = String(Math.round((plyr.muted ? 0 : plyr.volume) * 100));
        };
        const toggleVolumePanel = (event) => {
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget?.blur();
          volumeElement?.classList.toggle('is-volume-open');
        };
        const closeVolumePanelOnOutsideClick = (event) => {
          if (!volumeElement?.contains(event.target)) {
            volumeElement?.classList.remove('is-volume-open');
          }
        };
        const closeVolumePanel = () => {
          volumeElement?.classList.remove('is-volume-open');
        };
        const toggleMuteFromVolumeValue = (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (plyr.muted || plyr.volume === 0) {
            const restoredVolume = lastNonZeroVolumeRef.current || 0.8;
            plyr.volume = restoredVolume;
            plyr.muted = false;
            video.volume = restoredVolume;
            video.muted = false;
            if (volumeInput) volumeInput.value = String(restoredVolume);
          } else {
            lastNonZeroVolumeRef.current = plyr.volume || lastNonZeroVolumeRef.current;
            plyr.volume = 0;
            plyr.muted = true;
            video.volume = 0;
            video.muted = true;
            if (volumeInput) volumeInput.value = '0';
          }
          updateVolumeValue();
        };
        const setVolumeFromVerticalPointer = (event) => {
          if (!volumeInput || !volumeHitboxEl) return;
          event.preventDefault();
          event.stopPropagation();
          const rect = volumeHitboxEl.getBoundingClientRect();
          const ratio = clamp((rect.bottom - event.clientY) / rect.height, 0, 1);
          plyr.volume = ratio;
          plyr.muted = ratio === 0;
          video.volume = ratio;
          video.muted = ratio === 0;
          volumeInput.value = String(ratio);
          updateVolumeValue();
        };
        const startVolumePointer = (event) => {
          setVolumeFromVerticalPointer(event);
          const handlePointerMove = (moveEvent) => setVolumeFromVerticalPointer(moveEvent);
          const handlePointerUp = () => {
            document.removeEventListener('pointermove', handlePointerMove);
            document.removeEventListener('pointerup', handlePointerUp);
          };
          document.addEventListener('pointermove', handlePointerMove);
          document.addEventListener('pointerup', handlePointerUp);
        };

        if (volumeElement && volumeInput && muteButton) {
          volumeElement.classList.add('plyr__volume--vertical');
          volumeInput.setAttribute('step', '0.01');
          volumeValueEl = document.createElement('button');
          volumeValueEl.type = 'button';
          volumeValueEl.className = 'plyr__volume-value';
          volumeValueEl.setAttribute('aria-label', '静音 / 恢复音量');
          volumeValueEl.setAttribute('title', '静音 / 恢复音量');
          volumeHitboxEl = document.createElement('span');
          volumeHitboxEl.className = 'plyr__volume-hitbox';
          volumeElement.insertBefore(volumeHitboxEl, volumeInput);
          volumeElement.insertBefore(volumeValueEl, volumeInput);
          updateVolumeValue();
          volumeValueEl.addEventListener('click', toggleMuteFromVolumeValue);
          volumeInput.addEventListener('input', updateVolumeValue);
          volumeHitboxEl.addEventListener('pointerdown', startVolumePointer);
          plyr.on('volumechange', updateVolumeValue);
          plyr.on('controlshidden', closeVolumePanel);
          muteButton.addEventListener('click', toggleVolumePanel, true);
          document.addEventListener('pointerdown', closeVolumePanelOnOutsideClick, true);
        }

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

        // 添加移动端长按加速功能
        const indicatorContainerId = 'speed-indicator-container';
        const getIndicatorContainer = () => document.getElementById(indicatorContainerId);
        const clearGestureIndicator = () => {
          const container = getIndicatorContainer();
          if (container && !isLongPressingRef.current) {
            container.innerHTML = '';
          }
        };
        const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
        const formatGestureTime = (seconds) => {
          if (!Number.isFinite(seconds)) return '00:00';
          const safeSeconds = Math.max(0, Math.floor(seconds));
          const hours = Math.floor(safeSeconds / 3600);
          const minutes = Math.floor((safeSeconds % 3600) / 60);
          const secs = safeSeconds % 60;
          if (hours > 0) {
            return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
          }
          return `${minutes}:${String(secs).padStart(2, '0')}`;
        };
        const renderGestureIndicator = ({ type, deltaSeconds = 0, targetTime = 0, volume = 0 }) => {
          const container = getIndicatorContainer();
          if (!container) return;

          const isSeek = type === 'seek';
          const direction = deltaSeconds >= 0 ? '快进' : '后退';
          const arrow = deltaSeconds >= 0 ? '>>' : '<<';
          const percent = Math.round(clamp(volume, 0, 1) * 100);
          const label = isSeek
            ? `${arrow} ${direction} ${Math.abs(Math.round(deltaSeconds))} 秒`
            : `音量 ${percent}%`;
          const detail = isSeek ? formatGestureTime(targetTime) : '';
          const barPercent = isSeek
            ? clamp((Math.abs(deltaSeconds) / 120) * 100, 8, 100)
            : percent;

          container.innerHTML = `
            <div class="gesture-indicator gesture-indicator--${type}">
              <div class="gesture-indicator__label">${label}</div>
              <div class="gesture-indicator__detail">${detail}</div>
              <div class="gesture-indicator__track">
                <div class="gesture-indicator__fill" style="width: ${barPercent}%"></div>
              </div>
            </div>
          `;
        };
        const getSeekSensitivity = () => {
          const duration = Number.isFinite(video.duration) ? video.duration : 0;
          return clamp(duration / 12000, 0.06, 0.45);
        };
        const renderGestureOverlay = ({ type, deltaSeconds = 0, targetTime = 0, volume = 0 }) => {
          const container = getIndicatorContainer();
          if (!container) return;

          const isSeek = type === 'seek';
          const direction = deltaSeconds >= 0 ? '快进' : '后退';
          const arrow = deltaSeconds >= 0 ? '>>' : '<<';
          const percent = Math.round(clamp(volume, 0, 1) * 100);
          const label = isSeek
            ? `${arrow} ${direction} ${Math.abs(Math.round(deltaSeconds))} 秒`
            : `音量 ${percent}%`;
          const detail = isSeek ? formatGestureTime(targetTime) : '';

          container.innerHTML = `
            <div style="position: absolute; top: 40px; left: 50%; transform: translateX(-50%); pointer-events: none; z-index: 2147483647;">
              <div style="display: flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.3); padding: 8px 16px; border-radius: 8px; backdrop-filter: blur(4px);">
                <span style="font-size: 16px; font-weight: 600; color: white; text-shadow: 0 1px 2px rgba(0,0,0,0.5);">${label}</span>
                ${detail ? `<span style="font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.78); text-shadow: 0 1px 2px rgba(0,0,0,0.5);">${detail}</span>` : ''}
              </div>
            </div>
          `;
        };
        const getPointFromEvent = (e) => {
          const point = e.touches?.[0] || e.changedTouches?.[0] || e;
          return { x: point.clientX, y: point.clientY };
        };
        const stopLongPress = () => {
          if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
          }
        };
        const finishLongPress = () => {
          stopLongPress();

          if (isLongPressingRef.current && video && plyr) {
            console.log('鈴癸笍 闀挎寜缁撴潫锛屾仮澶嶉€熷害');
            plyr.speed = originalSpeedRef.current;
            isLongPressingRef.current = false;

            setShowSpeedIndicator(() => {
              console.log('鉂?闅愯棌鍔犻€熸寚绀哄櫒');

              const container = getIndicatorContainer();
              if (container) {
                container.innerHTML = '';
              }

              return false;
            });
          }
        };

        const handleLongPressStart = (e) => {
          // 防止在控制栏上触发
          if (e.target.closest('.plyr__controls')) {
            return;
          }

          // 清除之前的定时器
          stopLongPress();

          // 500ms后触发长按加速
          longPressTimerRef.current = setTimeout(() => {
            if (video && plyr) {
              const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement || plyr.fullscreen.active;
              console.log('🚀 长按加速触发, 全屏状态:', isFullscreen);
              originalSpeedRef.current = plyr.speed;
              plyr.speed = 2;
              isLongPressingRef.current = true;

              // 显示速度指示器 - 使用函数式更新确保状态正确
              setShowSpeedIndicator(() => {
                console.log('✅ 显示加速指示器, 全屏状态:', isFullscreen);

                // 直接操作DOM显示指示器
                const container = getIndicatorContainer();
                if (container) {
                  container.innerHTML = `
                    <div style="position: absolute; top: 40px; left: 50%; transform: translateX(-50%); pointer-events: none; z-index: 2147483647;">
                      <div style="display: flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.3); padding: 8px 16px; border-radius: 8px; backdrop-filter: blur(4px);">
                        <div style="display: flex; align-items: center; gap: 3px;">
                          <div style="width: 4px; height: 14px; background: white; border-radius: 9999px; animation: pulse 0.6s ease-in-out infinite;"></div>
                          <div style="width: 4px; height: 16px; background: white; border-radius: 9999px; animation: pulse 0.6s ease-in-out 0.2s infinite;"></div>
                          <div style="width: 4px; height: 14px; background: white; border-radius: 9999px; animation: pulse 0.6s ease-in-out 0.4s infinite;"></div>
                        </div>
                        <span style="font-size: 16px; font-weight: 600; color: white; text-shadow: 0 1px 2px rgba(0,0,0,0.5);">2x 加速中</span>
                      </div>
                    </div>
                  `;
                }

                return true;
              });

              // 阻止后续的点击事件
              const preventClick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                video.removeEventListener('click', preventClick, true);
              };
              video.addEventListener('click', preventClick, true);
            }
          }, 500);
        };

        const handleLongPressEnd = () => {
          // 清除定时器
          if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
          }

          // 恢复原速度
          if (isLongPressingRef.current && video && plyr) {
            console.log('⏹️ 长按结束，恢复速度');
            plyr.speed = originalSpeedRef.current;
            isLongPressingRef.current = false;

            // 隐藏速度指示器 - 使用函数式更新
            setShowSpeedIndicator(() => {
              console.log('❌ 隐藏加速指示器');

              // 直接操作DOM隐藏指示器
              const container = document.getElementById('speed-indicator-container');
              if (container) {
                container.innerHTML = '';
              }

              return false;
            });
          }
        };

        // 直接在video元素上监听事件，确保全屏时也能工作
        const startGesture = (e) => {
          if (e.target.closest('.plyr__controls')) return;
          const point = getPointFromEvent(e);
          gestureRef.current = {
            startX: point.x,
            startY: point.y,
            lastX: point.x,
            lastY: point.y,
            mode: null,
            startTime: video.currentTime || 0,
            targetTime: video.currentTime || 0,
            startVolume: plyr.volume ?? video.volume ?? 1,
            active: true,
            moved: false
          };
          handleLongPressStart(e);
        };

        const moveGesture = (e) => {
          const gesture = gestureRef.current;
          if (!gesture?.active) return;
          const point = getPointFromEvent(e);
          const dx = point.x - gesture.startX;
          const dy = point.y - gesture.startY;
          const absX = Math.abs(dx);
          const absY = Math.abs(dy);

          if (!gesture.mode && Math.max(absX, absY) > 12) {
            gesture.mode = absX >= absY ? 'seek' : 'volume';
            gesture.moved = true;
            finishLongPress();
          }

          if (!gesture.mode) return;
          if (e.cancelable) e.preventDefault();
          e.stopPropagation();

          if (gesture.mode === 'seek') {
            const duration = Number.isFinite(video.duration) ? video.duration : 0;
            if (duration <= 0) return;
            const stepSeconds = (point.x - gesture.lastX) * getSeekSensitivity();
            const targetTime = clamp((gesture.targetTime ?? gesture.startTime) + stepSeconds, 0, Math.max(duration - 0.1, 0));
            const deltaSeconds = targetTime - gesture.startTime;
            gesture.targetTime = targetTime;
            renderGestureOverlay({ type: 'seek', deltaSeconds, targetTime });
            gesture.lastX = point.x;
            return;
          }

          const volumeDelta = -dy / 220;
          const nextVolume = clamp(gesture.startVolume + volumeDelta, 0, 1);
          plyr.volume = nextVolume;
          video.volume = nextVolume;
          video.muted = nextVolume === 0;
          plyr.muted = nextVolume === 0;
          renderGestureOverlay({ type: 'volume', volume: nextVolume });
          gesture.lastX = point.x;
          gesture.lastY = point.y;
        };

        const endGesture = () => {
          const gesture = gestureRef.current;
          finishLongPress();

          if (gesture?.active && gesture.mode === 'seek') {
            video.currentTime = gesture.targetTime;
            plyr.currentTime = gesture.targetTime;
          }

          gestureRef.current = null;
          if (gesture?.mode) {
            setTimeout(clearGestureIndicator, 650);
          }
        };

        video.addEventListener('touchstart', startGesture, { passive: true });
        video.addEventListener('touchmove', moveGesture, { passive: false });
        video.addEventListener('touchend', endGesture, { passive: true });
        video.addEventListener('touchcancel', endGesture, { passive: true });

        // 监听鼠标事件（桌面端也支持）
        video.addEventListener('mousedown', startGesture);
        video.addEventListener('mousemove', moveGesture);
        video.addEventListener('mouseup', endGesture);
        video.addEventListener('mouseleave', endGesture);

        playerReadyCleanupRef.current = () => {
          document.removeEventListener('fullscreenchange', handleFullscreenOrientation);
          document.removeEventListener('webkitfullscreenchange', handleFullscreenOrientation);
          video.removeEventListener('webkitbeginfullscreen', lockLandscape);
          video.removeEventListener('webkitendfullscreen', unlockOrientation);
          plyr.off?.('enterfullscreen', lockLandscape);
          plyr.off?.('exitfullscreen', unlockOrientation);
          unlockOrientation();
          volumeInput?.removeEventListener('input', updateVolumeValue);
          volumeHitboxEl?.removeEventListener('pointerdown', startVolumePointer);
          muteButton?.removeEventListener('click', toggleVolumePanel, true);
          document.removeEventListener('pointerdown', closeVolumePanelOnOutsideClick, true);
          plyr.off?.('volumechange', updateVolumeValue);
          plyr.off?.('controlshidden', closeVolumePanel);
          volumeValueEl?.removeEventListener('click', toggleMuteFromVolumeValue);
          volumeValueEl?.remove();
          volumeHitboxEl?.remove();
          video.removeEventListener('touchstart', startGesture);
          video.removeEventListener('touchmove', moveGesture);
          video.removeEventListener('touchend', endGesture);
          video.removeEventListener('touchcancel', endGesture);
          video.removeEventListener('mousedown', startGesture);
          video.removeEventListener('mousemove', moveGesture);
          video.removeEventListener('mouseup', endGesture);
          video.removeEventListener('mouseleave', endGesture);
        };
      };
      plyr.on('ready', setupPlayerControls);
      setTimeout(setupPlayerControls, 0);

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
        if ((resumeTimeRef.current || 0) > 0 && !hasRestoredTimeRef.current && video.duration > 0) {
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
        const { currentVideo: currentVideoData, currentEpisodeIndex: currentIndex, parsedEpisodes: episodes } = playbackMetaRef.current;
        
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

        // 自动跳过疑似广告区间（可手动开关）
        const adRanges = adRangesRef.current;
        if (autoSkipAdsEnabledRef.current && adRanges.length > 0) {
          // 检查是否即将进入广告区间（提前3秒提示）
          const upcomingRange = adRanges.find((range) => currentTime >= (range.start - 3) && currentTime < (range.start - 0.15));
          if (upcomingRange) {
            const now = Date.now();
            if (now - lastToastRef.current.detectAt > 3000) {
              lastToastRef.current.detectAt = now;
              setAdSkipStatus('preparing');

              // 直接操作DOM显示准备跳过广告提示
              const container = document.getElementById('speed-indicator-container');
              if (container) {
                container.innerHTML = `
                  <div style="position: absolute; top: 40px; left: 50%; transform: translateX(-50%); pointer-events: none; z-index: 2147483647;">
                    <div style="display: flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.3); padding: 8px 16px; border-radius: 8px; backdrop-filter: blur(4px);">
                      <svg style="width: 18px; height: 18px; color: rgb(250,204,21); filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5)); animation: pulse 0.6s ease-in-out infinite;" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/>
                      </svg>
                      <span style="font-size: 16px; font-weight: 600; color: rgb(250,204,21); text-shadow: 0 1px 2px rgba(0,0,0,0.5);">准备跳过广告</span>
                    </div>
                  </div>
                `;
              }

              // 清除之前的定时器
              if (adSkipTimeoutRef.current) {
                clearTimeout(adSkipTimeoutRef.current);
              }

              // 3秒后自动隐藏（如果还没跳过的话）
              adSkipTimeoutRef.current = setTimeout(() => {
                if (adSkipStatus === 'preparing') {
                  setAdSkipStatus(null);
                  const container = document.getElementById('speed-indicator-container');
                  if (container && !isLongPressingRef.current) {
                    container.innerHTML = '';
                  }
                }
              }, 3000);
            }
          }

          // 检查是否在广告区间内
          const hitRange = adRanges.find((range) => currentTime >= (range.start - 0.15) && currentTime < range.end);
          if (hitRange) {
            const now = Date.now();
            // 防止 seek 后重复触发导致循环跳转
            if (now - lastAutoSkipRef.current.at > 1200 || Math.abs(lastAutoSkipRef.current.target - hitRange.end) > 0.5) {
              const targetTime = Math.min(hitRange.end + 0.2, duration > 0 ? duration - 0.1 : hitRange.end + 0.2);
              lastAutoSkipRef.current = { at: now, target: targetTime };
              video.currentTime = targetTime;
              if (plyrRef.current) {
                plyrRef.current.currentTime = targetTime;
              }
              console.log(
                `⏭️ 自动跳过疑似广告片段: ${hitRange.startHMS || formatSecondsToHMS(hitRange.start)} ~ ${hitRange.endHMS || formatSecondsToHMS(hitRange.end)} ` +
                `(${hitRange.start.toFixed(2)}s -> ${hitRange.end.toFixed(2)}s), ` +
                `当前=${formatSecondsToHMS(currentTime)} (${currentTime.toFixed(2)}s), 跳转到=${formatSecondsToHMS(targetTime)} (${targetTime.toFixed(2)}s)`
              );

              // 显示已跳过广告指示器
              const toastNow = Date.now();
              if (toastNow - lastToastRef.current.skipAt > 1500) {
                lastToastRef.current.skipAt = toastNow;
                setAdSkipStatus('skipped');

                // 直接操作DOM显示已跳过广告提示
                const container = document.getElementById('speed-indicator-container');
                if (container) {
                  container.innerHTML = `
                    <div style="position: absolute; top: 40px; left: 50%; transform: translateX(-50%); pointer-events: none; z-index: 2147483647;">
                      <div style="display: flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.3); padding: 8px 16px; border-radius: 8px; backdrop-filter: blur(4px);">
                        <svg style="width: 18px; height: 18px; color: rgb(74,222,128); filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5));" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832l7-5a1 1 0 000-1.664l-7-5z"/>
                          <path d="M13 5v10l4-5-4-5z"/>
                        </svg>
                        <span style="font-size: 16px; font-weight: 600; color: rgb(74,222,128); text-shadow: 0 1px 2px rgba(0,0,0,0.5);">已跳过广告</span>
                      </div>
                    </div>
                  `;
                }

                // 清除之前的定时器
                if (adSkipTimeoutRef.current) {
                  clearTimeout(adSkipTimeoutRef.current);
                }

                // 2秒后自动隐藏
                adSkipTimeoutRef.current = setTimeout(() => {
                  setAdSkipStatus(null);
                  const container = document.getElementById('speed-indicator-container');
                  if (container && !isLongPressingRef.current) {
                    container.innerHTML = '';
                  }
                }, 2000);
              }
              return;
            }
          }
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
      // 清理长按定时器
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      // 清理广告跳过定时器
      if (adSkipTimeoutRef.current) {
        clearTimeout(adSkipTimeoutRef.current);
        adSkipTimeoutRef.current = null;
      }

      if (sourceLoadTimeoutRef.current) {
        clearTimeout(sourceLoadTimeoutRef.current);
        sourceLoadTimeoutRef.current = null;
      }

      if (topOverlayTimeoutRef.current) {
        clearTimeout(topOverlayTimeoutRef.current);
        topOverlayTimeoutRef.current = null;
      }

      if (playerReadyCleanupRef.current) {
        playerReadyCleanupRef.current();
        playerReadyCleanupRef.current = null;
      }
      if (episodeButtonsCleanupRef.current) {
        episodeButtonsCleanupRef.current();
        episodeButtonsCleanupRef.current = null;
      }
      gestureRef.current = null;

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
      setControlsReady(false);
      hasRestoredTimeRef.current = false;
      adRangesRef.current = [];
      lastAutoSkipRef.current = { at: 0, target: 0 };
      lastToastRef.current = { detectAt: 0, skipAt: 0 };

      // 清理保存进度的定时器
      if (saveProgressIntervalRef.current) {
        clearInterval(saveProgressIntervalRef.current);
        saveProgressIntervalRef.current = null;
      }
    };
  }, [retryKey]);

  useEffect(() => {
    let cancelled = false;
    let cleanupSourceListeners = () => {};

    const switchSource = async () => {
      const video = videoRef.current;
      if (!src || !video || !isInitialized.current || currentSrcRef.current === src) return;
      if (sourceLoadTimeoutRef.current) {
        clearTimeout(sourceLoadTimeoutRef.current);
        sourceLoadTimeoutRef.current = null;
      }

      setError(null);
      setIsLoading(true);
      hasRestoredTimeRef.current = false;
      adRangesRef.current = [];
      lastAutoSkipRef.current = { at: 0, target: 0 };
      lastToastRef.current = { detectAt: 0, skipAt: 0 };

      const handleCanPlay = () => {
        if (cancelled) return;
        if (sourceLoadTimeoutRef.current) {
          clearTimeout(sourceLoadTimeoutRef.current);
          sourceLoadTimeoutRef.current = null;
        }
        cleanupSourceListeners();
        video.style.opacity = '';
        setIsLoading(false);
        plyrRef.current?.play().catch(() => {});
      };
      const handleSourceError = (event) => {
        if (cancelled) return;
        console.error('❌ Video元素错误:', event);
        if (sourceLoadTimeoutRef.current) {
          clearTimeout(sourceLoadTimeoutRef.current);
          sourceLoadTimeoutRef.current = null;
        }
        cleanupSourceListeners();
        video.style.opacity = '';
        setError('播放出错，请尝试切换源');
        setIsLoading(false);
      };
      cleanupSourceListeners = () => {
        video.removeEventListener('canplay', handleCanPlay);
        video.removeEventListener('error', handleSourceError);
      };
      video.addEventListener('canplay', handleCanPlay);
      video.addEventListener('error', handleSourceError);

      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
        hlsInstances.delete(playerId.current);
      }

      try {
        video.pause();
        video.style.opacity = '0';
        video.removeAttribute('src');
        video.load();

        if (src.includes('.m3u8')) {
          const HlsModule = await import('hls.js');
          const Hls = HlsModule.default;

          if (Hls.isSupported()) {
            const hls = new Hls({
              maxBufferLength: 30,
              maxMaxBufferLength: 60,
              startLevel: -1,
              enableWorker: true,
              lowLatencyMode: false,
              debug: false
            });

            hlsRef.current = hls;
            hlsInstances.set(playerId.current, hls);
            hls.loadSource(src);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              plyrRef.current?.play().catch(() => {});
            });
            hls.on(Hls.Events.LEVEL_LOADED, (event, data) => {
              const details = data?.details || hls.levels?.[hls.currentLevel]?.details;
              const levelUrl = data?.levelInfo?.url?.[0] || data?.url || src;
              adRangesRef.current = detectAdRangesFromLevel(details, levelUrl);
              if (adRangesRef.current.length > 0) {
                console.log('已识别疑似广告区间:', adRangesRef.current);
                if (setToastMessage) {
                  const now = Date.now();
                  if (now - lastToastRef.current.detectAt > 3000) {
                    lastToastRef.current.detectAt = now;
                    setToastMessage(`已识别疑似广告区间，自动跳过：${autoSkipAdsEnabledRef.current ? '开' : '关'}`);
                  }
                }
              } else {
                console.log('未识别到可跳过广告区间');
              }

              setTimeout(() => {
                const latestResumeTime = resumeTimeRef.current || 0;
                if (cancelled || video.duration <= 0 || latestResumeTime <= 0 || hasRestoredTimeRef.current) return;
                const adjustedResumeTime = Math.max(0, latestResumeTime - 5);
                const safeResumeTime = Math.min(adjustedResumeTime, video.duration - 1);
                if (safeResumeTime > 0) {
                  hasRestoredTimeRef.current = true;
                  video.currentTime = safeResumeTime;
                  if (plyrRef.current) {
                    plyrRef.current.currentTime = safeResumeTime;
                  }
                  console.log('✅ HLS 恢复播放进度:', safeResumeTime, '/', video.duration, '(原始时间:', latestResumeTime, ')');
                }
              }, 300);
            });
            hls.on(Hls.Events.ERROR, (event, data) => {
              if (cancelled || !data.fatal) return;
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
                  cleanupSourceListeners();
                  video.style.opacity = '';
                  setError('播放出错，请尝试切换源');
                  setIsLoading(false);
                  hls.destroy();
                  break;
              }
            });
          } else {
            video.src = src;
            video.load();
          }
        } else {
          video.src = src;
          video.load();
        }

        sourceLoadTimeoutRef.current = setTimeout(() => {
          if (cancelled) return;
          cleanupSourceListeners();
          video.style.opacity = '';
          setError('播放加载超时，请尝试切换源');
          setIsLoading(false);
          sourceLoadTimeoutRef.current = null;
        }, 20000);
        currentSrcRef.current = src;
      } catch (err) {
        if (cancelled) return;
        console.error('切换播放源失败:', err);
        cleanupSourceListeners();
        video.style.opacity = '';
        setError('播放出错，请尝试切换源');
        setIsLoading(false);
      }
    };

    switchSource();
    return () => {
      cancelled = true;
      cleanupSourceListeners();
    };
  }, [src]);

  useEffect(() => {
    const root = playerContainerRef.current;
    if (!root) return;
    const previousButton = root.querySelector('[data-episode-direction="previous"]');
    const nextButton = root.querySelector('[data-episode-direction="next"]');
    if (previousButton) previousButton.disabled = !hasPreviousEpisode;
    if (nextButton) nextButton.disabled = !hasNextEpisode;
  }, [hasPreviousEpisode, hasNextEpisode]);

  useEffect(() => {
    if (episodeButtonsCleanupRef.current) {
      episodeButtonsCleanupRef.current();
      episodeButtonsCleanupRef.current = null;
    }

    if (!controlsReady || (parsedEpisodes?.length || 0) <= 1) return;

    const controlsElement = playerContainerRef.current?.querySelector('.plyr__controls');
    const playButton = controlsElement?.querySelector('button[data-plyr="play"]');
    if (!controlsElement || !playButton) return;

    controlsElement.querySelectorAll('.episode-skip-control').forEach((button) => button.remove());

    const createEpisodeButton = (direction) => {
      const button = document.createElement('button');
      const isPrevious = direction < 0;
      button.type = 'button';
      button.className = 'plyr__control episode-skip-control';
      button.dataset.episodeDirection = isPrevious ? 'previous' : 'next';
      button.setAttribute('aria-label', isPrevious ? '上一集' : '下一集');
      button.setAttribute('title', isPrevious ? '上一集' : '下一集');
      button.disabled = isPrevious ? !hasPreviousEpisode : !hasNextEpisode;
      button.innerHTML = isPrevious
        ? '<span class="episode-skip-control__icon">‹</span>'
        : '<span class="episode-skip-control__icon">›</span>';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        handleEpisodeSwitch(direction);
      });
      return button;
    };

    const previousEpisodeBtn = createEpisodeButton(-1);
    const nextEpisodeBtn = createEpisodeButton(1);
    controlsElement.insertBefore(previousEpisodeBtn, playButton);
    playButton.insertAdjacentElement('afterend', nextEpisodeBtn);

    episodeButtonsCleanupRef.current = () => {
      previousEpisodeBtn.remove();
      nextEpisodeBtn.remove();
    };

    return () => {
      if (episodeButtonsCleanupRef.current) {
        episodeButtonsCleanupRef.current();
        episodeButtonsCleanupRef.current = null;
      }
    };
  }, [controlsReady, parsedEpisodes?.length, hasPreviousEpisode, hasNextEpisode]);

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

      <div className="player-shell relative z-10 w-full aspect-video bg-black rounded-xl overflow-visible shadow-2xl ring-1 ring-white/10 group" ref={playerContainerRef}>
        {/* 视频元素 - 按照文档推荐的方式 */}
        <video
          ref={videoRef}
          className="plyr-video w-full h-full"
          playsInline
          crossOrigin="anonymous"
        ></video>

        {false && !error && parsedEpisodes?.length > 1 && (
          <div className="absolute inset-0 z-[15] pointer-events-none flex items-center justify-center gap-24 sm:gap-36 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleEpisodeSwitch(-1);
              }}
              disabled={!hasPreviousEpisode}
              className="pointer-events-auto flex items-center gap-1.5 rounded-lg bg-black/35 px-3 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-black/55 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              aria-label="上一集"
              title="上一集"
            >
              <SkipBack size={18} />
              <span>上一集</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleEpisodeSwitch(1);
              }}
              disabled={!hasNextEpisode}
              className="pointer-events-auto flex items-center gap-1.5 rounded-lg bg-black/35 px-3 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-black/55 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              aria-label="下一集"
              title="下一集"
            >
              <span>下一集</span>
              <SkipForward size={18} />
            </button>
          </div>
        )}



        {/* 加载状态 */}
        {isLoading && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-[2147483646]">
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
          <div className="relative group">
            <button
              onClick={() => {
                setAutoSkipAdsEnabled((prev) => {
                  const next = !prev;
                  persistAutoSkipAds(next);
                  return next;
                });
              }}
              className={`px-2 py-0.5 rounded border transition-all ${
                autoSkipAdsEnabled
                  ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20'
                  : 'text-slate-300 bg-slate-700/30 border-slate-500/40 hover:bg-slate-600/40'
              }`}
              aria-label="切换自动跳过广告"
            >
                跳过广告：{autoSkipAdsEnabled ? '开' : '关'}
            </button>
            <div className="absolute top-full mt-2 left-0 z-[100] pointer-events-none invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200">
              <div className="bg-slate-900 text-slate-200 text-[10px] px-2 py-1 rounded border border-white/10 whitespace-nowrap shadow-xl">
                切换是否自动跳过疑似广告片段
              </div>
              <div className="w-2 h-2 bg-slate-900 border-l border-t border-white/10 absolute -top-1 left-3 rotate-45"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
