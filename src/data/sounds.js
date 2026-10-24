/**
 * 音效元数据：全应用唯一来源（single source of truth）
 * UI 卡片、mixerStore、audioStore、音频引擎均从本文件取元数据，禁止在别处写死路径
 *
 * 字段说明：
 * - id：音效唯一标识（字符串，全局唯一），音频引擎与各 Store 均以此为准
 * - name：显示名称
 * - url：音频文件路径（指向 public/audio 下的 mp3）；有 synth 字段时可留空
 * - synth：合成配置（程序化渲染，不依赖外部文件）；有此字段时引擎自动走合成路径
 * - loop：是否循环播放；环境音 true，短音效 false
 * - defaultVolume：默认音量（0-1），可选
 * - icon：卡片/列表展示图标（emoji），可选
 * - category：分类，可选
 * - description：描述文案，可选
 */

// —— 合成配置生成辅助函数 ——

/** 雨声：白噪声 + 中低通滤波 */
const synthRain = {
  noise: 'white',
  filters: [{ type: 'lowpass', frequency: 1200, Q: 0.5 }],
  duration: 8,
}

/** 大雨：白噪声 + 更高截止 + 粉噪层叠加，听感更密集 */
const synthHeavyRain = {
  noise: 'white',
  filters: [
    { type: 'lowpass', frequency: 2400, Q: 0.7 },
    { type: 'highpass', frequency: 400, Q: 0.5 },
  ],
  duration: 8,
}

/** 小雨：白噪声 + 低截止 + 振幅调制，听感更轻柔断续 */
const synthLightRain = {
  noise: 'white',
  filters: [{ type: 'lowpass', frequency: 800, Q: 0.5 }],
  amFrequency: 0.3,
  amDepth: 0.3,
  duration: 8,
}

/** 雷雨：雨声 + 偶发雷声脉冲（低频正弦 + 衰减） */
const synthThunder = {
  noise: 'white',
  filters: [{ type: 'lowpass', frequency: 1000, Q: 0.5 }],
  pulses: [
    { minInterval: 5, maxInterval: 12, frequency: 55, duration: 2, gain: 0.8, type: 'sine' },
    { minInterval: 8, maxInterval: 15, frequency: 40, duration: 2.5, gain: 0.6, type: 'sine' },
  ],
  duration: 12,
}

/** 海浪：白噪声 + 带通 + 慢速振幅调制（0.1Hz 周期起伏） */
const synthWaves = {
  noise: 'white',
  filters: [
    { type: 'bandpass', frequency: 500, Q: 0.7 },
    { type: 'lowpass', frequency: 1500, Q: 0.5 },
  ],
  amFrequency: 0.12,
  amDepth: 0.7,
  duration: 12,
}

/** 风吹树叶：粉噪声 + 带通 + 慢速调制，听感轻柔飘忽 */
const synthWind = {
  noise: 'pink',
  filters: [
    { type: 'bandpass', frequency: 800, Q: 0.6 },
    { type: 'lowpass', frequency: 3000, Q: 0.5 },
  ],
  amFrequency: 0.2,
  amDepth: 0.5,
  duration: 10,
}

/** 大风：棕噪声 + 带通 + 更强调制，听感更猛烈 */
const synthStrongWind = {
  noise: 'brown',
  filters: [
    { type: 'bandpass', frequency: 400, Q: 0.8 },
    { type: 'lowpass', frequency: 2000, Q: 0.5 },
  ],
  amFrequency: 0.15,
  amDepth: 0.6,
  duration: 10,
}

/** 篝火：粉噪声 + 低通 + 偶发爆裂脉冲 */
const synthFire = {
  noise: 'pink',
  filters: [{ type: 'lowpass', frequency: 600, Q: 0.5 }],
  pulses: [
    { minInterval: 0.3, maxInterval: 1.5, frequency: 2000, duration: 0.05, gain: 0.4, type: 'square' },
    { minInterval: 0.5, maxInterval: 2, frequency: 1200, duration: 0.08, gain: 0.3, type: 'square' },
  ],
  duration: 10,
}

/** 壁炉：比篝火更低沉、爆裂更少 */
const synthFireplace = {
  noise: 'brown',
  filters: [{ type: 'lowpass', frequency: 400, Q: 0.5 }],
  pulses: [
    { minInterval: 1, maxInterval: 3, frequency: 800, duration: 0.1, gain: 0.3, type: 'square' },
  ],
  duration: 12,
}

