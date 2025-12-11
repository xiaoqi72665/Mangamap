# MangaMap · 灵动导航 (Personal OS)

  

> 您的私人数字中枢。基于 Cloudflare Workers 的无服务器单页应用 (SPA)，采用 iOS 26 概念设计的“液态玻璃”风格。

## ✨ 核心特性

  * **🎨 极致视觉**：模拟 iOS 26 概念设计，拥有动态流体背景、高斯模糊玻璃拟态 (Glassmorphism) 及 Squircle 连续曲率圆角。
  * **⚡️ 极速性能**：
      * **智能缓存**：主数据 5 分钟缓存，站点状态 12 小时缓存，拒绝多余请求。
      * **图片懒加载**：原生 `loading="lazy"` + `decoding="async"`。
      * **体积优化**：前端自动压缩上传图片（Canvas），解决 KV 存储限制。
  * **🔒 安全隐私**：
      * 基于 Cloudflare KV 的数据存储。
      * 完整的访问控制（密码校验 + Token 机制）。
      * 敏感操作（编辑/删除）权限验证。
  * **📱 PWA 支持**：原生 App 般的体验，支持离线访问，可安装至 iOS/Android 主屏幕。
  * **☁️ 强大的后端**：Worker 代理实现跨域标题抓取、站点存活检测。

-----

## 🛠️ 开发日志 (Dev Log)

### v2.0 重构 - "Liquid Glass" 更新

本次更新主要针对 UI 交互、性能瓶颈及数据存储逻辑进行了全面重构。

#### 1\. UI/UX 界面重构

  - [x] **设计语言升级**：从扁平化改为 **iOS 26 Liquid Glass** 风格。
      - 背景增加 3 个动态游走的彩色光球 (`.orb`)。
      - 全局应用高饱和度背景模糊 (`backdrop-filter: blur(40px) saturate(180%)`)。
  - [x] **卡片布局优化**：
      - 弃用纵向卡片，改为 **iOS Widget 横向胶囊** 布局。
      - 图标容器去边框化，增加内发光质感。
      - 操作按钮（编辑/删除）改为悬停触发的右上角浮动气泡。
  - [x] **交互体验**：
      - 增加输入框聚焦光晕效果。
      - 优化模态框（Modal）的弹出动画 (`scaleIn`)。

#### 2\. 性能与网络优化

  - [x] **请求熔断机制**：
      - **站点状态检测**：引入 LocalStorage 缓存，有效期 **1 小时**。未过期时直接读取缓存，将 Worker 请求数降低 95% 以上。
      - **主数据同步**：引入 **5 分钟** 间隔锁，避免频繁刷新导致重复拉取巨大的 JSON 数据。
  - [x] **资源加载优化**：
      - 为所有图标添加 `loading="lazy"` 和 `decoding="async"` 属性，提升首屏渲染速度。

#### 3\. 功能增强 (前端 + Worker)

  - [x] **图片上传黑科技**：
      - 解决了 LocalStorage 和 KV 的体积限制。
      - **实现逻辑**：前端利用 `<canvas>` 将上传的大图自动压缩裁剪为 128px 的 JPEG (Base64)，体积从 MB 级降至 KB 级。
  - [x] **自动获取标题**：
      - 新增 Worker 接口 `/getTitle?url=xxx`。
      - 输入网址后失焦，自动抓取目标网页 `<title>` 并回填到输入框。
  - [x] **PWA 完整支持**：
      - 补全 `manifest.json` 和 `sw.js`。
      - 解决 iOS 图标兼容性问题（SVG 用于浏览器，PNG 用于主屏幕）。

-----

## 📂 项目结构

```text
/
├── index.html        # 单页入口 (PWA, Meta, UI结构)
├── style.css         # 核心样式 (CSS Variables, Animations, Glassmorphism)
├── script.js         # 前端逻辑 (Auth, Canvas压缩, 缓存策略, DOM操作)
├── sw.js             # Service Worker (离线缓存策略)
├── manifest.json     # PWA 配置文件
├── blackcat.svg      # 浏览器标签页图标 (高清 SVG)
└── image/
    └── logo.png      # 移动端主屏幕图标 (512x512 PNG)
```

## 🚀 部署说明 (Cloudflare Workers)

### 1\. 准备工作

在 Cloudflare 后台创建一个 KV Namespace，命名为 `NAV_DATA`。

### 2\. 配置 Worker

将 `worker.js` 的内容部署到 Cloudflare Workers，并绑定 KV：

  - **Variable Name**: `NAV_DATA`
  - **KV Namespace**: 选择刚才创建的空间

### 3\. 初始化密码

在 KV 中手动添加一个键值对：

  - **Key**: `site_password`
  - **Value**: `kk321`

### 4\. 前端配置

修改 `script.js` 顶部的 `API_BASE` 变量为你自己的 Worker 地址：

```javascript
const API_BASE = "https://nav-sync.2536319853.workers.dev/";
```

-----


Copyright © 2025 MangaMap. All rights reserved.