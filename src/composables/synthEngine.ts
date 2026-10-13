// 合成引擎：用 OfflineAudioContext 程序化渲染环境音 AudioBuffer
// 每个音效按配置生成独特的循环 buffer，替代外部 mp3 文件
// 渲染结果按 soundId 缓存，重复播放不重新渲染
//
// 合成图：噪声源(或振荡器) → 滤波器链 → 振幅调制(可选) → 基础音调叠加(可选) → 偶发脉冲叠加(可选) → 输出

/**
 * 噪声类型
 * - white 白噪声：均匀频谱，听感"沙沙"
 * - pink 粉噪声：每倍频 -3dB，听感更自然温和
 * - brown 棕噪声：每倍频 -6dB，低频浑厚
 */
type NoiseType = 'white' | 'pink' | 'brown'

/**
 * 滤波器配置（串联链，按数组顺序连接）
 * @property type 滤波器类型
 * @property frequency 截止/中心频率（Hz）
 * @property Q 品质因数，默认 1
 */
interface FilterConfig {
  type: BiquadFilterType
  frequency: number
  Q?: number
}

/**
 * 持续音调配置（钵音、诵经等有固定音高的音效）
 * @property frequency 振荡器频率（Hz）
 * @property type 振荡器类型，默认 'sine'
 * @property gain 增益（0-1）
 */
interface ToneConfig {
  frequency: number
  type?: OscillatorType
  gain: number
}

/**
 * 偶发脉冲配置（雷声、爆裂、键盘敲击等间歇性声音）
 * @property minInterval 最小间隔（秒）
 * @property maxInterval 最大间隔（秒）
 * @property frequency 脉冲频率（Hz）
 * @property duration 单次脉冲时长（秒）
 * @property gain 脉冲增益（0-1）
 * @property type 脉冲振荡器类型，默认 'sine'
 */
interface PulseConfig {
  minInterval: number
  maxInterval: number
  frequency: number
  duration: number
  gain: number
  type?: OscillatorType
}

/**
 * 完整合成配置（写入 sounds.js 的音效条目 synth 字段）
 * @property noise 噪声类型；纯音效可设 null
 * @property filters 滤波器链
 * @property amFrequency 振幅调制频率（Hz），不填或 0 表示不加调制
 * @property amDepth 调制深度（0-1），1 为完全开关
 * @property tones 持续音调列表
 * @property pulses 偶发脉冲列表
 * @property duration 渲染时长（秒），默认 10
 */
export interface SynthConfig {
  noise: NoiseType | null
  filters?: FilterConfig[]
  amFrequency?: number
  amDepth?: number
  tones?: ToneConfig[]
  pulses?: PulseConfig[]
  duration?: number
}

// 渲染缓存：key 是 soundId，避免重复渲染
const synthCache = new Map<string, AudioBuffer>()

/**
 * 生成噪声样本并封装为 AudioBuffer
 * @param ctx 用于创建 buffer 的 AudioContext 或 OfflineAudioContext
 * @param type 噪声类型
 * @param duration 时长（秒）
 * @param channels 声道数，默认 1
 * @returns 返回填充了噪声样本的 AudioBuffer
 */
function createNoiseBuffer(
  ctx: BaseAudioContext,
  type: NoiseType,
  duration: number,
  channels: number = 1
): AudioBuffer {
  const sampleRate = ctx.sampleRate
  const length = Math.floor(duration * sampleRate)
  const buffer = ctx.createBuffer(channels, length, sampleRate)

  for (let ch = 0; ch < channels; ch++) {
    const data = buffer.getChannelData(ch)
    if (type === 'white') {
      // 白噪声：均匀分布的随机值
      for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1
      }
    } else if (type === 'pink') {
      // 粉噪声：Voss-McCartney 算法，多个 octave 叠加产生 -3dB/倍频
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1
        b0 = 0.99886 * b0 + white * 0.0559179
        b1 = 0.99332 * b1 + white * 0.0750759
        b2 = 0.969 * b2 + white * 0.153852
        b3 = 0.96659 * b3 + white * 0.3104856
        b4 = 0.94 * b4 + white * 0.5329522
        b5 = 0.6067 * b5 + white * 0.5400221
        b6 = 0.4238 * b6 + white * 0.6202975
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 - b6) * 0.35
      }
    } else {
      // 棕噪声：随机游走，低频浑厚
      let last = 0
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1
        // 积分系数控制低频滚降斜率
        last = (last + 0.02 * white) / 1.02
        data[i] = last * 3.5
      }
    }
  }
  return buffer
}

/**
 * 预计算偶发脉冲的时间表（在渲染开始前确定脉冲出现的时间点）
 * @param config 脉冲配置
 * @param totalDuration 总渲染时长（秒）
 * @returns 返回脉冲起始时间数组（秒）
 */