/** 咖啡馆：粉噪声 + 带通 + 偶发中频脉冲（杯盏轻碰） */
const synthCafe = {
  noise: 'pink',
  filters: [
    { type: 'bandpass', frequency: 1000, Q: 0.4 },
    { type: 'lowpass', frequency: 4000, Q: 0.5 },
  ],
  pulses: [
    { minInterval: 2, maxInterval: 6, frequency: 3000, duration: 0.05, gain: 0.2, type: 'sine' },
    { minInterval: 3, maxInterval: 8, frequency: 1500, duration: 0.08, gain: 0.15, type: 'sine' },
  ],
  duration: 12,
}

/** 火车车厢：低频周期性噪声 + 金属共振音调 */
const synthTrain = {
  noise: 'brown',
  filters: [{ type: 'lowpass', frequency: 300, Q: 0.5 }],
  tones: [
    { frequency: 80, type: 'sawtooth', gain: 0.08 },
    { frequency: 120, type: 'sine', gain: 0.05 },
  ],
  amFrequency: 2,
  amDepth: 0.4,
  duration: 10,
}

/** 冥想钵音：正弦衰减叠加谐波，长余音循环 */
const synthBowl = {
  noise: null,
  tones: [
    { frequency: 220, type: 'sine', gain: 0.4 },
    { frequency: 440, type: 'sine', gain: 0.2 },
    { frequency: 660, type: 'sine', gain: 0.1 },
  ],
  amFrequency: 0.3,
  amDepth: 0.3,
  duration: 6,
}

/** 诵经：低频正弦 + 谐波 + 慢速调制 */
const synthChant = {
  noise: null,
  tones: [
    { frequency: 110, type: 'sine', gain: 0.3 },
    { frequency: 165, type: 'sine', gain: 0.15 },
    { frequency: 220, type: 'sawtooth', gain: 0.05 },
  ],
  amFrequency: 0.25,
  amDepth: 0.4,
  duration: 8,
}

/** 键盘敲击：粉噪声 + 高通 + 偶发短脉冲 */
const synthKeyboard = {
  noise: 'pink',
  filters: [{ type: 'highpass', frequency: 2000, Q: 0.5 }],
  pulses: [
    { minInterval: 0.15, maxInterval: 0.6, frequency: 3000, duration: 0.03, gain: 0.5, type: 'square' },
    { minInterval: 0.2, maxInterval: 0.8, frequency: 2500, duration: 0.04, gain: 0.4, type: 'square' },
  ],
  duration: 8,
}

/** 翻书声：粉噪声 + 高通 + 偶发极短脉冲 */
const synthPage = {
  noise: 'pink',
  filters: [{ type: 'bandpass', frequency: 4000, Q: 1 }],
  pulses: [
    { minInterval: 3, maxInterval: 8, frequency: 5000, duration: 0.05, gain: 0.6, type: 'sine' },
  ],
  duration: 12,
}

/** 轻音乐：和弦叠加 + 慢速调制 */
const synthMusic = {
  noise: null,
  tones: [
    { frequency: 261.63, type: 'sine', gain: 0.15 },  // C4
    { frequency: 329.63, type: 'sine', gain: 0.12 },  // E4
    { frequency: 392, type: 'sine', gain: 0.1 },     // G4
    { frequency: 523.25, type: 'sine', gain: 0.08 }, // C5
  ],
  amFrequency: 0.15,
  amDepth: 0.25,
  duration: 8,
}

/** 小溪：白噪声 + 高通 + 带通 + 快速调制 */
const synthStream = {
  noise: 'white',
  filters: [
    { type: 'highpass', frequency: 1000, Q: 0.5 },
    { type: 'bandpass', frequency: 3000, Q: 0.6 },
  ],
  amFrequency: 0.8,
  amDepth: 0.3,
  duration: 8,
}

