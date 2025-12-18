import express from "express";
import "dotenv/config";
import axios from "axios";
import cors from "cors";
import jwt from "jsonwebtoken";
import Redis from "ioredis";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import https from "https";
import { fileURLToPath } from "url";

/* ================= 基础 ================= */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const app = express();
const PORT = 3000;

/* ================= 日志 ================= */

const ts = () => new Date().toISOString().replace("T", " ").slice(0, 19);
const logger = {
  info: (...m) => console.log(ts(), "[INFO]", ...m),
  warn: (...m) => console.warn(ts(), "[WARN]", ...m),
  error: (...m) => console.error(ts(), "[ERROR]", ...m),
};

/* ================= Redis ================= */

const REDIS_URL = process.env.REDIS_URL || "";
const redis = REDIS_URL
  ? new Redis(REDIS_URL, { retryStrategy: () => null })
  : null;

redis?.on("ready", () => logger.info("Redis 已连接"));
redis?.on("error", (e) => logger.warn("Redis 异常:", e.message));

/* ================= 工具 ================= */

const readJson = (name) => {
  const p = path.join(DATA_DIR, name);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf-8"));
};

const writeJson = (name, data) => {
  fs.writeFileSync(path.join(DATA_DIR, name), JSON.stringify(data, null, 2));
};

/* ================= JWT ================= */

const JWT_SECRET = process.env.JWT_SECRET || "video-secret";
const JWT_EXPIRES_IN = "2h";

const signToken = (payload) =>
  jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

const auth = (req, res, next) => {
  const t = req.headers.authorization?.replace("Bearer ", "");
  if (!t) return res.status(401).json({ msg: "未登录" });

  try {
    req.user = jwt.verify(t, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ msg: "登录已失效" });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ msg: "无管理员权限" });
  }
  next();
};

/* ================= 初始数据 ================= */

const INITIAL_SOURCES = [
  {
    key: "bdzy",
    name: "百度资源",
    desc: "默认源站",
    url: "https://api.apibdzy.com/api.php/provide/vod/from/dbm3u8/at/json/",
    enabled: true,
  },
];

let SOURCE_CACHE = [];
let USER_PASSWORD = null;

/* ================= 管理员密码 ================= */

let ADMIN_PASSWORD = readJson("admin.json")?.password;

if (!ADMIN_PASSWORD) {
  ADMIN_PASSWORD = crypto.randomBytes(6).toString("hex");
  writeJson("admin.json", { password: ADMIN_PASSWORD });
  logger.warn("⚠️ 管理员密码已生成：", ADMIN_PASSWORD);
}

/* ================= 加载用户密码 ================= */

(async () => {
  const local = readJson("password.json");
  if (local?.password) {
    USER_PASSWORD = local.password;
    return;
  }

  if (redis) {
    const r = await redis.get("video:password");
    if (r) {
      USER_PASSWORD = r;
      writeJson("password.json", { password: r });
    }
  }
})();

/* ================= 加载源站 ================= */

(async () => {
  const local = readJson("sources.json");
  if (local) {
    SOURCE_CACHE = local;
    logger.info("使用本地源站数据");
    return;
  }

  if (redis) {
    const r = await redis.get("video:source");
    if (r) {
      SOURCE_CACHE = JSON.parse(r);
      writeJson("sources.json", SOURCE_CACHE);
      logger.info("从 Redis 拉取源站并缓存");
      return;
    }
  }

  SOURCE_CACHE = INITIAL_SOURCES;
  writeJson("sources.json", SOURCE_CACHE);
  logger.warn("使用默认源站数据");
})();

/* ================= 中间件 ================= */

app.use(cors());
app.use(express.json());

/* ================= 登录 ================= */

app.post("/api/login", (req, res) => {
  const { password } = req.body;

  if (password === ADMIN_PASSWORD) {
    return res.json({
      success: true,
      role: "admin",
      token: signToken({ role: "admin" }),
      needSetUserPassword: !USER_PASSWORD,
    });
  }

  if (USER_PASSWORD && password === USER_PASSWORD) {
    return res.json({
      success: true,
      role: "user",
      token: signToken({ role: "user" }),
    });
  }

  res.status(401).json({ msg: "密码错误" });
});

