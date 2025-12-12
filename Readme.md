**部署流程**

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
使用命令：
```bash
docker run -d   -p 8686:3000   --name movie-app   -e JWT_SECRET='video!@#$%'   -e SITE_PASSWORD='666888'   -e REDIS_URL='redis://admin:123456@127.0.0.7:6379/6'   movie-app:latest
```

---

**第三步：配置**

redis配置：
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