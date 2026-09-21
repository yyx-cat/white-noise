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
          <div class="card-emoji">{{ sound.emoji }}</div>
          <div class="card-name">{{ sound.name }}</div>
          <button
            class="play-btn"
            :class="{ playing: playingId === sound.id }"
            @click="togglePlay(sound)"
          >
            {{ playingId === sound.id ? '⏸' : '▶' }}
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
import { mixerStore } from '@/store/mixer'
import { useAudio } from '@/composables/useAudio'

// 获取音频引擎实例（与 playingId、categories 处于同一层作用域）
const audio = useAudio()

// 注册 Swiper 模块
const swiperModules = [Autoplay, Pagination]

// 顶部轮播 Banner 数据
const banners = [
  { emoji: '🌧️', title: '雨声助眠', bg: 'linear-gradient(135deg, #667eea, #764ba2)' },
  { emoji: '🌊', title: '海浪白噪音', bg: 'linear-gradient(135deg, #2193b0, #6dd5ed)' },
  { emoji: '🔥', title: '篝火噼啪', bg: 'linear-gradient(135deg, #f2994a, #f2c94c)' },
]

// 分类 Tab
const categories = ['全部', '自然', '生活', '冥想', '专注']
const activeCategory = ref('全部')

// ③ 假数据：写死 12 个音效对象
const sounds = [
  { id: 1, emoji: '🌧️', name: '雨声', category: '自然' },
  { id: 2, emoji: '⛈️', name: '雷雨', category: '自然' },
  { id: 3, emoji: '🌊', name: '海浪', category: '自然' },
  { id: 4, emoji: '🍃', name: '风吹树叶', category: '自然' },
  { id: 5, emoji: '🔥', name: '篝火', category: '生活' },
  { id: 6, emoji: '☕', name: '咖啡馆', category: '生活' },
  { id: 7, emoji: '🚂', name: '火车车厢', category: '生活' },
  { id: 8, emoji: '🧘', name: '冥想钵音', category: '冥想' },
  { id: 9, emoji: '🕉️', name: '诵经', category: '冥想' },
  { id: 10, emoji: '💻', name: '键盘敲击', category: '专注' },
  { id: 11, emoji: '📖', name: '翻书声', category: '专注' },
  { id: 12, emoji: '🎵', name: '轻音乐', category: '专注' },
]

// 当前正在播放的音效 id
const playingId = ref(null)

// 根据分类筛选卡片
const filteredSounds = computed(() => {
  if (activeCategory.value === '全部') return sounds
  return sounds.filter((s) => s.category === activeCategory.value)
})

// ④ 点击按钮：切换播放/暂停，并打印日志
function togglePlay(sound) {
  if (playingId.value === sound.id) {
    playingId.value = null
    console.log('暂停了:', sound.name)
    // 调用音频引擎暂停写死的测试音频
    audio.pause(audio.TEST_URL)
  } else {
    playingId.value = sound.id
    console.log('点击了:', sound.name)
    // 调用音频引擎播放写死的测试音频（play 为 async，本阶段不 await 也能出声）
    audio.play(audio.TEST_URL)
    // ③ 点击时自动加入混音台
    mixerStore.addSound(sound)
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
</style>