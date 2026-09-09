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
import { homeOutline, compassOutline, notificationsOutline, personOutline } from 'ionicons/icons'
</script>

<template>
  <ion-page>
    <ion-tabs>
      <!-- 路由出口：渲染当前激活的 Tab 页面 -->
      <ion-router-outlet></ion-router-outlet>

      <!-- 底部 Tab 栏 -->
      <ion-tab-bar slot="bottom">
        <!-- 首页 Tab -->
        <ion-tab-button tab="home" href="/tabs/home">
          <ion-icon :icon="homeOutline" />
          <ion-label>首页</ion-label>
        </ion-tab-button>

        <!-- 探索 Tab -->
        <ion-tab-button tab="explore" href="/tabs/explore">
          <ion-icon :icon="compassOutline" />
          <ion-label>探索</ion-label>
        </ion-tab-button>

        <!-- 通知 Tab -->
        <ion-tab-button tab="notifications" href="/tabs/notifications">
          <ion-icon :icon="notificationsOutline" />
          <ion-label>通知</ion-label>
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
