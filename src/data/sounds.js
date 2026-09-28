/**
 * 音效元数据：全应用唯一来源（single source of truth）
 * UI 卡片、mixerStore、audioStore、音频引擎均从本文件取元数据，禁止在别处写死路径
 *
 * 字段说明：
 * - id：音效唯一标识（字符串，全局唯一），音频引擎与各 Store 均以此为准
 * - name：显示名称
 * - url：音频文件路径（指向 public/audio 下的 mp3）；现阶段 12 个音效共用 3 个文件
 * - loop：是否循环播放；环境音 true，短音效 false
 * - defaultVolume：默认音量（0-1），可选
 * - icon：卡片/列表展示图标（emoji），可选
 * - category：分类，可选
 * - description：描述文案，可选
 */
export const sounds = [
  // —— 自然 ——
  {
    id: 'rain',
    name: '雨声',
    url: '/audio/Rain.mp3',
    loop: true,
    defaultVolume: 0.8,
    icon: '🌧️',
    category: '自然',
    description: '淅淅沥沥的雨声，适合放松与入眠',
  },
  {
    id: 'thunder',
    name: '雷雨',
    url: '/audio/Rain.mp3',
    loop: true,
    defaultVolume: 0.7,
    icon: '⛈️',
    category: '自然',
    description: '雨声与远处闷雷交织',
  },
  {
    id: 'waves',
    name: '海浪',
    url: '/audio/Ocean.mp3',
    loop: true,
    defaultVolume: 0.8,
    icon: '🌊',
    category: '自然',
    description: '海浪拍岸，起伏绵长',
  },
  {
    id: 'wind',
    name: '风吹树叶',
    url: '/audio/Ocean.mp3',
    loop: true,
    defaultVolume: 0.6,
    icon: '🍃',
    category: '自然',
    description: '微风拂过林梢的沙沙声',
  },
  // —— 生活 ——
  {
    id: 'fire',
    name: '篝火',
    url: '/audio/Fire.mp3',
    loop: true,
    defaultVolume: 0.7,
    icon: '🔥',
    category: '生活',
    description: '木柴噼啪作响的温暖火光',
  },
  {
    id: 'cafe',
    name: '咖啡馆',
    url: '/audio/Fire.mp3',
    loop: true,
    defaultVolume: 0.5,
    icon: '☕',
    category: '生活',
    description: '杯盏轻碰与人声低语的环境音',
  },
  {
    id: 'train',
    name: '火车车厢',
    url: '/audio/Fire.mp3',
    loop: true,
    defaultVolume: 0.6,
    icon: '🚂',
    category: '生活',
    description: '铁轨节奏与车厢低鸣',
  },
  // —— 冥想 ——
  {
    id: 'bowl',
    name: '冥想钵音',
    url: '/audio/Ocean.mp3',
    loop: true,
    defaultVolume: 0.5,
    icon: '🧘',
    category: '冥想',
    description: '颂钵余音，绵长安定',
  },
  {
    id: 'chant',
    name: '诵经',
    url: '/audio/Ocean.mp3',
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
    url: '/audio/Fire.mp3',
    loop: true,
    defaultVolume: 0.5,
    icon: '💻',
    category: '专注',
    description: '清脆的打字节奏',
  },
  {
    id: 'page',
    name: '翻书声',
    url: '/audio/Fire.mp3',
    loop: true,
    defaultVolume: 0.4,
    icon: '📖',
    category: '专注',
    description: '纸页翻动的轻响',
  },
  {
    id: 'music',
    name: '轻音乐',
    url: '/audio/Ocean.mp3',
    loop: true,
    defaultVolume: 0.6,
    icon: '🎵',
    category: '专注',
    description: '舒缓的背景旋律',
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
 * 按 id 查找音效的音频地址
 * @param {string} id 音效唯一标识
 * @returns {string|undefined} 对应的音频 url；找不到时返回 undefined
 */
export function getSoundUrl(id) {
  return getSoundById(id)?.url
}

/**
 * 全部分类列表（按 sounds 中的 category 去重，"全部"固定在最前）
 * @returns {string[]} 分类名数组
 */
export function getCategories() {
  const set = new Set(sounds.map((s) => s.category))
  return ['全部', ...set]
}
