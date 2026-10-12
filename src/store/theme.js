import { reactive, watch } from 'vue'

const STORAGE_KEY = 'white-noise-theme'

// 从 localStorage 读
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) {
    console.warn('读取主题失败:', e)
  }
  return { mode: 'system', primary: '#3880ff', background: 'none' }
}

export const themeStore = reactive({
  mode: load().mode,              // 'light' | 'dark' | 'system'
  primary: load().primary,        // 主色调十六进制
  background: load().background,  // 'none' | 'night' | 'forest' | 'ocean'

  // 设置主题模式
  setMode(mode) {
    this.mode = mode
    this.apply()
  },

  // 设置主色调
  setPrimary(color) {
    this.primary = color
    this.apply()
  },

  // 设置背景
  setBackground(name) {
    this.background = name
    this.apply()
  },

  // 应用到 DOM
  apply() {
    const root = document.documentElement

    // 1. 深浅色
    let isDark = false
    if (this.mode === 'dark') {
      isDark = true
    } else if (this.mode === 'system') {
      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    root.classList.toggle('dark', isDark)

    // 2. 主色调写成 CSS 变量
    root.style.setProperty('--app-primary', this.primary)
    root.style.setProperty('--app-primary-light', this.primary + '22')

    // 3. 背景图
    if (this.background && this.background !== 'none') {
      // 动态 import 图片，打包时会处理成正确的 URL
      import(`@/assets/wallpapers/${this.background}.jpg`)
        .then((mod) => {
          root.style.setProperty('--app-bg-image', `url(${mod.default})`)
          root.classList.add('has-bg-image')
        })
        .catch(() => {
          // 图片不存在时回退
          root.style.removeProperty('--app-bg-image')
          root.classList.remove('has-bg-image')
          console.warn(`背景图 ${this.background}.jpg 未找到`)
        })
    } else {
      root.style.removeProperty('--app-bg-image')
      root.classList.remove('has-bg-image')
    }
  },
})

// 持久化
watch(
  () => [themeStore.mode, themeStore.primary, themeStore.background],
  () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        mode: themeStore.mode,
        primary: themeStore.primary,
        background: themeStore.background,
      })
    )
  }
)

// 跟随系统时，监听系统主题变化
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (themeStore.mode === 'system') {
    themeStore.apply()
  }
})