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

- `index.html`：首页时钟、日期、今日进度，以及同页搜索和文章列表面板。
- `posts.html`：文章列表页（标签筛选、站内搜索、分页）。
- `search.html`：外部搜索引擎页（Bing / 百度 / Google，图标可拖拽排序，顺序存 `localStorage.searchEngineOrder`）。
- `post.html?slug=...`：文章详情页（Markdown 渲染、阅读排版、主题切换、上一篇/下一篇）。
- `admin.html`：管理页（新建 / 编辑 / 删除文章，需要 PAT）。

各页面 HTML 默认 `body.dark-mode`。文章列表页、独立搜索页和详情页使用共享主题模块，读取并保存 `localStorage.theme`，单击按钮切换主题；首页和管理页当前没有初始化共享导航与主题按钮，默认暗色，也不读取已保存主题。

首页使用雨景视频、静态雨景图及渐变兜底，日期下方显示「今日进度」；首页内通过方向按钮或方向键切换搜索与文章列表，向上进入全屏、向左进入管理页。文章列表使用卡片和标签。

### 雨景背景与排查

首页的 `#rain-background` 默认静音、循环、内联播放，由 `res/js/index.js` 设置视频地址并调用 `play()`；只有收到 `playing` 事件才显示视频。播放失败、页面隐藏或启用「减少动态效果」时显示 `res/img/rain.jpg`，图片不可用时使用渐变兜底；页面隐藏时暂停。`sw.js` 跳过 `rain.mp4`，离线时不能依赖视频播放。当前没有声音切换按钮。

**排查背景不显示：** 请求成功不代表视频已解码或开始播放；`play()` 的错误目前被静默处理。检查浏览器自动播放策略、编码、减少动态效果、页面隐藏和旧 Service Worker 缓存。

1. 在目标首页 DevTools 的 Console 执行：`const v = document.querySelector('#rain-background'); ({src: v.currentSrc, paused: v.paused, muted: v.muted, readyState: v.readyState, error: v.error?.message, playing: v.classList.contains('is-playing'), reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches, hidden: document.hidden})`。
2. 在未发生用户交互的刷新过程中观察 `play()` 的拒绝原因：`NotAllowedError` 指向自动播放策略；`NotSupportedError` 或媒体错误应检查实际响应内容、MIME 类型和浏览器支持的视频编码。直接在控制台手动调用 `play()` 可能受用户激活状态影响，不能单独证明自动播放策略。
3. 视频已设置 `muted`；若仍被拦截，检查目标浏览器策略，必要时评估用户交互后播放。若是编码问题则转换为兼容格式。修改静态资源后更新 `sw.js` 缓存版本，并确认浏览器加载到新版本。

## 实际文件结构

```text
.
├─ sw.js                       # Service Worker：静态资源 cache-first，HTML/Gist API network-first
├─ index.html                 # 首页
├─ posts.html                 # 文章列表页
├─ search.html                # 外部搜索引擎页
├─ post.html                  # 文章详情页
├─ admin.html                 # 管理页
├─ res/
│  ├─ css/index.css           # 全站唯一样式表（主题变量 + 响应式 + 详情/管理页基础布局）
│  ├─ icon/                   # favicon 与搜索引擎图标
│  ├─ video/rain.mp4          # 首页雨景背景视频
│  ├─ img/rain.jpg            # 首页静态背景兜底
│  └─ js/
│     ├─ config.js            # 导出 CONFIG（GIST_ID / OWNER / SITE_* / PAGE_SIZE）
│     ├─ gist.js              # GitHub API 封装、Mock 数据、Gist、Util
│     ├─ index.js             # 首页入口：时钟、背景、搜索与面板切换
│     ├─ posts.js             # 文章列表页入口：筛选、搜索、分页
│     ├─ search.js            # 搜索页入口：引擎选择、拖拽排序、回车搜索
│     ├─ post.js              # 详情页入口：渲染 Markdown、元信息与上下篇导航
│     ├─ admin.js             # 管理页入口：新建 / 编辑 / 删除
│     ├─ theme.js             # 文章列表 / 搜索 / 详情页共用的主题切换模块
│     ├─ nav.js               # 全站共享导航渲染器（ES Module，floating 变体）
│     ├─ sw-register.js       # 全站共用的 SW 注册脚本（经典脚本，defer）
│     └─ vendor/
│        ├─ marked.min.js     # Markdown 渲染器（本地 UMD 构建，暴露全局 marked）
│        └─ purify.min.js     # XSS 过滤器（本地 UMD 构建，暴露全局 DOMPurify）
├─ sample-gist-files/         # Gist 数据示例，仅参考，不会自动上传
└─ .gitignore
```

