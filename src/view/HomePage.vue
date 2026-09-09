<!--
  首页组件（底部 Tab 第 1 个）
  当前为骨架占位页面，后续填充首页内容
-->
<script setup>
// 引入 Ionic 页面与内容容器组件
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent } from '@ionic/vue'
</script>

<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>首页</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true">
      <div class="placeholder">首页内容（待开发）</div>
    </ion-content>
  </ion-page>
</template>

<style scoped>
/* 占位文本样式 */
.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text);
}
</style>
