# MangaMap · 灵动导航 (Personal OS)

> 您的私人数字中枢。基于 Cloudflare Workers 的无服务器单页应用 (SPA)，采用 iOS 26 液态玻璃风格设计。

## ✨ 核心特性

- **🎨 视觉设计**：iOS 26 液态玻璃风格，动态流体背景、玻璃拟态效果及连续曲率圆角
- **⚡️ 性能优化**：智能缓存策略、原生图片懒加载、前端 Canvas 图片压缩
- **🔒 安全隐私**：Cloudflare KV 存储、密码校验 + Token 权限控制
- **📱 PWA 支持**：离线访问、可安装至移动设备主屏幕
- **☁️ 后端功能**：Worker 代理实现跨域标题抓取、站点存活检测

## 📂 项目结构

```text
/
├── index.html        # 单页入口
├── style.css         # 核心样式
├── script.js         # 前端逻辑
├── sw.js             # Service Worker
├── manifest.json     # PWA 配置
├── blackcat.svg      # 浏览器图标
└── image/
    └── logo.png      # 移动设备图标
```

## 🚀 部署说明 (Cloudflare Workers)

1. **准备工作**：创建 KV Namespace `NAV_DATA`
2. **配置 Worker**：部署 `worker.js` 并绑定 KV (变量名 `NAV_DATA`)
3. **初始化密码**：在 KV 中添加键值对 `site_password`
4. **前端配置**：修改 `script.js` 中的 `API_BASE` 为你的 Worker 地址

Copyright © 2025 MangaMap. All rights reserved.