`config.js` 与 `gist.js` 是各页面入口共享的数据模块；文章列表、搜索与详情页使用 `theme.js`。修改数据行为时还需检查调用方和 Mock 分支。

页面加载关系（修改时保持一致）：

- `index.html`：`res/css/index.css` + `type="module"` 的 `res/js/index.js` + `res/js/sw-register.js`（defer）；使用首页自身的面板导航，不初始化共享导航。
- `posts.html`：`res/css/index.css` + `type="module"` 的 `res/js/posts.js` + `res/js/sw-register.js`（defer）。导航由 `posts.js` 导入 `nav.js` 渲染。
- `search.html`：`res/css/index.css` + `type="module"` 的 `res/js/search.js` + `res/js/sw-register.js`（defer）。搜索引擎图标为 `<button>`，可拖拽排序；导航由 `search.js` 导入 `nav.js` 渲染。
- `post.html`：`res/css/index.css` + 本地 `res/js/vendor/marked.min.js` / `purify.min.js`（UMD，暴露全局 `marked` / `DOMPurify`）+ `type="module"` 的 `res/js/post.js` + `res/js/sw-register.js`（defer）。`post.js` 导入 `nav.js` 渲染 floating 导航，并在 `DOMContentLoaded` 后从 `theme.js` 初始化主题。
- `admin.html`：`res/css/index.css` + `type="module"` 的 `res/js/admin.js` + `res/js/sw-register.js`（defer）；当前未初始化共享导航及主题切换。

不要再引用 `js/`、`css/` 或 `res/js/merged.js`，这些旧路径已经不存在。不要改回 CDN 加载 marked / DOMPurify。

## 功能清单与回归约定

修改相关代码时，应按本节及「修改后的验证」检查受影响功能和相邻调用方；未能验证的项目须明确说明，不能把 Mock 成功当成真实 API 或离线验证。以下描述当前行为，不表示所有边界都是期望设计。

### 首页与同页搜索

- 首页默认暗色；本地时钟每秒更新，日期和今日进度按本地时间计算；减少动态效果时关闭时钟动画。背景默认静音播放，静态图和渐变是播放前及失败时的兜底。
- 首页方向按钮及方向键：上切换全屏、左方向键或左按钮在 2 秒间隔内累计三次进入管理页、下进入文章面板、右进入搜索面板；左键长按重复事件不计数，切换面板、全屏状态变化或页面失焦时重置计数。全屏时方向导航隐藏且不可聚焦，但首页左方向键仍可使用。搜索面板左方向键、文章面板顶部上方向键或非输入控件内的 Esc 返回首页。文章面板未到顶部时上方向键保留原生滚动；输入、选择等控件内不拦截方向键。
- 切换面板同步 `inert`、`aria-hidden` 和焦点；离开首页时方向导航不可交互。首页不再使用滑动手势导航，文章面板保留原生触摸滚动。
- 同页搜索支持点击引擎或 Enter/空格激活图标，输入框回车使用排序首位引擎；空输入不跳转。引擎拖拽顺序存 `localStorage.searchEngineOrder`，有输入时禁止拖拽；本面板没有清空按钮和空输入提示，不应与独立搜索页混淆。

### 文章列表与详情

- 首页内嵌列表空闲预取，提前进入立即加载；加载动画、失败重试、并发去重和加载中筛选须正常。独立 `posts.html` 启动加载，当前没有重试按钮，加载成功后才绑定筛选事件。
- 两处列表展示已发布文章，按创建时间倒序，按标签精确筛选、标题/摘要/标签不区分大小写搜索，默认每页 10 篇；空列表与无匹配结果提示不同。标签选项目前来自全部索引，包括草稿。筛选返回第一页，不重复播放卡片入场动画。
- 翻页后首页滚动面板归顶、独立列表滚动文档归顶；键盘激活翻页后焦点转到首篇链接，页码使用 live region。细原生滚动条遵循系统显示设置，不保证所有平台停止滚动时自动隐藏。
- 详情通过 slug 定位，读取元数据、渲染经 DOMPurify 净化的 Markdown，处理开头重复 H1；上下篇只在已发布文章中按创建时间升序确定，无相邻文章时隐藏导航。缺参数、资源或文件及请求失败均需显示错误并结束加载状态。
- 当前详情查找不检查 `status`，知道 slug 的人可能访问公开 Gist 中的草稿；草稿状态不是访问控制。修改 slug 会改变详情 URL，即使文件名保持不变也不能保证旧链接有效。

