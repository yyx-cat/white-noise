<!--
  我的页组件（底部 Tab）
  功能：混音预设管理——把当前混音状态（播放列表/音量/效果器）保存为预设，
  列表展示已存预设，点击加载（自动回发现页查看混音台），删除需二次确认
-->
<script setup>
// 引入 Ionic 页面组件与 Vue 组合式 API
import { ref, onMounted, onUnmounted } from 'vue'
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent } from '@ionic/vue'
import { useRouter } from 'vue-router'
// 预设持久化 API（Capacitor Preferences 封装）
import { savePreset, listPresets, loadPreset, deletePreset } from '@/composables/usePresets'
// 混音台列表（保存前判空用）
import { mixerStore } from '@/store/mixer'

// 路由实例：加载预设成功后跳回发现页查看混音台
const router = useRouter()

// 预设名称输入框内容
const presetName = ref('')
// 已保存的预设列表
const presets = ref([])
// 保存按钮防抖
const saving = ref(false)
// 正在加载的预设 id（列表项显示加载态）
const loadingId = ref(null)
// 操作提示文案（保存/加载/删除结果反馈，2.5 秒后自动消失）
const hint = ref('')
// 提示消失定时器句柄（组件卸载时清理）
let hintTimer = null

/**
 * 显示操作提示并在 2.5 秒后自动清除
 * @param text 提示文案
 */
function showHint(text) {
  hint.value = text
  // 重复触发时先清掉上一个定时器，避免提前消失
  if (hintTimer) {
    clearTimeout(hintTimer)
  }
  hintTimer = setTimeout(() => {
    hint.value = ''
    hintTimer = null
  }, 2500)
}

/**
 * 从存储刷新预设列表
 */
async function refreshList() {
  try {
    presets.value = await listPresets()
  } catch (err) {
    console.error('读取预设列表失败:', err)
    showHint('读取预设失败，请重试')
  }
}

/**
 * 保存当前混音状态为新预设（混音台为空时只提示不保存）
 */
async function onSave() {
  if (saving.value) return
  // 混音台为空：没有可保存的内容
  if (mixerStore.sounds.length === 0) {
    showHint('混音台是空的，先去发现页添加音效吧')
    return
  }
  saving.value = true
  try {
    const created = await savePreset(presetName.value)
    presetName.value = ''
    await refreshList()
    showHint(`已保存「${created.name}」（${created.playlist.length} 个音效）`)
  } catch (err) {
    // 名称为空等校验错误在此反馈给用户
    showHint(err && err.message ? err.message : '保存失败，请重试')
  } finally {
    saving.value = false
  }
}

/**
 * 加载预设：恢复播放列表/音量/效果器后跳回发现页
 * @param preset 目标预设对象
 */
async function onLoad(preset) {
  if (loadingId.value) return
  loadingId.value = preset.id
  try {
    const ok = await loadPreset(preset.id)
    if (ok) {
      // 恢复完成，跳回发现页查看混音台效果
      router.push('/tabs/explore')
    } else {
      showHint('预设不存在或已被删除')
    }
  } catch (err) {
    console.error('加载预设失败:', err)
    showHint('加载失败，请重试')
  } finally {
    loadingId.value = null
  }
}

/**
 * 删除预设（二次确认防止误删）
 * @param preset 目标预设对象
 */
async function onDelete(preset) {
  // 二次确认：用户取消则直接返回
  if (!window.confirm(`确定删除预设「${preset.name}」吗？`)) {
    return
  }
  try {
    await deletePreset(preset.id)
    await refreshList()
    showHint('已删除')
  } catch (err) {
    console.error('删除预设失败:', err)
    showHint('删除失败，请重试')
  }
}

/**
 * 格式化保存时间（列表展示用）
 * @param ts 时间戳（毫秒）
 * @returns 返回 "YYYY-MM-DD HH:mm" 格式字符串
 */
function formatDate(ts) {
  const d = new Date(ts)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// 挂载时读取预设列表（刷新 App 后预设仍在）
onMounted(refreshList)

// 组件卸载时清理提示定时器
onUnmounted(() => {
  if (hintTimer) {
    clearTimeout(hintTimer)
    hintTimer = null
  }
})
</script>

<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>我的</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true">
      <div class="presets-page">
        <!-- 保存区：输入预设名称 + 保存当前混音 -->
        <div class="card save-card">
          <div class="card-title">💾 保存当前混音</div>
          <div class="save-row">
            <input
              v-model="presetName"
              class="name-input"
              type="text"
              placeholder="输入预设名称"
              maxlength="20"
              @keyup.enter="onSave"
            />
            <button class="save-btn" :disabled="saving || !presetName.trim()" @click="onSave">
              {{ saving ? '保存中…' : '保存' }}
            </button>
          </div>
        </div>

        <!-- 操作提示 -->
        <div class="hint" v-if="hint">{{ hint }}</div>

        <!-- 预设列表：点击加载，右侧删除（二次确认） -->
        <div class="card list-card">
          <div class="card-title">📋 我的预设</div>
          <div
            v-for="p in presets"
            :key="p.id"
            class="preset-item"
            @click="onLoad(p)"
          >
            <div class="preset-info">
              <div class="preset-name">{{ p.name }}</div>
              <div class="preset-meta">
                {{ p.playlist.length }} 个音效 · {{ formatDate(p.createdAt) }}
              </div>
            </div>
            <button class="del-btn" @click.stop="onDelete(p)">删除</button>
          </div>
          <div class="empty" v-if="presets.length === 0">
            还没有预设，去发现页调好混音后回来保存
          </div>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<style scoped>
/* 页面内容区背景：浅灰，与发现页卡片风格一致 */
ion-content {
  --background: #f7f7f7;
}

/* 页面容器 */
.presets-page {
  padding: 16px;
}

/* 通用卡片 */
.card {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}
.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
}

/* 保存区：输入框 + 按钮 */
.save-row {
  display: flex;
  gap: 10px;
}
.name-input {
  flex: 1;
  height: 40px;
  padding: 0 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
}
.name-input:focus {
  border-color: #3880ff;
}
.save-btn {
  width: 72px;
  height: 40px;
  border: none;
  border-radius: 8px;
  background: #3880ff;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
}
.save-btn:disabled {
  opacity: 0.4;
}

/* 操作提示 */
.hint {
  font-size: 13px;
  color: #2dd36f;
  margin: -6px 0 12px 4px;
}

/* 预设列表项 */
.preset-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
}
.preset-item:last-of-type {
  border-bottom: none;
}
.preset-info {
  min-width: 0;
}
.preset-name {
  font-size: 15px;
  color: #333;
  font-weight: 500;
  /* 名称过长时省略 */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.preset-meta {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}
.del-btn {
  flex-shrink: 0;
  margin-left: 12px;
  padding: 6px 14px;
  border: 1px solid #ffdddd;
  border-radius: 999px;
  background: #fff5f5;
  color: #ff4961;
  font-size: 13px;
  cursor: pointer;
}

/* 空状态 */
.empty {
  padding: 24px 0;
  text-align: center;
  font-size: 14px;
  color: #aaa;
}
</style>
