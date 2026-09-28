// 音频引擎模块：基于 Web Audio API 的模块级单例，负责 AudioContext 管理、
// 音频加载解码缓存（以 soundId 为 key）、多音轨（音轨 Map）生命周期与音量控制
// 引擎只负责真实发声，不 import 任何 Store；与 Store 的状态同步通过 setEngineCallbacks 注册回调完成
// 音效元数据（url/loop/默认音量）唯一来源是 sounds.js，引擎按 soundId 查表，不写死业务路径
import { getSoundById } from '@/data/sounds'

/**
 * 音轨信息：每个 soundId 一条音轨，包含发声链路与播放状态
 * @property soundId 音效唯一标识
 * @property gainNode 该音轨独立音量节点（多轨并存时各接各的 GainNode）
 * @property source 当前正在使用的 BufferSourceNode（一次性节点，暂停/停止后置 null）
 * @property volume 当前音量 0-1
 * @property isPlaying 是否正在发声
 * @property isPaused 是否处于暂停（保留 offset 等待续播）
 * @property offset 暂停时保存的播放偏移（秒）
 * @property loop 是否循环播放（来自 sounds.js 元数据）
 * @property startedAt 本次启动时的 AudioContext.currentTime，用于计算进度
 * @property connected GainNode 是否已连接 destination
 */
interface Track {
  soundId: string
  gainNode: GainNode
  source: AudioBufferSourceNode | null
  volume: number
  isPlaying: boolean
  isPaused: boolean
  offset: number
  loop: boolean
  startedAt: number
  connected: boolean
}

/**
 * 引擎对外的事件回调（由 Store 注册，避免引擎直接 import Store 造成循环依赖）
 * @property onTrackEnded 非循环音效自然结束时触发
 * @property onTrackError 音效加载或播放出错时触发
 */
interface EngineCallbacks {
  onTrackEnded: (soundId: string) => void
  onTrackError: (soundId: string, error: unknown) => void
}

// ===== 模块级单例状态（非响应式，不进入任何 Store） =====

// 单例 AudioContext：实际实例挂在 globalThis 上防 HMR 丢失，模块级变量仅作缓存指针
let audioContext: AudioContext | null = null

// 音频缓冲缓存：key 是 soundId（任务口径）；同一音效重复加载直接命中
const bufferCache = new Map<string, AudioBuffer>()

// 内部按 url 的二级缓存：thunder 与 rain 共用 Rain.mp3 时避免同文件重复 fetch 与解码
const urlBufferCache = new Map<string, AudioBuffer>()

// url 级加载中去重：同一文件并发加载只发一个请求
const urlInflight = new Map<string, Promise<AudioBuffer>>()

// 音轨 Map：key 是 soundId，管理每条音轨的 GainNode 与播放状态
const tracks = new Map<string, Track>()

// source 到 soundId 的反向映射：onended 触发时据此找到所属音轨
const sourceToSound = new Map<AudioBufferSourceNode, string>()

// 引擎事件回调（默认空实现，由 Store 通过 setEngineCallbacks 注册）
let engineCallbacks: EngineCallbacks = {
  onTrackEnded: () => {},
  onTrackError: () => {},
}

// 音量平滑过渡时间常数（秒）：拖动滑块/切换音量时避免爆音
const VOLUME_SMOOTHING = 0.03

// ===== 音频上下文相关 =====

/**
 * 创建或恢复 AudioContext（必须在用户手势中调用）
 * 惰性创建：首次调用才 new；已创建则直接复用
 * @returns 返回单例 AudioContext；非浏览器环境返回 null
 */
function ensureAudioContext(): AudioContext | null {
  // SSR 或非浏览器环境：没有 window 时直接返回 null
  if (typeof window === 'undefined') {
    return null
  }
  const g = globalThis as any
  // HMR 后模块变量丢失，但 globalThis 上的实例仍保留，直接复用
  if (g.__audioContext) {
    audioContext = g.__audioContext as AudioContext
    return audioContext
  }
  if (audioContext) {
    return audioContext
  }
  // 兼容不同浏览器的 AudioContext 前缀
  const Ctor: typeof AudioContext | undefined =
    window.AudioContext || (window as any).webkitAudioContext
  if (!Ctor) {
    return null
  }
  // 懒创建并同步挂到 globalThis，保证单例唯一
  audioContext = new Ctor()
  g.__audioContext = audioContext
  return audioContext
}