### 独立搜索、主题与管理

- 独立搜索页支持 Bing、百度、Google：回车使用首个引擎、点击或键盘激活指定引擎；空输入提示且不跳转，清空按钮清空并聚焦，Esc 清空并失焦。顺序与首页共用本地存储，拖拽排序目前没有键盘排序替代。
- 文章列表、独立搜索和详情页由 `renderNav` 渲染导航，再初始化共享主题；主题持久化，支持 View Transition，不支持或减少动态效果时直接切换。首页和管理页目前没有共享主题按钮。
- 管理页提供 PAT 保存、显隐和确认清除；文章表格有加载、空和错误状态，支持编辑、删除及新建。仅在受控测试 Gist 上验证写操作：新建/更新同步写 Markdown 与索引，编辑保留创建时间及原文件名，删除需确认；空标题不写入，清空已有编辑内容前需确认。
- 当前新建确认只检查编辑状态、标题和正文；slug 缺少唯一性校验，索引可能重复保存正文，多客户端写入可能覆盖。管理表格将索引字段插入 `innerHTML`，存在注入风险；这些是待处理边界，不应当作安全保证。

### 数据、离线与无障碍

- 真实读取匿名访问公开 Gist；写入使用本地 PAT，Mock 只修改内存、刷新重置，不验证真实鉴权和持久化。详情复用 Gist 响应；正文只有 `truncated === false` 且 `content` 为字符串时使用内嵌内容，否则走 raw URL；索引走 raw URL。
- Service Worker 仅处理 GET：API 和导航 network-first，其他同源静态资源 cache-first；视频和跨域 raw 不在其缓存策略内。HTTP 错误、离线详情回退与版本更新存在待验证限制，不应承诺离线正文必定可用。
- 保留可见键盘焦点、语义标签、live region、加载状态、窄屏可操作性及 `prefers-reduced-motion` 降级；验证滚动条时保留原生滚动和系统辅助功能偏好。

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
- 文件名由「UTC 日期 + slug」生成；更新时复用原文件名。文章 URL 使用 slug，修改 slug 仍会使旧链接失效。
- 删除文章 = 在 Gist PATCH 请求中把该文件名设为 `null`，同时回写 `index.json`。
- `slug` 生成规则见 `res/js/gist.js` 的 `Util.slugify`：小写、保留中英文数字、空白转 `-`。

示例数据见 `sample-gist-files/`，仅参考，不会自动上传到 Gist。

## 编码约定

- 纯原生 JS，不引入框架、包管理器或打包流程；第三方库优先下载 UMD 构建到 `res/js/vendor/`，暴露全局变量后直接 `<script src>` 引用。**下载后必须验证文件内容**（Read 前几行确认有代码），不能只看文件存在——jsdelivr 等 CDN 偶尔返回 502 时 PowerShell 的 `Invoke-WebRequest` / `curl` 不会报错但会写 0 字节空文件，浏览器加载后全局变量 undefined，`post.js` 会触发「Markdown 渲染资源加载失败」提示。首选 unpkg.com 做下载源（`https://unpkg.com/<pkg>@<version>/<file>`）。
- 入口脚本使用 ES Modules；`nav.js` 也是 ES Module，由各页面入口导入并调用 `renderNav(page)`，不再通过独立 `<script>` 标签加载。
- 路径统一相对当前页面，静态资源放在 `res/` 下。
- 样式只改 `res/css/index.css`；使用已有 CSS 变量（`--bg-color`、`--text-color`、`--accent-color` 等）和 `clamp()` 响应式写法。
- 首页与文章列表/详情/管理页的布局通过 `body.posts-page`、`body.post-page`、`body.admin-page` 隔离，不要破坏首页的 flex 居中布局。
- 页面默认 `body.dark-mode`；文章列表、独立搜索和详情页通过 `res/js/theme.js` 读取并保存 `localStorage.theme`，缺省为暗色。首页和管理页目前不初始化该模块；不要误认为它们已共享主题。
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

