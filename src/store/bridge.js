/**
 * 双写协调层（bridge）：mixerStore（旧 reactive）与 audioStore（Pinia）的唯一定义点
 * B 侧（UI 组件）只调用本文件函数，不需要知道两个 Store 如何配合，两个 Store 也互不 import
 * 职责：
 * 1. 混音台语义：加入/移除/音量/暂停恢复/全部停止（mixerStore 列表与 audioStore 播放态同步双写）
 * 2. 试听语义：播放器模式播放（打断其他）
 * 3. 向 mixerStore 传参时做字段映射（mixerStore 期望 emoji，元数据中为 icon），mixerStore 本身保持不动
 */
import { mixerStore } from './mixer'
import { useAudioStore } from './audio'
import { getSoundById } from '@/data/sounds'

/**
 * 把音效加入混音台并立即播放（发现页卡片点击走这里）
 * mixerStore 加入列表（已存在则不重复加）+ audioStore.playMultiple 叠加播放（已在播则跳过不打断）
 * 发现页点击属于用户手势，audioStore.playMultiple 内部会先 ensureAudioReady 满足自动播放策略
 * @param {object} sound 音效元数据对象（来自 sounds.js，含 id/icon/name）
 */
export function addSoundToMixer(sound) {
  const audioStore = useAudioStore()
  // 元数据校验：查不到直接告警返回
  if (!getSoundById(sound?.id)) {
    console.warn(`bridge.addSoundToMixer: 未在 sounds.js 中找到 id 为 ${sound?.id} 的音效`)
    return
  }
  // 双写：旧 mixerStore 加入混音台（字段映射 icon → emoji，内部已做去重）
  mixerStore.addSound({ id: sound.id, emoji: sound.icon, name: sound.name })
  // 混音模式播放：叠加不打断其他音效
  audioStore.playMultiple([sound.id])
}

/**
 * 从混音台移除音效并停止其播放
 * @param {string} soundId 音效唯一标识
 */
export function removeSoundFromMixer(soundId) {
  const audioStore = useAudioStore()
  // 停止该音效播放（偏移归零，下次加入从头播）
  audioStore.stop(soundId)
  // 从旧 mixerStore 列表移除
  mixerStore.removeSound(soundId)
}

/**
 * 设置混音台某音效音量（UI 滑块 0-100）
 * @param {string} soundId 音效唯一标识
 * @param {number} uiValue 滑块值 0-100，内部除以 100 转为 0-1
 */
export function setMixerVolume(soundId, uiValue) {
  const audioStore = useAudioStore()
  // clamp 到 0-100 后除以 100，得到 0-1 音量
  const normalized = Math.min(100, Math.max(0, uiValue)) / 100
  // audioStore.setVolume 内部再 clamp 一次并调引擎平滑作用于 GainNode
  audioStore.setVolume(soundId, normalized)
}

/**
 * 切换混音台某音效的播放/暂停
 * 播放中 → 暂停（保留偏移）；暂停中 → 从偏移续播；空闲（未加载/已停止）→ 混音模式开始播放
 * @param {string} soundId 音效唯一标识
 */
export function toggleMixerPlay(soundId) {
  const audioStore = useAudioStore()
  if (audioStore.isPlaying(soundId)) {
    // 播放中 → 暂停
    audioStore.pause(soundId)
  } else if (audioStore.isPaused(soundId)) {
    // 暂停中 → 续播
    audioStore.resume(soundId)
  } else {
    // 空闲 → 混音模式播放（叠加不打断其他）
    audioStore.playMultiple([soundId])
  }
}

/**
 * 停止全部混音音频（mixerStore 列表保留，仅停止发声）
 * 用户明确停止时才调用；audioStore.stopAll 内部会复位 currentMode 与 playerSoundId
 */
export function stopAllMixerAudio() {
  useAudioStore().stopAll()
}

/**
 * 试听某音效（播放器模式）：调 audioStore.play，会打断其他正在播的音效
 * 不动 mixerStore（试听不加入混音台）
 * @param {string} soundId 音效唯一标识
 */
export function playPreview(soundId) {
  useAudioStore().play(soundId)
}
