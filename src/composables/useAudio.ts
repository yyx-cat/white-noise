// 音频引擎模块：基于 Web Audio API 封装单例 AudioContext、音频加载与播放/暂停
// 提供缓存机制避免重复解码，并为每个播放实例创建独立的 GainNode 以便后续控制音量

/**
 * 当前播放实例信息
 * @property source 当前播放使用的 BufferSourceNode
 * @property gainNode 该实例对应的 GainNode（用于后续控制音量）
 * @property buffer 该 id 对应的 AudioBuffer 引用，resume 时无需再查缓存
 * @property isPlaying 是否正在发声（true=播放中；false=已暂停但状态保留以供 resume）
 * @property offset 暂停时保存的播放偏移（秒），resume 时从此处继续播放
 * @property startTime 本次开始播放时的 AudioContext.currentTime，用于计算当前进度
 * @property cancelled 是否主动停止标记，用于区分 onended 自然结束与主动 stop/pause
 */
interface PlayingEntry {
  source: AudioBufferSourceNode
  gainNode: GainNode
  buffer: AudioBuffer
  isPlaying: boolean
  offset: number
  startTime: number
  cancelled: boolean
}

// 单例 AudioContext 引用：实际实例挂在 globalThis 上，模块级变量仅作为缓存指针
// 这样 Vite HMR 重新执行模块时变量虽被重置，但 globalThis 上的实例仍然保留，避免重复创建
let audioContext: AudioContext | null = null

// 音频缓冲缓存：以 url 作为 key，缓存解码后的 AudioBuffer，避免重复 fetch 与解码
const audioBufferCache = new Map<string, AudioBuffer>()

// 正在播放的实例缓存：以 url 作为 key，记录当前播放的 source 与 gainNode，便于暂停时清理
const playingMap = new Map<string, PlayingEntry>()

// 正在加载中的 Promise 缓存：以 url 作为 key，用于并发去重
// 同一 URL 同时被多次调用 loadSound 时，复用同一个 Promise，避免发出多个 fetch 请求
const inflightLoaders = new Map<string, Promise<AudioBuffer>>()

// 写死的本地测试音频路径（项目自带的 Rain.mp3，位于 public/audio/）
// 同源路径无 CORS 问题，控制台验证稳定；正式代码不应依赖此常量
const TEST_URL = '/audio/Rain.mp3'

/**
 * 获取单例 AudioContext
 * 浏览器要求 AudioContext 在用户交互后才能创建/恢复，因此此处使用懒创建
 * SSR 或非浏览器环境（无 window）时返回 null，避免模块加载或调用时直接崩掉
 * @returns 返回共享的 AudioContext 实例；非浏览器环境或浏览器不支持时返回 null
 */
function getAudioContext(): AudioContext | null {
  // SSR 或非浏览器环境：没有 window 时直接返回 null，避免访问 window 报错
  if (typeof window === 'undefined') {
    return null
  }
  // 借助 globalThis 保存单例：HMR 模块重载时旧模块级变量会丢失，但 globalThis 上的引用保留
  const g = globalThis as any
  if (g.__audioContext) {
    // 同步到模块级变量，便于后续直接读取
    audioContext = g.__audioContext as AudioContext
    return audioContext
  }
  // 若模块级已存在（同一次会话内首次调用后的快路径），直接返回
  if (audioContext) {
    return audioContext
  }
  // 兼容 webkit 前缀（老版本 Safari）
  const Ctor: typeof AudioContext | undefined =
    window.AudioContext || g.webkitAudioContext
  // 浏览器不支持 Web Audio API 时返回 null，调用方应处理
  if (!Ctor) {
    return null
  }
  // 懒创建：第一次真正需要播放或解码时才 new AudioContext()
  audioContext = new Ctor()
  // 同步挂到 globalThis，保证 HMR 后单例不丢
  g.__audioContext = audioContext
  return audioContext
}

/**
 * 兼容回调式与 Promise 式的 decodeAudioData 包装
 * 现代浏览器支持 Promise 形式，老版本 Safari 仅支持回调形式，此处统一包装为 Promise
 * @param ctx AudioContext 实例
 * @param arrayBuffer 待解码的 ArrayBuffer
 * @returns 返回解码后的 AudioBuffer
 */
