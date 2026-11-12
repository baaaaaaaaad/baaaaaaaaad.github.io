# AGENTS.md

Gist Blog（无后台）— GitHub Pages + Gist + GitHub API

本文件是仓库的唯一项目说明（已合并原 `README.md`），同时作为编码代理的工作指南。修改代码前请先阅读「项目结构」「数据读写」「已知陷阱」。

## 项目概览

纯静态、无后台的 Gist 博客，部署在 GitHub Pages（用户站点 `baaaaaaaaad.github.io`）。

- 托管：GitHub Pages，`main` 分支根目录直接发布，无构建步骤。
- 存储：GitHub Gist，`index.json` 保存文章元数据，每篇文章一个 `YYYY-MM-DD--slug.md`。
- 读写：浏览器直接调用 GitHub API；读取匿名，写入需要 PAT（仅 `gist` 权限）。
- 技术栈：原生 HTML / CSS / JavaScript ES Modules（无框架、无包管理、无打包器、无测试）。
- 页面语言与注释：中文。新增注释、文档、提交说明保持中文风格。

> 写操作需要 Personal Access Token（PAT），仅勾选 `gist` 权限。
> 切勿把 PAT 写进源码；管理页只把 PAT 存进当前浏览器的 `localStorage`，并提供一键清除。

## 快速开始

1. 在 https://gist.github.com/new 创建 **公开 Gist**，添加 `index.json` 文件：

   ```json
   {
     "version": 1,
     "site": { "title": "Blog For Navigation", "description": "博客由 Gist 驱动", "author": "yourname" },
     "posts": []
   }
   ```

   记下 **Gist ID**（URL 末尾的一长串）。

2. 打开 `res/js/config.js`，把 `GIST_ID`、`OWNER` 改为你的实际值。
3. 把本项目所有文件推送到你的 GitHub Pages 仓库（根目录或 `docs/`）。
4. 在仓库 Settings → Pages 启用 Pages，访问站点。
5. `res/js/gist.js` 顶部 `USE_MOCK_DATA` 决定是否走内存 Mock（默认 `false`，直接访问真实 Gist）。
   本地调试时可以临时改回 `true`，所有读写都短路到内存变量，刷新会丢失。
6. 第一次发布：进入 `admin.html`，粘贴**仅 `gist` 权限**的 PAT，填好内容后点击「保存」。

## 本地预览

不要用 `file://` 直接打开，ES Modules 与 `fetch` 会被浏览器拦截。在仓库根目录起静态服务器：

```powershell
python -m http.server 8000
# 或
npx --yes serve .
```

然后访问 `http://localhost:8000/`。没有 install、build、lint、test 命令。

## 页面

- `index.html`：首页时钟、搜索与文章列表（标签筛选、搜索、分页）。
- `post.html?slug=...`：文章详情页。
- `admin.html`：管理页（新建 / 编辑 / 删除文章，需要 PAT）。三个页面共用主题偏好。

三页都默认 `body.dark-mode`，首次访问显示暗色主题；主题状态存 `localStorage.theme`。右上角主题按钮行为：

- **首页**：单击延迟 250ms 切换主题（走 view-transition 圆形扩散），双击切换浏览器全屏，三击显示/隐藏搜索框与文章列表按钮。
- **管理页**：单击切换主题（不做计数），同样走 view-transition 动画。

首页默认隐藏搜索框与文章列表按钮，`body.controls-visible` 控制显隐，状态存 `localStorage.indexControlsVisible`，键盘 `Shift+T` 也能切换。

首页背景会按清晨、白天、黄昏、夜晚切换极淡的氛围色；日期下方显示「今日进度」；文章列表使用卡片、标签与入场动画。

## 实际文件结构

