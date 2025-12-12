import express from "express";
import "dotenv/config";
import axios from "axios";
import cors from "cors";
import path from "path";
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import Redis from 'ioredis';
import { log } from "console";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// --- 日志工具 ---
const formatTs = () => {
  const d = new Date();
  const pad = (n) => n.toString().padStart(2, "0");
  const yyyy = d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${yyyy}-${MM}-${dd} ${hh}:${mm}:${ss}`;
};

const logger = {
  info: (...msg) => console.log(`${formatTs()} - INFO -`, ...msg),
  warn: (...msg) => console.warn(`${formatTs()} - WARN -`, ...msg),
  error: (...msg) => console.error(`${formatTs()} - ERROR -`, ...msg),
};

// --- Redis 配置 ---
const REDIS_URL = process.env.REDIS_URL || "redis://user:password@localhost:6379/5";

const redis = new Redis(REDIS_URL, {
  // 避免错误凭证时不断重连
  retryStrategy: () => null,
  maxRetriesPerRequest: 1,
  enableReadyCheck: true,
});

// 仅在认证完成后触发
redis.once("ready", () => {
  logger.info("✅ Redis ready");
  initializeSources(); // 连接成功后初始化源站数据
});

redis.on("error", (err) => {
  logger.error("❌ Redis connection error:", err?.message || err);
});

redis.on("end", () => {
  if (redis.status !== "ready") {
    logger.warn("⚠️ Redis closed, using local fallback only.");
  }
});

// --- 初始化源站列表 (兜底/默认配置) ---
const INITIAL_SOURCES = [
  { key: "ikunzy", name: "爱坤资源", desc: "主打清晰度", url: "https://ikunzyapi.com/api.php/provide/vod/from/ikm3u8/at/json" },
  { key: "bdzy", name: "百度资源", desc: "老牌劲旅，主打稳定", url: "https://api.apibdzy.com/api.php/provide/vod/from/dbm3u8/at/json/" },
];

async function initializeSources() {
  try {
    const exists = await redis.exists("video:source");
    if (!exists) {
      logger.info("ℹ️ Initializing Redis with default sources...");
      await redis.set("video:source", JSON.stringify(INITIAL_SOURCES));
    } else {
      logger.info("ℹ️ Redis sources already exist, skipping initialization.");
    }
  } catch (error) {
    logger.error("⚠️ Failed to initialize sources (Redis error), will use local fallback:", error.message);
  }
}

// 辅助函数：获取源站配置 (带兜底逻辑)
async function getSourceConfig() {
  try {
    // 如果 Redis 未连接或连接断开，直接返回兜底配置
    if (redis.status !== 'ready') {
      logger.warn("⚠️ Redis not ready, using local fallback sources.");
      return INITIAL_SOURCES;
    }

    const data = await redis.get("video:source");
    if (!data) {
      logger.info("ℹ️ Redis sources not found, using local fallback.");
      return INITIAL_SOURCES;
    }
    return JSON.parse(data);
  } catch (error) {
    logger.error("Failed to fetch sources from Redis, using fallback:", error.message);
    return INITIAL_SOURCES;
  }
}

// --- 访问密码配置 ---
const SITE_PASSWORD = process.env.SITE_PASSWORD || "666888"; // 默认密码，可通过环境变量覆盖
const JWT_SECRET = process.env.JWT_SECRET || "video!@#$%^&*()"; // JWT 密钥
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "2h"; // JWT 过期时间（默认2小时）

// 从 Redis 获取访问密码，失败或不存在时回退到环境变量
async function getSitePassword() {
  if (redis.status === "ready") {
    try {
      const redisPwd = await redis.get("video:password");
      if (redisPwd) return redisPwd;
      logger.info("ℹ️ Redis password not found, using SITE_PASSWORD fallback.");
    } catch (err) {
      logger.warn("⚠️ Failed to read password from Redis, using fallback:", err.message);
    }
  } else {
    logger.warn("⚠️ Redis not ready, using SITE_PASSWORD fallback.");
  }
  return SITE_PASSWORD;
}

// 开启 CORS 允许前端跨域调试
app.use(cors({
  origin: true, // 生产环境建议指定具体域名
  credentials: false // 禁用 cookie
}));

// 解析 JSON
app.use(express.json());


// --- JWT 工具函数 ---
const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
};

// --- 访问密码验证中间件（纯 JWT 认证）---
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.substring(7)
    : null;

  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      req.user = decoded;
      return next();
    }
  }

  setTimeout(() => {
    res.status(401).json({ error: "Unauthorized: please login" });
  }, 500);
};

// 将验证应用到所有 /api 开头的路由（除了 /api/login）
app.use('/api', (req, res, next) => {
  if (req.path === '/login') {
    next();
  } else {
    authMiddleware(req, res, next);
  }
});


// --- API 路由 ---

app.post("/api/login", async (req, res) => {
  const { password } = req.body;

  const targetPassword = await getSitePassword();

  // 验证密码
  if (password && password === targetPassword) {
    logger.info(`Login success`);
    const token = generateToken({
      authenticated: true,
      iat: Math.floor(Date.now() / 1000)
    });

    res.json({
      success: true,
      msg: "Login successful",
      token: token,
      expiresIn: JWT_EXPIRES_IN
    });
  } else {
    logger.warn(`Login failed with password: ${password}`);
    setTimeout(() => {
      res.status(401).json({ success: false, error: "Incorrect password" });
    }, 500);
  }
});

app.post("/api/logout", (req, res) => {
  res.json({ success: true, msg: "Logged out successfully" });
});

app.post("/api/refresh-token", authMiddleware, (req, res) => {
  const newToken = generateToken({
    authenticated: true,
    iat: Math.floor(Date.now() / 1000)
  });

  res.json({
    success: true,
    token: newToken,
    expiresIn: JWT_EXPIRES_IN
  });
});

app.get("/api/sources", async (req, res) => {
  const sources = await getSourceConfig();
  // 仅返回名称、Key和描述给前端
  const publicList = sources.map(s => ({ key: s.key, name: s.name, desc: s.desc }));
  res.json(publicList);
});

app.get("/api/video", async (req, res) => {
  const { key, ac, t, pg, wd, h, ids } = req.query;

  const sources = await getSourceConfig();
  const source = sources.find(s => s.key === key);

  if (!key || !source) {
    return res.status(400).json({ error: "无效的资源源 Key" });
  }

  const targetApi = source.url;

  // Construct params object with only allowed keys
  const params = { ac };
  if (t) params.t = t;
  if (pg) params.pg = pg;
  if (wd) params.wd = wd;
  if (h) params.h = h;
  if (ids) params.ids = ids;

  try {
    logger.info(`[Proxy] Requesting ${key} with params:`, params);

    const response = await axios.get(targetApi, {
      params: params,
      timeout: 10000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    res.json(response.data);
  } catch (error) {
    logger.error(`[Proxy Error] ${key}:`, error.message);
    res.status(502).json({
      code: 502,
      msg: "源站请求失败",
      list: [],
    });
  }
});

// --- 静态文件服务 (可选) ---
// 如果你打包了 React 项目 (npm run build)，将 dist 目录放在 server.js 同级
app.use(express.static(path.join(__dirname, 'dist')));

// SPA 路由支持：任何未处理的请求返回 index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// 启动服务器
app.listen(PORT, () => {
  logger.info(`🚀 极影服务器已启动: http://localhost:${PORT}`);
  logger.info(`👉 接口地址: http://localhost:${PORT}/api/video`);
});
