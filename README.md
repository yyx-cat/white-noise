# White Noise — 基于 Ionic + Vue 的白噪音助眠混音 App

> HTML5 移动应用开发课程项目  
> 基于 Vue 3 + Ionic Vue + Web Audio API 的移动端白噪音混音应用，支持多轨环境音叠加、程序化音频合成、混响与 3D 环绕、睡眠定时器、预设管理与使用统计，并配置 Capacitor Android 打包。

## 项目简介

本项目面向助眠、专注与放松场景，提供可自由组合的环境音混音体验。用户可在发现页浏览雨声、海浪、篝火、咖啡馆、白/粉/棕噪音等 20+ 种音效，加入底部混音台后独立调节每条音轨音量，并叠加全局混响与 3D 环绕效果。

音效采用 **OfflineAudioContext 程序化合成**，通过噪声算法、滤波链、振幅调制与脉冲包络配置化渲染，按 `soundId` 缓存复用，降低包体体积并规避音频版权风险。

## 功能特性

- **发现页**：Banner 轮播、5 个分类 Tab、20+ 音效卡片，支持播放/加载/移除状态。
- **多轨混音台**：底部可拖拽面板，多音效同时播放，每轨独立音量，支持全部停止/播放、移除单轨、清空。
- **效果器**：全局混响（ConvolverNode + 脉冲响应，强度可调）与 3D 环绕（StereoPannerNode 周期声像，速度可调）。
- **睡眠定时器**：15/30/60 分钟快捷、时/分滚轮、开始/暂停/重置、专注模式；倒计时归零自动停止全部音频，跨 Tab 继续计时。
- **预设管理**：保存/加载/重命名/删除混音配置，按创建时间或使用频率排序，`localStorage` 持久化。
- **个性化与统计**：浅色/深色/跟随系统、固定背景与主色切换；今日/本周/连续天数、7 日柱状图、最常播放 Top 3。
- **移动端**：Capacitor Android 平台配置、权限声明与签名 APK 构建流程。

## 技术栈

| 类别 | 技术 |
|---|---|
| 前端框架 | Vue 3（Composition API）、Vite |
| 移动端 UI | Ionic Vue、Vue Router、Swiper |
| 状态管理 | Pinia + Vue `reactive` + bridge 协调层 |
| 音频 | Web Audio API、OfflineAudioContext、ConvolverNode、StereoPannerNode |
| 移动端打包 | Capacitor、Android Studio、Gradle |
| 版本控制 | Git / GitHub |

## 架构说明

项目按“视图层 — 协调层 — 状态层/引擎层 — 数据层”分层：

- 页面组件只调用 `bridge.js`，不直接操作音频引擎。
- `useAudio.ts` 负责音频上下文、多轨混音、音量与效果器；`synthEngine.ts` 负责程序化合成；`useTimer.ts` 负责睡眠定时器。
- 引擎不直接 import Store，通过 `setEngineCallbacks` 回调反向同步状态，避免循环依赖。
- 音效元数据统一放在 `src/data/sounds.js`，新增音效无需修改引擎代码。

## 快速开始

```bash
npm install
npm run dev      # 开发服务器，默认 http://localhost:5173
npm run build    # 生产构建
npm run preview  # 预览构建产物
```

## Android 打包

```bash
npm run build
npx cap sync android
npx cap open android
```

在 Android Studio 中通过 **Build → Generate Signed Bundle / APK** 生成签名 release APK，输出路径：

```
android/app/build/outputs/apk/release/app-release.apk
```

> 签名密钥库与密码请勿提交至 Git。

## 项目结构（简）

```
src/
├── main.js / App.vue          # 入口、生命周期、预加载与销毁
├── view/                      # 发现页、计时器页、我的页、Tab 容器
├── composables/
│   ├── useAudio.ts            # 音频引擎
│   ├── synthEngine.ts         # 程序化合成
│   └── useTimer.ts            # 睡眠定时器
├── store/                     # audio / bridge / mixer / presets / stats / theme
└── data/sounds.js             # 音效元数据与合成配置（唯一来源）
```

## 小组分工

| 成员 | 负责内容 |
|---|---|
| 游雅茜（组长） | 音频引擎、程序化合成、睡眠定时器、`audioStore`、`bridge.js`、音效元数据、应用生命周期、Capacitor 配置与签名 APK；架构拆分与联调 |
| 郝月莉 | 发现页、计时器页、我的页、底部 Tab 与路由、mixer/preset/stats/theme Store、全局样式与主题、README、UI 打磨与移动端适配 |

## 课程信息

- 课程：HTML5 移动应用开发
- 项目类型：课程小组项目
- 仓库地址：`https://github.com/yyx-cat/white-noise`

---

**仓库 About 建议**：

> 基于 Vue 3 + Ionic + Web Audio 的白噪音助眠混音 App：多轨环境音、程序化合成、混响与 3D 环绕、睡眠定时器、预设与统计，支持 Capacitor Android 打包。

**Topics 建议**：`vue3` `vite` `ionic` `web-audio` `white-noise` `sleep-aid` `capacitor` `pinia`
