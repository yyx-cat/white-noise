// 路由配置模块：负责创建应用的路由实例并定义底部 4 个 Tab 的路由表
import { createRouter, createWebHistory } from '@ionic/vue-router'
import ExplorePage from '@/view/ExplorePage.vue'
import MixerPage from '@/view/MixerPage.vue'
import ProfilePage from '@/view/ProfilePage.vue'
import TabsPage from '@/view/TabsPage.vue'


/**
 * 创建应用路由实例
 * 配置底部 4 个 Tab 路由：首页、探索、通知、我的
 * @returns {Router} 返回配置好的 vue-router 路由实例
 */
export function createAppRouter() {
  // 路由表：以 /tabs 为父路由，下挂 4 个子 Tab 页面
  const routes = [
    {
      path: '/',
      redirect: '/tabs/explore',
    },
    {
      path: '/tabs/',
      component: TabsPage,
      children: [
        {
          path: '',
          redirect: '/tabs/home',
        },
        {
          path: 'explore',
          component: ExplorePage,
        },
        {
          path: 'mixer',
          component: MixerPage,
        },
        {
          path: 'profile',
          component: ProfilePage,
        },
      ],
    },
  ]

  // 创建并返回路由实例，使用 HTML5 history 模式
  const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes,
  })

  return router
}

// 默认导出已创建的路由实例，供 main.js 使用
export default createAppRouter()
