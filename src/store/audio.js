import { defineStore } from 'pinia'
import { sounds, getSoundById } from '@/data/sounds'
import { useAudio } from '@/composables/useAudio'

// 音频引擎实例（引擎状态非响应式，不进入 Store；Store 只镜像普通数据）
const engine = useAudio()

/**
 * 音频运行时状态 Store（Pinia）—— B 侧读取运行时状态的主要入口
 * 只存普通数据（布尔、字符串、数字、数组、对象），绝不存 AudioContext / AudioBuffer / AudioNode
 * 与引擎的状态同步两条路：
 * 1. 正向：actions 调引擎后同步自身 state
 * 2. 反向：引擎事件（自然结束/出错）经 setEngineCallbacks 回调写回 Store
 */
export const useAudioStore = defineStore('audio', {
  state: () => ({
    // AudioContext 是否已初始化（用户手势后由 ensureAudioReady 置 true）
    audioReady: false,
    // 当前模式：idle（空闲）/ player（播放器，切歌打断）/ mixer（混音，叠加共存）
    currentMode: 'idle',
    // 播放器模式下当前播放的 soundId
    playerSoundId: null,
    // 正在播放的 soundId 数组
    playingIds: [],
    // 音量表：soundId → 0-1
    volumes: {},
    // 音轨状态表：soundId → 'idle' | 'loading' | 'playing' | 'paused' | 'error'
    trackStates: {},
    // 错误信息表：soundId → 错误消息
    errors: {},
    // 正在加载的 soundId 集合（数组）
    loadingIds: [],
  }),

  getters: {
    /**
     * 判断某音效是否正在播放
     * @param {string} soundId 音效唯一标识
     * @returns {boolean} 是否正在播放
     */
    isPlaying: (state) => (soundId) => {
      return state.playingIds.includes(soundId)
    },

    /**
     * 判断某音效是否处于暂停（保留偏移等待续播）
     * @param {string} soundId 音效唯一标识
     * @returns {boolean} 是否暂停
     */
    isPaused: (state) => (soundId) => {
      return state.trackStates[soundId] === 'paused'
    },

    /**
     * 判断某音效是否正在加载
     * @param {string} soundId 音效唯一标识
     * @returns {boolean} 是否加载中
     */
    isLoading: (state) => (soundId) => {
      return state.loadingIds.includes(soundId)
    },

    /**
     * 获取音量（未设置时回退元数据 defaultVolume，再回退 0.8）
     * @param {string} soundId 音效唯一标识
     * @returns {number} 音量 0-1
     */
    getVolume: (state) => (soundId) => {
      if (soundId in state.volumes) {
        return state.volumes[soundId]
      }
      return getSoundById(soundId)?.defaultVolume ?? 0.8
    },

    /**
     * 获取音轨状态（未记录时视为 idle）
     * @param {string} soundId 音效唯一标识
     * @returns {string} 'idle' | 'loading' | 'playing' | 'paused' | 'error'
     */
    getTrackState: (state) => (soundId) => {
      return state.trackStates[soundId] ?? 'idle'
    },

    /**
     * 是否有任意音效在播放
     * @returns {boolean}
     */
    hasAnyPlaying: (state) => {
      return state.playingIds.length > 0
    },

    /**
     * 获取正在播放的 soundId 列表
     * @returns {string[]}
     */
    getPlayingIds: (state) => {
      return state.playingIds
    },
  },

  actions: {
    /**
     * 在用户手势里初始化或恢复 AudioContext（幂等，可重复调用）
     */
    async ensureAudioReady() {
      const state = engine.resumeAudioContext()
      if (state !== null) {
        this.audioReady = true
      }
    },

    /**
     * 静默预热音频：应用启动后提前 fetch + decode，避免用户点击时才冷解码
     * （大体积环境音冷解码可能耗时数秒，期间点击表现为无声/卡 loading）
     * 预热对 UI 状态透明：不写 trackStates/loadingIds，失败也静默（等用户点击时再重试）
     * @param {string[]} [soundIds] 指定要预热的音效 id；缺省预热 sounds.js 全部（引擎按 url 去重）
     */
    async preload(soundIds) {
      // 预热所需的解码可在 suspended 的 AudioContext 上进行（无需用户手势）
      engine.ensureAudioContext()
      const ids = soundIds && soundIds.length ? soundIds : sounds.map((s) => s.id)
      // allSettled：单个失败不影响其他，失败的等用户点击时在播放链路中重新加载
      await Promise.allSettled(ids.map((id) => engine.loadSound(id)))
    },

    /**
     * 播放器模式播放：切歌打断其他音效，同时只有一个在播
     * @param {string} soundId 音效唯一标识
     */
    async play(soundId) {
      await this.ensureAudioReady()
      // 播放器模式：打断其他（引擎内部 stopAllExcept），Store 同步清掉其他音效的播放态
      this.currentMode = 'player'
      this.playerSoundId = soundId
      this.playingIds
        .filter((id) => id !== soundId)
        .forEach((id) => this.setTrackStopped(id))
      // 标记加载并调引擎
      this.setTrackLoading(soundId)
      try {
        await engine.play(soundId)
        this.setTrackPlaying(soundId)
      } catch (err) {
        this.setTrackError(soundId, err)
      }
    },

    /**
     * 混音模式播放：叠加不打断；已在播的跳过
     * @param {string[]} soundIds 音效唯一标识数组
     */
    async playMultiple(soundIds) {
      await this.ensureAudioReady()
      this.currentMode = 'mixer'
      this.playerSoundId = null
      // 未在播的先标加载（引擎 playMultiple 会跳过已在播的）
      soundIds.filter((id) => !this.isPlaying(id)).forEach((id) => this.setTrackLoading(id))
      // 引擎内部逐轨处理，失败轨道经 onTrackError 回调标记，这里无需整体 catch
      await engine.playMultiple(soundIds)
      // 成功启动的轨道统一标 playing（跳过已失败的 error 轨道）
      soundIds.forEach((id) => {
        if (this.getTrackState(id) !== 'error' && engine.isPlaying(id)) {
          this.setTrackPlaying(id)
        }
      })
    },

    /**
     * 暂停指定音效（保留偏移，等待 resume 续播）
     * @param {string} soundId 音效唯一标识
     */
    pause(soundId) {
      engine.pause(soundId)
      this.setTrackPaused(soundId)
    },

    /**
     * 继续播放指定音效（从暂停偏移重建 source）
     * @param {string} soundId 音效唯一标识
     */
    resume(soundId) {
      const ok = engine.resume(soundId)
      if (ok) {
        this.setTrackPlaying(soundId)
      }
    },

    /**
     * 停止指定音效（偏移归零，需重新 play 从头播）
     * @param {string} soundId 音效唯一标识
     */
    stop(soundId) {
      engine.stop(soundId)
      this.setTrackStopped(soundId)
    },

    /**
     * 停止全部音效并复位模式
     */
    stopAll() {
      engine.stopAll()
      // 引擎已全部停止，同步清掉所有播放/加载态
      this.playingIds.forEach((id) => this.setTrackStopped(id))
      this.loadingIds.forEach((id) => this.setTrackStopped(id))
      this.currentMode = 'idle'
      this.playerSoundId = null
    },

    /**
     * 设置音量：接收 0-1，clamp 后更新 volumes 并调引擎平滑作用于 GainNode
     * @param {string} soundId 音效唯一标识
     * @param {number} value 音量 0-1
     */
    setVolume(soundId, value) {
      const v = Math.min(1, Math.max(0, value))
      this.volumes[soundId] = v
      engine.setVolume(soundId, v)
    },

    /**
     * 标记音轨进入加载中
     * @param {string} soundId 音效唯一标识
     */
    setTrackLoading(soundId) {
      this.trackStates[soundId] = 'loading'
      if (!this.loadingIds.includes(soundId)) {
        this.loadingIds.push(soundId)
      }
    },

    /**
     * 标记音轨进入播放中
     * @param {string} soundId 音效唯一标识
     */
    setTrackPlaying(soundId) {
      this.trackStates[soundId] = 'playing'
      if (!this.playingIds.includes(soundId)) {
        this.playingIds.push(soundId)
      }
      this.loadingIds = this.loadingIds.filter((id) => id !== soundId)
    },

    /**
     * 标记音轨进入暂停
     * @param {string} soundId 音效唯一标识
     */
    setTrackPaused(soundId) {
      this.trackStates[soundId] = 'paused'
      this.playingIds = this.playingIds.filter((id) => id !== soundId)
      this.loadingIds = this.loadingIds.filter((id) => id !== soundId)
    },

    /**
     * 标记音轨回到空闲（主动停止）
     * @param {string} soundId 音效唯一标识
     */
    setTrackStopped(soundId) {
      this.trackStates[soundId] = 'idle'
      this.playingIds = this.playingIds.filter((id) => id !== soundId)
      this.loadingIds = this.loadingIds.filter((id) => id !== soundId)
    },

    /**
     * 标记音轨出错
     * @param {string} soundId 音效唯一标识
     * @param {unknown} error 错误对象或消息
     */
    setTrackError(soundId, error) {
      this.trackStates[soundId] = 'error'
      this.errors[soundId] = error instanceof Error ? error.message : String(error)
      this.playingIds = this.playingIds.filter((id) => id !== soundId)
      this.loadingIds = this.loadingIds.filter((id) => id !== soundId)
    },

    /**
     * 非循环音效自然结束时由引擎回调调用：移出 playingIds、状态回 idle
     * @param {string} soundId 音效唯一标识
     */
    syncTrackEnded(soundId) {
      this.setTrackStopped(soundId)
    },

    /**
     * 复位运行时状态：停止全部播放、清空各状态表（保留 audioReady，Context 已创建无需重建）
     */
    reset() {
      engine.stopAll()
      this.currentMode = 'idle'
      this.playerSoundId = null
      this.playingIds = []
      this.loadingIds = []
      this.trackStates = {}
      this.errors = {}
      this.volumes = {}
    },
  },
})

// 引擎事件回调注册：引擎自然结束/出错时写回 Store（运行时触发，此时 Pinia 已激活）
// 回调内部才调用 useAudioStore()，避免模块加载期触发（那时可能尚无活动 Pinia 实例）
engine.setEngineCallbacks({
  // 非循环音效自然结束：状态回 idle 并移出播放列表
  onTrackEnded: (soundId) => {
    useAudioStore().syncTrackEnded(soundId)
  },
  // 加载或播放出错：标记 error 并记录消息
  onTrackError: (soundId, error) => {
    useAudioStore().setTrackError(soundId, error)
  },
})