function schedulePulses(config: PulseConfig, totalDuration: number): number[] {
  const times: number[] = []
  let cursor = Math.random() * config.minInterval
  while (cursor < totalDuration) {
    times.push(cursor)
    const interval = config.minInterval + Math.random() * (config.maxInterval - config.minInterval)
    cursor += interval
  }
  return times
}

/**
 * 渲染合成 buffer（核心入口）
 * 按 config 搭建节点图，用 OfflineAudioContext 离线渲染为 AudioBuffer
 * @param soundId 音效唯一标识（用作缓存 key）
 * @param config 合成配置
 * @returns 返回渲染好的 AudioBuffer（可循环播放）
 */
export async function renderSynth(
  soundId: string,
  config: SynthConfig
): Promise<AudioBuffer> {
  // 命中缓存直接返回
  if (synthCache.has(soundId)) {
    return synthCache.get(soundId) as AudioBuffer
  }

  const duration = config.duration ?? 10
  // 渲染用 44100 采样率，单声道（环境音无需立体声，体积更小）
  const sampleRate = 44100
  const offlineCtx = new OfflineAudioContext(1, Math.ceil(duration * sampleRate), sampleRate)

  // 主输出增益：所有声源汇聚点
  const masterGain = offlineCtx.createGain()
  masterGain.gain.value = 0.5
  masterGain.connect(offlineCtx.destination)

  // ===== 噪声链 =====
  if (config.noise) {
    const noiseBuffer = createNoiseBuffer(offlineCtx, config.noise, duration, 1)
    const noiseSource = offlineCtx.createBufferSource()
    noiseSource.buffer = noiseBuffer
    noiseSource.loop = true

    // 滤波器链：按 filters 数组顺序串联
    let lastNode: AudioNode = noiseSource
    if (config.filters && config.filters.length > 0) {
      for (const fc of config.filters) {
        const filter = offlineCtx.createBiquadFilter()
        filter.type = fc.type
        filter.frequency.value = fc.frequency
        if (fc.Q !== undefined) {
          filter.Q.value = fc.Q
        }
        lastNode.connect(filter)
        lastNode = filter
      }
    }

    // 振幅调制：LFO 振荡器 → gain.gain，实现周期性音量起伏（海浪、风声）
    if (config.amFrequency && config.amFrequency > 0) {
      const lfo = offlineCtx.createOscillator()
      lfo.frequency.value = config.amFrequency
      const lfoGain = offlineCtx.createGain()
      // 调制深度：基础增益 ± amDepth
      lfoGain.gain.value = (config.amDepth ?? 0.5) * 0.5
      const amGain = offlineCtx.createGain()
      // 基础增益设为 1 - depth/2，确保调制低谷不低于 0
      amGain.gain.value = 1 - (config.amDepth ?? 0.5) * 0.5
      lfo.connect(lfoGain)
      lfoGain.connect(amGain.gain)
      lastNode.connect(amGain)
      amGain.connect(masterGain)
      lfo.start(0)
    } else {
      lastNode.connect(masterGain)
    }
    noiseSource.start(0)
  }

  // ===== 持续音调（钵音、诵经等） =====
  if (config.tones) {
    for (const tone of config.tones) {
      const osc = offlineCtx.createOscillator()
      osc.type = tone.type ?? 'sine'
      osc.frequency.value = tone.frequency
      const gain = offlineCtx.createGain()
      gain.gain.value = tone.gain
      osc.connect(gain)
      gain.connect(masterGain)
      osc.start(0)
    }
  }

  // ===== 偶发脉冲（雷声、爆裂、敲击等） =====
  if (config.pulses) {
    for (const pc of config.pulses) {
      const times = schedulePulses(pc, duration)
      for (const t of times) {
        const osc = offlineCtx.createOscillator()
        osc.type = pc.type ?? 'sine'
        osc.frequency.value = pc.frequency
        const gain = offlineCtx.createGain()
        // 脉冲包络：快速起、指数衰减
        gain.gain.setValueAtTime(0, t)
        gain.gain.linearRampToValueAtTime(pc.gain, t + 0.005)
        gain.gain.exponentialRampToValueAtTime(0.001, t + pc.duration)
        osc.connect(gain)
        gain.connect(masterGain)
        osc.start(t)
        osc.stop(t + pc.duration + 0.01)
      }
    }
  }

  // 离线渲染（同步完成，返回 Promise）
  const rendered = await offlineCtx.startRendering()
  // 写入缓存
  synthCache.set(soundId, rendered)
  return rendered
}

/**
 * 查询某 soundId 是否已渲染并缓存
 * @param soundId 音效唯一标识
 * @returns 返回是否已缓存
 */
export function hasSynthCache(soundId: string): boolean {
  return synthCache.has(soundId)
}

/**
 * 清空合成缓存（disposeAudioContext 时调用）
 */
export function clearSynthCache(): void {
  synthCache.clear()
}