/**
 * 若 AudioContext 处于 suspended 则恢复（浏览器自动播放策略要求用户手势后 resume）
 * @returns 返回恢复后的状态；非浏览器环境返回 null
 */
async function resumeAudioContext(): Promise<AudioContextState | null> {
  const ctx = ensureAudioContext()
  if (!ctx) {
    return null
  }
  if (ctx.state === 'suspended') {
    await ctx.resume()
  }
  return ctx.state
}

/**
 * 获取单例 AudioContext（不创建）
 * @returns 返回已存在的 AudioContext 或 null
 */
function getAudioContext(): AudioContext | null {
  return audioContext ?? (globalThis as any).__audioContext ?? null
}

/**
 * 彻底销毁 AudioContext（App 卸载时才调用）
 * 停止所有音轨、清理缓存、关闭上下文并解除 globalThis 引用
 */
async function disposeAudioContext(): Promise<void> {
  disposeAll()
  const ctx = audioContext ?? (globalThis as any).__audioContext
  if (ctx) {
    try {
      await ctx.close()
    } catch (_e) {
      // 已关闭或不可关闭，忽略
    }
  }
  audioContext = null
  delete (globalThis as any).__audioContext
  bufferCache.clear()
  urlBufferCache.clear()
  urlInflight.clear()
}

// ===== 加载相关 =====

/**
 * 获取音效元数据（sounds.js 唯一来源）
 * @param soundId 音效唯一标识
 * @returns 返回元数据对象；查不到返回 undefined
 */
function getSoundMeta(soundId: string) {
  return getSoundById(soundId)
}

/**
 * 加载音效：带 soundId/url 两级缓存查表；未命中才走 loadBuffer 实际请求
 * @param soundId 音效唯一标识
 * @returns 返回解码后的 AudioBuffer
 */
async function loadSound(soundId: string): Promise<AudioBuffer> {
  // 一级缓存：soundId 直接命中
  if (bufferCache.has(soundId)) {
    return bufferCache.get(soundId) as AudioBuffer
  }
  const meta = getSoundMeta(soundId)
  if (!meta || !meta.url) {
    throw new Error(`sounds.js 中不存在音效 ${soundId} 或缺少 url`)
  }
  // 二级缓存：同文件已被其他音效加载过，直接复用（如 thunder 共用 rain 的 Rain.mp3）
  if (urlBufferCache.has(meta.url)) {
    const buf = urlBufferCache.get(meta.url) as AudioBuffer
    bufferCache.set(soundId, buf)
    return buf
  }
  // 未命中：实际加载（loadBuffer 内部做 url 级并发去重）
  return loadBuffer(soundId)
}

/**
 * 真正执行 fetch + decodeAudioData（统一为 Promise，兼容老版 Safari 回调式实现）
 * 加载成功后同时写入 soundId 缓存与 url 缓存
 * @param soundId 音效唯一标识
 * @returns 返回解码后的 AudioBuffer
 */
async function loadBuffer(soundId: string): Promise<AudioBuffer> {
  const meta = getSoundMeta(soundId)
  if (!meta || !meta.url) {
    throw new Error(`sounds.js 中不存在音效 ${soundId} 或缺少 url`)
  }
  const url = meta.url as string
  // url 级并发去重：同一文件同时多次请求只发一个 fetch
  if (urlInflight.has(url)) {
    const buf = await (urlInflight.get(url) as Promise<AudioBuffer>)
    bufferCache.set(soundId, buf)
    return buf
  }

  // 实际加载闭包（挂到 inflight 实现去重）
  const task = (async () => {
    const ctx = ensureAudioContext()
    if (!ctx) {
      throw new Error('当前环境不支持 Web Audio API，无法加载音频')
    }
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`音频加载失败: ${response.status} ${response.statusText}`)
    }
    const arrayBuffer = await response.arrayBuffer()
    return decodeAudioDataCompat(ctx, arrayBuffer)
  })()

  urlInflight.set(url, task)
  try {
    const buf = await task
    // 双写缓存：soundId 级（任务口径）与 url 级（同文件去重）
    bufferCache.set(soundId, buf)
    urlBufferCache.set(url, buf)
    return buf
  } finally {
    // 无论成败都清理 inflight，失败可重试
    urlInflight.delete(url)
  }
}

