# --- 第一阶段：构建环境 ---
FROM node:20-slim AS builder

WORKDIR /app

# 1. 安装所有依赖（包括构建工具）
COPY package*.json ./
RUN npm install

# 2. 复制源码并构建前端
COPY . .
RUN npm run build

# --- 第二阶段：运行环境 ---
FROM node:20-slim

WORKDIR /app

# 1. 仅复制 package.json 用于安装生产依赖
COPY package*.json ./

# 2. 仅安装生产环境依赖 (去除 vite, tailwind 等构建工具)
RUN npm install --omit=dev

# 3. 从第一阶段复制构建好的 dist 目录 (只包含静态文件)
COPY --from=builder /app/dist ./dist

# 4. 复制后端入口文件
COPY server.js ./

# 5. 暴露端口并启动
EXPOSE 3000
CMD ["node", "server.js"]
