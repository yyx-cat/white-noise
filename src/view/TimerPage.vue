<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>计时器</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <div class="timer-wrap">
        <!-- 大号时间显示 -->
        <div class="time-display">{{ displayTime }}</div>

        <!-- 进度条 -->
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
        </div>

        <!-- 竖滚轮：小时 + 分钟 -->
        <div class="wheel-wrap">
          <div class="wheel">
            <div
              class="wheel-list"
              ref="hourListRef"
              @scroll="onHourScroll"
            >
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
            <div
              class="wheel-list"
              ref="minuteListRef"
              @scroll="onMinuteScroll"
            >
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

        <!-- 控制按钮 -->
        <div class="controls">
          <button class="ctrl-btn start" @click="start" :disabled="running">
            开始
          </button>
          <button class="ctrl-btn pause" @click="pause" :disabled="!running">
            暂停
          </button>
          <button class="ctrl-btn reset" @click="reset">
            重置
          </button>
          <button
            class="ctrl-btn focus"
            @click="enterFocus"
            :disabled="remaining <= 0"
          >
            专注
          </button>
        </div>

        <!-- 状态提示 -->
        <div class="status" v-if="finished">⏰ 时间到！</div>
      </div>
    </ion-content>

    <!-- 专注模式全屏遮罩 -->
    <div v-if="focusMode" class="focus-overlay">
      <div class="focus-time">{{ displayTime }}</div>
      <div class="focus-hint" v-if="!running">已暂停</div>
      <div class="focus-controls">
        <button class="focus-ctrl" @click="running ? pause() : start()">
          {{ running ? '⏸ 暂停' : '▶ 开始' }}
        </button>
        <button class="focus-ctrl exit" @click="exitFocus">
          退出
        </button>
      </div>
    </div>
  </ion-page>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, onUnmounted } from 'vue'
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent } from '@ionic/vue'
import { stopAllMixerAudio } from '@/store/bridge'

// 选中的小时和分钟
const selectedHour = ref(0)
const selectedMinute = ref(15)

// 剩余秒数
const remaining = ref(selectedHour.value * 3600 + selectedMinute.value * 60)
const running = ref(false)
const finished = ref(false)
let timerId = null

// 专注模式
const focusMode = ref(false)

// 滚轮 DOM 引用
const hourListRef = ref(null)
const minuteListRef = ref(null)

// 每项高度（要和 CSS 里 .wheel-item 的高度一致）
const ITEM_HEIGHT = 40

// 总秒数
const totalSeconds = computed(
  () => selectedHour.value * 3600 + selectedMinute.value * 60
)

// 进度百分比
const progressPercent = computed(() => {
  if (totalSeconds.value === 0) return 0
  return ((totalSeconds.value - remaining.value) / totalSeconds.value) * 100
})

// 显示格式：有小时就 hh:mm:ss，否则 mm:ss
const displayTime = computed(() => {
  const h = Math.floor(remaining.value / 3600)
  const m = Math.floor((remaining.value % 3600) / 60)
  const s = remaining.value % 60
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})

// 小时滚动
function onHourScroll() {
  if (!hourListRef.value || running.value) return
  const index = Math.round(hourListRef.value.scrollTop / ITEM_HEIGHT)
  selectedHour.value = Math.max(0, Math.min(23, index))
  syncRemaining()
}

// 分钟滚动
function onMinuteScroll() {
  if (!minuteListRef.value || running.value) return
  const index = Math.round(minuteListRef.value.scrollTop / ITEM_HEIGHT)
  selectedMinute.value = Math.max(0, Math.min(59, index))
  syncRemaining()
}

// 没在运行时，同步剩余时间
function syncRemaining() {
  if (running.value) return
  remaining.value = totalSeconds.value
  finished.value = false
}

// 开始
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

// 暂停
function pause() {
  running.value = false
  stopTimer()
}

// 重置
function reset() {
  running.value = false
  finished.value = false
  stopTimer()
  remaining.value = totalSeconds.value
}

// 进入专注模式
function enterFocus() {
  if (remaining.value <= 0) return
  focusMode.value = true
  if (!running.value) {
    start()
  }
}

// 退出专注模式
function exitFocus() {
  focusMode.value = false
  pause()
}

// 清除定时器
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

/* 大号时间显示 */
.time-display {
  font-size: 80px;
  font-weight: 300;
  font-variant-numeric: tabular-nums;
  color: #333;
  margin-bottom: 24px;
}

/* 进度条 */
.progress-bar {
  width: 80%;
  height: 6px;
  background: #eee;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 40px;
}
.progress-fill {
  height: 100%;
  background: #3880ff;
  transition: width 1s linear;
}

/* 竖滚轮 */
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
  /* 上下留白，让第一项和最后一项能滚到中间 */
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
  color: #bbb;
  scroll-snap-align: center;
  transition: color 0.2s, font-size 0.2s;
}
.wheel-item.active {
  color: #333;
  font-size: 30px;
  font-weight: 600;
}
.wheel-unit {
  position: absolute;
  right: -20px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 14px;
  color: #999;
}

/* 控制按钮（四个统一尺寸） */
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
  background: #3880ff;
}
.ctrl-btn:disabled {
  opacity: 0.4;
}

/* 时间到提示 */
.status {
  margin-top: 30px;
  font-size: 18px;
  color: #ff4961;
  font-weight: 600;
}

/* 专注模式全屏遮罩 */
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
  font-size: 96px;
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