```text
.
├─ sw.js                       # Service Worker：静态资源 cache-first，HTML/Gist API network-first
├─ index.html                 # 首页 + 内嵌文章列表页
├─ post.html                  # 文章详情页
├─ admin.html                 # 管理页
├─ res/
│  ├─ css/index.css           # 全站唯一样式表（主题变量 + 响应式 + 详情/管理页基础布局）
│  ├─ icon/                   # favicon 与搜索引擎图标
│  └─ js/
│     ├─ config.js            # 导出 CONFIG（GIST_ID / OWNER / SITE_* / PAGE_SIZE）
│     ├─ gist.js              # GitHub API 封装、Mock 数据、Gist、Util
│     ├─ index.js             # 首页入口：列表、时钟、主题、搜索、页面切换
│     ├─ post.js              # 详情页入口：解析 Front Matter 并渲染 Markdown
│     ├─ admin.js             # 管理页入口：新建 / 编辑 / 删除
│     ├─ nav.js               # 详情页与管理页共用的导航条（经典脚本，非模块）
│     ├─ sw-register.js       # 三页共同的 SW 注册脚本（经典脚本，defer）
│     └─ vendor/
│        ├─ marked.min.js     # Markdown 渲染器（本地 UMD 构建，暴露全局 marked）
│        └─ purify.min.js     # XSS 过滤器（本地 UMD 构建，暴露全局 DOMPurify）
├─ sample-gist-files/         # Gist 数据示例，仅参考，不会自动上传
└─ .gitignore
```

`config.js` 与 `gist.js` 是三个页面入口共享的模块；修改数据读写行为时只需改这两处。

页面加载关系（修改时保持一致）：

- `index.html`：`res/css/index.css` + `type="module"` 的 `res/js/index.js` + `res/js/sw-register.js`（defer）。首页导航与主题按钮均为静态 HTML，不需要 `nav.js`。
- `post.html`：`res/css/index.css` + 本地 `res/js/vendor/marked.min.js` / `purify.min.js`（UMD，暴露全局 `marked` / `DOMPurify`）+ `res/js/nav.js`（defer）+ `type="module"` 的 `res/js/post.js` + `res/js/sw-register.js`（defer）。
- `admin.html`：`res/css/index.css` + `res/js/nav.js`（defer）+ `type="module"` 的 `res/js/admin.js` + `res/js/sw-register.js`（defer）。右上角主题按钮为静态 HTML，主题切换逻辑内嵌在 `admin.js`（同模块内定义 `applyTheme/setTheme/setupThemeToggle`）。

不要再引用 `js/`、`css/` 或 `res/js/merged.js`，这些旧路径已经不存在。不要改回 CDN 加载 marked / DOMPurify。

## 数据读写

`res/js/gist.js` 是唯一的 Gist 访问层，导出 `Gist` 与 `Util`；`res/js/config.js` 是唯一配置来源。

- `CONFIG.GIST_ID`：当前为真实 Gist ID。
- `CONFIG.OWNER`：仅展示用，不参与鉴权。
- `CONFIG.PAGE_SIZE`：列表分页大小，默认 10。
- `USE_MOCK_DATA`（`res/js/gist.js` 顶部）：**当前为 `false`**，所有读写走真实 GitHub API。本地调试时临时改为 `true`，刷新后 Mock 内存会重置——如果线上保存刷新后没了，先检查是不是被改成 `true`。
- 修改数据行为时，Mock 与真实 API 两条分支都要保持一致（`getGist/getIndex/getPostFile/upsertPost/deletePost`）。

`index.json` 的结构：

```json
{
  "version": 1,
  "site": { "title": "...", "description": "...", "author": "..." },
  "posts": [
    {
      "title": "...",
      "slug": "...",
      "filename": "YYYY-MM-DD--slug.md",
      "tags": ["..."],
      "summary": "...",
      "status": "published",
      "created_at": "ISO-8601",
      "updated_at": "ISO-8601"
    }
  ]
}
```

约定：