/**
 * 兼容回调式与 Promise 式的 decodeAudioData 包装
 * 现代浏览器支持 Promise 形式，老版本 Safari 仅支持回调形式，统一包装为 Promise
 * @param ctx AudioContext 实例
 * @param arrayBuffer 待解码的 ArrayBuffer
 * @returns 返回解码后的 AudioBuffer
 */
function decodeAudioDataCompat(
  ctx: AudioContext,
  arrayBuffer: ArrayBuffer
): Promise<AudioBuffer> {
  // 优先 Promise 形式
  try {
    const ret = ctx.decodeAudioData(arrayBuffer)
    if (ret && typeof (ret as any).then === 'function') {
      return ret as Promise<AudioBuffer>
    }
  } catch (_e) {
    // 抛 TypeError 说明仅支持回调形式，走兜底
  }
  // 回调形式兜底（老版本 Safari）
  return new Promise<AudioBuffer>((resolve, reject) => {
    ;(ctx as any).decodeAudioData(
      arrayBuffer,
      (buffer: AudioBuffer) => resolve(buffer),
      (err: any) => reject(err || new Error('decodeAudioData 解码失败'))
    )
  })
}

/**
 * 取缓冲：优先缓存，没有就加载（对调用方屏蔽缓存细节）
 * @param soundId 音效唯一标识
 * @returns 返回 AudioBuffer
 */
async function getBuffer(soundId: string): Promise<AudioBuffer> {
  return loadSound(soundId)
}

/**
 * 查询某音效是否正在加载中
 * @param soundId 音效唯一标识
 * @returns 返回是否加载中
 */
function isLoading(soundId: string): boolean {
  const meta = getSoundMeta(soundId)
  return !!meta && !!meta.url && urlInflight.has(meta.url as string)
}

// ===== 音轨相关 =====

/**
 * 创建或复用音轨（包含独立 GainNode）
 * 音量初始化为元数据 defaultVolume（默认 0.8）
 * @param soundId 音效唯一标识
 * @returns 返回音轨对象
 */
function getOrCreateTrack(soundId: string): Track {
  const existing = tracks.get(soundId)
  if (existing) {
    return existing
  }
  const ctx = ensureAudioContext()
  if (!ctx) {
    throw new Error('当前环境不支持 Web Audio API，无法创建音轨')
  }
  const meta = getSoundMeta(soundId)
  // 创建独立 GainNode（此时不连接 destination，连接延迟到 startTrack）
  const gainNode = ctx.createGain()
  const volume = Math.min(1, Math.max(0, (meta && meta.defaultVolume) ?? 0.8))
  gainNode.gain.value = volume
  const track: Track = {
    soundId,
    gainNode,
    source: null,
    volume,
    isPlaying: false,
    isPaused: false,
    offset: 0,
    loop: meta ? meta.loop !== false : true,
    startedAt: 0,
    connected: false,
  }
  tracks.set(soundId, track)
  return track
}

/**
 * 创建新的 AudioBufferSourceNode（一次性节点，每次启动都要新建）
 * 只创建与设置 buffer/loop，不连接不启动
 * @param soundId 音效唯一标识
 * @param offset 起始偏移（秒），仅用于记录语义；实际 start 由 startTrack 传参
 * @returns 返回新建的 source；对应 buffer 未就绪时返回 null
 */
function createSource(soundId: string, offset: number): AudioBufferSourceNode | null {
  const ctx = getAudioContext()
  const buffer = bufferCache.get(soundId)
  if (!ctx || !buffer) {
    return null
  }
  const track = tracks.get(soundId)
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.loop = track ? track.loop : true
  // 记录反向映射：onended 触发时据此找到音轨
  sourceToSound.set(source, soundId)
  return source
}

