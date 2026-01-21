// 每次修改代码后，请修改这里的版本号 (例如 v1 -> v2)
// 这样浏览器才会知道有新版本，从而重新缓存文件
const CACHE_NAME = 'mangamap-v2';

// 使用相对路径 (./)，适应所有部署环境 (包括子目录)
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './blackcat.svg',
  './image/logo.png',
  './image/avatar.jpg' // 把头像也缓存进去
];

// 1. 安装阶段：缓存核心文件
self.addEventListener('install', (e) => {
  console.log('[SW] 安装 Service Worker...');
  // 强制立即接管页面，不用等待旧的 SW 关闭
  self.skipWaiting(); 
  
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] 正在缓存静态资源');
      return cache.addAll(ASSETS);
    })
  );
});

// 2. 激活阶段：清理旧缓存 (关键步骤！)
self.addEventListener('activate', (e) => {
  console.log('[SW] 激活 Service Worker...');
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          // 如果发现缓存名字不是当前的 CACHE_NAME，就删掉
          if (key !== CACHE_NAME) {
            console.log('[SW] 删除旧缓存:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  // 让 Service Worker 立即控制所有页面
  return self.clients.claim();
});

// 3. 拦截请求：优先查缓存，没有再走网络 (Stale-while-revalidate 策略的简化版)
self.addEventListener('fetch', (e) => {
  // 如果是 API 请求 (Cloudflare Worker)，直接走网络，不缓存
  // 避免 API 数据更新了，页面显示的还是旧数据
  if (e.request.url.includes('workers.dev')) {
    return; 
  }

  e.respondWith(
    caches.match(e.request).then((response) => {
      // 如果缓存里有，直接返回缓存
      if (response) {
        return response;
      }
      // 否则去网络请求
      return fetch(e.request);
    })
  );
});