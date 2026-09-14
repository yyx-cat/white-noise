<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>混音台</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <!-- 空状态 -->
      <div v-if="mixerStore.sounds.length === 0" class="empty">
        <div class="empty-emoji">🎚️</div>
        <p>还没有音效，去发现页点几个吧</p>
      </div>

      <!-- ① 当前播放列表：卡片形式 -->
      <div v-else class="mixer-list">
        <div
          v-for="sound in mixerStore.sounds"
          :key="sound.id"
          class="mixer-card"
        >
          <div class="card-head">
            <span class="card-emoji">{{ sound.emoji }}</span>
            <span class="card-name">{{ sound.name }}</span>
            <button class="remove-btn" @click="mixerStore.removeSound(sound.id)">
              ✕
            </button>
          </div>

          <!-- ② 音量滑块 -->
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
    </ion-content>
  </ion-page>
</template>

<script setup>
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonRange } from '@ionic/vue'
import { mixerStore } from '@/store/mixer'

// ④ 滑块 @input 事件：打印音量值
function onVolumeChange(sound, event) {
  const value = event.detail.value
  sound.volume = value
  console.log(`${sound.name} 音量值:`, value)
}
</script>

<style scoped>
.empty {
  text-align: center;
  padding-top: 80px;
  color: #999;
}
.empty-emoji {
  font-size: 48px;
}

.mixer-list {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.mixer-card {
  background: #fff;
  border-radius: 14px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}
.card-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.card-emoji {
  font-size: 28px;
}
.card-name {
  flex: 1;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}
.remove-btn {
  border: none;
  background: transparent;
  color: #999;
  font-size: 16px;
}
</style>