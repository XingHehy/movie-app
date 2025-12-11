// 全局实例管理
export const hlsInstances = new Map();
export const plyrInstances = new Map();

// 停止所有播放器的全局辅助函数
export const stopAllPlayers = () => {
    // 销毁 Plyr 实例
    plyrInstances.forEach((plyr, id) => {
        try {
            plyr.destroy();
            plyrInstances.delete(id);
        } catch (err) {
            console.warn('销毁 Plyr 失败:', err);
        }
    });

    // 销毁 HLS 实例
    hlsInstances.forEach((hls, id) => {
        try {
            hls.destroy();
            hlsInstances.delete(id);
        } catch (err) {
            console.warn('销毁 HLS 失败:', err);
        }
    });

    // 清理所有 video 元素
    document.querySelectorAll('video').forEach(video => {
        try {
            if (!video.paused) video.pause();
            video.removeAttribute('src');
            video.load();
        } catch (err) {
            console.warn('清理 video 失败:', err);
        }
    });
};