- 列表只展示 `status === 'published'` 的文章，按 `created_at` 倒序。
- Markdown 文件带 YAML Front Matter（冗余存储元数据），但 `index.json` 才是主数据源。
- 文件名由「UTC 日期 + slug」生成；更新文章时复用原文件名，避免链接失效。
- 删除文章 = 在 Gist PATCH 请求中把该文件名设为 `null`，同时回写 `index.json`。
- `slug` 生成规则见 `res/js/gist.js` 的 `Util.slugify`：小写、保留中英文数字、空白转 `-`。

示例数据见 `sample-gist-files/`，仅参考，不会自动上传到 Gist。

## 编码约定

- 纯原生 JS，不引入框架、包管理器或打包流程；第三方库优先下载 UMD 构建到 `res/js/vendor/`，暴露全局变量后直接 `<script src>` 引用。**下载后必须验证文件内容**（Read 前几行确认有代码），不能只看文件存在——jsdelivr 等 CDN 偶尔返回 502 时 PowerShell 的 `Invoke-WebRequest` / `curl` 不会报错但会写 0 字节空文件，浏览器加载后全局变量 undefined，`post.js` 会触发「Markdown 渲染资源加载失败」提示。首选 unpkg.com 做下载源（`https://unpkg.com/<pkg>@<version>/<file>`）。
- 入口脚本使用 ES Modules；`nav.js` 保持经典脚本，便于直接通过 `<script defer>` 加载。
- 路径统一相对当前页面，静态资源放在 `res/` 下。
- 样式只改 `res/css/index.css`；使用已有 CSS 变量（`--bg-color`、`--text-color`、`--accent-color` 等）和 `clamp()` 响应式写法。
- 首页与详情/管理页的布局通过 `body.post-page`、`body.admin-page` 隔离，不要破坏首页的 flex 居中布局。
- 主题切换依赖 `body.dark-mode` 与 `localStorage.theme`，三页默认 `<body class="dark-mode">` 防止刷新闪烁；JS 初始化若 localStorage 无值则回退到 `'dark'`。admin.js 内嵌了一份简化版主题切换逻辑（单级点击，不做计数），和 index.js 的 API 语义保持一致（`applyTheme/setTheme/setupThemeToggle`）。
- DOM 查询使用 `document.querySelector` 并保持空值判断；页面入口脚本只应操作本页存在的元素。
- 缩进：CSS 4 空格；JS 2 空格。
- 注释使用中文，不要为显而易见的代码新增注释。

## 安全提示

- PAT 权限**仅勾选 `gist`**；不要勾选 `repo` 或其他权限。
- PAT 只保存在浏览器本地（`localStorage.gh_pat`），可在管理页右上角随时清除。
- 切勿把 PAT 写入源码、示例、日志或提交记录。

## 待办事项（`admin.html` / `admin.js` 优化）

> 以下为 2026-11-11 整理的管理页优化点，尚未实施，等用户确认后再动手。

### 功能完整性


### 安全 / 隐私

- ~~**PAT 输入框为 `type="text"`** — PAT 明文回显在输入框里，任何人在旁观屏幕时可见。可考虑 `type="password"` + 一键显示/隐藏。~~ ✅ 已修复：改为 `type="password"`，带 👁/🙈 眼睛按钮切换。

### 交互体验

- ~~**缺少空状态** — 文章列表为空时表格完全空白，没有「还没有文章，点击新建」之类的引导。~~ ✅ 已修复：`renderTable` 在 posts 为空时显示引导行（colspan="6"）。
- ~~**缺少加载状态** — `loadIndex()` 是异步的，拉取期间表格为空，用户无法判断是「没有文章」还是「正在加载」。~~ ✅ 已修复：`loadIndex` 开头先写「加载中...」行，catch 兜底写错误行。
- ~~**「新建」按钮无确认** — 点击会直接清空表单，若正在编辑某篇文章，内容会瞬间丢失且无撤销途径。~~ ✅ 已修复：检测 `editingFilename` 或表单有内容时弹 `confirm`，取消则 return。
- ~~**无标题校验** — 保存时空标题也可以写入成功，可能产生脏数据。~~ ✅ 已修复：`upsert` 开头校验 `meta.title`，为空时 toast 提示并 return，不会触发 API 调用。

