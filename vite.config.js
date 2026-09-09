import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      // 将 @ 指向 src 目录，便于模块引用
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
