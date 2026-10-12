<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>我的</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <!-- ================= 1. 预设管理 ================= -->
      <section class="section">
        <div class="section-head">
          <h2 class="section-title">我的预设</h2>
          <button class="section-action" @click="createPreset">+ 新建</button>
        </div>

        <!-- 排序 -->
        <div class="sort-tabs">
          <button
            v-for="opt in sortOptions"
            :key="opt.value"
            class="sort-tab"
            :class="{ active: sortBy === opt.value }"
            @click="sortBy = opt.value"
          >
            {{ opt.label }}
          </button>
        </div>

        <!-- 预设列表 -->
        <div v-if="sortedPresets.length === 0" class="empty">
          还没有预设，去混音台保存一个吧
        </div>
        <div v-else class="preset-list">
          <div
            v-for="preset in sortedPresets"
            :key="preset.id"
            class="preset-card"
            @click="openPreset(preset)"
          >
                      <div
              class="preset-cover"
              :style="{ background: (preset.color || '#3880ff') + '22' }"
            >
              {{ preset.emoji }}
            </div>
            <div class="preset-info">
              <div class="preset-name">{{ preset.name }}</div>
              <div class="preset-meta">
                {{ preset.sounds.length }} 个声音 · {{ formatDate(preset.createdAt) }}
              </div>
            </div>
            <button class="preset-more" @click.stop="openMenu(preset)">⋯</button>
          </div>
        </div>
      </section>

      <!-- ================= 2. 个性化 ================= -->
      <section class="section">
        <h2 class="section-title">个性化</h2>

        <!-- 主题 -->
        <div class="row">
          <span class="row-label">主题</span>
          <div class="row-options">
            <button
              v-for="t in themeOptions"
              :key="t.value"
              class="opt-btn"
              :class="{ active: themeStore.mode === t.value }"
              @click="themeStore.setMode(t.value)"
            >
              {{ t.label }}
            </button>
          </div>
        </div>

        <!-- 背景 -->
        <div class="row">
          <span class="row-label">背景</span>
          <div class="row-options">
            <button
              v-for="bg in bgOptions"
              :key="bg.value"
              class="bg-dot"
              :class="{ active: themeStore.background === bg.value }"
              @click="themeStore.setBackground(bg.value)"
            >
              {{ bg.label }}
            </button>
          </div>
        </div>

        <!-- 主色调 -->
        <div class="row">
          <span class="row-label">主色调</span>
          <div class="row-options">
            <button
              v-for="c in colorOptions"
              :key="c.value"
              class="color-dot"
              :class="{ active: themeStore.primary === c.value }"
              :style="{ background: c.value }"
              @click="themeStore.setPrimary(c.value)"
            ></button>
          </div>
        </div>
      </section>

      <!-- ================= 3. 使用统计 ================= -->
      <section class="section">
        <div class="section-head">
          <h2 class="section-title">使用统计</h2>
          <button class="section-action" @click="resetStats">清空</button>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">{{ todayMinutes }}</div>
            <div class="stat-label">今日专注(分钟)</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ weekMinutes }}</div>
            <div class="stat-label">本周累计(分钟)</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ streakDays }}</div>
            <div class="stat-label">连续使用(天)</div>
          </div>
        </div>

        <!-- 最近 7 天柱状图 -->
        <div class="chart">
          <div
            v-for="(day, i) in last7Days"
            :key="i"
            class="chart-bar-wrap"
          >
            <div
              class="chart-bar"
              :style="{ height: barHeight(day.minutes) + 'px' }"
            ></div>
            <div class="chart-label">{{ day.label }}</div>
          </div>
        </div>

        <!-- 最常播放 Top 3 -->
        <div v-if="topSounds.length" class="top-sounds">
          <div class="top-title">最常播放</div>
          <div
            v-for="(item, i) in topSounds"
            :key="item.id"
            class="top-item"
          >
            <span class="top-rank">{{ i + 1 }}</span>
            <span class="top-name">{{ item.name }}</span>
            <span class="top-count">{{ item.count }} 次</span>
          </div>
        </div>
      </section>

      <!-- ================= 4. 关于 ================= -->
      <section class="section">
        <h2 class="section-title">关于</h2>
        <div class="about-card">
          <div class="about-name">White Noise</div>
          <div class="about-desc">一款帮你专注、放松、助眠的白噪音应用。</div>
          <div class="about-version">版本 1.0.0</div>
        </div>
      </section>
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
.section {
  padding: 20px 16px;
}
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.section-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--app-text);
  margin: 0;
}
.section-action {
  border: none;
  background: transparent;
  color: var(--app-primary);
  font-size: 14px;
}