- [x]  ~~**PAT 输入框为 `type="text"`** — PAT 明文回显在输入框里，任何人在旁观屏幕时可见。可考虑 `type="password"` + 一键显示/隐藏。~~ ✅ 已修复：改为 `type="password"`，带 👁/🙈 眼睛按钮切换。

### 交互体验

- [x]  ~~**缺少空状态** — 文章列表为空时表格完全空白，没有「还没有文章，点击新建」之类的引导。~~ ✅ 已修复：`renderTable` 在 posts 为空时显示引导行（colspan="6"）。
- [x] ~~**缺少加载状态** — `loadIndex()` 是异步的，拉取期间表格为空，用户无法判断是「没有文章」还是「正在加载」。~~ ✅ 已修复：`loadIndex` 开头先写「加载中...」行，catch 兜底写错误行。
- [x] ~~**「新建」按钮无确认** — 点击会直接清空表单，若正在编辑某篇文章，内容会瞬间丢失且无撤销途径。~~ ✅ 已修复：检测 `editingFilename` 或表单有内容时弹 `confirm`，取消则 return。
- [x] ~~**无标题校验** — 保存时空标题也可以写入成功，可能产生脏数据。~~ ✅ 已修复：`upsert` 开头校验 `meta.title`，为空时 toast 提示并 return，不会触发 API 调用。

### 可维护性 / 边界情况

- [x] ~~**slug 与文件名的关系无提示** — 更新时复用旧文件名（避免外链失效），但用户在 slug 输入框改了 slug 后，文件名并不变化，容易困惑。可加一行说明。~~ ✅ 已修复：`setForm` 编辑时在 slug 下方显示灰字 hint，内容包含实际锁定的文件名。
- [x] ~~**长列表无分页** — 文章数量多时表格会很长，且前端渲染全部行。~~ ✅ 已修复：表格外包 `.table-wrapper`，`max-height: 480px; overflow-y: auto`，小屏 `320px`；thead 用 `position: sticky` 固定表头。管理场景下内部滚动比分页更友好（能一眼对比所有条目）。
- [x] ~~**小屏表单布局** — `.controls` grid `1fr 1fr` 在移动端会挤压，`@media (max-width: 768px)` 未覆盖管理页表单。~~ ✅ 已修复：inline style 搬到 `.admin-form-grid` + `.admin-col-span` 类，media query 下变成单列；`.pat-controls` 也加了小屏 flex-direction:column。
- [x] ~~**Front Matter 解析较弱** — 编辑时用简单的 `indexOf(':')` 解析 YAML，对带冒号的值、嵌套结构会出错。当前数据格式简单所以能用，但属于脆弱实现。~~ ✅ 已彻底移除：编辑时元数据全从 `currentPosts`（即 index.json）拿，.md 文件只做"剥掉 front matter 外壳"拿正文（`md.replace(/^---[\s\S]*?---\n?/, '')`），不再解析 YAML。`setForm(meta, editingFilename)` 第二个参数控制 slug hint 显隐。

### 样式

- [x] ~~**Toast 可能被移动端键盘遮挡** — `position: fixed; bottom: 30px` 在弹出输入法时可能不可见。~~ ✅ 已修复：Toast 从底部挪到顶部（`top: 30px`），顶部永远不被软键盘遮挡；换为强调色 + 阴影让它更像系统通知。
- [x] ~~**表格无横向滚动** — 列多时小屏可能溢出容器。~~ ✅ 已修复：`.table-wrapper` 加 `overflow-x: auto`，内部 `.table` 设 `white-space: nowrap; min-width: 720px`，窄屏自动出现横向滚动条，列不再被挤压。

## 性能与流畅度待办

> 以下是静态代码检索得到的待验证事项，并非已测实的性能问题；实施前先用真实数据、弱网和移动设备测量，权衡体验与数据新鲜度。

