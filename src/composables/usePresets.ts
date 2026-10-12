// 预设持久化 composable：把当前混音状态（播放列表/音量/效果器）打包为 JSON，
// 经 Capacitor Preferences 读写（Web 端自动回退 localStorage，注意全部为异步 Promise）
// 快照收集与恢复逻辑在 bridge（collectPresetSnapshot/applyPresetSnapshot），本文件只管存储与编解码
import { Preferences } from '@capacitor/preferences'
import { collectPresetSnapshot, applyPresetSnapshot } from '@/store/bridge'

// 预设中的效果器状态（UI 口径：reverbAmount/surroundSpeed 均为 0-100）
export type PresetEffects = {
  reverbEnabled: boolean
  reverbAmount: number
  surroundEnabled: boolean
  surroundSpeed: number
}

// 预设结构：id/name + 混音快照（playlist 为音效 id 顺序数组，trackVolumes 为 UI 口径 0-100）
export type Preset = {
  id: string
  name: string
  playlist: string[]
  trackVolumes: Record<string, number>
  effects: PresetEffects
  // 保存时间戳（毫秒），列表展示用
  createdAt: number
}

// Preferences 存储键：所有预设序列化为一个 JSON 数组
const STORAGE_KEY = 'mixer-presets'

/**
 * 内部：读取全部预设（解析失败时返回空数组，避免坏数据卡死页面）
 * @returns 返回预设数组（按保存顺序）
 */
async function readAllPresets(): Promise<Preset[]> {
  const { value } = await Preferences.get({ key: STORAGE_KEY })
  if (!value) {
    return []
  }
  try {
    const parsed = JSON.parse(value)
    // 校验为数组后逐项过滤出合法预设（缺关键字段的不返回）
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.filter(
      (p) => p && typeof p.id === 'string' && typeof p.name === 'string' && Array.isArray(p.playlist)
    )
  } catch {
    // JSON 损坏：告警并按空处理，下次保存会覆盖掉坏数据
    console.warn('usePresets: 预设数据解析失败，已按空列表处理')
    return []
  }
}

/**
 * 内部：写回全部预设
 * @param presets 预设数组
 */
async function writeAllPresets(presets: Preset[]): Promise<void> {
  await Preferences.set({ key: STORAGE_KEY, value: JSON.stringify(presets) })
}

/**
 * 保存当前混音状态为新预设（快照收集在 bridge.collectPresetSnapshot 同步完成）
 * @param name 预设名称（首尾空白会被去除，空名抛错）
 * @returns 返回新建的预设对象
 * @throws 名称为空时抛出 Error
 */
export async function savePreset(name: string): Promise<Preset> {
  const trimmed = (name || '').trim()
  if (!trimmed) {
    throw new Error('预设名称不能为空')
  }
  const presets = await readAllPresets()
  // 生成唯一 id：时间戳 + 随机后缀（同毫秒保存多次也不冲突）
  const preset: Preset = {
    id: `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    name: trimmed,
    ...collectPresetSnapshot(),
    createdAt: Date.now(),
  }
  presets.push(preset)
  await writeAllPresets(presets)
  return preset
}

/**
 * 列出全部预设
 * @returns 返回预设数组（保存顺序，旧的在前）
 */
export async function listPresets(): Promise<Preset[]> {
  return readAllPresets()
}

/**
 * 加载指定预设：恢复播放列表（自动播放）、各音轨音量滑块与混响/3D 环绕状态
 * 恢复执行在 bridge.applyPresetSnapshot（停声清台 → 效果器 → 播放列表+音量），
 * 内部 await 效果器异步加载，完成后才返回
 * @param id 预设唯一标识
 * @returns 返回是否找到并已应用该预设
 */
export async function loadPreset(id: string): Promise<boolean> {
  const presets = await readAllPresets()
  const target = presets.find((p) => p.id === id)
  if (!target) {
    return false
  }
  await applyPresetSnapshot(target)
  return true
}

/**
 * 删除指定预设（幂等：id 不存在时无变化也不报错）
 * @param id 预设唯一标识
 */
export async function deletePreset(id: string): Promise<void> {
  const presets = await readAllPresets()
  const next = presets.filter((p) => p.id !== id)
  await writeAllPresets(next)
}