/* ================= 用户接口 ================= */

app.get("/api/sources", auth, (req, res) => {
  // 统一规范 enabled 字段：只有显式为 true 才视为启用，其余一律 false
  const normalized = SOURCE_CACHE.map((s) => ({
    ...s,
    enabled: s.enabled === true,
  }));

  // 如果是管理员，返回所有源站和完整字段（包含 url 和 enabled）
  if (req.user.role === "admin") {
    return res.json(normalized);
  }

  // 普通用户只返回启用的源站和基本字段（不暴露 url）
  res.json(
    normalized
      .filter((s) => s.enabled === true)
      .map((s) => ({
        key: s.key,
        name: s.name,
        desc: s.desc,
        enabled: s.enabled,
      }))
  );
});

app.get("/api/video", auth, async (req, res) => {
  const { key, ...params } = req.query;
  const source = SOURCE_CACHE.find(
    (s) => s.key === key && s.enabled !== false
  );

  if (!source) return res.status(400).json({ msg: "无效源站" });

  try {
    const r = await axios.get(source.url, {
      params,
      timeout: 8000,
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    });
    res.json(r.data);
  } catch (e) {
    res.status(502).json({ msg: "源站请求失败" });
  }
});

/* ================= 管理员接口 ================= */

app.get("/api/admin/sources/redis", auth, adminOnly, async (req, res) => {
  if (!redis) {
    return res.json([]);
  }

  try {
    const data = await redis.get("video:source");
    if (!data) return res.json([]);

    const sources = JSON.parse(data).map((s) => ({
      ...s,
      // Redis 可能没有 enable 字段，默认启用
      enabled: s.enabled === false ? false : true,
      // 确保 url 字段存在，默认为空字符串
      url: s.url || "",
      // 确保 name 和 key 字段存在
      name: s.name || "",
      key: s.key || ""
    }));

    res.json(sources);
  } catch (err) {
    logger.error("从 Redis 拉取源站失败:", err.message);
    res.status(500).json({ msg: "拉取源站数据失败" });
  }
});


app.post("/api/admin/sources", auth, adminOnly, async (req, res) => {
  const { sources, syncToRedis = false } = req.body;
  if (!Array.isArray(sources)) {
    return res.status(400).json({ msg: "源站数据格式错误" });
  }

  SOURCE_CACHE = sources;
  writeJson("sources.json", sources);

  if (syncToRedis && redis) {
    await redis.set("video:source", JSON.stringify(sources));
  }

  res.json({ success: true, msg: "源站已保存" });
});

// 更新管理员密码
app.post("/api/admin/password", auth, adminOnly, async (req, res) => {
  const { password } = req.body;

  if (!password || password === ADMIN_PASSWORD) {
    return res.status(400).json({ msg: "管理员密码不合法" });
  }

  ADMIN_PASSWORD = password;
  writeJson("admin.json", { password });

  res.json({ success: true, msg: "管理员密码已更新" });
});

// 更新用户访问密码
app.post("/api/user/password", auth, adminOnly, async (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ msg: "用户密码不合法" });
  }

  USER_PASSWORD = password;
  writeJson("password.json", { password });

  if (redis) await redis.set("video:password", password);

  res.json({ success: true, msg: "用户密码已设置" });
});

// --- 静态文件服务 (可选) ---
// 如果你打包了 React 项目 (npm run build)，将 dist 目录放在 server.js 同级
app.use(express.static(path.join(__dirname, 'dist')));

// SPA 路由支持：任何未处理的请求返回 index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

/* ================= 启动 ================= */
app.listen(PORT, () => {
  logger.info(`🚀 服务已启动：http://localhost:${PORT}`);
  logger.info(`👉 接口地址: http://localhost:${PORT}/api/video`);

});