/* 排序 */
.sort-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.sort-tab {
  padding: 6px 14px;
  border-radius: 999px;
  border: 1px solid var(--app-border);
  background: var(--app-card);
  font-size: 13px;
  color: var(--app-text-sub);
}
.sort-tab.active {
  background: var(--app-primary);
  border-color: var(--app-primary);
  color: #fff;
}

/* 预设列表 */
.empty {
  padding: 30px;
  text-align: center;
  color: var(--app-text-sub);
  font-size: 14px;
}
.preset-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.preset-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--app-card);
  border-radius: 12px;
  padding: 12px 14px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}
.preset-cover {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: var(--app-primary-light);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
}
.preset-info {
  flex: 1;
}
.preset-name {
  font-size: 15px;
  font-weight: 500;
  color: var(--app-text);
}
.preset-meta {
  font-size: 12px;
  color: var(--app-text-sub);
  margin-top: 2px;
}
.preset-more {
  border: none;
  background: transparent;
  font-size: 18px;
  color: var(--app-text-sub);
}

/* 个性化 */
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.row-label {
  font-size: 15px;
  color: var(--app-text);
}
.row-options {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.opt-btn {
  padding: 6px 14px;
  border-radius: 999px;
  border: 1px solid var(--app-border);
  background: var(--app-card);
  font-size: 13px;
  color: var(--app-text-sub);
}
.opt-btn.active {
  background: var(--app-primary);
  border-color: var(--app-primary);
  color: #fff;
}

/* 背景选项 */
.bg-dot {
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid var(--app-border);
  background: var(--app-card);
  font-size: 12px;
  color: var(--app-text-sub);
}
.bg-dot.active {
  background: var(--app-primary);
  border-color: var(--app-primary);
  color: #fff;
}

.color-dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid transparent;
}
.color-dot.active {
  border-color: var(--app-text);
}

/* 统计 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 20px;
}
.stat-card {
  background: var(--app-card);
  border-radius: 12px;
  padding: 16px 8px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}
.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: var(--app-primary);
}
.stat-label {
  font-size: 12px;
  color: var(--app-text-sub);
  margin-top: 4px;
}

/* 柱状图 */
.chart {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  height: 80px;
  padding: 0 8px;
}
.chart-bar-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}
.chart-bar {
  width: 16px;
  border-radius: 4px;
  background: var(--app-primary);
  transition: height 0.3s;
}
.chart-label {
  font-size: 11px;
  color: var(--app-text-sub);
  margin-top: 4px;
}

/* Top 3 */
.top-sounds {
  margin-top: 20px;
}
.top-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--app-text);
  margin-bottom: 8px;
}
.top-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--app-border);
}
.top-rank {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--app-primary);
  color: #fff;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.top-name {
  flex: 1;
  font-size: 14px;
  color: var(--app-text);
}
.top-count {
  font-size: 13px;
  color: var(--app-text-sub);
}

/* 关于 */
.about-card {
  background: var(--app-card);
  border-radius: 12px;
  padding: 20px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}
.about-name {
  font-size: 18px;
  font-weight: 600;
  color: var(--app-text);
}
.about-desc {
  font-size: 13px;
  color: var(--app-text-sub);
  margin-top: 8px;
}
.about-version {
  font-size: 12px;
  color: var(--app-text-sub);
  margin-top: 12px;
}
</style>