function decodeAudioDataCompat(
  ctx: AudioContext,
  arrayBuffer: ArrayBuffer
): Promise<AudioBuffer> {
  // 优先使用 Promise 形式（现代浏览器）
  try {
    const ret = ctx.decodeAudioData(arrayBuffer)
    // 若返回值是 Promise 则直接使用
    if (ret && typeof (ret as any).then === 'function') {
      return ret as Promise<AudioBuffer>
    }
  } catch (_e) {
    // 抛 TypeError 说明该实现只支持回调形式，走下面的回调兜底
  }
  // 回调形式兜底（老版本 Safari 等仅支持回调的浏览器）
  return new Promise<AudioBuffer>((resolve, reject) => {
    ;(ctx as any).decodeAudioData(
      arrayBuffer,
      (buffer: AudioBuffer) => resolve(buffer),
      (err: any) => reject(err || new Error('decodeAudioData 解码失败'))
    )
  })
}

/**
 * 加载音频文件并解码为 AudioBuffer
 * 加载完成后会缓存到 Map 中，相同 url 不会重复请求
 * @param url 音频文件的 URL（同时作为缓存 key 与播放 id）
 * @returns 返回解码后的 AudioBuffer
 */
async function loadSound(url: string): Promise<AudioBuffer> {
  // 命中缓存则直接返回，避免重复网络请求与解码
  if (audioBufferCache.has(url)) {
    return audioBufferCache.get(url) as AudioBuffer
  }
  // 命中正在加载中的 Promise（同一 URL 并发调用），复用同一请求避免重复 fetch
  if (inflightLoaders.has(url)) {
    return inflightLoaders.get(url) as Promise<AudioBuffer>
  }

  // 实际加载逻辑（独立闭包，便于挂到 inflightLoaders 做并发去重）
  const task = (async () => {
    const ctx = getAudioContext()
    // 非浏览器环境或不支持 Web Audio API：抛出友好错误，避免直接崩掉调用方
    if (!ctx) {
      throw new Error('当前环境不支持 Web Audio API，无法加载音频')
    }
    // 通过 fetch 获取音频二进制数据
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`音频加载失败: ${response.status} ${response.statusText}`)
    }
    // 转为 ArrayBuffer 供解码使用
    const arrayBuffer = await response.arrayBuffer()
    // 解码音频数据为 AudioBuffer（部分浏览器需要回调形式，此处使用 Promise 形式）
    const audioBuffer = await decodeAudioDataCompat(ctx, arrayBuffer)
    // 存入缓存
    audioBufferCache.set(url, audioBuffer)
    return audioBuffer
  })()

  // 挂到 inflightLoaders，使并发调用复用同一个 Promise
  inflightLoaders.set(url, task)
  try {
    return await task
  } finally {
    // 加载结束（无论成功失败）都清理 inflight，让失败的请求可被重试
    inflightLoaders.delete(url)
  }
}

/**
 * 计算指定 id 当前的播放进度偏移（秒）
 * 综合起始 offset 与已播放时长，并对循环场景取模
 * @param url 音频 URL（作为 id）
 * @param ctx 当前 AudioContext 实例
 * @returns 返回当前应保存的播放偏移；不在播放时返回 entry.offset
 */
function computeCurrentOffset(url: string, ctx: AudioContext): number {
  const entry = playingMap.get(url)
  if (!entry) {
    return 0
  }
  // 若不在播放，直接返回已保存偏移
  if (!entry.isPlaying) {
    return entry.offset
  }
  // 已播放时长 = 当前上下文时间 - 本次起始时间
  const elapsed = ctx.currentTime - entry.startTime
  // 累计偏移 = 起始偏移 + 已播放时长
  const total = entry.offset + elapsed
  const duration = entry.buffer.duration
  // 循环场景对 duration 取模；非循环场景（duration=0 时不取模）
  return duration > 0 ? total % duration : total
}

