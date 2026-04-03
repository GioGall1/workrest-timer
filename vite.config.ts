import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  base: (() => {
    // GitHub Pages serves projects under `/<repo>/`
    const repo = process.env.GITHUB_REPOSITORY?.split('/')[1]
    if (process.env.GITHUB_ACTIONS && repo) return `/${repo}/`
    return '/'
  })(),
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
  }
})
