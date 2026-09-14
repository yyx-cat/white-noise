<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>发现</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <!-- ① 顶部轮播 Banner -->
      <div class="banner-wrap">
        <div class="banner-scroll">
          <div
            v-for="(banner, index) in banners"
            :key="index"
            class="banner-item"
            :style="{ background: banner.bg }"
          >
            <div class="banner-emoji">{{ banner.emoji }}</div>
            <div class="banner-text">{{ banner.title }}</div>
          </div>
        </div>
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

// 顶部轮播 Banner 数据
const banners = [
  { emoji: '🌧️', title: '雨声助眠', bg: 'linear-gradient(135deg, #667eea, #764ba2)' },
  { emoji: '🌊', title: '海浪白噪音', bg: 'linear-gradient(135deg, #2193b0, #6dd5ed)' },
  { emoji: '🔥', title: '篝火噼啪', bg: 'linear-gradient(135deg, #f2994a, #f2c94c)' },
]

// 分类 Tab
const categories = ['全部', '自然', '生活', '冥想', '专注']
const activeCategory = ref('全部')

// ③ 假数据：写死 8-12 个音效对象
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

// 当前正在播放的音效 id（null 表示都没播）
const playingId = ref(null)

// 根据分类筛选卡片
const filteredSounds = computed(() => {
  if (activeCategory.value === '全部') return sounds
  return sounds.filter((s) => s.category === activeCategory.value)
})

// ④ 点击按钮：切换播放/暂停，并在控制台打印日志
function togglePlay(sound) {
  if (playingId.value === sound.id) {
    playingId.value = null
    console.log('暂停了:', sound.name)
  } else {
    playingId.value = sound.id
    console.log('点击了:', sound.name)
  }
}
</script>

<style scoped>
/* Banner 横向滚动 */
.banner-wrap {
  padding: 12px 16px 0;
}
.banner-scroll {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
}
.banner-scroll::-webkit-scrollbar {
  display: none;
}
.banner-item {
  flex: 0 0 85%;
  height: 140px;
  border-radius: 16px;
  scroll-snap-align: start;
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

/* 卡片网格：两列 */
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
  position: relative;
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