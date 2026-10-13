import { reactive, watch } from 'vue'

const STORAGE_KEY = 'white-noise-presets'

// 从 localStorage 读取
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) {
    console.warn('读取预设失败:', e)
  }
  return []
}

export const presetStore = reactive({
  presets: load(),

  // 保存一个预设
  // sounds: [{ id, emoji, name, volume }]
    savePreset(name, sounds, emoji = '🎵', color = '#3880ff') {
    const preset = {
      id: Date.now(),
      name,
      emoji,
      color,
      createdAt: Date.now(),
      useCount: 0,
      sounds: sounds.map((s) => ({
        id: s.id,
        name: s.name,
        emoji: s.emoji,
        volume: s.volume,
      })),
    }
    this.presets.push(preset)
    return preset
  },

  // 重命名
  renamePreset(id, newName) {
    const p = this.presets.find((p) => p.id === id)
    if (p) p.name = newName
  },

  // 删除
  deletePreset(id) {
    this.presets = this.presets.filter((p) => p.id !== id)
  },

  // 使用次数 +1（调用预设时用）
  markUsed(id) {
    const p = this.presets.find((p) => p.id === id)
    if (p) p.useCount++
  },

  // 应用预设：把预设里的声音恢复到混音台并播放
  applyPreset(id) {
    const p = this.presets.find((p) => p.id === id)
    if (!p) return
    // 使用次数 +1
    p.useCount++
    return p.sounds
  },
})

// 任何改动自动存到 localStorage
watch(
  () => presetStore.presets,
  (val) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
  },
  { deep: true }
)