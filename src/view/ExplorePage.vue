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

    <!-- 遮罩：面板展开时让发现页变暗且不可点 -->
    <div
      v-if="showMixer"
      class="mixer-mask"
      @click="closeMixer"
    ></div>

    <!-- 混音台面板 + 迷你条 -->
       <!-- 混音台面板 + 迷你条：没有音效时整个隐藏 -->
    <div
      v-if="mixerStore.sounds.length > 0"
      class="mixer-sheet"
      :class="{ open: showMixer }"
      :style="{ height: sheetHeight + 'px' }"
    >
      <!-- 拖拽手柄 -->
      <div
        class="sheet-handle"
        @pointerdown="startDrag"
        @click="toggleMixer"
      >
        <span class="sheet-arrow">{{ showMixer ? '▼' : '▲' }}</span>
      </div>

            <!-- 迷你条：收起时显示在面板顶部 -->
      <div v-if="!showMixer && mixerStore.sounds.length" class="mini-bar">
        <span class="mini-text">
          🎵 混音器 ({{ mixerStore.sounds.length }}个音效)
        </span>
      </div>

      <!-- 面板内容：展开时显示 -->
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
              <button
                class="sheet-remove"
                @click="removeSoundFromMixer(sound.id)"
              >
                ✕
              </button>
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
import { addSoundToMixer, removeSoundFromMixer, setMixerVolume } from '@/store/bridge'
import { mixerStore } from '@/store/mixer'
import { useAudioStore } from '@/store/audio'

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

// ===== 混音台面板状态 =====
const showMixer = ref(false)
// 面板高度（px）
const sheetHeight = ref(0)
// 收起时露出的迷你条高度
const MINI_HEIGHT = 56
// 展开时的比例（屏幕高度的百分比）
const EXPAND_RATIO = 0.5

// 计算展开高度
function getExpandHeight() {
  return window.innerHeight * EXPAND_RATIO
}

// 初始化：收起状态
function initSheet() {
  sheetHeight.value = MINI_HEIGHT
}

// 打开面板
function openMixer() {
  showMixer.value = true
  sheetHeight.value = getExpandHeight()
}

// 关闭面板
function closeMixer() {
  showMixer.value = false
  sheetHeight.value = MINI_HEIGHT
}

// 切换
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
  // 如果收起状态下拖动，先展开
  if (!showMixer.value) {
    showMixer.value = true
  }
  window.addEventListener('pointermove', onDrag)
  window.addEventListener('pointerup', stopDrag)
}

function onDrag(e) {
  if (!dragging) return
  const delta = startY - e.clientY // 往上拖是正数
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
    // 低于 30% → 收起
    closeMixer()
  } else if (h < halfHeight) {
    // 30% ~ 50% → 吸附到 50%
    sheetHeight.value = halfHeight
  } else {
    // 高于 50% → 吸附到 90%
    sheetHeight.value = fullHeight
  }
}

// ===== 播放逻辑 =====
function togglePlay(sound) {
  if (audioStore.isPlaying(sound.id)) {
    // 正在播 → 只暂停这一个
    removeSoundFromMixer(sound.id)
  } else if (audioStore.isPaused(sound.id)) {
    removeSoundFromMixer(sound.id)
    } else {
    addSoundToMixer(sound)
    // 每次新加入音效时，面板从收起状态开始
    showMixer.value = false
    sheetHeight.value = MINI_HEIGHT
  }
}

function onVolumeChange(sound, event) {
  const value = event.detail.value
  sound.volume = value
  setMixerVolume(sound.id, value)
}

// ===== 生命周期 =====
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
/* Banner 容器 */
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

/* 分类 Tab */
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
  border: 1px solid #ddd;
  background: #f7f7f7;
  font-size: 14px;
  color: #333;
}
.category-tab.active {
  background: #3880ff;
  border-color: #3880ff;
  color: #fff;
}

/* 卡片网格 */
.card-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  padding: 0 16px 120px;
}
.sound-card {
  background: #fff;
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
  color: #333;
}
.play-btn {
  margin-top: 12px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: #3880ff;
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

/* ===== 遮罩 ===== */
.mixer-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 1000;
}

/* ===== 混音台面板 ===== */
.mixer-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: #fff;
  border-radius: 16px 16px 0 0;
  box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.15);
  z-index: 1001;
  transition: height 0.25s ease, transform 0.25s ease;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  /* 不展开时，只有迷你条高度 */
  height: 56px;
}
.mixer-sheet.open {
  /* 高度由 JS 控制 */
}

/* 拖拽手柄 */
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
  color: #999;
}

/* 迷你条 */
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
  color: #333;
}

/* 面板内容 */
.sheet-body {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px 24px;
}
.sheet-empty {
  padding: 40px;
  text-align: center;
  color: #999;
}
.sheet-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.sheet-card {
  background: #f7f7f7;
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
}
.sheet-remove {
  border: none;
  background: transparent;
  color: #999;
  font-size: 14px;
}
</style>