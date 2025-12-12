const API_BASE_URL = `${window.location.origin}/api`;

let onUnauthorizedCallback = () => { };

// JWT Token 管理
const TOKEN_KEY = 'auth_token';
const TOKEN_EXPIRY_KEY = 'auth_token_expiry';

const tokenManager = {
    set: (token, expiresIn) => {
        sessionStorage.setItem(TOKEN_KEY, token);
        // 计算过期时间（提前5分钟刷新）
        const expiryTime = Date.now() + parseExpiresIn(expiresIn) - 5 * 60 * 1000;
        sessionStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
    },
    get: () => sessionStorage.getItem(TOKEN_KEY),
    clear: () => {
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(TOKEN_EXPIRY_KEY);
    },
    isExpiringSoon: () => {
        const expiry = sessionStorage.getItem(TOKEN_EXPIRY_KEY);
        if (!expiry) return false;
        return Date.now() >= parseInt(expiry);
    }
};

// 解析过期时间字符串（如 "2h", "30m"）
const parseExpiresIn = (expiresIn) => {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) return 2 * 60 * 60 * 1000; // 默认2小时

    const value = parseInt(match[1]);
    const unit = match[2];

    const multipliers = {
        's': 1000,
        'm': 60 * 1000,
        'h': 60 * 60 * 1000,
        'd': 24 * 60 * 60 * 1000
    };

    return value * (multipliers[unit] || 1000);
};

export const setupApi = (callbacks) => {
    if (callbacks.onUnauthorized) {
        onUnauthorizedCallback = callbacks.onUnauthorized;
    }
};

const getAuthHeaders = () => {
    const token = tokenManager.get();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
};

const handleResponse = async (res) => {
    if (res.status === 401) {
        tokenManager.clear(); // 清除无效 token
        onUnauthorizedCallback();
        throw new Error("Unauthorized"); // Interrupt flow
    }
    if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
    }
    return res.json();
};

export const api = {
    login: async (password) => {
        const res = await fetch(`${API_BASE_URL}/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: 'omit',
            body: JSON.stringify({ password })
        });

        if (res.status === 401) {
            return res.json(); // 密码错误，直接返回给前端处理
        }

        const data = await handleResponse(res);

        // 保存 JWT token
        if (data.success && data.token) {
            tokenManager.set(data.token, data.expiresIn);
        }

        return data;
    },

    logout: async () => {
        const res = await fetch(`${API_BASE_URL}/logout`, {
            method: "POST",
            headers: getAuthHeaders(),
            credentials: 'omit'
        });
        tokenManager.clear(); // 清除 token
        return handleResponse(res);
    },

    refreshToken: async () => {
        const res = await fetch(`${API_BASE_URL}/refresh-token`, {
            method: "POST",
            headers: getAuthHeaders(),
            credentials: 'omit'
        });
        const data = await handleResponse(res);

        if (data.success && data.token) {
            tokenManager.set(data.token, data.expiresIn);
        }

        return data;
    },

    getSources: async () => {
        const res = await fetch(`${API_BASE_URL}/sources`, {
            headers: getAuthHeaders(),
            credentials: 'omit'
        });
        return handleResponse(res);
    },

    getVideoList: async (sourceKey, page = 1) => {
        // 检查 token 是否即将过期，自动刷新
        if (tokenManager.isExpiringSoon()) {
            try {
                await api.refreshToken();
            } catch (err) {
                console.warn('Token refresh failed:', err);
            }
        }

        const url = new URL(`${API_BASE_URL}/video`);
        url.searchParams.append('key', sourceKey);
        url.searchParams.append('ac', 'detail');
        url.searchParams.append('pg', page);

        const res = await fetch(url.toString(), {
            headers: getAuthHeaders(), // 携带 JWT token
            credentials: 'omit'
        });
        return handleResponse(res);
    },

    getVideoDetail: async (sourceKey, ids) => {
        if (tokenManager.isExpiringSoon()) {
            try {
                await api.refreshToken();
            } catch (err) {
                console.warn('Token refresh failed:', err);
            }
        }

        const url = new URL(`${API_BASE_URL}/video`);
        url.searchParams.append('key', sourceKey);
        url.searchParams.append('ac', 'detail');
        url.searchParams.append('ids', ids);

        const res = await fetch(url.toString(), {
            headers: getAuthHeaders(),
            credentials: 'omit'
        });
        return handleResponse(res);
    },

    searchVideos: async (sourceKey, keyword, signal) => {
        // 检查 token 是否即将过期，自动刷新
        if (tokenManager.isExpiringSoon()) {
            try {
                await api.refreshToken();
            } catch (err) {
                console.warn('Token refresh failed:', err);
            }
        }

        const url = new URL(`${API_BASE_URL}/video`);
        url.searchParams.append('key', sourceKey);
        url.searchParams.append('ac', 'detail');
        url.searchParams.append('wd', keyword);

        const res = await fetch(url.toString(), {
            headers: getAuthHeaders(), // 携带 JWT token
            credentials: 'omit',
            signal
        });
        return handleResponse(res);
    }
};

