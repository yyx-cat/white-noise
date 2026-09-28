<!--
  根组件
  使用 Ionic 的 IonApp 容器包裹路由出口，作为整个应用的承载外壳
-->
<script setup>
// 引入 Ionic 应用容器与路由出口组件
import { IonApp, IonRouterOutlet } from '@ionic/vue'
// 引入组件生命周期、音频引擎与音频状态 Store
import { onMounted, onUnmounted } from 'vue'
import { useAudio } from '@/composables/useAudio'
import { useAudioStore } from '@/store/audio'

// 音频引擎实例（模块级单例，路由切换不销毁，仅随 App 卸载销毁）
const engine = useAudio()
// 音频状态 Store（pinia 已在挂载前注册，此处可直接使用）
const audioStore = useAudioStore()

// 挂载后在浏览器空闲时段静默预热音频（提前 fetch + decode），
// 避免用户点击音效卡片时才冷解码大文件导致数秒无声；解码在 suspended 上下文也可进行
onMounted(() => {
  const startPreload = () => audioStore.preload()
  // 优先用 requestIdleCallback 避开首屏渲染；不支持时用短延时兜底
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(startPreload, { timeout: 2000 })
  } else {
    setTimeout(startPreload, 800)
  }
})

// 仅在 App 卸载时停止全部音轨并销毁 AudioContext；
// 路由切换（如发现页 ↔ 混音台）不触发这里，音频继续播放
onUnmounted(() => {
  engine.disposeAudioContext()
})
</script>

<template>
  <ion-app>
    <!-- 路由出口：渲染匹配的页面（含底部 Tab 容器） -->
    <ion-router-outlet></ion-router-outlet>
  </ion-app>
</template>