/** 鸟鸣：偶发高频扫频脉冲（用正弦模拟鸟叫） */
const synthBirds = {
  noise: 'pink',
  filters: [{ type: 'highpass', frequency: 2000, Q: 0.5 }],
  pulses: [
    { minInterval: 1, maxInterval: 3, frequency: 3500, duration: 0.1, gain: 0.5, type: 'sine' },
    { minInterval: 1.5, maxInterval: 4, frequency: 4200, duration: 0.08, gain: 0.4, type: 'sine' },
    { minInterval: 2, maxInterval: 5, frequency: 2800, duration: 0.12, gain: 0.45, type: 'sine' },
  ],
  duration: 12,
}

/** 虫鸣：高频周期性脉冲（夏夜蝉鸣） */
const synthCricket = {
  noise: null,
  tones: [{ frequency: 6000, type: 'square', gain: 0.06 }],
  amFrequency: 8,
  amDepth: 1,
  duration: 6,
}

/** 白噪音：纯白噪声，无滤波 */
const synthWhiteNoise = {
  noise: 'white',
  duration: 6,
}

/** 粉噪音：纯粉噪声 */
const synthPinkNoise = {
  noise: 'pink',
  duration: 6,
}

/** 棕噪音：纯棕噪声，低频浑厚 */
const synthBrownNoise = {
  noise: 'brown',
  duration: 6,
}

/** 机舱：低频稳态噪声 + 轻微调制 */
const synthAirplane = {
  noise: 'brown',
  filters: [{ type: 'lowpass', frequency: 500, Q: 0.5 }],
  tones: [{ frequency: 100, type: 'sawtooth', gain: 0.05 }],
  amFrequency: 0.1,
  amDepth: 0.15,
  duration: 10,
}

/** 风扇：低频稳态 + 叶片频率 */
const synthFan = {
  noise: 'brown',
  filters: [{ type: 'lowpass', frequency: 400, Q: 0.5 }],
  tones: [{ frequency: 60, type: 'sine', gain: 0.08 }],
  amFrequency: 12,
  amDepth: 0.2,
  duration: 8,
}

