<!--
  我的页组件（底部 Tab 第 4 个）
  预设管理 / 个性化（主题·背景·主色） / 使用统计（今日·本周·连续·7日柱状图·最常用音效）
-->
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

// ===== 预设操作菜单 =====
const actionPreset = ref(null)   // 当前操作哪个预设
const renamePreset = ref(null)   // 当前正在重命名的预设
const newPresetName = ref('')

function openMenu(preset) {
  actionPreset.value = preset
}

function startRename() {
  renamePreset.value = actionPreset.value
  newPresetName.value = actionPreset.value.name
  actionPreset.value = null
}

function doRename() {
  const name = newPresetName.value.trim()
  if (!name) {
    alert('名称不能为空')
    return
  }
  presetStore.renamePreset(renamePreset.value.id, name)
  renamePreset.value = null
}

function confirmDelete() {
  const ok = confirm(`确定删除预设「${actionPreset.value.name}」吗？`)
  if (ok) {
    presetStore.deletePreset(actionPreset.value.id)
    actionPreset.value = null
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

<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>我的</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <div class="profile-page">

        <!-- 预设管理 -->
        <section class="card">
          <div class="section-head">
            <span class="section-title">🎵 我的预设</span>
            <button class="ghost-btn" @click="createPreset">+ 新建</button>
          </div>

          <div class="sort-row">
            <span class="sort-label">排序</span>
            <select v-model="sortBy" class="sort-select">
              <option v-for="o in sortOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
          </div>

          <div v-if="sortedPresets.length === 0" class="empty">还没有预设，去发现页调好混音后回来保存</div>
          <div v-else class="preset-list">
            <div
              v-for="p in sortedPresets"
              :key="p.id"
              class="preset-item"
              @click="openPreset(p)"
            >
              <div class="preset-emoji">{{ p.emoji }}</div>
              <div class="preset-info">
                <div class="preset-name">{{ p.name }}</div>
                <div class="preset-meta">{{ p.sounds.length }} 个音效 · {{ p.useCount }} 次使用 · {{ formatDate(p.createdAt) }}</div>
              </div>
              <button class="more-btn" @click.stop="openMenu(p)">⋯</button>
            </div>
          </div>
        </section>

        <!-- 个性化 -->
        <section class="card">
          <div class="section-title">🎨 个性化</div>

          <div class="row">
            <div class="row-label">主题</div>
            <div class="btn-group">
              <button
                v-for="o in themeOptions"
                :key="o.value"
                class="chip"
                :class="{ active: themeStore.mode === o.value }"
                @click="themeStore.setMode(o.value)"
              >{{ o.label }}</button>
            </div>
          </div>

          <div class="row">
            <div class="row-label">背景</div>
            <div class="btn-group">
              <button
                v-for="o in bgOptions"
                :key="o.value"
                class="chip"
                :class="{ active: themeStore.background === o.value }"
                @click="themeStore.setBackground(o.value)"
              >{{ o.label }}</button>
            </div>
          </div>

          <div class="row">
            <div class="row-label">主色</div>
            <div class="btn-group">
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

        <!-- 使用统计 -->
        <section class="card">
          <div class="section-head">
            <span class="section-title">📊 使用统计</span>
            <button class="ghost-btn danger" @click="resetStats">清空</button>
          </div>

          <div class="stats-row">
            <div class="stat-cell">
              <div class="stat-num">{{ todayMinutes }}</div>
              <div class="stat-label">今日(分钟)</div>
            </div>
            <div class="stat-cell">
              <div class="stat-num">{{ weekMinutes }}</div>
              <div class="stat-label">本周(分钟)</div>
            </div>
            <div class="stat-cell">
              <div class="stat-num">{{ streakDays }}</div>
              <div class="stat-label">连续(天)</div>
            </div>
          </div>

        <div class="chart">
          <div v-for="(d, i) in last7Days" :key="i" class="bar-col">
            <!-- 新增的数值显示 -->
            <div class="bar-value">{{ d.minutes > 0 ? d.minutes : '' }}</div>
            <!-- 柱子 -->
            <div class="bar" :style="{ height: barHeight(d.minutes) + 'px' }"></div>
            <div class="bar-label">{{ d.label }}</div>
          </div>
        </div>

          <div v-if="topSounds.length" class="top-sounds">
            <div v-for="(t, i) in topSounds" :key="t.id" class="top-item">
              <span class="rank">{{ i + 1 }}</span>
              <span class="top-name">{{ t.name }}</span>
              <span class="top-count">{{ t.count }} 次</span>
            </div>
          </div>
        </section>

      </div>
    </ion-content>
    
        <!-- 预设操作底部菜单 -->
    <div v-if="actionPreset" class="action-mask" @click="actionPreset = null">
      <div class="action-sheet" @click.stop>
        <div class="action-title">{{ actionPreset.name }}</div>
        <button class="action-item" @click="startRename">重命名</button>
        <button class="action-item danger" @click="confirmDelete">删除</button>
        <button class="action-cancel" @click="actionPreset = null">取消</button>
      </div>
    </div>

    <!-- 重命名弹窗 -->
    <div v-if="renamePreset" class="rename-mask" @click="renamePreset = null">
      <div class="rename-dialog" @click.stop>
        <div class="rename-title">重命名预设</div>
        <input
          v-model="newPresetName"
          class="rename-input"
          placeholder="新名称"
        />
        <div class="rename-actions">
          <button class="rename-cancel" @click="renamePreset = null">取消</button>
          <button class="rename-confirm" @click="doRename">确定</button>
        </div>
      </div>
    </div>
  </ion-page>
</template>

<style scoped>
/* 页面容器 */
.profile-page {
  padding: 12px 14px 32px;
}

/* 卡片 */
.card {
  background: #fff;
  border-radius: 14px;
  padding: 16px;
  margin-bottom: 14px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

/* 幽灵按钮（新建/清空） */
.ghost-btn {
  border: 1px solid #3880ff;
  background: transparent;
  color: #3880ff;
  border-radius: 999px;
  padding: 5px 14px;
  font-size: 13px;
  cursor: pointer;
}
.ghost-btn.danger {
  border-color: #ff4961;
  color: #ff4961;
}

/* 排序行 */
.sort-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.sort-label {
  font-size: 13px;
  color: #999;
}
.sort-select {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 5px 8px;
  font-size: 13px;
  outline: none;
  background: #fff;
}

/* 预设列表 */
.preset-list {
  display: flex;
  flex-direction: column;
}
.preset-item {
  display: flex;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
}
.preset-item:last-of-type {
  border-bottom: none;
}
.preset-emoji {
  font-size: 24px;
  margin-right: 12px;
}
.preset-info {
  flex: 1;
  min-width: 0;
}
.preset-name {
  font-size: 15px;
  color: #333;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.preset-meta {
  font-size: 12px;
  color: #999;
  margin-top: 3px;
}
.more-btn {
  border: none;
  background: transparent;
  font-size: 20px;
  color: #999;
  padding: 4px 10px;
  cursor: pointer;
}

/* 个性化行 */
.row {
  display: flex;
  align-items: center;
  margin: 12px 0;
}
.row-label {
  width: 44px;
  font-size: 14px;
  color: #666;
  flex-shrink: 0;
}
.btn-group {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.chip {
  border: 1px solid #ddd;
  background: #f7f7f7;
  color: #555;
  border-radius: 999px;
  padding: 6px 14px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}
.chip.active {
  border-color: #3880ff;
  background: #3880ff;
  color: #fff;
}
.color-dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.15s;
}
.color-dot.active {
  border-color: #333;
  transform: scale(1.1);
}

/* 统计三格 */
.stats-row {
  display: flex;
  margin-bottom: 16px;
}
.stat-cell {
  flex: 1;
  text-align: center;
}
.stat-num {
  font-size: 24px;
  font-weight: 600;
  color: #333;
  font-variant-numeric: tabular-nums;
}
.stat-label {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

/* 7 日柱状图 */
.chart {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  height: 100px;
  padding: 0 8px;
  margin-bottom: 10px;
}
.chart-bar-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  height: 100%;
  justify-content: flex-end;
}
.chart-value {
  font-size: 11px;
  color: var(--app-text-sub);
  margin-bottom: 4px;
  height: 14px;
}
.bar {
  width: 18px;
  background: #3880ff;
  border-radius: 4px 4px 0 0;
  min-height: 4px;
}
.bar-label {
  font-size: 11px;
  color: #999;
  margin-top: 4px;
}

/* 最常用声音 */
.top-sounds {
  border-top: 1px solid #f0f0f0;
  padding-top: 12px;
}
.top-item {
  display: flex;
  align-items: center;
  padding: 6px 0;
}
.rank {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #f0f0f0;
  color: #666;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 10px;
  flex-shrink: 0;
}
.top-name {
  flex: 1;
  font-size: 14px;
  color: #333;
}
.top-count {
  font-size: 12px;
  color: #999;
}

/* 空状态 */
.empty {
  padding: 20px 0;
  text-align: center;
  font-size: 14px;
  color: #aaa;
}

/* 预设操作底部菜单 */
.action-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 3000;
  display: flex;
  align-items: flex-end;
}
.action-sheet {
  width: 100%;
  background: var(--app-card);
  border-radius: 20px 20px 0 0;
  padding: 16px 20px 30px; /* 底部留白避开导航栏 */
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.action-title {
  text-align: center;
  font-size: 13px;
  color: var(--app-text-sub);
  margin-bottom: 8px;
}
.action-item {
  width: 100%;
  padding: 14px;
  border-radius: 12px;
  border: none;
  background: var(--app-bg);
  color: var(--app-text);
  font-size: 16px;
}
.action-item.danger {
  color: #ff4961;
}
.action-cancel {
  width: 100%;
  padding: 14px;
  border-radius: 12px;
  border: none;
  background: var(--app-card);
  color: var(--app-text);
  font-size: 16px;
  margin-top: 8px;
  border: 1px solid var(--app-border);
}

/* 重命名弹窗 */
.rename-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 3100;
  display: flex;
  align-items: center;
  justify-content: center;
}
.rename-dialog {
  width: 85%;
  max-width: 340px;
  background: var(--app-card);
  border-radius: 16px;
  padding: 20px;
}
.rename-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--app-text);
  text-align: center;
  margin-bottom: 16px;
}
.rename-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--app-border);
  border-radius: 10px;
  font-size: 15px;
  margin-bottom: 20px;
  box-sizing: border-box;
  background: var(--app-bg);
  color: var(--app-text);
}
.rename-actions {
  display: flex;
  gap: 12px;
}
.rename-cancel,
.rename-confirm {
  flex: 1;
  padding: 10px;
  border-radius: 10px;
  border: none;
  font-size: 15px;
}
.rename-cancel {
  background: var(--app-border);
  color: var(--app-text);
}
.rename-confirm {
  background: var(--app-primary);
  color: #fff;
}
</style>
