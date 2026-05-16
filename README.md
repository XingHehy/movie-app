![演示](https://github.com/user-attachments/assets/c5d44e2b-6921-4628-ac05-62ee30bb455c)

# **部署流程**

**第一步：构建镜像**
在项目根目录手动执行构建：

```bash
docker build -t movie-app .
```

**第二步：运行容器**
使用 Docker Compose 启动：

```bash
docker-compose up -d
```

使用命令（可选配置 Redis）：

```bash
docker run -d \
  -p 8686:3000 \
  --name movie-app \
  -e JWT_SECRET='video!@#$%' \
  -e REDIS_URL='redis://admin:123456@127.0.0.7:6379/6' \
  movie-app:latest
```

---

**第三步：Redis 配置说明（含 IPTV）**

| 字段（Field）     | 类型（Type） | 说明 & 示例值                                           |
| ----------------- | ------------ | ------------------------------------------------------- |
| `video:password`  | String       | 视频服务访问密码 示例：`66888`                          |
| `video:source`    | String       | 视频源配置（JSON 格式），具体结构如下                   |
| `video:iptv_cctv` | String       | IPTV 定时任务生成的 CCTV 频道数据（苹果 CMS 风格 JSON） |

```json
[
  {
    "key": "ikunzy",
    "name": "爱坤资源",
    "url": "https://xxx.com/api.php/provide/vod/from/ikm3u8/at/json",
    "desc": "较新资源站，带宽充足，画质较好（主打清晰度）。"
  },
  {
    "key": "bdzy",
    "name": "百度资源",
    "url": "https://xxx.com/api.php/provide/vod/from/dbm3u8/at/json/",
    "desc": "老牌劲旅，资源库庞大且稳定，覆盖老片较多。"
  }
]
```

#### 配置说明补充

1. `key`：视频源唯一标识；
2. `name`：视频源名称；
3. `url`：视频源接口地址（需确保可正常访问，返回标准 JSON 格式）；
4. `desc`：视频源描述

---

## **IPTV（CCTV）功能说明**

- **功能概述**
  - 定时抓取 `IPTV` 文本源（默认 `https://live.zbds.top/tv/iptv4.txt`）。
  - 仅保留 `CCTV*` 频道，自动合并多播放源，生成 **苹果 CMS 格式 JSON**。
  - 结果写入 Redis 的 `video:iptv_cctv`，并通过接口对外暴露，相当于一个“内置第三方源”。

- **后端相关环境变量**
  - **`REDIS_URL`**：Redis 连接串；未显式配置时，默认使用 `redis://127.0.0.1:6379/0`。
  - **`IPTV_CCTV_URL`**：IPTV 源地址，默认 `https://live.zbds.top/tv/iptv4.txt`。
  - **`IPTV_REFRESH_HOURS`**：定时刷新间隔（小时），例如 `6` 表示每 6 小时刷新一次；不配置或为 `0` 时只在调用刷新接口时生成。
  - **`IPTV_REDIS_KEY`**：Redis 存储键名，默认 `video:iptv_cctv`。

- **IPTV 相关接口**
  - **管理员手动刷新**：`GET /api/iptv/cctv/refresh`
    - 需携带 `Authorization: Bearer <token>`（管理员 token），否则返回 401。
    - 立即抓取 IPTV 源 → 只保留 CCTV → 转成苹果 CMS JSON → 写入 Redis（`video:iptv_cctv`）。
  - **作为“第三方源”的查询接口**：`GET /api/source/iptv`
    - 需携带 `Authorization: Bearer <token>`（管理员或普通用户 token），否则返回 401。
    - 可作为 `video:source` 中某个源的 URL 使用。
    - 返回结构与普通苹果 CMS 源完全一致，优先从 Redis 读取缓存；若无缓存则临时抓取并回写 Redis。

  - **在源站列表中使用 IPTV 源**
  - 在 `video:source` 或后台“源站列表”中，使用固定 key=`iptv` 的数据源：

```json
[
  {
    "key": "iptv",
    "name": "CCTV 直播",
    "url": "https://你的域名/api/source/iptv",
    "desc": "IPTV 直播源",
    "enabled": true
  },
  {
    "key": "bdzy",
    "name": "百度资源",
    "url": "https://xxx.com/api.php/provide/vod/from/dbm3u8/at/json/",
    "desc": "老牌劲旅，资源库庞大且稳定，覆盖老片较多。"
  }
]
```

- **HTTPS 站点播放 HTTP 直播源（代理转发）**
  - 后端提供了统一代理接口：`GET /api/proxy?url=<http/https 资源地址>`。
  - 若目标为 `.m3u8`：自动改写清单中的分片、子清单、`EXT-X-KEY` 的 `URI` 为继续走 `/api/proxy`，浏览器全程只访问本服务的 HTTPS 域名。
  - 其他资源（`ts`、`mp4`、密钥文件等）则直接透传。
  - 相关环境变量：
    - **`PROXY_ALLOW_PRIVATE`**：是否允许代理本地/内网地址，默认 `false`。
    - **`PROXY_ALLOW_HOSTS`**：允许代理的域名白名单，逗号分隔，例如：`play.kankanlive.com,58.57.40.22`。

---

# 更新日志

- **v1.72**
  - 添加长按加速功能
  - 优化广告跳过提示样式

- **v1.71**
  - 修复点击跳过广告按钮时导致画面中断

- **v1.70**
  - 添加资源站m3u8插播广告检测逻辑，自动识别疑似广告片段并自动跳过广告

- **v1.63**
  - 优化播放器样式
  - 修复搜索功能中的信号处理

- **v1.62**
  - 增加视频搜索分页功能
  - 优化播放器语言

- **v1.61**
  - 添加IPTV(CCTV)功能支持

- **v1.60**
  - 修复页面隐藏（切换标签页、最小化、锁屏等）时，播放器会被销毁，导致播放黑屏
  - 新增搜索历史、播放记录功能，数据存在浏览器缓存里
  - 新增支持从播放记录里面续播，提升用户体验

- **v1.51**
  - 点击视频时，若无播放地址（vod_play_url为空），显示提示并阻止进入播放页面
- **v1.5**
  - 优化重构整体逻辑
  - 不再强依赖 Redis，支持无 Redis 环境下正常运行（仅在提供 `REDIS_URL` 时启用 Redis 功能）

- **v1.43**
  - 优化交互体验
    - 优化搜索功能：可以选择部分源进行搜索
  - 修复已知bug：
    - 修复某些源没有按照指定的播放器类型返回数据，导致播放识别的问题
    - 修复页面切换原视频仍在播放的问题
    - 尝试修复某些源请求失败的问题
  - 优化逻辑细节

- **v1.42**
  - 优化播放器样式
  - 修复已知bug：
    - 视频列表翻页失效

- **v1.41**
  - 优化日志显示
  - 密码错误弹出来小丑表情包
  - 访问密码可以在redis里设置
  - 修复已知bug：
    - redis失败会一直重试，直到成功

- **v1.4**
  - 页面组件化
  - 添加路由功能，方便分享收藏
  - 修复已知bug
  - 优化交互体验

- **v1.3**
  - 优化交互体验

- **v1.2**
  - 修复ios端将网页添加为应用后，无法全屏的问题
  - 优化交互体验

- **v1.1**
  - 完善功能，修复bug
  - 优化交互体验
  - 支持docker部署

- **v1.0**
  - 初步实现功能