- [ ] **建立性能基线**：使用 DevTools 测量冷/热缓存、弱网请求瀑布、正文显示时间、长任务及移动端帧率，记录优化前后结果。
  - 初步测量（2026-11-22，Chrome DevTools、本地静态服务器、每种场景单次）：首页禁用 HTTP 缓存 LCP 206 ms、CLS 0.01；允许缓存 LCP 174 ms、CLS 0.01；模拟手机视口 390×844、Slow 4G、CPU 4× 降速，首页 LCP 703 ms、CLS 0.00，`test-md` 详情页 LCP 1,330 ms、CLS 0.05。
  - 优化前的弱网详情页观察到 4 个串行请求：Gist API → 索引 → Gist API → 正文。当前复用 Gist API 响应后，完整内嵌正文时预计为 2 个请求（Gist API → 索引）；正文被截断或无内嵌内容时预计为 3 个（Gist API → 索引 → 正文 raw URL）。优化后的实际瀑布及性能尚未测量；LCP 不等同于正文显示时间。
  - 尚未单独测量正文显示时间、长任务和真实手机帧率；本地结果不能代表 GitHub Pages 线上延迟，禁用 HTTP 缓存也不保证清除了 Service Worker 缓存。基线仍需补全并记录优化后结果。
- 详情页通过 `Gist.getGist()` 获取一次完整 Gist 响应，并将该响应传给 `Gist.getIndex(gist)` 和 `Gist.getPostFile(filename, gist)` 复用文件信息，避免为读取正文再次请求 Gist API。索引仍通过 `index.json` 的 `raw_url` 读取；Markdown 若有 `truncated === false` 且 `content` 为字符串（包括空字符串），直接使用内嵌内容；否则回退到该文件的 `raw_url`。不传 gist 参数的 `getIndex()` / `getPostFile()` 仍会自行获取 Gist，以兼容其他调用方；Mock 分支不发网络请求。
- [ ] **减少文章详情串行请求**：代码优化已完成，但仍需在真实浏览器、真实 Gist 和弱网下验证及测量；内嵌正文与截断 raw URL 回退逻辑见 `res/js/gist.js`。
- [ ] **控制索引体积**：`res/js/admin.js` 保存时可能将 `body` 一并写入 `index.json`，先检查真实索引大小及现有数据，再评估停止重复写入和清理历史数据；不能影响正文及编辑功能。
- [ ] **评估视频开销**：比较视频播放和暂停时的流量、解码开销及帧率；评估压缩、降低分辨率或帧率，或默认使用静态图并允许主动播放，兼顾画质和体验。
- [ ] **调整首页文章预取时机**：比较启动时、空闲时及首次进入文章列表时加载的首屏和切页表现；保留加载提示、失败重试并避免重复请求。
  - 现状：`res/js/index.js` 使用空闲回调预取索引，不支持时使用定时器；提前进入文章面板会立即加载，加载中显示动画，失败可手动重试，并复用正在进行的请求。加载期间输入的筛选词会在加载完成后应用。减少动态效果时动画停止。
  - 优化前测试（2026-11-22，本地静态服务器、Chromium 158、1280×720、隔离上下文禁用 Service Worker、真实 Gist，只读，各场景单次）：启动时发出一次 Gist API 和一次索引 raw 请求；加载前后快速反复切换未增加请求。暂停 API 时显示加载提示，但加载中输入的筛选词在加载完成后未自动应用，再次修改输入才生效。
  - 模拟 API 请求失败后显示错误；恢复请求并切换面板不会重试，刷新后重新请求并恢复。该测试未覆盖真实断网、Service Worker 缓存、移动设备及弱网性能。
  - 优化后模拟测试：隔离浏览器上下文禁用 Service Worker，拦截 API 和 raw 请求；验证了空闲调度及定时器降级、提前切入、加载动画、加载中筛选、快速切换并发去重、API 失败后手动重试及空列表。尚未覆盖真实网络、Service Worker 和移动设备。
  - 待验证：对比三种时机的首页 LCP、长任务、请求次数与传输量，以及立即或停留后切入到卡片显示的时间；分别测试视频播放与暂停、冷/热缓存及 SW 受控状态。模拟 API 和 raw 失败、HTTP 错误与恢复，检查加载期间输入、快速切换、空列表、失败重试、并发去重与事件重复绑定。跨域 raw 内容不受当前 SW 缓存策略保护。
