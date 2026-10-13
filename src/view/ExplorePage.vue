<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>发现</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <!-- 顶部自动轮播 Banner -->
      <div class="banner-wrap">
        <swiper
          :modules="swiperModules"
          :autoplay="{ delay: 3000, disableOnInteraction: false }"
          :loop="true"
          :pagination="{ clickable: true }"
          class="banner-swiper"
        >
          <swiper-slide v-for="(banner, index) in banners" :key="index">
            <div class="banner-item" :style="{ background: banner.bg }">
              <div class="banner-emoji">{{ banner.emoji }}</div>
              <div class="banner-text">{{ banner.title }}</div>
            </div>
          </swiper-slide>
        </swiper>
      </div>

      <!-- 分类 Tab 栏 -->
      <div class="category-tabs">
        <button
          v-for="cat in categories"
          :key="cat"
          class="category-tab"
          :class="{ active: activeCategory === cat }"
          @click="activeCategory = cat"
        >
          {{ cat }}
        </button>
      </div>

      <!-- 音效卡片网格 -->
      <div class="card-grid">
        <div
          v-for="sound in filteredSounds"
          :key="sound.id"
          class="sound-card"
        >
          <div class="card-emoji">{{ sound.icon }}</div>
          <div class="card-name">{{ sound.name }}</div>
          <button
            class="play-btn"
            :class="{
              playing: audioStore.isPlaying(sound.id),
              loading: audioStore.isLoading(sound.id),
            }"
            @click="togglePlay(sound)"
          >
            {{ audioStore.isPlaying(sound.id) ? '⏸' : audioStore.isLoading(sound.id) ? '⏳' : '▶' }}
          </button>
        </div>
      </div>
    </ion-content>

    <!-- 遮罩 -->
    <div v-if="showMixer" class="mixer-mask" @click="closeMixer"></div>

    <!-- 混音台面板 + 迷你条 -->
    <div
      v-if="mixerStore.sounds.length > 0"
      class="mixer-sheet"
      :class="{ open: showMixer }"
      :style="{ height: sheetHeight + 'px' }"
    >
      <div class="sheet-handle" @pointerdown="startDrag" @click="toggleMixer">
        <span class="sheet-arrow">{{ showMixer ? '▼' : '▲' }}</span>
      </div>

      <div v-if="!showMixer && mixerStore.sounds.length" class="mini-bar">
        <span class="mini-text">
          🎵 混音器 ({{ mixerStore.sounds.length }}个音效)
        </span>
      </div>

      <div v-if="showMixer" class="sheet-body">
        <div v-if="mixerStore.sounds.length === 0" class="sheet-empty">
          还没有音效，去点几个吧
        </div>
        <div v-else class="sheet-list">
          <div
            v-for="sound in mixerStore.sounds"
            :key="sound.id"
            class="sheet-card"
          >
            <div class="sheet-card-head">
              <span class="sheet-emoji">{{ sound.emoji }}</span>
              <span class="sheet-name">{{ sound.name }}</span>
              <button class="sheet-remove" @click="removeSoundFromMixer(sound.id)">✕</button>
            </div>
            <ion-range
              :min="0"
              :max="100"
              :value="sound.volume"
              @ionInput="onVolumeChange(sound, $event)"
            >
              <span slot="start">🔈</span>
              <span slot="end">🔊</span>
            </ion-range>
          </div>
        </div>

        <!-- 效果器面板：混响 + 3D 环绕（全局开关，作用于所有正在播放的音效） -->
        <div class="fx-panel">
          <div class="fx-title">🎛️ 效果器</div>
          <!-- 混响行：开关按钮 + 强度滑块 -->
          <div class="fx-row">
            <button
              class="fx-toggle"
              :class="{ on: audioStore.reverbEnabled }"
              @click="onToggleReverb"
            >
              混响 {{ audioStore.reverbEnabled ? '开' : '关' }}
            </button>
            <ion-range
              class="fx-range"
              :min="0"
              :max="100"
              :value="audioStore.reverbAmount"
              @ionInput="onReverbAmount($event)"
            >
              <span slot="start">弱</span>
              <span slot="end">强</span>
            </ion-range>
          </div>
          <!-- 3D 环绕行：开关按钮 + 速度滑块 -->
          <div class="fx-row">
            <button
              class="fx-toggle"
              :class="{ on: audioStore.surroundEnabled }"
              @click="onToggleSurround"
            >
              环绕 {{ audioStore.surroundEnabled ? '开' : '关' }}
            </button>
            <ion-range
              class="fx-range"
              :min="0"
              :max="100"
              :value="audioStore.surroundSpeed"
              @ionInput="onSurroundSpeed($event)"
            >
              <span slot="start">慢</span>
              <span slot="end">快</span>
            </ion-range>
          </div>
        </div>

        <button
          class="stop-all-btn"
          :class="{ playing: !anyPlaying }"
          @click="toggleAll"
        >
          {{ anyPlaying ? '⏹ 全部停止' : '▶ 全部播放' }}
        </button>

        <button class="save-preset-btn" @click="saveAsPreset">
          💾 保存为预设
        </button>

        <button class="clear-all-btn" @click="clearAll">
          🗑 清空混音台
        </button>
      </div>
    </div>

    <!-- 保存预设弹窗 -->
    <div v-if="showSaveDialog" class="save-dialog-mask" @click="showSaveDialog = false">
      <div class="save-dialog" @click.stop>
        <div class="dialog-title">保存为预设</div>

        <input
          v-model="presetName"
          class="dialog-input"
          placeholder="预设名称"
        />

        <div class="dialog-label">图标</div>
        <div class="emoji-list">
          <button
            v-for="e in emojiOptions"
            :key="e"
            class="emoji-item"
            :class="{ active: presetEmoji === e }"
            @click="presetEmoji = e"
          >
            {{ e }}
          </button>
        </div>

        <div class="dialog-label">颜色</div>
        <div class="color-list">
          <button
            v-for="c in presetColors"
            :key="c"
            class="color-item"
            :class="{ active: presetColor === c }"
            :style="{ background: c }"
            @click="presetColor = c"
          ></button>
        </div>

        <div class="dialog-actions">
          <button class="dialog-cancel" @click="showSaveDialog = false">取消</button>
          <button class="dialog-confirm" @click="confirmSave">保存</button>
        </div>
      </div>
    </div>
  </ion-page>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonRange } from '@ionic/vue'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { Autoplay, Pagination } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/pagination'
