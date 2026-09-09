# my-app

基于 Vue 3 + Vite + Ionic 的移动端应用骨架项目，包含底部 4 个 Tab（首页、探索、通知、我的）。

## 技术栈

- Vue 3（`<script setup>`）
- Vite
- Ionic Vue（`@ionic/vue` + `@ionic/vue-router`）
- Vue Router

## 环境要求

- Node.js 18+（推荐 20 LTS）
- npm 或其他包管理器

## 安装与启动

```bash
# 安装依赖
npm install

# 启动开发服务器（默认 http://localhost:5173）
npm run dev
```

## 构建与预览

```bash
# 生产构建
npm run build

# 预览构建产物
npm run preview
```

## 项目结构

```
my-app/
├── index.html              # HTML 入口
├── vite.config.js          # Vite 配置（含 @ -> src 别名）
├── package.json
└── src/
    ├── main.js             # 应用入口：注册 Ionic 与路由
    ├── App.vue             # 根组件：IonApp + 路由出口
    ├── style.css           # 全局样式
    ├── router/
    │   └── index.js        # 路由配置：4 个 Tab 路由
    └── view/
        ├── TabsPage.vue          # 底部 Tab 容器
        ├── HomePage.vue          # 首页（占位）
        ├── ExplorePage.vue       # 探索页（占位）
        ├── NotificationsPage.vue # 通知页（占位）
        └── ProfilePage.vue       # 我的页（占位）
```

## 协作流程

1. 克隆仓库：`git clone <仓库地址>`
2. 安装依赖：`npm install`
3. 切换分支开发，完成后提 PR
4. 拉取最新代码：`git pull`
