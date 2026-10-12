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

/**
 * 切换混响开关（效果器为全局状态，作用于所有正在播放的音效）
 * 开启时引擎先加载脉冲响应再出湿声，关闭时湿声归 0、干声保留
 */
export function toggleMixerReverb() {
  useAudioStore().toggleReverb()
}

/**
 * 设置混响强度（UI 滑块 0-100）
 * @param {number} uiValue 强度 0-100，内部除以 100 转为 0-1
 */
export function setMixerReverbAmount(uiValue) {
  useAudioStore().setReverbAmount(uiValue)
}

/**
 * 切换 3D 环绕开关（开启时声像自动左右往返，关闭时回正中并清理定时器）
 */
export function toggleMixerSurround() {
  useAudioStore().toggleSurround()
}

/**
 * 设置 3D 环绕速度（UI 滑块 0-100）
 * @param {number} uiValue 速度 0-100，内部除以 50 映射为 0-2 Hz
 */
export function setMixerSurroundSpeed(uiValue) {
  useAudioStore().setSurroundSpeed(uiValue)
}

/**
 * 收集当前混音状态快照（预设保存用，同步不产生副作用）
 * 数据源：mixerStore（播放列表与 UI 口径音量）+ audioStore（效果器 UI 口径状态）
 * @returns {{playlist: string[], trackVolumes: Record<string, number>, effects: {reverbEnabled: boolean, reverbAmount: number, surroundEnabled: boolean, surroundSpeed: number}}} 混音状态快照（音量/强度均为 UI 滑块口径 0-100）
 */
export function collectPresetSnapshot() {
  const audioStore = useAudioStore()
  // 播放列表：混音台全部音效 id（含暂停中的音轨，恢复时统一启动）
  const playlist = mixerStore.sounds.map((s) => s.id)
  // 各音轨音量：soundId → UI 滑块值 0-100
  const trackVolumes = {}
  mixerStore.sounds.forEach((s) => {
    trackVolumes[s.id] = s.volume
  })
  // 效果器状态：与 audioStore 中的 UI 口径一致，恢复时可直接走 bridge
  const effects = {
    reverbEnabled: audioStore.reverbEnabled,
    reverbAmount: audioStore.reverbAmount,
    surroundEnabled: audioStore.surroundEnabled,
    surroundSpeed: audioStore.surroundSpeed,
  }
  return { playlist, trackVolumes, effects }
}

/**
 * 应用预设快照到当前混音台（预设加载用）
 * 流程：停掉当前全部声音并清空混音台 → 恢复效果器开关与数值 → 逐个恢复音效（自动播放）与音量
 * 注意顺序：stopAll 会复位环绕开关，因此效果器恢复必须放在停声之后
 * @param {{playlist: string[], trackVolumes: Record<string, number>, effects: {reverbEnabled: boolean, reverbAmount: number, surroundEnabled: boolean, surroundSpeed: number}}} snapshot 预设快照（collectPresetSnapshot 的产物，音量/强度为 UI 口径 0-100）
 * @returns {Promise<number>} 实际恢复的音效数量（预设中已下架/不存在的音效会被跳过）
 */
export async function applyPresetSnapshot(snapshot) {
  const audioStore = useAudioStore()
  // 第一步：停掉当前全部声音（内部同步清播放态与环绕开关）并清空混音台列表
  audioStore.stopAll()
  mixerStore.clear()
  // 第二步：恢复效果器——开关与目标不一致才 toggle，数值始终重设
  const fx = snapshot.effects || {}
  if (typeof fx.reverbEnabled === 'boolean' && fx.reverbEnabled !== audioStore.reverbEnabled) {
    // await：toggleReverb 内部异步加载脉冲响应，等待完成保证跳转页面前开关状态已确定
    await audioStore.toggleReverb()
  }
  if (typeof fx.reverbAmount === 'number') {
    audioStore.setReverbAmount(fx.reverbAmount)
  }
  if (typeof fx.surroundEnabled === 'boolean' && fx.surroundEnabled !== audioStore.surroundEnabled) {
    audioStore.toggleSurround()
  }
  if (typeof fx.surroundSpeed === 'number') {
    audioStore.setSurroundSpeed(fx.surroundSpeed)
  }
  // 第三步：逐个恢复播放列表（addSoundToMixer 内部加入混音台并叠加播放）再覆盖音量
  let restored = 0
  const playlist = Array.isArray(snapshot.playlist) ? snapshot.playlist : []
  playlist.forEach((id) => {
    const meta = getSoundById(id)
    // 音效库中已不存在的 id：跳过并告警
    if (!meta) {
      console.warn(`bridge.applyPresetSnapshot: 跳过预设中不存在的音效 id=${id}`)
      return
    }
    addSoundToMixer(meta)
    // 音量恢复：预设无该音轨音量时保持 addSoundToMixer 的默认 50
    const uiVolume = snapshot.trackVolumes?.[id]
    if (typeof uiVolume === 'number') {
      mixerStore.setSoundVolume(id, uiVolume)
      setMixerVolume(id, uiVolume)
    }
    restored += 1
  })
  return restored
}