import { sounds, getCategories } from '@/data/sounds'
import {
  addSoundToMixer,
  removeSoundFromMixer,
  setMixerVolume,
  stopAllMixerAudio,
  toggleMixerPlay,
  toggleMixerReverb,
  setMixerReverbAmount,
  toggleMixerSurround,
  setMixerSurroundSpeed,
} from '@/store/bridge'
import { mixerStore } from '@/store/mixer'
import { useAudioStore } from '@/store/audio'
import { presetStore } from '@/store/presets'

const audioStore = useAudioStore()
const swiperModules = [Autoplay, Pagination]

const banners = [
  { emoji: '🌧️', title: '雨声助眠', bg: 'linear-gradient(135deg, #667eea, #764ba2)' },
  { emoji: '🌊', title: '海浪白噪音', bg: 'linear-gradient(135deg, #2193b0, #6dd5ed)' },
  { emoji: '🔥', title: '篝火噼啪', bg: 'linear-gradient(135deg, #f2994a, #f2c94c)' },
]

const categories = getCategories()
const activeCategory = ref('全部')

const filteredSounds = computed(() => {
  if (activeCategory.value === '全部') return sounds
  return sounds.filter((s) => s.category === activeCategory.value)
})

const anyPlaying = computed(() => {
  return mixerStore.sounds.some((s) => audioStore.isPlaying(s.id))
})

// ===== 混音台面板状态 =====
const showMixer = ref(false)
const sheetHeight = ref(0)
const MINI_HEIGHT = 56
const EXPAND_RATIO = 0.5

function getExpandHeight() {
  return window.innerHeight * EXPAND_RATIO
}

function initSheet() {
  sheetHeight.value = MINI_HEIGHT
}

function openMixer() {
  showMixer.value = true
  sheetHeight.value = getExpandHeight()
}

function closeMixer() {
  showMixer.value = false
  sheetHeight.value = MINI_HEIGHT
}

function toggleMixer() {
  if (showMixer.value) {
    closeMixer()
  } else {
    openMixer()
  }
}

// ===== 拖拽 =====
let dragging = false
let startY = 0
let startHeight = 0

function startDrag(e) {
  dragging = true
  startY = e.clientY
  startHeight = sheetHeight.value
  if (!showMixer.value) {
    showMixer.value = true
  }
  window.addEventListener('pointermove', onDrag)
  window.addEventListener('pointerup', stopDrag)
}

function onDrag(e) {
  if (!dragging) return
  const delta = startY - e.clientY
  let newHeight = startHeight + delta
  const maxHeight = window.innerHeight * 0.9
  const minHeight = MINI_HEIGHT
  newHeight = Math.max(minHeight, Math.min(maxHeight, newHeight))
  sheetHeight.value = newHeight
}