export const sounds = [
  // —— 自然 ——
  {
    id: 'rain',
    name: '雨声',
    synth: synthRain,
    loop: true,
    defaultVolume: 0.8,
    icon: '🌧️',
    category: '自然',
    description: '淅淅沥沥的雨声，适合放松与入眠',
  },
  {
    id: 'heavyRain',
    name: '大雨',
    synth: synthHeavyRain,
    loop: true,
    defaultVolume: 0.75,
    icon: '🌧️',
    category: '自然',
    description: '密集的大雨声，遮蔽环境噪声效果更佳',
  },
  {
    id: 'lightRain',
    name: '小雨',
    synth: synthLightRain,
    loop: true,
    defaultVolume: 0.7,
    icon: '🌦️',
    category: '自然',
    description: '轻柔断续的小雨，更温柔的助眠',
  },
  {
    id: 'thunder',
    name: '雷雨',
    synth: synthThunder,
    loop: true,
    defaultVolume: 0.7,
    icon: '⛈️',
    category: '自然',
    description: '雨声与远处闷雷交织',
  },
  {
    id: 'waves',
    name: '海浪',
    synth: synthWaves,
    loop: true,
    defaultVolume: 0.8,
    icon: '🌊',
    category: '自然',
    description: '海浪拍岸，起伏绵长',
  },
  {
    id: 'wind',
    name: '风吹树叶',
    synth: synthWind,
    loop: true,
    defaultVolume: 0.6,
    icon: '🍃',
    category: '自然',
    description: '微风拂过林梢的沙沙声',
  },
  {
    id: 'strongWind',
    name: '狂风',
    synth: synthStrongWind,
    loop: true,
    defaultVolume: 0.65,
    icon: '🌪️',
    category: '自然',
    description: '猛烈的狂风呼啸',
  },
  {
    id: 'stream',
    name: '小溪',
    synth: synthStream,
    loop: true,
    defaultVolume: 0.65,
    icon: '💧',
    category: '自然',
    description: '溪水潺潺流淌',
  },
  {
    id: 'birds',
    name: '鸟鸣',
    synth: synthBirds,
    loop: true,
    defaultVolume: 0.5,
    icon: '🐦',
    category: '自然',
    description: '林间鸟儿清脆鸣叫',
  },
  // —— 生活 ——
  {
    id: 'fire',
    name: '篝火',
    synth: synthFire,
    loop: true,
    defaultVolume: 0.7,
    icon: '🔥',
    category: '生活',
    description: '木柴噼啪作响的温暖火光',
  },
  {
    id: 'fireplace',
    name: '壁炉',
    synth: synthFireplace,
    loop: true,
    defaultVolume: 0.65,
    icon: '🏠',
    category: '生活',
    description: '壁炉中火苗低沉燃烧',
  },
  {
    id: 'cafe',
    name: '咖啡馆',
    synth: synthCafe,
    loop: true,
    defaultVolume: 0.5,
    icon: '☕',
    category: '生活',
    description: '杯盏轻碰与人声低语的环境音',
  },
  {
    id: 'train',
    name: '火车车厢',
    synth: synthTrain,
    loop: true,
    defaultVolume: 0.6,
    icon: '🚂',
    category: '生活',
    description: '铁轨节奏与车厢低鸣',
  },
  {
    id: 'airplane',
    name: '机舱',
    synth: synthAirplane,
    loop: true,
    defaultVolume: 0.55,
    icon: '✈️',
    category: '生活',
    description: '高空飞行时机舱的低频环境音',
  },
  {
    id: 'fan',
    name: '风扇',
    synth: synthFan,
    loop: true,
    defaultVolume: 0.5,
    icon: '🌀',
    category: '生活',
    description: '电风扇转动时的恒定低鸣',
  },
  // —— 冥想 ——
  {
    id: 'bowl',
    name: '冥想钵音',
    synth: synthBowl,
    loop: true,
    defaultVolume: 0.5,
    icon: '🧘',
    category: '冥想',
    description: '颂钵余音，绵长安定',
  },
  {
    id: 'chant',
    name: '诵经',
    synth: synthChant,
    loop: true,
    defaultVolume: 0.4,
    icon: '🕉️',
    category: '冥想',
    description: '低沉平缓的诵念声',
  },
  // —— 专注 ——
  {
    id: 'keyboard',
    name: '键盘敲击',
    synth: synthKeyboard,
    loop: true,
    defaultVolume: 0.5,
    icon: '💻',
    category: '专注',
    description: '清脆的打字节奏',
  },
  {
    id: 'page',
    name: '翻书声',
    synth: synthPage,
    loop: true,
    defaultVolume: 0.4,
    icon: '📖',
    category: '专注',
    description: '纸页翻动的轻响',
  },
  {
    id: 'music',
    name: '轻音乐',
    synth: synthMusic,
    loop: true,
    defaultVolume: 0.6,
    icon: '🎵',
    category: '专注',
    description: '舒缓的 C 大调和弦背景',
  },
  // —— 纯噪音 ——
  {
    id: 'whiteNoise',
    name: '白噪音',
    synth: synthWhiteNoise,
    loop: true,
    defaultVolume: 0.5,
    icon: '⬜',
    category: '纯噪音',
    description: '全频段均匀的沙沙声，经典掩蔽音',
  },
  {
    id: 'pinkNoise',
    name: '粉噪音',
    synth: synthPinkNoise,
    loop: true,
    defaultVolume: 0.5,
    icon: '🟪',
    category: '纯噪音',
    description: '每倍频 -3dB 的自然粉噪，比白噪更温和',
  },
  {
    id: 'brownNoise',
    name: '棕噪音',
    synth: synthBrownNoise,
    loop: true,
    defaultVolume: 0.5,
    icon: '🟫',
    category: '纯噪音',
    description: '每倍频 -6dB 的低频棕噪，浑厚如海浪',
  },
  {
    id: 'cricket',
    name: '虫鸣',
    synth: synthCricket,
    loop: true,
    defaultVolume: 0.35,
    icon: '🦗',
    category: '纯噪音',
    description: '夏夜蝉鸣般的高频脉冲',
  },
]

/**
 * 按 id 查找音效元数据
 * @param {string} id 音效唯一标识
 * @returns {object|undefined} 对应的音效元数据对象；找不到时返回 undefined
 */
export function getSoundById(id) {
  return sounds.find((s) => s.id === id)
}

/**
 * 全部分类列表（按 sounds 中的 category 去重，"全部"固定在最前）
 * @returns {string[]} 分类名数组
 */
export function getCategories() {
  const set = new Set(sounds.map((s) => s.category))
  return ['全部', ...set]
}