### 可维护性 / 边界情况

- ~~**slug 与文件名的关系无提示** — 更新时复用旧文件名（避免外链失效），但用户在 slug 输入框改了 slug 后，文件名并不变化，容易困惑。可加一行说明。~~ ✅ 已修复：`setForm` 编辑时在 slug 下方显示灰字 hint，内容包含实际锁定的文件名。
- ~~**长列表无分页** — 文章数量多时表格会很长，且前端渲染全部行。~~ ✅ 已修复：表格外包 `.table-wrapper`，`max-height: 480px; overflow-y: auto`，小屏 `320px`；thead 用 `position: sticky` 固定表头。管理场景下内部滚动比分页更友好（能一眼对比所有条目）。
- ~~**小屏表单布局** — `.controls` grid `1fr 1fr` 在移动端会挤压，`@media (max-width: 768px)` 未覆盖管理页表单。~~ ✅ 已修复：inline style 搬到 `.admin-form-grid` + `.admin-col-span` 类，media query 下变成单列；`.pat-controls` 也加了小屏 flex-direction:column。
- ~~**Front Matter 解析较弱** — 编辑时用简单的 `indexOf(':')` 解析 YAML，对带冒号的值、嵌套结构会出错。当前数据格式简单所以能用，但属于脆弱实现。~~ ✅ 已彻底移除：编辑时元数据全从 `currentPosts`（即 index.json）拿，.md 文件只做"剥掉 front matter 外壳"拿正文（`md.replace(/^---[\s\S]*?---\n?/, '')`），不再解析 YAML。`setForm(meta, editingFilename)` 第二个参数控制 slug hint 显隐。

### 样式

- ~~**Toast 可能被移动端键盘遮挡** — `position: fixed; bottom: 30px` 在弹出输入法时可能不可见。~~ ✅ 已修复：Toast 从底部挪到顶部（`top: 30px`），顶部永远不被软键盘遮挡；换为强调色 + 阴影让它更像系统通知。
- ~~**表格无横向滚动** — 列多时小屏可能溢出容器。~~ ✅ 已修复：`.table-wrapper` 加 `overflow-x: auto`，内部 `.table` 设 `white-space: nowrap; min-width: 720px`，窄屏自动出现横向滚动条，列不再被挤压。

## 可选扩展

- ~~**使用 GitHub OAuth 替代 PAT 粘贴**~~ ❌ 当前架构不可行：GitHub 已移除 Device Flow（2021）；PKCE / Authorization Code 流程的 client_secret 不能放纯静态前端；GitHub Pages 无后端做 token 交换。保留 PAT 方案。
- ~~**增加 Service Worker 做离线缓存**~~ ✅ 已实现：根目录 `sw.js` + `res/js/sw-register.js` 三页共同注册。缓存策略——静态资源（HTML/CSS/JS/vendor/icon）cache-first；导航请求与 Gist API network-first（失败时回退缓存）。每次部署改 cache 名 `static-vN` 触发更新。
- **在 `index.json` 里保留关键词字段做更快的前端搜索** — 当前 `applyFilter` 已用 `${title} ${summary} ${tags}` 拼接 + `toLowerCase().includes()`，几十篇文章下 1ms 级完成，暂无瓶颈。文章超过 200 篇时再考虑。
- ~~**将 `marked` / `DOMPurify` 下载到本地避免依赖 CDN**~~ ✅ 已完成：下载 UMD 构建到 `res/js/vendor/marked.min.js` + `purify.min.js`，`post.html` 改本地路径。暴露全局 `marked` / `DOMPurify`，`post.js` 检查 `typeof` 的守卫仍然生效。

## 已知陷阱