function stopDrag() {
  dragging = false
  window.removeEventListener('pointermove', onDrag)
  window.removeEventListener('pointerup', stopDrag)
  const h = sheetHeight.value
  const closeThreshold = window.innerHeight * 0.3
  const halfHeight = window.innerHeight * 0.5
  const fullHeight = window.innerHeight * 0.9
  if (h < closeThreshold) {
    closeMixer()
  } else if (h < halfHeight) {
    sheetHeight.value = halfHeight
  } else {
    sheetHeight.value = fullHeight
  }
}

// ===== 播放逻辑 =====
function togglePlay(sound) {
  if (audioStore.isPlaying(sound.id)) {
    removeSoundFromMixer(sound.id)
  } else if (audioStore.isPaused(sound.id)) {
    removeSoundFromMixer(sound.id)
  } else {
    addSoundToMixer(sound)
    showMixer.value = false
    sheetHeight.value = MINI_HEIGHT
  }
}

function onVolumeChange(sound, event) {
  const value = event.detail.value
  sound.volume = value
  setMixerVolume(sound.id, value)
}

// ===== 效果器（混响 + 3D 环绕） =====
function onToggleReverb() {
  toggleMixerReverb()
}
function onReverbAmount(event) {
  setMixerReverbAmount(event.detail.value)
}
function onToggleSurround() {
  toggleMixerSurround()
}
function onSurroundSpeed(event) {
  setMixerSurroundSpeed(event.detail.value)
}

// ===== 全部停止 / 全部播放 =====
function toggleAll() {
  if (anyPlaying.value) {
    stopAllMixerAudio()
    console.log('已停止全部声音')
  } else {
    mixerStore.sounds.forEach((s) => {
      toggleMixerPlay(s.id)
    })
    console.log('已恢复全部声音')
  }
}

// ===== 清空混音台 =====
function clearAll() {
  if (mixerStore.sounds.length === 0) return
  const ok = confirm('确定清空混音台里所有音效吗？')
  if (!ok) return
  // 先停掉全部声音
  stopAllMixerAudio()
  // 再逐个从列表移除
  const ids = mixerStore.sounds.map((s) => s.id)
  ids.forEach((id) => removeSoundFromMixer(id))
  // 收起面板
  closeMixer()
}

// ===== 保存预设弹窗 =====
const showSaveDialog = ref(false)
const presetName = ref('')
const presetEmoji = ref('🎵')
const presetColor = ref('#3880ff')

const emojiOptions = ['🎵', '🌙', '💻', '🌧️', '🔥', '🌊', '🧘', '☕', '📖', '🍃']
const presetColors = ['#3880ff', '#8e44ad', '#2dd36f', '#ff4961', '#ffc409', '#92949c']

function saveAsPreset() {
  if (mixerStore.sounds.length === 0) {
    alert('混音台是空的')
    return
  }
  presetName.value = ''
  presetEmoji.value = '🎵'
  presetColor.value = '#3880ff'
  showSaveDialog.value = true
}

function confirmSave() {
  const name = presetName.value.trim()
  if (!name) {
    alert('请输入预设名称')
    return
  }
  presetStore.savePreset(name, mixerStore.sounds, presetEmoji.value, presetColor.value)
  showSaveDialog.value = false
  alert(`已保存预设「${name}」`)
}

onMounted(() => {
  initSheet()
  window.addEventListener('resize', initSheet)
})
onUnmounted(() => {
  window.removeEventListener('resize', initSheet)
  window.removeEventListener('pointermove', onDrag)
  window.removeEventListener('pointerup', stopDrag)
})
</script>

<style scoped>
.banner-wrap {
  padding: 12px 16px 0;
}
.banner-swiper {
  border-radius: 16px;
  overflow: hidden;
  --swiper-pagination-bottom: 8px;
}
.banner-item {
  height: 140px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #fff;
}
.banner-emoji {
  font-size: 40px;
}
.banner-text {
  margin-top: 8px;
  font-size: 16px;
  font-weight: 600;
}
.banner-swiper :deep(.swiper-pagination-bullet) {
  background: #fff;
  opacity: 0.6;
}
.banner-swiper :deep(.swiper-pagination-bullet-active) {
  opacity: 1;
}

