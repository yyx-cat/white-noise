// 应用入口模块：创建 Vue 应用实例并挂载 Ionic 与路由
import { createApp } from 'vue'
// 引入 Ionic Vue 插件
import { IonicVue } from '@ionic/vue'
// 引入 Ionic 基础样式（全屏布局与组件样式）
import '@ionic/vue/css/core.css'

// 引入全局样式
import './style.css'
// 引入根组件
import App from './App.vue'
// 引入路由实例
import router from './router'

/**
 * 创建并挂载应用
 * 依次注册 Ionic 插件与路由，最后挂载到 #app 节点
 */
const app = createApp(App)
  .use(IonicVue)
  .use(router)

// 路由就绪后再挂载，避免首屏闪烁
router.isReady().then(() => {
  app.mount('#app')
})