- 三个页面入口已按页面拆分：`index.js`、`post.js`、`admin.js` 各自只加载一次。新增页面时不要把它们全部引入，否则会重复绑定事件。
- `res/js/index.js` 是 ES Module，顶层函数不会挂到 `window`；不要在 HTML 里用 `onclick="searchWithEngine(...)"` 之类的内联写法，统一用 `addEventListener` 绑定。
- `res/js/index.js` 顶部仍会调用列表 `main()`，但已用 `#post-list` 存在性做守卫；不要在无列表元素的页面加载它。
- 管理页保存依赖模块变量 `editingFilename`：`null` 表示新建，非空表示更新。不要再给 `#save` 额外设置 `onclick`，否则会重复写入。
- 管理页更新文章时会从 `currentPosts` 保留 `created_at`；不要退回为每次保存都使用当前时间。
- `post.html` 依赖本地 UMD 构建的 `marked` 与 `DOMPurify`（`res/js/vendor/`），渲染必须经过 `DOMPurify.sanitize`，不要绕过。`post.js` 已对 `typeof marked` / `typeof DOMPurify` 缺失给出明确提示。不要改回 CDN 引用。
- 首页文章列表按钮使用内联 SVG，已移除 Font Awesome；不要为单个图标重新引入整站图标库。
- 首页 `.search-container` 与 `#page-toggle` 默认隐藏；`#theme-toggle` 使用计数机制（250ms 内累计点击数）派发动作：单击=切换主题、双击=浏览器全屏、三击=切换显隐。键盘 `Shift+T` 是显隐控件的替代快捷键。不要改回即时 click 处理，否则多击时会多次触发主题切换。
- admin 页的 `#theme-toggle` 简化为单击切换主题（不做计数），因为管理页没有搜索框，也不需要全屏入口。
- `toggleFullscreen()` 使用 WebKit/MS 前缀做兼容，iOS Safari 与部分受限 WebView 不支持会静默跳过；不要依赖其返回值。
- 时钟跳动动画依赖 `void el.offsetWidth` 强制 reflow 来重触发同名 CSS animation；移除动画类后不加 reflow 直接 `classList.add` 不会产生动画。`.clock .char[class*="char-jump"] { transition: none }` 在动画期间禁用元素上的 `transition: all`，两者缺一不可。
- 键盘快捷键与焦点样式是无障碍替代：`Shift+T` 切换控件显隐；不要删除全局 `:focus-visible` 规则。`prefers-reduced-motion` 会关闭字符跳动、卡片入场和主题圆形扩散，修改动画时保持该降级。
- 首页使用 `<main>` + `.sr-only` 的 `<h1>`，文章列表区域使用 `<section>`，避免同一文档出现多个 `<main>`。
- 首页氛围背景由 `body[data-time="dawn|day|dusk|night"]` 驱动，时间段在 `res/js/index.js` 的 `getTimeOfDay` 中计算；新增时间段时同步补 `res/css/index.css` 的 `--ambient-a` / `--ambient-b` 变量（含暗色主题）。
- 主题切换使用 `document.startViewTransition` + `html.theme-transitioning`；不支持或用户偏好减少动画时回退为直接切换。`--theme-x` / `--theme-y` 是圆形扩散的圆心，不要删除。
- 文章卡片由 `res/js/index.js` 的 `createPostCard` 生成，`#post-list.animate-in` 只用于首次加载和翻页；筛选输入时不要加该 class，否则每输入一个字符都会重播动画。

