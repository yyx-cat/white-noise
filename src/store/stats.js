import { reactive, watch } from 'vue'

const STORAGE_KEY = 'white-noise-stats'

// 从 localStorage 读
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) {
    console.warn('读取统计失败:', e)
  }
  return { daily: {}, soundCount: {} }
}

// 今天日期字符串 YYYY-MM-DD
export function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const statsStore = reactive({
  // 每天累计秒数：{ '2026-10-12': 1234 }
  daily: load().daily || {},
  // 每个音效播放次数：{ rain: 12 }
  soundCount: load().soundCount || {},

  // 给今天加秒数
  addSeconds(seconds) {
    if (seconds <= 0) return
    const key = todayKey()
    this.daily[key] = (this.daily[key] || 0) + seconds
  },

  // 音效播放次数 +1
  countSound(soundId) {
    this.soundCount[soundId] = (this.soundCount[soundId] || 0) + 1
  },

  // 今日秒数
  todaySeconds() {
    return this.daily[todayKey()] || 0
  },

  // 本周（最近 7 天）秒数合计
  weekSeconds() {
    let sum = 0
    for (let i = 0; i < 7; i++) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      sum += this.daily[key] || 0
    }
    return sum
  },

  // 连续使用天数：从今天往前数，连续有记录的天数
  streak() {
    let count = 0
    for (let i = 0; i < 365; i++) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      if (this.daily[key] && this.daily[key] > 0) {
        count++
      } else {
        // 今天没记录不算断，允许今天还没开始
        if (i === 0) continue
        break
      }
    }
    return count
  },

  // 最近 7 天数据，给柱状图用
  last7Days() {
    const labels = ['日', '一', '二', '三', '四', '五', '六']
    const result = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      result.push({
        label: labels[d.getDay()],
        minutes: Math.round((this.daily[key] || 0) / 60),
      })
    }
    return result
  },

  // 最常播放的声音 Top 3
  topSounds() {
    const entries = Object.entries(this.soundCount)
    entries.sort((a, b) => b[1] - a[1])
    return entries.slice(0, 3)
  },

  // 清空
  reset() {
    this.daily = {}
    this.soundCount = {}
  },
})

// 持久化
watch(
  () => [statsStore.daily, statsStore.soundCount],
  () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ daily: statsStore.daily, soundCount: statsStore.soundCount })
    )
  },
  { deep: true }
)