/**
 * 连接音轨链路：source → 该音轨 GainNode → destination
 * GainNode 与 destination 的连接幂等（connected 标志防重复）
 * @param soundId 音效唯一标识
 */
function connectTrack(soundId: string): void {
  const track = tracks.get(soundId)
  const ctx = getAudioContext()
  if (!track || !ctx || !track.source) {
    return
  }
  // source → GainNode
  track.source.connect(track.gainNode)
  // GainNode → destination（只连一次）
  if (!track.connected) {
    track.gainNode.connect(ctx.destination)
    track.connected = true
  }
}

/**
 * 启动音轨播放（内部会创建并连接新 source）
 * 循环音效的 offset 先按 duration 取模，避免越界
 * @param soundId 音效唯一标识
 * @param offset 起始偏移（秒）
 */
function startTrack(soundId: string, offset: number): void {
  const track = tracks.get(soundId)
  const ctx = getAudioContext()
  if (!track || !ctx) {
    return
  }
  // 重复启动保护：先停旧 source，避免叠加多个 source 出叠音
  if (track.source) {
    stopSourceQuietly(track)
  }
  // 循环音效 offset 取模（buffer 未就绪时跳过）
  const buffer = bufferCache.get(soundId)
  let startOffset = offset
  if (buffer && track.loop && buffer.duration > 0) {
    startOffset = offset % buffer.duration
  }
  // 创建并连接新 source
  const source = createSource(soundId, startOffset)
  if (!source) {
    engineCallbacks.onTrackError(soundId, new Error(`音效 ${soundId} 的音频数据未就绪`))
    return
  }
  track.source = source
  connectTrack(soundId)
  // 注册自然结束回调：非循环音效播完自动清理并通知 Store
  source.onended = () => {
    // 通过反向映射找到音轨；闭包内比对当前 source，主动 stop/pause 的不进入此分支
    const sid = sourceToSound.get(source)
    sourceToSound.delete(source)
    const t = sid ? tracks.get(sid) : undefined
    if (!t || t.source !== source) {
      return
    }
    // 循环音效不会自然结束（loop=true 时 onended 仅在主动 stop 触发）
    if (t.loop) {
      return
    }
    // 非循环自然结束：清理状态并通知 Store
    t.source = null
    t.isPlaying = false
    t.isPaused = false
    t.offset = 0
    cleanupTrack(sid)
    engineCallbacks.onTrackEnded(sid)
  }
  // 从指定偏移启动（第一个参数 when=0 立即，第二个 offset）
  source.start(0, startOffset)
  // 记录播放状态
  track.isPlaying = true
  track.isPaused = false
  track.offset = startOffset
  track.startedAt = ctx.currentTime
}

/**
 * 安静地停止并断开当前 source（不抛错、不触发自然结束分支）
 * @param track 目标音轨
 */
function stopSourceQuietly(track: Track): void {
  const s = track.source
  if (!s) {
    return
  }
  // 先从反向映射移除并置空 source，onended 里比对失败即自动跳过
  sourceToSound.delete(s)
  track.source = null
  try {
    s.stop()
  } catch (_e) {
    // 已停止或未启动，忽略
  }
  try {
    s.disconnect()
  } catch (_e) {
    // 忽略
  }
}

/**
 * 停止音轨：停止 source、保留 GainNode、偏移归零、状态复位
 * @param soundId 音效唯一标识
 */
function stopTrack(soundId: string): void {
  const track = tracks.get(soundId)
  if (!track) {
    return
  }
  stopSourceQuietly(track)
  track.isPlaying = false
  track.isPaused = false
  track.offset = 0
}

/**
 * 暂停音轨：计算当前偏移（循环按 duration 取模）、停止 source、保留 GainNode 与音量
 * BufferSourceNode 是一次性节点，此处只 stop 不复用，续播由 resumeTrack 重建 source
 * @param soundId 音效唯一标识
 */
function pauseTrack(soundId: string): void {
  const track = tracks.get(soundId)
  const ctx = getAudioContext()
  if (!track || !track.isPlaying) {
    return
  }
  // 计算当前播放进度：起始偏移 + 已播放时长（循环按 duration 取模）
  if (ctx) {
    const elapsed = ctx.currentTime - track.startedAt
    const total = track.offset + elapsed
    const buffer = bufferCache.get(soundId)
    track.offset =
      buffer && track.loop && buffer.duration > 0 ? total % buffer.duration : total
  }
  stopSourceQuietly(track)
  track.isPlaying = false
  track.isPaused = true
  // GainNode 保留（音量设置不丢失），resume 时复用
}