/**
 * 创建一个新的 BufferSourceNode 并从指定偏移开始播放
 * 关键点：BufferSourceNode 一次性，每次 resume 都要重建此节点
 * @param url 音频 URL（作为 id）
 * @param ctx 当前 AudioContext 实例
 * @param buffer 待播放的 AudioBuffer
 * @param offset 起始播放偏移（秒），从该位置继续播放
 * @param gainNode 已有的 GainNode（保留以维持音量设置），若未提供则创建新的
 */
function startSource(
  url: string,
  ctx: AudioContext,
  buffer: AudioBuffer,
  offset: number,
  gainNode?: GainNode
): void {
  // 创建 BufferSourceNode 用于播放 AudioBuffer
  const source = ctx.createBufferSource()
  source.buffer = buffer
  // 循环播放，适合白噪音场景
  source.loop = true

  // 复用传入的 GainNode 或创建新的（默认音量 1）
  const gain = gainNode ?? ctx.createGain()
  // 连接链路：source -> gainNode -> destination
  source.connect(gain)
  if (!gainNode) {
    gain.connect(ctx.destination)
  }

  // 注册自然结束回调：区分主动 stop（cancelled=true）与自然结束
  source.onended = () => {
    const entry = playingMap.get(url)
    // 若已被主动取消（pause/stop 触发），不处理自然结束逻辑
    if (!entry || entry.cancelled) {
      return
    }
    // 自然结束：清理状态、偏移归零
    entry.isPlaying = false
    entry.offset = 0
    // 释放 source 节点引用（避免内存泄漏）
    entry.source.disconnect()
  }

  // 从 offset 开始播放（第一个参数为 when，第二个为 offset）
  source.start(0, offset)

  // 写入或更新 playingMap 中的 entry
  const existing = playingMap.get(url)
  if (existing) {
    // resume/play 场景：复用 entry，更新 source、gain、时间戳、状态
    existing.source = source
    existing.gainNode = gain
    existing.isPlaying = true
    existing.offset = offset
    existing.startTime = ctx.currentTime
    existing.cancelled = false
  } else {
    // 全新播放场景：新建 entry
    playingMap.set(url, {
      source,
      gainNode: gain,
      buffer,
      isPlaying: true,
      offset,
      startTime: ctx.currentTime,
      cancelled: false,
    })
  }
}

/**
 * 彻底清理指定 id 的播放实例（停止节点、断开连接、从 playingMap 移除）
 * 与 pause 的区别：stop 不保留状态，偏移与节点全部清理，再次播放需重新 play
 * @param url 音频 URL（作为 id）
 */
function stopInternal(url: string): void {
  const entry = playingMap.get(url)
  if (!entry) {
    return
  }
  // 标记主动取消，防止 onended 误触自然结束分支
  entry.cancelled = true
  // 停止播放，try/catch 防止重复停止抛错
  try {
    entry.source.stop()
  } catch (_e) {
    // 已停止或尚未播放，忽略错误
  }
  // 断开节点连接，释放资源
  entry.source.disconnect()
  entry.gainNode.disconnect()
  // 从播放缓存中移除
  playingMap.delete(url)
}

/**
 * 播放指定音频（兼任首次播放与从暂停处继续播放）
 * 行为分支：
 * - id 未加载：调用 loadSound 加载（未缓存会 fetch），然后从 0 开始播放
 * - 已在播放：先彻底停止旧实例，再从 0 重新播放，避免多个 source 叠加
 * - 之前暂停过（entry 存在且 isPlaying=false）：从保存的偏移量继续播放，复用 buffer 与 gainNode
 * - 第一次播放：从 0 开始
 * @param url 音频文件 URL（同时作为 id 标识该播放实例）
 * @returns 返回是否成功开始播放
 */
