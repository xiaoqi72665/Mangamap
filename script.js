(() => {
  // 定义 Worker 的地址
  const API_BASE = "https://nav-sync.2536319853.workers.dev";

  const STORAGE_KEYS = {
    auth: "mangamap_auth",
    links: "mangamap_links",
    token: "mangamap_token",
  };

  const fallbackIcon =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none"><rect width="64" height="64" rx="18" fill="rgba(255,255,255,0.1)"/><path d="M20 44V20h24v4H24v5h18v4H24v11h-4Zm22.5 0-7.5-9 7.5-9H48l-7.5 9L48 44h-5.5Z" fill="#fff" opacity="0.8"/></svg>'
    );

  // DOM 元素引用
  const linkGrid = document.getElementById("linkGrid");
  const loginForm = document.getElementById("loginForm");
  const passwordInput = document.getElementById("passwordInput");
  const authScreen = document.getElementById("authScreen");
  const authError = document.getElementById("authError");
  const addBtn = document.getElementById("addBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const modal = document.getElementById("modal");
  const closeModalBtn = document.getElementById("closeModalBtn");
  const cancelBtn = document.getElementById("cancelBtn");
  const linkForm = document.getElementById("linkForm");
  const nameInput = document.getElementById("nameInput");
  const urlInput = document.getElementById("urlInput");
  const categoryInput = document.getElementById("categoryInput");
  const iconPreview = document.getElementById("iconPreview");
  const iconFileInput = document.getElementById("iconFileInput");
  const iconUrlInput = document.getElementById("iconUrlInput");
  const editingIdInput = document.getElementById("editingId");
  const modalTitle = document.getElementById("modalTitle");
  const modalEyebrow = document.getElementById("modalEyebrow");
  const categoryNav = document.getElementById("categoryNav");
  const CATEGORY_OPTIONS = ["漫画", "动漫", "小说", "工具"];

  let links = [];
  let customIconData = "";
  let selectedCategory = "漫画";

  // --- 核心认证逻辑 ---

  async function checkPasswordRemote(password) {
    try {
      const resp = await fetch(`${API_BASE}/checkPassword`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      return await resp.json();
    } catch (err) {
      console.error("密码校验请求失败：", err);
      return { ok: false };
    }
  }

  async function autoLogin() {
    const token = localStorage.getItem(STORAGE_KEYS.token);
    // 1. 如果本地没有 token，直接返回 false（需要显示锁屏）
    if (!token) return false;

    try {
      // 2. 去 Worker 验证 token 是否过期
      const resp = await fetch(`${API_BASE}/verifyToken`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const result = await resp.json();

      if (result.ok) {
        // Token 有效，保持登录状态
        localStorage.setItem(STORAGE_KEYS.auth, "true");
        return true;
      } else {
        // Token 失效（过期或被顶号），清理本地存储
        console.log("Token 已失效");
        handleLogout(); 
        return false;
      }
    } catch (err) {
      console.error("自动登录网络错误：", err);
      // 网络连不上时，为了安全，通常要求重新输入密码
      return false;
    }
  }

  // --- 链接数据逻辑 ---

  function normalizeUrl(raw) {
    const value = raw.trim();
    if (!value) return "";
    if (/^https?:\/\//i.test(value)) return value;
    return `https://${value}`;
  }

  function getFavicon(url) {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
    } catch (_) {
      return fallbackIcon;
    }
  }

  function normalizeLink(item) {
    return {
      ...item,
      category: CATEGORY_OPTIONS.includes(item.category) ? item.category : "漫画",
    };
  }

// ♻️ 优化后的数据加载：带 5 分钟缓存
  async function loadLinks() {
    // 1. 优先加载本地缓存，实现秒开
    const cached = localStorage.getItem(STORAGE_KEYS.links);
    const lastSync = localStorage.getItem("mangamap_last_sync_time"); // 获取上次同步时间
    const SYNC_INTERVAL = 5 * 60 * 1000; // 设置缓存时间：5分钟

    if (cached) {
      links = JSON.parse(cached).map(normalizeLink);
      renderLinks(); // 立即渲染
    } else {
      // 如果本地完全没数据（第一次打开），设置默认数据
      links = getDefaultLinks();
      renderLinks();
    }

    // 2. 检查是否需要去云端同步
    const now = Date.now();
    // 如果有缓存，且距离上次同步不到 5 分钟，就跳过网络请求
    if (cached && lastSync && (now - parseInt(lastSync) < SYNC_INTERVAL)) {
      console.log("主数据命中缓存，跳过云端同步"); 
      return; 
    }

    // 3. 执行云端同步 (后台静默进行)
    try {
      const resp = await fetch(API_BASE);
      const data = await resp.json();
      if (Array.isArray(data) && data.length) {
        // 对比一下数据是否有变化（简单的长度对比，或者直接覆盖）
        links = data.map(normalizeLink);
        
        // 更新本地存储和同步时间
        localStorage.setItem(STORAGE_KEYS.links, JSON.stringify(links));
        localStorage.setItem("mangamap_last_sync_time", now.toString());
        
        // 重新渲染最新数据
        renderLinks(); 
      }
    } catch (err) {
      console.error("远程加载失败，继续使用缓存", err);
    }
  }

  async function saveLinks() {
    // 更新本地
    localStorage.setItem(STORAGE_KEYS.links, JSON.stringify(links));
    // ✅ 新增：保存时更新同步时间，避免刚保存完又去拉取旧数据
    localStorage.setItem("mangamap_last_sync_time", Date.now().toString());
    // 同步到 Worker KV
    try {
      await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(links),
      });
    } catch (err) {
      console.error("同步到云端失败", err);
    }
  }

// ♻️ 优化后的状态检查：带 12 小时缓存
  async function checkSiteStatus(url) {
    // 定义缓存键名，防止冲突
    const CACHE_KEY = `site_status_${url}`;
    // 定义缓存过期时间：1 小时 (毫秒)
    const EXPIRE_TIME = 1 * 60 * 60 * 1000; 

    // 1️⃣ 第一步：先检查本地缓存
    const cached = localStorage.getItem(CACHE_KEY);
    
    if (cached) {
      try {
        const { status, timestamp } = JSON.parse(cached);
        const now = Date.now();

        // 如果缓存存在，且距离上次检查没超过 12 小时
        if (now - timestamp < EXPIRE_TIME) {
          // console.log("命中缓存，不消耗 Worker:", url); // 调试用
          return status; // 直接返回结果，不发请求
        }
      } catch (e) {
        // 解析出错（比如旧数据格式不对），忽略，重新请求
        localStorage.removeItem(CACHE_KEY);
      }
    }

    // 2️⃣ 第二步：缓存失效或不存在，才请求 Worker
    try {
      const resp = await fetch(`${API_BASE}/check?url=${encodeURIComponent(url)}`);
      const data = await resp.json();
      const status = data.ok ? "ok" : "bad";

      // 3️⃣ 第三步：把新结果写入缓存
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        status: status,
        timestamp: Date.now() // 记录当前时间
      }));

      return status;
    } catch (err) {
      return "bad";
    }
  }

  function getDefaultLinks() {
    const samples = [
      { name: "MangaDex", url: "https://mangadex.org", category: "漫画" },
      { name: "GitHub", url: "https://github.com", category: "工具" },
    ];
    return samples.map((item) => ({
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
      name: item.name,
      url: item.url,
      category: item.category,
      icon: getFavicon(item.url),
    }));
  }

  // --- 界面控制逻辑 ---

  function setAuthenticated(value) {
    // 这里的逻辑很关键：如果 value 为 true，就加上 .hidden 隐藏锁屏
    if (value) {
        authScreen.classList.add("hidden");
        // 登录成功后，立即渲染当前分类
        setActiveCategory(selectedCategory);
    } else {
        authScreen.classList.remove("hidden");
    }
    localStorage.setItem(STORAGE_KEYS.auth, value ? "true" : "false");
  }

  function setActiveCategory(category) {
    if (!CATEGORY_OPTIONS.includes(category)) {
      category = "漫画";
    }
    selectedCategory = category;
    document.querySelectorAll(".nav-chip").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.category === category);
    });
    renderLinks();
  }

  function renderLinks() {
    linkGrid.innerHTML = "";
    const filtered = links.filter(
      (item) => (item.category || "漫画") === selectedCategory
    );

    if (!filtered.length) {
      const empty = document.createElement("div");
      empty.className = "glass card empty";
      empty.style.padding = "18px";
      empty.innerHTML = `<p style='color: var(--muted);'>当前分类「${selectedCategory}」还没有站点，点击右上角“新增站点”吧。</p>`;
      linkGrid.appendChild(empty);
      return;
    }

    const template = document.getElementById("linkCardTemplate");

    filtered.forEach((link) => {
      const clone = template.content.cloneNode(true);
      const statusDot = clone.querySelector(".status-indicator");
      statusDot.classList.add("status-loading");

      const anchor = clone.querySelector("a");
      const img = clone.querySelector("img");
      const title = clone.querySelector("h4");
      const desc = clone.querySelector("p");
      const editBtn = clone.querySelector(".edit");
      const delBtn = clone.querySelector(".delete");

      anchor.href = link.url;
      title.textContent = link.name;
      desc.textContent = link.url;
      img.src = link.icon || fallbackIcon;
      img.onerror = () => (img.src = fallbackIcon);

      checkSiteStatus(link.url).then((state) => {
        statusDot.classList.remove("status-loading");
        statusDot.classList.add(state === "ok" ? "status-ok" : "status-bad");
      });

      editBtn.addEventListener("click", (e) => {
          e.preventDefault(); 
          openModal(link);
      });
      delBtn.addEventListener("click", (e) => {
          e.preventDefault(); 
          handleDelete(link.id);
      });

      linkGrid.appendChild(clone);
    });
  }

  function handleDelete(id) {
    const target = links.find((l) => l.id === id);
    if (!target) return;
    if (!confirm(`删除「${target.name}」？`)) return;
    links = links.filter((link) => link.id !== id);
    saveLinks();
    renderLinks();
  }

  function openModal(link) {
    const editing = Boolean(link);
    modalTitle.textContent = editing ? "编辑站点" : "创建导航";
    modalEyebrow.textContent = editing ? "编辑" : "新增站点";

    nameInput.value = link?.name || "";
    urlInput.value = link?.url || "";
    categoryInput.value =
      link?.category && CATEGORY_OPTIONS.includes(link.category)
        ? link.category
        : selectedCategory;
    editingIdInput.value = link?.id || "";
    customIconData =
      link?.icon && link.icon.startsWith("data:") ? link.icon : "";
    iconUrlInput.value =
      link?.icon && !link.icon.startsWith("data:") ? link.icon : "";

    updateIconPreview();

    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    nameInput.focus();
  }

  function closeModal() {
    linkForm.reset();
    editingIdInput.value = "";
    customIconData = "";
    categoryInput.value = selectedCategory;
    iconUrlInput.value = "";
    updateIconPreview();
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
  }

  function updateIconPreview() {
    const url = normalizeUrl(urlInput.value);
    const manualUrl = iconUrlInput.value.trim();
    let src = fallbackIcon;
    src = manualUrl || customIconData || (url ? getFavicon(url) : fallbackIcon);
    iconPreview.src = src || fallbackIcon;
  }

  async function handleLogin(event) {
    event.preventDefault();
    const value = passwordInput.value.trim();
    if (!value) {
      authError.textContent = "请输入口令";
      return;
    }

    // 调用 Worker 检查密码
    const result = await checkPasswordRemote(value);

    if (!result.ok) {
      authError.textContent = "口令不正确";
      passwordInput.value = "";
      passwordInput.focus();
      return;
    }

    // ⭐ 关键点：保存 Token 到本地
    if (result.token) {
      localStorage.setItem(STORAGE_KEYS.token, result.token);
    }
    
    authError.textContent = "";
    // 解锁界面
    setAuthenticated(true);
  }

  function handleLogout() {
    localStorage.removeItem(STORAGE_KEYS.auth);
    localStorage.removeItem(STORAGE_KEYS.token);
    setAuthenticated(false);
  }

  function handleSave(event) {
    event.preventDefault();
    const name = nameInput.value.trim();
    const url = normalizeUrl(urlInput.value);
    const manualUrl = iconUrlInput.value.trim();
    const category = CATEGORY_OPTIONS.includes(categoryInput.value)
      ? categoryInput.value
      : "漫画";
    if (!name || !url) return;

    const payload = {
      id: editingIdInput.value || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`),
      name,
      url,
      category,
      icon: manualUrl || customIconData || getFavicon(url),
    };

    const index = links.findIndex((l) => l.id === payload.id);
    if (index >= 0) {
      links[index] = payload;
    } else {
      links.unshift(payload);
    }

    saveLinks();
    renderLinks();
    closeModal();
  }

function handleFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    // 限制：拦截超大文件
    if (file.size > 10 * 1024 * 1024) {
      alert("图片太大，请选择 10MB 以内的图片");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // 创建 Canvas 压缩
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const MAX_SIZE = 128; // 压缩到 128px
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        // 导出压缩后的 Base64
        customIconData = canvas.toDataURL("image/jpeg", 0.8);
        
        iconUrlInput.value = "";
        updateIconPreview();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function bindEvents() {
    loginForm.addEventListener("submit", handleLogin);
    logoutBtn.addEventListener("click", handleLogout);
    addBtn.addEventListener("click", () => openModal());
    closeModalBtn.addEventListener("click", closeModal);
    cancelBtn.addEventListener("click", closeModal);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });
    
    // --- 原有的图标预览 ---
    urlInput.addEventListener("input", updateIconPreview);
    iconUrlInput.addEventListener("input", updateIconPreview);
    
    // ==========================================
    // 🆕 新增：网址输入框失去焦点时，自动获取标题
    // ==========================================
    urlInput.addEventListener("blur", async () => {
      const url = normalizeUrl(urlInput.value);
      // 1. 如果没有网址，或者名称栏已经有字了，就不自动获取，防止覆盖用户写的
      if (!url || nameInput.value.trim() !== "") return;

      // 2. 显示加载状态
      nameInput.placeholder = "正在自动识别标题...";
      nameInput.value = ""; // 确保空着等待

      try {
        // 请求 Worker
        const resp = await fetch(`${API_BASE}/getTitle?url=${encodeURIComponent(url)}`);
        const data = await resp.json();

        // 3. 填充标题
        if (data.title) {
          nameInput.value = data.title;
          // 稍微清洗一下标题（有些网站标题特别长，比如 "Bilibili - 哔哩哔哩..."）
          // 这里可以根据喜好截断，或者保留原样
        } else {
            nameInput.placeholder = "无法识别，请手动输入";
        }
      } catch (err) {
        console.error("标题识别失败", err);
        nameInput.placeholder = "识别超时，请手动输入";
      }
    });
    // ==========================================

    iconFileInput.addEventListener("change", handleFileUpload);
    linkForm.addEventListener("submit", handleSave);
    categoryNav.addEventListener("click", (event) => {
      const btn = event.target.closest(".nav-chip");
      if (!btn) return;
      setActiveCategory(btn.dataset.category);
    });
  }

  // --- 初始化流程（修复版） ---
  async function init() {
    // 1. 绑定事件
    bindEvents();
    
    // 2. 更新图标预览
    updateIconPreview();

    // 3. 核心修复：优先执行自动登录检查
    // 如果本地有Token且有效，直接解锁，不显示锁屏界面
    const isLoggedIn = await autoLogin();
    setAuthenticated(isLoggedIn);

    // 4. 加载数据（无论是否登录都预加载数据，提升体验）
    await loadLinks();

      // --- 主题切换逻辑 ---
    const themeBtn = document.getElementById("themeBtn");
    const themes = ["theme-dark", "theme-light", "theme-colorful"];
    let currentThemeIndex = 0;

    function applyTheme(index) {
      // 移除所有主题类
      document.body.classList.remove(...themes);
      // 如果不是默认(索引0)，则添加对应类
      if (index > 0) {
        document.body.classList.add(themes[index]);
      }
      
      // 保存设置
      localStorage.setItem("mangamap_theme_index", index);
      currentThemeIndex = index;

      // 更新按钮图标 (可选：如果你想根据主题变图标)
      // 简单起见，这里可以让图标转一下表示切换成功
      themeBtn.style.transform = "rotate(360deg)";
      setTimeout(() => themeBtn.style.transform = "", 300);
    }

    // 初始化：读取上次的主题
    const savedTheme = localStorage.getItem("mangamap_theme_index");
    if (savedTheme) {
      applyTheme(parseInt(savedTheme));
    }

    // 绑定点击事件
    if (themeBtn) {
      themeBtn.addEventListener("click", () => {
        // 循环切换：0 -> 1 -> 2 -> 0
        const nextIndex = (currentThemeIndex + 1) % themes.length;
        applyTheme(nextIndex);
      });
    }
  }


  // ... (原有的 init 函数) ...

  // 🆕 PWA 注册逻辑
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('PWA Service Worker 注册成功', reg.scope))
        .catch(err => console.log('PWA 注册失败', err));
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();