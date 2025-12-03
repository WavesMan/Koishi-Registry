import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import fs from 'fs'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(), 
    tailwindcss(),
    {
      name: 'serve-root-public',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/index.json') {
            const filePath = path.resolve(__dirname, '../public/index.json')
            if (fs.existsSync(filePath)) {
              res.setHeader('Content-Type', 'application/json')
              const stream = fs.createReadStream(filePath)
              stream.pipe(res)
              return
            }
          }
          next()
        })
      }
    }
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: '../public',
    emptyOutDir: false, // 不清空，以免删除 index.json
    rollupOptions: {
      output: {
        // 确保文件名不冲突，通常带 hash 没问题
      }
    }
  },
  server: {
    // 移除 proxy，直接通过中间件服务文件
  }
})
