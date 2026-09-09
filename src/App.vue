<!--
  根组件
  使用 Ionic 的 IonApp 容器包裹路由出口，作为整个应用的承载外壳
-->
<script setup>
// 引入 Ionic 应用容器与路由出口组件
import { IonApp, IonRouterOutlet } from '@ionic/vue'
</script>

<template>
  <ion-app>
    <!-- 路由出口：渲染匹配的页面（含底部 Tab 容器） -->
    <ion-router-outlet></ion-router-outlet>
  </ion-app>
</template>