- 搜索引擎图标顺序保存在 `localStorage.searchEngineOrder`；搜索框有内容时禁止拖拽，这是有意行为。
- 搜索框清空按钮 `#search-clear` 由 `updateSearchAffordances` 根据输入内容显隐；`Esc` 会清空并失焦。输入框必须保留 `min-width: 0`，否则移动端会被搜索引擎图标挤爆。
- PAT 存在 `localStorage.gh_pat`，只用于 GitHub API 请求头，不得写入源码、示例、日志或提交记录。管理页初始化时若检测到已存 PAT，会自动把输入框 `disabled` + 灰化、隐藏眼睛按钮、提示 meta 改为「已在本地」；清除后恢复可编辑。
- `sw.js` 在根目录以最大 scope 注册，首次安装时预缓存 `STATIC_ASSETS` 中的固定列表；新增静态文件（CSS/JS/icon）时记得把路径加进去。部署更新时改 cache 名 `static-vN` 触发旧缓存淘汰。不要把 POST/PATCH 请求（API 写操作）放进缓存。
- `USE_MOCK_DATA = true` 时不会访问 GitHub，所有写操作只改内存，刷新后丢失；若线上"保存后刷新没了"或看到示例文章，先检查是不是被改成 `true`（当前默认 `false`）。
- `admin.js` 内嵌了 `applyTheme/setTheme/setupThemeToggle` 三个函数（不从 index.js 导入，避免跨模块依赖），修改主题逻辑时 index.js 和 admin.js 要同步更新。
- 不要提交任何 token、真实个人敏感信息；`.gitignore` 已忽略 `.vscode/`、`node_modules/`、`dist/`、`.vercel/`、`.old/`。

## 修改后的验证

无自动化测试，按以下清单人工验证：

1. `http://localhost:8000/` 时钟每**秒**触发跳动（不只是首次加载），小时个位→十位→分钟个位→十位→秒个位→十位跳动高度依次增大；日期与今日进度正确；首屏直接显示暗色（不闪烁亮色）。
2. 主题按钮：单击走 view-transition 圆形扩散切主题，**刷新后**持久化；双击进入浏览器全屏（ESC 原生退出）；三击显示/隐藏搜索框与列表按钮（状态栏存 `indexControlsVisible`）；`Shift+T` 快捷键可切换显隐。
3. 首页点击文章列表按钮，标签筛选、搜索、分页正常；「返回首页」可回到时钟页。
4. 下载/替换 vendor 依赖后，先 Read 文件前几行确认有实际代码（不是 0 字节空文件），再打开 `post.html?slug=...`，正文 Markdown 渲染正常、上一篇/下一篇链接可用；`Network` 面板确认 `marked.min.js` / `purify.min.js` 加载自 `res/js/vendor/`（不是 CDN）。若看到「Markdown 渲染资源加载失败」提示，优先检查 vendor 文件是否为空。
5. 打开 `admin.html`，首屏直接暗色、右上角有主题按钮且切换后和首页共享同一份 `localStorage.theme`；文章列表拉取期间表格显示「加载中...」，失败时显示错误提示，零数据时显示引导行（不是空白表格）。
   未设置 PAT 时：输入框可编辑、placeholder 为原始提示、meta 行显示「仅在本地使用」；保存后 → 输入框自动 disabled + 灰化、眼睛按钮隐藏、meta 行改为「已在本地」、placeholder 改为「已保存（点击清除后可修改）」；点击「清除」→ 恢复可编辑状态。
   标题为空点击保存 → toast「标题不能为空」、不触发 API。编辑中有内容点击「新建」→ 弹确认框，取消则不清空。
   点击某篇文章「编辑」→ 表单回填正确，slug 下方显示灰色 hint（含锁定的文件名），正文正确（YAML front matter 已剥离）；新建模式下 slug hint 隐藏。
   文章列表表格超过 6 行时表头固定、内部滚动；小屏（≤768px）下表单变单列，PAT 工具栏也变纵向。
   窄屏下表格出现横向滚动条（列不被挤压变形）；Toast 显示在顶部居中（软键盘弹出时不被遮挡）。
   新建、编辑、删除走真实 Gist（不是内存 Mock），刷新后持久化。
6. Service Worker：DevTools → Application → Service Workers 看到 `sw.js` 已注册；Cache Storage 里出现 `static-v1` 和 `dynamic-v1`；离线模式下刷新任意页面，静态资源仍能加载（Gist API 离线会显示缓存或错误提示）。
7. 系统启用「减少动态效果」后，字符跳动、卡片入场和主题圆形扩散应关闭，主题切换降级为直接切换；键盘 Tab 能看到清晰焦点。
8. 提交前运行 `git diff --check` 检查空白错误，并确认 `git status` 中没有 PAT 或本地配置文件。