- [ ] **改善弱网缓存行为**：检查 `sw.js` 的 network-first 超时、HTTP 错误处理和缓存写入，仅缓存适当的成功响应；评估超时回退与 stale-while-revalidate 的时效性取舍，并将必要的缓存写入纳入事件生命周期。
- [ ] **验证离线阅读与回退**：检查 Gist raw 内容跨域缓存的可行性、容量及更新策略；测试已访问和未访问的 `post.html?slug=...`，避免详情地址回退到首页。预缓存成功不代表正文可离线读取。
- [ ] **检查缓存版本一致性**：验证全局 `caches.match()` 对静态和动态缓存的匹配顺序，以及 `skipWaiting()` / `clients.claim()` 接管旧标签页时的资源版本混用；测试新旧页面共存和离线更新。
- [ ] **检查 Service Worker 安装成本**：测量首次预缓存的流量与存储，模拟单个资源失败并确认安装行为，权衡离线覆盖范围。
- [ ] **测量移动端合成开销**：对比文章面板的 `backdrop-filter` 与视频同时运行、分别关闭时的滑动及滚动帧率；检查主题 View Transition 的全屏裁剪开销，并保留减少动态效果降级。
- [ ] **验证移动端操作**：在 iOS Safari 和 Android Chrome 检查首页按钮、文章面板原生滚动及返回按钮，避免误触和操作失效。
- [ ] **测量文章详情渲染**：检查 `post.html` 同步 vendor 脚本对 HTML 解析的影响，以及长 Markdown、图片加载和布局偏移；调整加载顺序时确保依赖先于 `post.js` 可用，始终保留 DOMPurify 净化。
- [ ] **评估大规模列表**：文章数量增长后测量搜索筛选、排序及 DOM 更新；必要时预计算搜索文本和排序或引入短防抖。管理页滚动容器仍会渲染全部行，需用不同数量测试后再考虑分页或虚拟化。
- [ ] **检查周期性动画开销**：低端设备上观察时钟数字动画、遮罩及进度条宽度更新是否造成周期性布局或绘制；仅在实测有必要时优化，保持时间准确及无障碍状态同步。

## 可选扩展

- ~~**使用 GitHub OAuth 替代 PAT 粘贴**~~ ❌ 当前架构不可行：GitHub 已移除 Device Flow（2021）；PKCE / Authorization Code 流程的 client_secret 不能放纯静态前端；GitHub Pages 无后端做 token 交换。保留 PAT 方案。
- ~~**增加 Service Worker 做离线缓存**~~ ✅ 已实现：根目录 `sw.js` + `res/js/sw-register.js` 全站共同注册。缓存策略——静态资源（HTML/CSS/JS/vendor/icon）cache-first；导航请求与 Gist API network-first（失败时回退缓存）。每次部署改 cache 名 `static-vN` 触发更新。
- **在 `index.json` 里保留关键词字段做更快的前端搜索** — 当前 `applyFilter` 已用 `${title} ${summary} ${tags}` 拼接 + `toLowerCase().includes()`，几十篇文章下 1ms 级完成，暂无瓶颈。文章超过 200 篇时再考虑。
- ~~**将 `marked` / `DOMPurify` 下载到本地避免依赖 CDN**~~ ✅ 已完成：下载 UMD 构建到 `res/js/vendor/marked.min.js` + `purify.min.js`，`post.html` 改本地路径。暴露全局 `marked` / `DOMPurify`，`post.js` 检查 `typeof` 的守卫仍然生效。

## 已知陷阱

