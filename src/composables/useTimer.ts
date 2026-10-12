// 睡眠定时器 composable：模块级单例，所有组件共享同一份倒计时状态
// 归零联动：倒计时走完时经 bridge 调用 audioStore.stopAll()（内部引擎停止 + 清空
// 播放态），与混音台 UI 的"停止全部"走同一路径，保证 UI 状态同步不残留"播放中"
// 防漂移：setInterval 每秒 tick 只负责触发检查，剩余秒数用结束时间戳反推，
// 避免 setInterval 的累计误差（后台标签页被节流后恢复时也能立即校正）
import { ref } from 'vue'
import { stopAllMixerAudio } from '@/store/bridge'

// ===== 模块级单例状态 =====

// 剩余秒数（响应式：Timer 页直接绑定显示）
const remainingSeconds = ref(0)

// 定时器是否运行中
const timerRunning = ref(false)

// 倒计时是否刚走完（Timer 页显示"时间到"提示用）
const timerFinished = ref(false)

// 定时器句柄（setInterval id）：模块级非响应式，UI 无需感知
let timerId: number | null = null

// 本次定时的总时长（秒）：重置时恢复默认用
let durationSeconds = 0

// 结束时间戳（毫秒）：tick 用它反推剩余秒数，避免 setInterval 漂移
let endTimestamp = 0

/**
 * 内部：停止 interval 并清理句柄（不改变 remainingSeconds 等状态）
 */
function stopTicking(): void {
  if (timerId !== null) {
    clearInterval(timerId)
    timerId = null
  }
}

/**
 * 内部：每秒 tick——用结束时间戳反推剩余秒数（ceil 保证显示从满秒开始递减）
 * 归零时：清理 interval → 调用 stopAll 停止全部声音 → 重置定时器状态
 */
function tick(): void {
  const remain = Math.max(0, Math.ceil((endTimestamp - Date.now()) / 1000))
  remainingSeconds.value = remain
  if (remain <= 0) {
    // 归零：停表 → 停声音（经 bridge 同步引擎与 Store 播放态）→ 复位（运行态清除，保留 finished 供 UI 提示）
    stopTicking()
    timerRunning.value = false
    timerFinished.value = true
    stopAllMixerAudio()
  }
}

/**
 * 设置定时时长（分钟）：停止进行中的倒计时，复位到新时长待启动
 * @param minutes 时长（分钟），向下取整且不小于 0
 */
function setTimer(minutes: number): void {
  const m = Math.max(0, Math.floor(minutes))
  stopTicking()
  durationSeconds = m * 60
  remainingSeconds.value = durationSeconds
  timerRunning.value = false
  timerFinished.value = false
}

/**
 * 开始倒计时（幂等：已在跑或无剩余时间时直接返回）
 * 记录结束时间戳后每秒 tick 反推剩余，避免 setInterval 漂移
 */
function startTimer(): void {
  // 已在跑：不重复启动（不叠加多个 interval）
  if (timerRunning.value) {
    return
  }
  // 未设置时长或已归零：无可倒计时
  if (remainingSeconds.value <= 0) {
    return
  }
  timerFinished.value = false
  timerRunning.value = true
  // 结束时间戳 = 当前时刻 + 剩余秒数（暂停后续跑也从此重算）
  endTimestamp = Date.now() + remainingSeconds.value * 1000
  timerId = window.setInterval(tick, 1000)
  // 立即 tick 一次：显示与运行态即时生效，不必等第一个 1 秒
  tick()
}

/**
 * 暂停倒计时：清理 interval，保留剩余秒数（再次 startTimer 从剩余时间续跑）
 */
function pauseTimer(): void {
  if (!timerRunning.value) {
    return
  }
  stopTicking()
  timerRunning.value = false
}

/**
 * 重置定时器：清空倒计时并恢复到 setTimer 设置的默认时长（未设置过则归 0）
 */
function resetTimer(): void {
  stopTicking()
  timerRunning.value = false
  timerFinished.value = false
  remainingSeconds.value = durationSeconds
}

/**
 * 彻底清理定时器（App 卸载时调用，防 interval 泄漏）
 */
function disposeTimer(): void {
  stopTicking()
}

/**
 * 睡眠定时器 composable（模块级单例：所有组件拿到的都是同一份倒计时状态）
 * @returns 返回响应式状态（ref）与控制方法集合
 */
export function useTimer() {
  return {
    // 响应式状态（ref，UI 直接绑定）
    remainingSeconds,
    timerRunning,
    timerFinished,
    // 控制方法
    setTimer,
    startTimer,
    pauseTimer,
    resetTimer,
    disposeTimer,
  }
}
