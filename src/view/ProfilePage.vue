<!--
  我的页组件（底部 Tab 第 4 个）
  当前为骨架占位页面，后续填充个人中心内容
-->
<script setup>
// 引入 Ionic 页面与内容容器组件
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent } from '@ionic/vue'
</script>

<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>我的</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <div class="placeholder">我的内容（待开发）</div>
    </ion-content>
  </ion-page>
</template>

<script setup>
import { ref, computed } from 'vue'
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent } from '@ionic/vue'
import { presetStore } from '@/store/presets'
import { applyPresetToMixer } from '@/store/bridge'
import { themeStore } from '@/store/theme'
import { statsStore } from '@/store/stats'
import { getSoundById } from '@/data/sounds'

/* ---------------- 预设管理 ---------------- */
const sortBy = ref('created')
const sortOptions = [
  { value: 'created', label: '按创建时间' },
  { value: 'usage', label: '按使用频率' },
]

const sortedPresets = computed(() => {
  const list = [...presetStore.presets]
  if (sortBy.value === 'usage') {
    return list.sort((a, b) => b.useCount - a.useCount)
  }
  return list.sort((a, b) => b.createdAt - a.createdAt)
})

function formatDate(ts) {
  const d = new Date(ts)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

function createPreset() {
  const name = prompt('预设名称')
  if (!name) return
  presetStore.savePreset(name, [], '🎵', '#3880ff')
}

function openPreset(preset) {
  const sounds = presetStore.applyPreset(preset.id)
  if (!sounds || sounds.length === 0) {
    alert('这个预设里还没有声音')
    return
  }
  applyPresetToMixer(sounds)
  alert(`已加载预设「${preset.name}」`)
}

function openMenu(preset) {
  const action = prompt(`对「${preset.name}」操作：输入 1 重命名，2 删除`)
  if (action === '1') {
    const newName = prompt('新名称', preset.name)
    if (newName) presetStore.renamePreset(preset.id, newName)
  } else if (action === '2') {
    presetStore.deletePreset(preset.id)
  }
}

/* ---------------- 个性化 ---------------- */
const themeOptions = [
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
  { value: 'system', label: '跟随系统' },
]

// 背景选项：value 要和 src/assets/wallpapers/ 里的文件名一致（不带 .jpg）
const bgOptions = [
  { value: 'none', label: '默认' },
  { value: '苹果', label: '苹果' },
  { value: '海洋', label: '海洋' },
  { value: '渐变', label: '渐变' },
]

const colorOptions = [
  { value: '#3880ff' },
  { value: '#8e44ad' },
  { value: '#2dd36f' },
  { value: '#ff4961' },
]

/* ---------------- 使用统计（真实数据） ---------------- */
const todayMinutes = computed(() => Math.round(statsStore.todaySeconds() / 60))
const weekMinutes = computed(() => Math.round(statsStore.weekSeconds() / 60))
const streakDays = computed(() => statsStore.streak())
const last7Days = computed(() => statsStore.last7Days())

const topSounds = computed(() => {
  return statsStore.topSounds().map(([id, count]) => {
    const meta = getSoundById(id)
    return { id, name: meta?.name ?? id, count }
  })
})

function barHeight(minutes) {
  const max = Math.max(60, ...last7Days.value.map((d) => d.minutes))
  if (max === 0) return 4
  return Math.max(4, Math.min(60, (minutes / max) * 60))
}

function resetStats() {
  const ok = confirm('确定清空所有统计吗？')
  if (!ok) return
  statsStore.reset()
}
</script>

<style scoped>
/* 页面内容区背景色：黄色，用于验证路由切换 */
ion-content {
  --background: #fadb14;
}

/* 占位文本样式 */
.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #333333;
  font-size: 20px;
}
</style>