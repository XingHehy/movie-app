import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist', // 编译输出目录
    emptyOutDir: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
      format: {
        comments: false,
        ascii_only: true, // 将中文等非ASCII字符转换为Unicode编码
      },
    },
    // 调整chunk大小警告阈值，因为hls.js本身体积较大
    chunkSizeWarningLimit: 600,
    // 优化代码块拆分
    rollupOptions: {
      output: {
        manualChunks: {
          // 将较大的依赖库单独拆分
          'lucide-react': ['lucide-react'],
          // 将React相关库单独拆分
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  server: {
    // 开发环境下的代理配置 (npm run dev 时生效)
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
})