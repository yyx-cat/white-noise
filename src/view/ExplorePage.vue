<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>发现</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <!-- ① 顶部自动轮播 Banner -->
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

      <!-- ② 音效卡片网格 -->
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
  </ion-page>
</template>

<script setup>
import { ref, computed } from 'vue'
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent } from '@ionic/vue'
// 引入 Swiper 组件和需要的模块
import { Swiper, SwiperSlide } from 'swiper/vue'
import { Autoplay, Pagination } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/pagination'
// 音效元数据唯一来源：卡片列表与分类均从此取，不再本地写死
import { sounds, getCategories } from '@/data/sounds'
// 双写协调层：UI 只调用 bridge，由它统一双写 audioStore / mixerStore 并驱动音频引擎
import { addSoundToMixer, removeSoundFromMixer } from '@/store/bridge'
// Pinia 音频状态：播放中判断（图标切换）全部以此为准
import { useAudioStore } from '@/store/audio'

// 音频状态 Store 实例（与 categories 处于同一层作用域）
const audioStore = useAudioStore()

// 注册 Swiper 模块
const swiperModules = [Autoplay, Pagination]

// 顶部轮播 Banner 数据
const banners = [
  { emoji: '🌧️', title: '雨声助眠', bg: 'linear-gradient(135deg, #667eea, #764ba2)' },
  { emoji: '🌊', title: '海浪白噪音', bg: 'linear-gradient(135deg, #2193b0, #6dd5ed)' },
  { emoji: '🔥', title: '篝火噼啪', bg: 'linear-gradient(135deg, #f2994a, #f2c94c)' },
]

// 分类 Tab（从 sounds.js 元数据动态生成，"全部"固定在最前）
const categories = getCategories()
const activeCategory = ref('全部')

// 根据分类筛选卡片
const filteredSounds = computed(() => {
  if (activeCategory.value === '全部') return sounds
  return sounds.filter((s) => s.category === activeCategory.value)
})

// ④ 点击按钮：经协调层加入混音台并叠加播放（addSoundToMixer 内部双写两个 Store，
// 走 audioStore.playMultiple 混音模式——多音效共存互不打断，点击同时满足用户手势要求）
function togglePlay(sound) {
  if (audioStore.isPlaying(sound.id)) {
    // 正在播 → 停止播放并从混音台移除
    removeSoundFromMixer(sound.id)
  } else if (audioStore.isPaused(sound.id)) {
    // 已暂停 → 直接从混音台移除
    removeSoundFromMixer(sound.id)
  } else {
    // 没播过 → 加入混音台并开始播
    addSoundToMixer(sound)
  }
}
</script>

<style scoped>
/* Banner 容器 */
.banner-wrap {
  padding: 12px 16px 0;
}
.banner-swiper {
  border-radius: 16px;
  overflow: hidden;
  /* 让分页点显示在图片上方 */
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

/* 分页点颜色 */
.banner-swiper :deep(.swiper-pagination-bullet) {
  background: #fff;
  opacity: 0.6;
}
.banner-swiper :deep(.swiper-pagination-bullet-active) {
  opacity: 1;
}

/* 分类 Tab 栏 */
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
  padding: 0 16px 24px;
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

/* 播放/暂停按钮 */
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

/* 加载中（音频冷解码）：灰底 + 缓慢呼吸提示，避免用户误以为点击无响应 */
.play-btn.loading {
  background: #b2bec3;
  animation: btn-breathing 1.2s ease-in-out infinite;
}
@keyframes btn-breathing {
  0%,
  100% {
    opacity: 0.55;
  }
  50% {
    opacity: 1;
  }
}
</style>