- 页面入口已按页面拆分：`index.js`、`posts.js`、`search.js`、`post.js`、`admin.js` 各自只加载一次。新增页面时不要把它们全部引入，否则会重复绑定事件。
- `res/js/index.js` 是 ES Module，顶层函数不会挂到 `window`；不要在 HTML 里用 `onclick="..."` 之类的内联写法，统一用 `addEventListener` 绑定。
- `res/js/posts.js` 用 `#post-list` 存在性做守卫；不要在无列表元素的页面加载它。
- 首页文章和搜索入口切换同页的面板；`togglePage` 维护视图、焦点与无障碍状态，不要误改为独立页面跳转。
- 管理页保存依赖模块变量 `editingFilename`：`null` 表示新建，非空表示更新。不要再给 `#save` 额外设置 `onclick`，否则会重复写入。
- 管理页更新文章时会从 `currentPosts` 保留 `created_at`；不要退回为每次保存都使用当前时间。
- `post.html` 依赖本地 UMD 构建的 `marked` 与 `DOMPurify`（`res/js/vendor/`），渲染必须经过 `DOMPurify.sanitize`，不要绕过。`post.js` 已对 `typeof marked` / `typeof DOMPurify` 缺失给出明确提示。不要改回 CDN 引用。
- 文章列表、搜索和详情页通过 `res/js/nav.js` 的 `renderNav(page)` 渲染到 `#site-nav`；必须先渲染再初始化主题按钮。首页和管理页目前不调用共享导航。
- 共享导航样式支持横排与响应式纵排；当前文章列表页固定横排，详情页窄屏回退横排。
- 详情页上一篇/下一篇使用「已发布 + `created_at` 升序」列表定位，不要退回为直接取 `index.json` 原始数组的 `±1`，否则草稿和手动排序会污染导航。
- 详情页渲染前会处理正文开头的 H1：与标题重复时移除，否则降级为 H2（`post.js` 的 `normalizeLeadingTitle`），避免一页出现两个 H1；正文其他位置的 H1 样式按 `article h1` 收敛。
- 详情页 `#navigation` 默认带 `hidden`，只有存在上一篇/下一篇时才移除；`#next-post` 需要 `margin-left: auto` 才能单独靠右。
- 首页方向按钮控制面板、管理页和全屏；文章列表、搜索和详情页的 `#theme-toggle` 由 `theme.js` 单击切换主题。
- `theme.js` 的 `toggleFullscreen()` 使用 WebKit/MS 前缀做兼容，iOS Safari 与部分受限 WebView 不支持会静默跳过；不要依赖其返回值。
- 首页时钟变化的数字使用位移动画；页面隐藏或减少动态效果时直接更新数字。
- 无障碍要求：不要删除全局 `:focus-visible` 规则；`prefers-reduced-motion` 会关闭字符跳动、卡片入场和主题圆形扩散，修改动画时保持该降级。
- 首页使用 `<main>` + `.sr-only` 的 `<h1>`；文章列表页同样使用 `<main>` + `.sr-only` 的 `<h1>`，列表区域使用 `<section>`；避免同一文档出现多个 `<main>`。
- 首页雨景视频的加载、播放和渐变兜底见「雨景背景与排查」；不要恢复已移除的椋鸟背景或按时间段切换背景的旧说明。
- 主题切换使用 `document.startViewTransition` + `html.theme-transitioning`；不支持或用户偏好减少动画时回退为直接切换。`--theme-x` / `--theme-y` 是圆形扩散的圆心，不要删除。
- 首页与独立列表各自生成文章卡片，`#post-list.animate-in` 只用于首次加载和翻页；筛选输入时不要加该 class，否则每输入一个字符都会重播动画。

- 搜索引擎图标顺序保存在 `localStorage.searchEngineOrder`；搜索框有内容时禁止拖拽，这是有意行为。
- 搜索框清空按钮 `#search-clear` 由 `res/js/search.js` 的 `updateSearchAffordances` 根据输入内容显隐；`Esc` 会清空并失焦；空输入回车或点图标会提示而不会跳转。输入框必须保留 `min-width: 0`，否则移动端会被搜索引擎图标挤爆。
- PAT 存在 `localStorage.gh_pat`，只用于 GitHub API 请求头，不得写入源码、示例、日志或提交记录。管理页初始化时若检测到已存 PAT，会自动把输入框 `disabled` + 灰化、隐藏眼睛按钮、提示 meta 改为「已在本地」；清除后恢复可编辑。
- `sw.js` 在根目录以最大 scope 注册，首次安装时预缓存 `STATIC_ASSETS` 中的固定列表；新增静态文件（CSS/JS/icon）时记得把路径加进去。部署更新时改 cache 名 `static-vN` 触发旧缓存淘汰。不要把 POST/PATCH 请求（API 写操作）放进缓存。
- `USE_MOCK_DATA = true` 时不会访问 GitHub，所有写操作只改内存，刷新后丢失；若线上"保存后刷新没了"或看到示例文章，先检查是不是被改成 `true`（当前默认 `false`）。
- 主题逻辑统一在 `res/js/theme.js`；不要再把 `applyTheme/setTheme/setupThemeToggle` 复制回 `index.js`、`posts.js` 或 `admin.js`。新增需要主题切换的页面时从该模块导入。
- 不要提交任何 token、真实个人敏感信息；`.gitignore` 已忽略 `.vscode/`、`node_modules/`、`dist/`、`.vercel/`、`.old/`。