/**
 * 继续音轨：用保存的 offset 重新创建 source 并播放（原 source 已在暂停时销毁）
 * @param soundId 音效唯一标识
 */
function resumeTrack(soundId: string): void {
  const track = tracks.get(soundId)
  if (!track || !track.isPaused) {
    return
  }
  // 重建 source 从保存的偏移继续
  startTrack(soundId, track.offset)
}

/**
 * 清理音轨：断开 GainNode 并从音轨 Map 移除（音量设置随之丢弃）
 * 非循环音效自然结束时调用；下次播放 getOrCreateTrack 会重建
 * @param soundId 音效唯一标识
 */
function cleanupTrack(soundId: string): void {
  const track = tracks.get(soundId)
  if (!track) {
    return
  }
  stopSourceQuietly(track)
  try {
    track.gainNode.disconnect()
  } catch (_e) {
    // 忽略
  }
  tracks.delete(soundId)
}

/**
 * 停止所有音轨并全部清理（App 卸载 / dispose 场景）
 */
function disposeAll(): void {
  for (const soundId of Array.from(tracks.keys())) {
    stopTrack(soundId)
    cleanupTrack(soundId)
  }
  tracks.clear()
  sourceToSound.clear()
}

// ===== 音量相关 =====

/**
 * 设置音量（对内实现）：clamp 到 0-1，写回音轨并平滑过渡 GainNode.gain
 * @param soundId 音效唯一标识
 * @param value 音量 0-1
 */
function setTrackVolume(soundId: string, value: number): void {
  const track = getOrCreateTrack(soundId)
  const v = Math.min(1, Math.max(0, value))
  track.volume = v
  const ctx = getAudioContext()
  if (!ctx) {
    return
  }
  // setTargetAtTime 平滑过渡（约 30ms 时间常数），避免拖动滑块时的爆音
  track.gainNode.gain.setTargetAtTime(v, ctx.currentTime, VOLUME_SMOOTHING)
}

/**
 * 设置音量（对外入口）：clamp 后更新音轨 GainNode
 * @param soundId 音效唯一标识
 * @param value 音量 0-1
 */
function setVolume(soundId: string, value: number): void {
  const meta = getSoundMeta(soundId)
  if (!meta) {
    return
  }
  setTrackVolume(soundId, value)
}

/**
 * 获取音量：音轨存在时返回当前音量，否则回退元数据默认值
 * @param soundId 音效唯一标识
 * @returns 返回音量 0-1
 */
function getVolume(soundId: string): number {
  const track = tracks.get(soundId)
  if (track) {
    return track.volume
  }
  const meta = getSoundMeta(soundId)
  return Math.min(1, Math.max(0, (meta && meta.defaultVolume) ?? 0.8))
}

// ===== 播放模式相关 =====

/**
 * 播放器模式播放：先打断其他音效（stopAllExcept），再从 0 启动目标
 * 切歌语义：同时只有一个音效在播
 * @param soundId 音效唯一标识
 */
async function play(soundId: string): Promise<void> {
  const ctx = ensureAudioContext()
  if (!ctx) {
    throw new Error('当前环境不支持 Web Audio API')
  }
  // 浏览器自动播放策略：用户手势后恢复
  if (ctx.state === 'suspended') {
    await ctx.resume()
  }
  // 播放器模式：打断其他正在播的音效
  stopAllExcept(soundId)
  // 目标音效已在播：先停再从 0 重播（重复点击不叠加 source）
  await startSound(soundId, 0)
}

/**
 * 内部通用启动：创建/复用音轨 → 确保缓冲 → 启动
 * @param soundId 音效唯一标识
 * @param offset 起始偏移（秒）
 */