async function play(url: string): Promise<boolean> {
  const ctx = getAudioContext()
  // 非浏览器环境或不支持 Web Audio API：直接返回 false，避免直接崩掉调用方
  if (!ctx) {
    return false
  }
  // 浏览器策略：用户交互前 AudioContext 可能处于 suspended 状态，播放前需恢复
  // 控制台验证时请先点击一下页面再调用 play，否则可能因自动播放策略没声音
  if (ctx.state === 'suspended') {
    await ctx.resume()
  }

  // 检查已有状态，按分支决定播放策略
  const existing = playingMap.get(url)
  if (existing) {
    if (existing.isPlaying) {
      // 已在播放：先彻底停止再从 0 重新播，避免叠加多个 source
      stopInternal(url)
      // 加载（命中缓存则直接返回）音频数据
      const buffer = await loadSound(url)
      // 从 0 偏移开始全新播放
      startSource(url, ctx, buffer, 0)
      return true
    }
    // 之前暂停过：从保存的偏移量继续播放，复用 buffer 与 gainNode（不重新 fetch）
    startSource(url, ctx, existing.buffer, existing.offset, existing.gainNode)
    return true
  }

  // 第一次播放：调用 loadSound 加载（未缓存会 fetch，已缓存秒回）
  const buffer = await loadSound(url)
  // 从 0 偏移开始全新播放
  startSource(url, ctx, buffer, 0)
  return true
}

/**
 * 暂停指定音频（保留状态以供 resume 继续）
 * 由于 BufferSourceNode 是一次性资源，停止后不可再次 start，所以暂停时：
 * 1. 计算当前播放到的时间偏移并保存
 * 2. 标记 cancelled 并停止当前 source（释放一次性节点）
 * 3. 状态保留在 playingMap，isPlaying=false，等待 resume 重建 source 继续
 * @param url 音频文件 URL（作为 id）
 */
function pause(url: string): void {
  const entry = playingMap.get(url)
  // 无实例或本就不在播放，直接返回
  if (!entry || !entry.isPlaying) {
    return
  }
  const ctx = getAudioContext()
  // ctx 理论上必存在（能播放说明已创建），但为类型安全做兜底
  if (!ctx) {
    return
  }
  // 计算当前播放进度作为下次 resume 的起点
  const offset = computeCurrentOffset(url, ctx)
  // 标记主动取消，防止 onended 触发自然结束分支
  entry.cancelled = true
  // 停止并断开一次性 BufferSourceNode
  try {
    entry.source.stop()
  } catch (_e) {
    // 已停止或尚未播放，忽略错误
  }
  entry.source.disconnect()
  // 注意：gainNode 不在此处断开，resume 时复用以保持音量设置
  // 更新状态：暂停但保留 entry，记录下次起点
  entry.isPlaying = false
  entry.offset = offset
}

/**
 * 继续播放指定音频（从 pause 保存的偏移处重建 BufferSourceNode）
 * 由于原 source 已在 pause 时被 stop，此处必须重新 createBufferSource
 * @param url 音频文件 URL（作为 id）
 * @returns 返回是否成功继续播放
 */
function resume(url: string): boolean {
  const entry = playingMap.get(url)
  // 无实例或本就在播放，无需 resume
  if (!entry || entry.isPlaying) {
    return false
  }
  const ctx = getAudioContext()
  if (!ctx) {
    return false
  }
  // 浏览器策略：用户交互前 AudioContext 可能处于 suspended 状态，继续前需恢复
  if (ctx.state === 'suspended') {
    // resume 可能异步，但不阻塞本次重建（source.start 会按调度执行）
    ctx.resume()
  }
  // 复用 entry 对应的 buffer 和 gainNode，从保存的偏移重建 source 继续
  startSource(url, ctx, entry.buffer, entry.offset, entry.gainNode)
  return true
}

/**
 * 彻底停止指定音频（不保留状态）
 * 与 pause 的区别：清理 entry、偏移归零，再次播放需重新 play 而非 resume
 * @param url 音频文件 URL（作为 id）
 */
function stop(url: string): void {
  stopInternal(url)
}

/**
 * 音频引擎 composable
 * 对外暴露 loadSound / play / pause / resume / stop 与 getAudioContext
 * 同时暴露 TEST_URL 便于开发期控制台验证；正式业务代码不应依赖 TEST_URL
 * 注意：不再把接口挂到 window 上，避免长期污染全局；控制台验证请用 Vite 动态 import
 * @returns 返回音频引擎对外接口
 */
export function useAudio() {
  return {
    loadSound,
    play,
    pause,
    resume,
    stop,
    getAudioContext,
    TEST_URL,
  }
}
