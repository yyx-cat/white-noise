import { reactive } from 'vue'

// 全局共享的混音台状态
export const mixerStore = reactive({
  // 当前混音台里的音效列表
  sounds: [],

  // 添加音效（如果已存在就不重复加）
  addSound(sound) {
    const exists = this.sounds.some((s) => s.id === sound.id)
    if (!exists) {
      this.sounds.push({
        id: sound.id,
        emoji: sound.emoji,
        name: sound.name,
        volume: 50,
      })
      console.log('已加入混音台:', sound.name)
    } else {
      console.log('已在混音台中:', sound.name)
    }
  },

  // 移除音效
  removeSound(id) {
    this.sounds = this.sounds.filter((s) => s.id !== id)
  },

  // 清空混音台（预设加载前重置列表用）
  clear() {
    this.sounds = []
  },

  // 设置某音效的 UI 音量（0-100，预设恢复音量滑块用）
  setSoundVolume(id, volume) {
    const entry = this.sounds.find((s) => s.id === id)
    if (entry) {
      entry.volume = volume
    }
  },
})