## 修改后的验证

无自动化测试，按以下清单人工验证：

1. `http://localhost:8000/`：时钟每秒更新，日期与今日进度正确；首页默认暗色，视频静音播放，加载前、失败及减少动态效果时静态背景可见。
2. 首页方向按钮和方向键切换同页搜索和文章面板、全屏及管理页；检查焦点、`inert`、`aria-hidden`、输入控件按键、文章面板顶部及非顶部上方向键。验证滑动不再触发导航，文章面板原生触摸滚动正常。
3. 首页空闲预取、提前切入、加载中筛选、快速切换去重及失败重试正常；首页和 `posts.html` 的筛选、搜索、空状态、分页归顶与键盘焦点正常。文章列表、搜索和详情页主题切换及刷新后持久化；首页和管理页当前没有共享主题按钮。
4. `search.html`：输入关键词回车使用排序第一的引擎，点击图标使用对应引擎；空输入会提示且不跳转；清空按钮与 `Esc` 行为正常；拖拽图标可调整顺序，刷新后保持（`localStorage.searchEngineOrder`），输入框有内容时禁止拖拽；图标可用键盘 Tab 聚焦并回车触发。
5. 下载/替换 vendor 依赖后，先 Read 文件前几行确认有实际代码（不是 0 字节空文件），再打开 `post.html?slug=...`：首屏暗色，主题按钮可切换并与独立列表、搜索页共享 `localStorage.theme`；标题、日期（`YYYY.MM.DD`）与标签正常，标签为空时没有多余分隔符；正文的标题、列表、引用、代码块、表格与图片按阅读宽度排版，窄屏下 `pre` / 表格横向滚动而不撑破页面；上一篇/下一篇只在存在时显示，单独“下一篇”靠右，没有上下篇时底部不出现空分隔线。`Network` 面板确认 `marked.min.js` / `purify.min.js` 加载自 `res/js/vendor/`（不是 CDN）。若看到「Markdown 渲染资源加载失败」提示，优先检查 vendor 文件是否为空。
6. 打开 `admin.html`，首屏默认暗色；文章列表拉取期间表格显示「加载中...」，失败时显示错误提示，零数据时显示引导行（不是空白表格）。
   未设置 PAT 时：输入框可编辑、placeholder 为原始提示、meta 行显示「仅在本地使用」；保存后 → 输入框自动 disabled + 灰化、眼睛按钮隐藏、meta 行改为「已在本地」、placeholder 改为「已保存（点击清除后可修改）」；点击「清除」→ 恢复可编辑状态。
   已设置 PAT 时，标题为空点击保存 → toast「标题不能为空」、不触发 API。编辑中有内容点击「新建」→ 弹确认框，取消则不清空。
   点击某篇文章「编辑」→ 表单回填正确，slug 下方显示灰色 hint（含锁定的文件名），正文正确（YAML front matter 已剥离）；新建模式下 slug hint 隐藏。
   文章列表表格超过 6 行时表头固定、内部滚动；小屏（≤768px）下表单变单列，PAT 工具栏也变纵向。
   窄屏下表格出现横向滚动条（列不被挤压变形）；Toast 显示在顶部居中（软键盘弹出时不被遮挡）。
   仅在受控测试 Gist 上验证真实新建、编辑和删除，确认刷新后持久化；不要用真实生产数据做破坏性测试。
7. Service Worker：检查注册和 `sw.js` 中实际版本的缓存；分别测试在线、离线、HTTP 错误及带 slug 的详情地址，记录实际回退。跨域 raw 和视频未由当前策略缓存，不保证离线正文可用。
8. 系统启用「减少动态效果」后，字符跳动、卡片入场和主题圆形扩散应关闭，主题切换降级为直接切换；键盘 Tab 能看到清晰焦点。
9. 提交前运行 `git diff --check` 检查空白错误，并确认 `git status` 中没有 PAT 或本地配置文件。