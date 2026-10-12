// 应用入口模块：创建 Vue 应用实例并挂载 Ionic 与路由
import { createApp } from 'vue'
// 引入 Ionic Vue 插件
import { IonicVue } from '@ionic/vue'
// 引入 Pinia 状态管理
import { createPinia } from 'pinia'
// 引入 Ionic 基础样式（全屏布局与组件样式）
import '@ionic/vue/css/core.css'

import { watch } from 'vue'
import { themeStore } from '@/store/theme'

import { useAudioStore } from '@/store/audio'
import { statsStore } from '@/store/stats'

// 引入全局样式
import './style.css'
// 引入根组件
import App from './App.vue'
// 引入路由实例
import router from './router'

// 创建 Pinia 实例（现阶段仅 audioStore 使用；mixerStore 暂继续用 reactive 方案）
const pinia = createPinia()

/**
 * 创建并挂载应用
 * 依次注册 Ionic 插件、Pinia 与路由，最后挂载到 #app 节点
 */
const app = createApp(App)
  .use(IonicVue)
  .use(pinia)
  .use(router)

// 路由就绪后再挂载，避免首屏闪烁
router.isReady().then(() => {
  app.mount('#app')
  // 统计：监听播放状态，有声音在播就累计秒数
  const audioStore = useAudioStore()
  let lastTick = null
  let statTimer = null

function startStatTimer() {
  if (statTimer) return
  lastTick = Date.now()
  statTimer = setInterval(() => {
    const now = Date.now()
    const delta = Math.round((now - lastTick) / 1000)
    lastTick = now
    statsStore.addSeconds(delta)
  }, 1000)
}

function stopStatTimer() {
  if (statTimer) {
    clearInterval(statTimer)
    statTimer = null
  }
  lastTick = null
}

// 监听 playingIds 变化
watch(
  () => audioStore.playingIds.length,
  (len) => {
    if (len > 0) {
      startStatTimer()
    } else {
      stopStatTimer()
    }
  },
  { immediate: true }
)
})
themeStore.apply()