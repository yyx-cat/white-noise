<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>计时器</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <div class="timer-wrap">
        <div class="time-display">{{ displayTime }}</div>

        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
        </div>

        <div class="wheel-wrap">
          <div class="wheel">
            <div class="wheel-list" ref="hourListRef" @scroll="onHourScroll">
              <div
                v-for="h in 24"
                :key="'h' + (h - 1)"
                class="wheel-item"
                :class="{ active: selectedHour === h - 1 }"
              >
                {{ h - 1 }}
              </div>
            </div>
            <div class="wheel-unit">时</div>
          </div>

          <div class="wheel">
            <div class="wheel-list" ref="minuteListRef" @scroll="onMinuteScroll">
              <div
                v-for="m in 60"
                :key="'m' + (m - 1)"
                class="wheel-item"
                :class="{ active: selectedMinute === m - 1 }"
              >
                {{ String(m - 1).padStart(2, '0') }}
              </div>
            </div>
            <div class="wheel-unit">分</div>
          </div>
        </div>

        <div class="controls">
          <button class="ctrl-btn start" @click="start" :disabled="running">开始</button>
          <button class="ctrl-btn pause" @click="pause" :disabled="!running">暂停</button>
          <button class="ctrl-btn reset" @click="reset">重置</button>
          <button class="ctrl-btn focus" @click="enterFocus" :disabled="remaining <= 0">专注</button>
        </div>

        <div class="status" v-if="finished">⏰ 时间到！</div>
      </div>
    </ion-content>

    <div v-if="focusMode" class="focus-overlay">
      <div class="focus-time">{{ displayTime }}</div>
      <div class="focus-hint" v-if="!running">已暂停</div>
      <div class="focus-controls">
        <button class="focus-ctrl" @click="running ? pause() : start()">
          {{ running ? '⏸ 暂停' : '▶ 开始' }}
        </button>
        <button class="focus-ctrl exit" @click="exitFocus">退出</button>
      </div>
    </div>
  </ion-page>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, onUnmounted } from 'vue'
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent } from '@ionic/vue'
import { stopAllMixerAudio } from '@/store/bridge'

const selectedHour = ref(0)
const selectedMinute = ref(15)
const remaining = ref(selectedHour.value * 3600 + selectedMinute.value * 60)
const running = ref(false)
const finished = ref(false)
let timerId = null
const focusMode = ref(false)

const hourListRef = ref(null)
const minuteListRef = ref(null)
const ITEM_HEIGHT = 40

const totalSeconds = computed(
  () => selectedHour.value * 3600 + selectedMinute.value * 60
)

const progressPercent = computed(() => {
  if (totalSeconds.value === 0) return 0
  return ((totalSeconds.value - remaining.value) / totalSeconds.value) * 100
})

const displayTime = computed(() => {
  const h = Math.floor(remaining.value / 3600)
  const m = Math.floor((remaining.value % 3600) / 60)
  const s = remaining.value % 60
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})

function onHourScroll() {
  if (!hourListRef.value || running.value) return
  const index = Math.round(hourListRef.value.scrollTop / ITEM_HEIGHT)
  selectedHour.value = Math.max(0, Math.min(23, index))
  syncRemaining()
}

function onMinuteScroll() {
  if (!minuteListRef.value || running.value) return
  const index = Math.round(minuteListRef.value.scrollTop / ITEM_HEIGHT)
  selectedMinute.value = Math.max(0, Math.min(59, index))
  syncRemaining()
}

function syncRemaining() {
  if (running.value) return
  remaining.value = totalSeconds.value
  finished.value = false
}

function start() {
  if (running.value) return
  if (remaining.value <= 0) return
  finished.value = false
  running.value = true
  timerId = setInterval(() => {
    if (remaining.value > 0) {
      remaining.value--
    } else {
      stopTimer()
      running.value = false
      finished.value = true
      stopAllMixerAudio()
      console.log('倒计时结束，已停止所有音频')
    }
  }, 1000)
}

function pause() {
  running.value = false
  stopTimer()
}

function reset() {
  running.value = false
  finished.value = false
  stopTimer()
  remaining.value = totalSeconds.value
}

function enterFocus() {
  if (remaining.value <= 0) return
  focusMode.value = true
  if (!running.value) {
    start()
  }
}

function exitFocus() {
  focusMode.value = false
  pause()
}

function stopTimer() {
  if (timerId) {
    clearInterval(timerId)
    timerId = null
  }
}

onMounted(() => {
  nextTick(() => {
    if (hourListRef.value) {
      hourListRef.value.scrollTop = selectedHour.value * ITEM_HEIGHT
    }
    if (minuteListRef.value) {
      minuteListRef.value.scrollTop = selectedMinute.value * ITEM_HEIGHT
    }
    remaining.value = totalSeconds.value
  })
})

onUnmounted(() => {
  stopTimer()
})
</script>

<style scoped>
.timer-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 60px;
}

.time-display {
  font-size: 80px;
  font-weight: 300;
  font-variant-numeric: tabular-nums;
  color: var(--app-text);
  margin-bottom: 24px;
}

.progress-bar {
  width: 80%;
  height: 6px;
  background: var(--app-border);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 40px;
}
.progress-fill {
  height: 100%;
  background: var(--app-primary);
  transition: width 1s linear;
}

.wheel-wrap {
  display: flex;
  gap: 20px;
  margin-bottom: 40px;
  position: relative;
  height: 240px;
}
.wheel {
  position: relative;
  width: 80px;
  height: 240px;
}
.wheel-list {
  height: 100%;
  overflow-y: scroll;
  scroll-snap-type: y mandatory;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  padding: 100px 0;
  box-sizing: border-box;
}
.wheel-list::-webkit-scrollbar {
  display: none;
}
.wheel-item {
  height: 40px;
  line-height: 40px;
  text-align: center;
  font-size: 24px;
  color: var(--app-text-sub);
  scroll-snap-align: center;
  transition: color 0.2s, font-size 0.2s;
}
.wheel-item.active {
  color: var(--app-text);
  font-size: 30px;
  font-weight: 600;
}
.wheel-unit {
  position: absolute;
  right: -20px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 14px;
  color: var(--app-text-sub);
}

.controls {
  display: flex;
  gap: 12px;
  align-items: center;
}
.ctrl-btn {
  width: 80px;
  height: 44px;
  padding: 0;
  border-radius: 999px;
  border: none;
  font-size: 16px;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ctrl-btn.start {
  background: #2dd36f;
}
.ctrl-btn.pause {
  background: #ffc409;
}
.ctrl-btn.reset {
  background: #92949c;
}
.ctrl-btn.focus {
  background: var(--app-primary);
}
.ctrl-btn:disabled {
  opacity: 0.4;
}

.status {
  margin-top: 30px;
  font-size: 18px;
  color: #ff4961;
  font-weight: 600;
}

.focus-overlay {
  position: fixed;
  inset: 0;
  background: #111;
  color: #fff;
  z-index: 2000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 40px;
}
.focus-time {
  font-size: clamp(80px, 22vw, 160px);
  font-weight: 200;
  font-variant-numeric: tabular-nums;
  letter-spacing: 4px;
}
.focus-hint {
  font-size: 18px;
  color: #888;
}
.focus-controls {
  display: flex;
  gap: 20px;
}
.focus-ctrl {
  padding: 14px 36px;
  border-radius: 999px;
  border: none;
  background: #333;
  color: #fff;
  font-size: 16px;
}
.focus-ctrl.exit {
  background: #555;
}
</style>