async function startSound(soundId: string, offset: number): Promise<void> {
  const meta = getSoundMeta(soundId)
  if (!meta) {
    throw new Error(`sounds.js 中不存在音效 ${soundId}`)
  }
  const track = getOrCreateTrack(soundId)
  track.loop = meta.loop !== false
  // 同一音效已在播：先停旧 source，避免叠加
  if (track.isPlaying) {
    stopTrack(soundId)
  }
  // 确保缓冲就绪（命中缓存秒回，未命中 fetch+解码）
  await getBuffer(soundId)
  startTrack(soundId, offset)
}

/**
 * 混音模式播放：叠加多个音效互不打断
 * 已在播的音效跳过（不重启、不叠加 source），未播的加载并启动；加载并行且同 id 只加载一次
 * @param soundIds 音效唯一标识数组
 */
async function playMultiple(soundIds: string[]): Promise<void> {
  const ctx = ensureAudioContext()
  if (!ctx) {
    throw new Error('当前环境不支持 Web Audio API')
  }
  if (ctx.state === 'suspended') {
    await ctx.resume()
  }
  // 对每个音效独立处理，失败只影响自身（onTrackError 回调通知 Store）
  await Promise.all(
    soundIds.map(async (soundId) => {
      try {
        // 已在播则跳过（混音模式不重启）
        if (isPlaying(soundId)) {
          return
        }
        await startSound(soundId, 0)
      } catch (err) {
        engineCallbacks.onTrackError(soundId, err)
      }
    })
  )
}

/**
 * 停止指定音效（不保留偏移）
 * @param soundId 音效唯一标识
 */
function stop(soundId: string): void {
  stopTrack(soundId)
}

/**
 * 停止所有音效
 */
function stopAll(): void {
  for (const soundId of Array.from(tracks.keys())) {
    stopTrack(soundId)
  }
}

/**
 * 停止除指定音效外的所有音效（播放器模式切歌用）
 * @param soundId 保留播放的音效唯一标识
 */
function stopAllExcept(soundId: string): void {
  for (const id of Array.from(tracks.keys())) {
    if (id !== soundId) {
      stopTrack(id)
    }
  }
}

/**
 * 查询音效是否正在播放
 * @param soundId 音效唯一标识
 * @returns 返回是否正在播放
 */
function isPlaying(soundId: string): boolean {
  const track = tracks.get(soundId)
  return !!track && track.isPlaying
}

/**
 * 暂停指定音效（保留偏移与音量）
 * @param soundId 音效唯一标识
 */
function pause(soundId: string): void {
  pauseTrack(soundId)
}

/**
 * 继续播放指定音效（从暂停偏移重建 source）
 * @param soundId 音效唯一标识
 * @returns 返回是否成功继续
 */
function resume(soundId: string): boolean {
  const ctx = ensureAudioContext()
  const track = tracks.get(soundId)
  if (!ctx || !track || !track.isPaused) {
    return false
  }
  if (ctx.state === 'suspended') {
    ctx.resume()
  }
  resumeTrack(soundId)
  return true
}

// ===== 事件与状态同步 =====

/**
 * 注册引擎事件回调（由 Store 调用，避免引擎直接 import Store）
 * @param callbacks 含 onTrackEnded / onTrackError 的回调对象
 */
function setEngineCallbacks(callbacks: Partial<EngineCallbacks>): void {
  engineCallbacks = {
    onTrackEnded: callbacks.onTrackEnded ?? engineCallbacks.onTrackEnded,
    onTrackError: callbacks.onTrackError ?? engineCallbacks.onTrackError,
  }
}

/**
 * 音频引擎 composable（模块级单例：所有组件拿到的都是同一份引擎状态）
 * @returns 返回引擎对外接口集合
 */
export function useAudio() {
  return {
    // 音频上下文
    ensureAudioContext,
    resumeAudioContext,
    getAudioContext,
    disposeAudioContext,
    // 加载
    loadSound,
    loadBuffer,
    getBuffer,
    getSoundMeta,
    isLoading,
    // 播放模式
    play,
    playMultiple,
    pause,
    resume,
    stop,
    stopAll,
    stopAllExcept,
    isPlaying,
    // 音量
    setVolume,
    getVolume,
    // 事件
    setEngineCallbacks,
    // 销毁
    disposeAll,
  }
}
