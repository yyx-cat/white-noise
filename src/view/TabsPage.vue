<!--
  底部 Tab 容器组件
  负责渲染底部 4 个 Tab（首页、探索、通知、我的）及其对应的路由出口
-->
<script setup>
// 引入 Ionic Tab 相关组件
import {
  IonTabBar,
  IonTabButton,
  IonTabs,
  IonLabel,
  IonIcon,
  IonPage,
  IonRouterOutlet,
} from '@ionic/vue'
// 引入底部 Tab 图标
import { compassOutline, optionsOutline, personOutline } from 'ionicons/icons'
</script>

<template>
  <ion-page>
    <ion-tabs>
      <!-- 路由出口：渲染当前激活的 Tab 页面 -->
      <ion-router-outlet></ion-router-outlet>

      <!-- 底部 Tab 栏 -->
      <ion-tab-bar slot="bottom">

        <!-- 探索 Tab -->
        <ion-tab-button tab="explore" href="/tabs/explore">
          <ion-icon :icon="compassOutline" />
          <ion-label>发现</ion-label>
        </ion-tab-button>

        <!-- 混音台 Tab -->
        <ion-tab-button tab="mixer" href="/tabs/mixer">
          <ion-icon :icon="optionsOutline" />
          <ion-label>混音台</ion-label>
        </ion-tab-button>

        <!-- 我的 Tab -->
        <ion-tab-button tab="profile" href="/tabs/profile">
          <ion-icon :icon="personOutline" />
          <ion-label>我的</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  </ion-page>
</template>