.category-tabs {
  display: flex;
  gap: 8px;
  padding: 16px;
  overflow-x: auto;
}
.category-tabs::-webkit-scrollbar {
  display: none;
}
.category-tab {
  flex: 0 0 auto;
  padding: 6px 16px;
  border-radius: 999px;
  border: 1px solid var(--app-border);
  background: var(--app-card);
  font-size: 14px;
  color: var(--app-text);
}
.category-tab.active {
  background: var(--app-primary);
  border-color: var(--app-primary);
  color: #fff;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  padding: 0 16px 120px;
}
.sound-card {
  background: var(--app-card);
  border-radius: 14px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: column;
  align-items: center;
}
.card-emoji {
  font-size: 36px;
}
.card-name {
  margin-top: 8px;
  font-size: 14px;
  color: var(--app-text);
}
.play-btn {
  margin-top: 12px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: var(--app-primary);
  color: #fff;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.play-btn.playing {
  background: #ff4961;
}
.play-btn.loading {
  background: #b2bec3;
  animation: btn-breathing 1.2s ease-in-out infinite;
}
@keyframes btn-breathing {
  0%, 100% { opacity: 0.55; }
  50% { opacity: 1; }
}

.mixer-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 1000;
}

.mixer-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--app-card);
  border-radius: 16px 16px 0 0;
  box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.15);
  z-index: 1001;
  transition: height 0.25s ease, transform 0.25s ease;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 56px;
}

.sheet-handle {
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  touch-action: none;
  flex-shrink: 0;
}
.sheet-handle:active {
  cursor: grabbing;
}
.sheet-arrow {
  font-size: 12px;
  color: var(--app-text-sub);
}

.mini-bar {
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
  flex-shrink: 0;
}
.mini-text {
  font-size: 14px;
  color: var(--app-text);
}

.sheet-body {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px 24px;
}
.sheet-empty {
  padding: 40px;
  text-align: center;
  color: var(--app-text-sub);
}
.sheet-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.sheet-card {
  background: var(--app-primary-light);
  border-radius: 12px;
  padding: 12px;
}
.sheet-card-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.sheet-emoji {
  font-size: 24px;
}
.sheet-name {
  flex: 1;
  font-size: 15px;
  font-weight: 500;
  color: var(--app-text);
}
.sheet-remove {
  border: none;
  background: transparent;
  color: var(--app-text-sub);
  font-size: 14px;
}

/* 效果器面板（混响 + 3D 环绕，全局开关） */
.fx-panel {
  margin-top: 16px;
  background: var(--app-primary-light);
  border-radius: 12px;
  padding: 12px;
}
.fx-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--app-text);
  margin-bottom: 10px;
}
.fx-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 8px 0;
}
.fx-toggle {
  flex-shrink: 0;
  padding: 6px 14px;
  border-radius: 999px;
  border: 1px solid var(--app-border);
  background: var(--app-bg);
  color: var(--app-text-sub);
  font-size: 13px;
}
.fx-toggle.on {
  border-color: var(--app-primary);
  background: var(--app-primary);
  color: #fff;
}
.fx-range {
  flex: 1;
}

.stop-all-btn {
  margin-top: 16px;
  width: 100%;
  padding: 12px;
  border-radius: 12px;
  border: none;
  background: #ff4961;
  color: #fff;
  font-size: 15px;
}
.stop-all-btn.playing {
  background: #2dd36f;
}

.save-preset-btn {
  margin-top: 10px;
  width: 100%;
  padding: 12px;
  border-radius: 12px;
  border: none;
  background: var(--app-primary);
  color: #fff;
  font-size: 15px;
}

.clear-all-btn {
  margin-top: 10px;
  width: 100%;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid #ff4961;
  background: transparent;
  color: #ff4961;
  font-size: 15px;
}

/* 保存预设弹窗 */
.save-dialog-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.save-dialog {
  width: 85%;
  max-width: 360px;
  background: var(--app-card);
  border-radius: 16px;
  padding: 20px;
}
.dialog-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--app-text);
  margin-bottom: 16px;
  text-align: center;
}
.dialog-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--app-border);
  border-radius: 10px;
  font-size: 15px;
  margin-bottom: 16px;
  box-sizing: border-box;
  background: var(--app-bg);
  color: var(--app-text);
}
.dialog-label {
  font-size: 13px;
  color: var(--app-text-sub);
  margin-bottom: 8px;
}
.emoji-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}
.emoji-item {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid var(--app-border);
  background: var(--app-bg);
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.emoji-item.active {
  border-color: var(--app-primary);
  background: var(--app-primary-light);
}
.color-list {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}
.color-item {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid transparent;
}
.color-item.active {
  border-color: var(--app-text);
}
.dialog-actions {
  display: flex;
  gap: 12px;
}
.dialog-cancel,
.dialog-confirm {
  flex: 1;
  padding: 10px;
  border-radius: 10px;
  border: none;
  font-size: 15px;
}
.dialog-cancel {
  background: var(--app-border);
  color: var(--app-text);
}
.dialog-confirm {
  background: var(--app-primary);
  color: #fff;
}
</style>