# AGENTS.md

Gist Blog（无后台）— GitHub Pages + Gist + GitHub API

本文件是仓库的唯一项目说明（已合并原 `README.md`），同时作为编码代理的工作指南。修改代码前请先阅读「项目结构」「数据读写」「已知陷阱」。

## 项目概览

纯静态、无后台的 Gist 博客，部署在 GitHub Pages（用户站点 `baaaaaaaaad.github.io`）。

- 托管：GitHub Pages，`main` 分支根目录直接发布，无构建步骤。
- 存储：GitHub Gist，`index.json` 保存文章元数据，每篇文章一个 `YYYY-MM-DD--slug.md`。
- 读写：浏览器直接调用 GitHub API；读取匿名，写入需要 PAT（仅 `gist` 权限）。
- 技术栈：原生 HTML / CSS / JavaScript ES Modules（无框架、无包管理、无打包器、无测试）。
- 页面语言与注释：页面注释与文档保持中文；UI 文本支持中英文切换，语言资源存放于 `res/lang/zh.json` 与 `res/lang/en.json`，通过 `localStorage.lang` 或 `navigator.language` 确定当前语言，`<html lang>` 动态更新。

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
6. 第一次发布：在首页通过左方向按钮或方向键连续三次进入管理面板，粘贴**仅 `gist` 权限**的 PAT，填好内容后点击「保存」。

## 本地预览

不要用 `file://` 直接打开，ES Modules 与 `fetch` 会被浏览器拦截。在仓库根目录起静态服务器：

```powershell
python -m http.server 8000
# 或
npx --yes serve .
```

然后访问 `http://localhost:8000/`。没有 install、build、lint、test 命令。

## 页面

- `index.html`：首页时钟、日期、今日进度，以及同页搜索、文章列表和管理面板。
- `post.html?slug=...`：文章详情页（Markdown 渲染、阅读排版、主题切换、上一篇/下一篇）。

各页面 HTML 默认 `body.dark-mode`。详情页使用共享主题模块，读取并保存 `localStorage.theme`，单击按钮切换主题；首页默认暗色，不初始化共享主题按钮，也不读取已保存主题。详情页复用首页静态雨景背景（`rain.jpg` + 渐变兜底），仅在暗色主题显示，亮色下移除避免与主题冲突；详情页不加视频和雨声。

首页使用雨景视频、静态雨景图及渐变兜底，时钟、日期和今日进度区域使用深色背景及文字阴影增强对比度；方向按钮或方向键切换同页搜索、文章列表与管理面板，向上切换全屏。导航按钮透明、无边框，图标带阴影，点击区域至少 44×44px。文章列表使用卡片和标签。

### 雨景背景与排查

首页的 `#rain-background` 默认静音、循环、内联播放，由 `res/js/index.js` 设置视频地址并调用 `play()`；只有收到 `playing` 事件才显示视频。播放失败或页面隐藏时显示 `res/img/rain.jpg`，图片不可用时使用渐变兜底；页面隐藏时暂停。`sw.js` 跳过 `rain.mp4` 和 `rain.mp3`，离线时不能依赖其播放。

雨声是独立于静音视频的 `res/audio/rain.mp3`：音频元素使用 `preload="auto"` 提示浏览器预加载，但不保证立即下载或播放；页面加载完成后尝试自动播放，可能被浏览器策略阻止；首页导航按钮可播放或静音，状态通过 `aria-label` 和 `aria-pressed` 表示。支持 Web Audio 时解码后使用循环 BufferSource，不支持时回退到循环音频元素；加载或播放失败会恢复按钮状态。音频不会随页面隐藏或切换面板自动暂停。

**排查背景不显示：** 请求成功不代表视频已解码或开始播放；`play()` 的错误目前被静默处理。检查浏览器自动播放策略、编码、页面隐藏和旧 Service Worker 缓存。

1. 在目标首页 DevTools 的 Console 执行：`const v = document.querySelector('#rain-background'); ({src: v.currentSrc, paused: v.paused, muted: v.muted, readyState: v.readyState, error: v.error?.message, playing: v.classList.contains('is-playing'), hidden: document.hidden})`。
2. 在未发生用户交互的刷新过程中观察 `play()` 的拒绝原因：`NotAllowedError` 指向自动播放策略；`NotSupportedError` 或媒体错误应检查实际响应内容、MIME 类型和浏览器支持的视频编码。直接在控制台手动调用 `play()` 可能受用户激活状态影响，不能单独证明自动播放策略。
3. 视频已设置 `muted`；若仍被拦截，检查目标浏览器策略，必要时评估用户交互后播放。若是编码问题则转换为兼容格式。修改静态资源后更新 `sw.js` 缓存版本，并确认浏览器加载到新版本。

## 实际文件结构

```text
.
├─ sw.js                       # Service Worker：静态资源 cache-first，HTML/Gist API network-first
├─ index.html                 # 首页
├─ res/
│  ├─ template/               # 已归档的演示页面（bird.html、bird-background.html）
│  ├─ audio/rain.mp3          # 首页雨声
│  ├─ css/index.css           # 全站唯一样式表（主题变量 + 响应式 + 详情/管理页基础布局）
│  ├─ icon/                   # favicon 与搜索引擎图标
│  ├─ video/rain.mp4          # 首页雨景背景视频
│  ├─ img/rain.jpg            # 首页静态背景兜底
│  └─ js/
│     ├─ config.js            # 导出 CONFIG（GIST_ID / OWNER / SITE_* / PAGE_SIZE）
│     ├─ gist.js              # GitHub API 封装、Mock 数据、Gist、Util
│     ├─ index.js             # 首页入口：时钟、背景、搜索与面板切换
│     ├─ post.js              # 详情页入口：渲染 Markdown、元信息与上下篇导航
│     ├─ admin.js             # 管理模块：新建 / 编辑 / 删除（首页管理面板动态导入）
│     ├─ refresh-feedback.js  # 首页文章列表和管理面板共用的刷新按钮状态与刷新时间
│     ├─ theme.js             # 详情页主题切换模块
│     ├─ nav.js               # 详情页导航渲染器（ES Module，floating 变体）
│     ├─ sw-register.js       # 全站共用的 SW 注册脚本（经典脚本，defer）
│     └─ vendor/
│        ├─ marked.min.js     # Markdown 渲染器（本地 UMD 构建，暴露全局 marked）
│        └─ purify.min.js     # XSS 过滤器（本地 UMD 构建，暴露全局 DOMPurify）
├─ sample-gist-files/         # Gist 数据示例，仅参考，不会自动上传
└─ .gitignore
```

`config.js` 与 `gist.js` 是各页面入口共享的数据模块；详情页使用 `theme.js`。修改数据行为时还需检查调用方和 Mock 分支。

页面加载关系：

- `index.html`：`res/css/index.css` + `type="module"` 的 `res/js/index.js` + `res/js/sw-register.js`（defer）；使用首页自身的面板导航，不初始化共享导航。首次进入管理面板时动态导入 `admin.js` 并调用 `initAdmin()`，后续进入不重复绑定或重新加载管理表格。
- `post.html`：`res/css/index.css` + 本地 `res/js/vendor/marked.min.js` / `purify.min.js`（UMD，暴露全局 `marked` / `DOMPurify`）+ `type="module"` 的 `res/js/post.js` + `res/js/sw-register.js`（defer）。`post.js` 导入 `nav.js` 渲染 floating 导航（主题切换），左上角返回按钮独立处理返回上一页，并在 `DOMContentLoaded` 后从 `theme.js` 初始化主题。

不要再引用 `js/`、`css/` 或 `res/js/merged.js`，这些旧路径已经不存在。不要改回 CDN 加载 marked / DOMPurify。

## 功能清单与回归约定

修改相关代码时，应按本节及「修改后的验证」检查受影响功能和相邻调用方；未能验证的项目须明确说明，不能把 Mock 成功当成真实 API 或离线验证。以下描述当前行为，不表示所有边界都是期望设计。

### 首页与同页搜索

- 首页默认暗色；本地时钟每秒更新，日期和今日进度按本地时间计算；页面隐藏时直接更新时钟数字。背景默认静音播放，静态图和渐变是播放前及失败时的兜底。
- 首页方向按钮及方向键：上切换全屏、左方向键或左按钮在 2 秒间隔内累计三次进入管理页、下进入文章面板、右进入搜索面板；左键长按重复事件不计数，切换面板、全屏状态变化或页面失焦时重置计数。全屏时方向导航隐藏且不可聚焦，但首页左方向键仍可使用。搜索面板左方向键、文章面板顶部上方向键或非输入控件内的 Esc 返回首页。文章面板未到顶部时上方向键保留原生滚动；输入、选择等控件内不拦截方向键。
- 切换面板同步 `inert`、`aria-hidden` 和焦点；标记为 `aria-hidden="true"` 的非活动面板通过 CSS 隐藏，离开首页时方向导航不可交互。管理面板可用返回按钮或非输入控件内的 Esc 返回，非全屏时焦点回到管理方向按钮；切换面板不会确认未保存内容。首页不再使用滑动手势导航，文章面板保留原生触摸滚动。
- 同页搜索支持点击引擎或 Enter/空格激活图标，输入框回车使用排序首位引擎；空输入不跳转。引擎拖拽顺序存 `localStorage.searchEngineOrder`，有输入时禁止拖拽；本面板没有清空按钮和空输入提示。

### 文章列表与详情

> 2026-11-26 起：文章列表在配置 PAT 后显示卡片编辑/删除按钮与「显示草稿」开关。

- 首页文章面板与管理面板的返回按钮使用 `.back-home-button` 样式（与搜索页一致，绝对定位至左上角，不占用纵向空间），刷新按钮使用 ↻ 图标，均有无障碍名称、提示文本及至少 44×44px 的点击区域。刷新信息合并为单个 `.refresh-info` 内联元素，排在刷新按钮前（不占纵向空间）：刷新中显示「正在刷新…」、成功后显示刷新时间 `HH:MM:SS`、失败显示「刷新失败」，宽度变化会横向挤开按钮避免误点，并通过 live region 播报状态。管理表格编辑/删除按钮使用 ✏️/🗑️ 图标，分页按钮使用 ◀/▶ 图标，管理面板保存/新建/清除按钮使用 💾/📄/❌ 图标。两处调用 `res/js/refresh-feedback.js`：加载时禁用按钮，手动刷新时旋转图标（最小显示 400ms），请求结束后停止；初次加载和保存、删除后的自动刷新不旋转。该模块处理按钮状态并提供 `updateRefreshTime` 更新刷新时间，两处列表仍分别控制请求、竞态和渲染。重试按钮同样触发旋转动画。
- 首页内嵌列表空闲预取，提前进入立即加载；加载动画、失败重试、并发去重和加载中筛选须正常。筛选栏刷新按钮重新请求索引，保留搜索词及有效标签，页码越界时回退；加载时禁用按钮，失败时保留旧列表并提示重试。刷新不保证绕过浏览器或 Service Worker 缓存。首页管理面板保存或删除成功后使列表失效，下次进入文章面板重新加载；过期的进行中请求不会覆盖新数据，已选标签不存在时重置为全部。该通知仅作用于当前文档，不同步其他标签页或外部修改。
- 两处列表展示已发布文章，按创建时间倒序，按标签精确筛选、标题/摘要/标签不区分大小写搜索，默认每页 10 篇；空列表与无匹配结果提示不同。标签选项目前来自全部索引，包括草稿。筛选返回第一页，不重复播放卡片入场动画。
- 翻页后首页滚动面板归顶；键盘激活翻页后焦点转到首篇链接，页码使用 live region。细原生滚动条遵循系统显示设置，不保证所有平台停止滚动时自动隐藏。
- 详情通过 slug 定位，读取元数据、渲染经 DOMPurify 净化的 Markdown，处理开头重复 H1；上下篇只在已发布文章中按创建时间升序确定，无相邻文章时隐藏导航。缺参数、资源或文件及请求失败均需显示错误并结束加载状态。
- 当前详情查找不检查 `status`，知道 slug 的人可能访问公开 Gist 中的草稿；草稿状态不是访问控制。修改 slug 会改变详情 URL，即使文件名保持不变也不能保证旧链接有效。

### 主题与管理

> 2026-11-26 起：管理面板不再内嵌文章表格，只保留 PAT 配置与新建/编辑表单；编辑/删除已移至文章列表。

- 详情页由 `renderNav` 渲染导航，再初始化共享主题；主题持久化，支持 View Transition，不支持时直接切换。首页目前没有共享主题按钮。
- 管理面板提供 PAT 保存、显隐和确认清除；文章表格有加载、空和错误状态，支持编辑、删除及新建。标题旁刷新按钮加载时禁用并播报状态，失败保留已有列表并可重试；保存或删除后的新请求使先前请求失效。刷新不保证绕过浏览器或 Service Worker 缓存。仅在受控测试 Gist 上验证写操作：新建/更新同步写 Markdown 与索引，编辑保留创建时间及原文件名，删除需确认；空标题不写入，清空已有编辑内容前需确认。
- 当前新建确认只检查编辑状态、标题和正文；slug 已有唯一性校验（P5，编辑排除自身），但多客户端写入仍可能覆盖，不应视作并发安全保证。

### 数据、离线与无障碍

- 真实读取匿名访问公开 Gist；写入使用本地 PAT，Mock 只修改内存、刷新重置，不验证真实鉴权和持久化。详情复用 Gist 响应；正文只有 `truncated === false` 且 `content` 为字符串时使用内嵌内容，否则走 raw URL；索引走 raw URL。
- Service Worker 仅处理 GET：API 和导航 network-first，其他同源静态资源 cache-first；雨景视频、雨声音频和跨域 raw 不在其缓存策略内。HTTP 错误、离线详情回退与版本更新存在待验证限制，不应承诺离线正文必定可用。
- 保留可见键盘焦点、语义标签、live region、加载状态、窄屏可操作性；验证滚动条时保留原生滚动和系统辅助功能偏好。

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
- 首页与详情/管理页的布局通过 `body.post-page` 和首页 `#admin-page` 隔离，不要破坏首页的 flex 居中布局。
- 页面默认 `body.dark-mode`；详情页通过 `res/js/theme.js` 读取并保存 `localStorage.theme`，缺省为暗色。首页目前不初始化该模块；不要误认为它们已共享主题。
- DOM 查询使用 `document.querySelector` 并保持空值判断；页面入口脚本只应操作本页存在的元素。
- 缩进：CSS 4 空格；JS 2 空格。
- 注释使用中文，不要为显而易见的代码新增注释。

## 安全提示

- PAT 权限**仅勾选 `gist`**；不要勾选 `repo` 或其他权限。
- PAT 只保存在浏览器本地（`localStorage.gh_pat`），可在管理页右上角随时清除。
- 切勿把 PAT 写入源码、示例、日志或提交记录。

## 页面模板迁移待办

> 独立页面 `posts.html`、`search.html`、`admin.html` 已删除，其功能由首页同页搜索、文章列表和管理面板承担。`post.html` 保留在根目录作为可分享、可刷新、可收录的文章详情入口。`res/template/` 仅剩两个椋鸟演示页面，尚待决定去留。迁移不提供鉴权。

- [ ] **`bird.html` 和 `bird-background.html`**：评估两个独立椋鸟演示页面是否仍需保留、迁作模板或归档；先确认引用、用途及旧链接，避免误认其为当前首页背景。

`index.html` 是 GitHub Pages 首页入口，可保留为主入口。迁移不改变 PAT 和公开 Gist 的安全边界。

## 待办事项（管理面板 / `admin.js` 优化）

> 首页原生同文档管理面板及管理模块复用已实现；以下未勾选事项是待决策、修复或验证项，不代表已批准实施。

### 管理面板后续待办（2026-11-22）

- [ ] **入口与历史**：决定是否继续保留三次左方向进入、是否调整入口的无障碍名称。目前同页切换不写 URL 或浏览器历史；是否增加直达、刷新恢复和前进后退支持尚待决定，设计时不得将 PAT 或表单内容放入 URL / 历史状态。
- [ ] **管理生命周期与 DOM**：当前首次进入时初始化一次，后续不自动重读；决定是否拆分一次绑定与每次激活的数据刷新，以及刷新失败时旧 `currentPosts` 的可见性和操作权限。评估将管理查询限定在管理根容器内（包括 `header .meta`），保持两处 HTML 同步、ID 唯一和单一 `main`，避免重复绑定或重复初始化首页。
- [ ] **表单与 PAT**：决定离开面板、跨文档导航及刷新时如何处理未保存内容；评估基于全部字段的快照与离开提示。目前「新建」仅检查编辑状态、标题和正文。决定离开时是否恢复 PAT 密码显示、是否清空未保存的 PAT；修正编辑提示中「改 slug 仅影响列表展示」的错误，实际详情 URL 也会变化。
- [ ] **异步竞态与错误**：处理多次编辑读取乱序、读取后点击新建导致旧结果覆盖、保存或删除重复提交；分别捕获并呈现编辑、保存、删除错误，失败后恢复操作。决定面板隐藏时写入完成的提示方式；隐藏不等于取消已发送请求，表格重绘后需检查焦点和状态播报。
- [ ] **注入与安全**：管理表格的索引字段及加载错误消息目前插入 `innerHTML`，评估改用 DOM API、`textContent` 和安全属性赋值。隐藏入口和同文档面板不是鉴权或安全隔离；PAT 不得进入日志、URL、历史状态或源码。
- [ ] **数据一致性与并发**：同文档写后列表失效、旧请求防覆盖和不存在的标签重置已实现；仍需验证筛选、页码边界及刷新失败。决定跨标签页和外部修改后的同步策略，并评估多客户端并发写入冲突；本地缓存或通知不能代替冲突处理。另见下方索引体积待办。
- [ ] **无障碍与移动端**：在键盘和辅助技术下验证三次入口提示、面板焦点、返回、`inert`、`aria-hidden`、输入控件按键及表格更新后的焦点和错误播报；在 iOS Safari / Android Chrome 检查管理长表单、嵌套表格滚动、触摸、缩放、软键盘和焦点滚动。实测面板 transform 对 toast 定位、裁剪及隐藏时播报的影响，不能仅凭顶部定位保证不被遮挡。
- [ ] **性能与后台资源**：管理面板打开时首页视频和时钟仍可能运行；先测量资源开销，再决定是否暂停及如何在恢复时遵守页面可见性。评估首页预取与管理索引请求是否值得共享，不能将共享请求视为并发冲突解决方案；其他性能测量见下节。
- [ ] **部署与测试**：后续修改静态资源时更新 SW 缓存版本，新增资源纳入预缓存；结合下方 SW 待办验证旧标签页、新版本接管、旧入口、离线和 HTTP 错误，不承诺离线写入。覆盖快速切换、重复进入、迟到请求、失败恢复及辅助技术；Mock 不验证真实鉴权、持久化或并发，真实写入仅在受控测试 Gist 验证。


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
  - 现状：`res/js/index.js` 使用空闲回调预取索引，不支持时使用定时器；提前进入文章面板会立即加载，加载中显示动画，失败可手动重试，并复用正在进行的请求。加载期间输入的筛选词会在加载完成后应用。加载动画持续到请求结束。
  - 优化前测试（2026-11-22，本地静态服务器、Chromium 158、1280×720、隔离上下文禁用 Service Worker、真实 Gist，只读，各场景单次）：启动时发出一次 Gist API 和一次索引 raw 请求；加载前后快速反复切换未增加请求。暂停 API 时显示加载提示，但加载中输入的筛选词在加载完成后未自动应用，再次修改输入才生效。
  - 模拟 API 请求失败后显示错误；恢复请求并切换面板不会重试，刷新后重新请求并恢复。该测试未覆盖真实断网、Service Worker 缓存、移动设备及弱网性能。
  - 优化后模拟测试：隔离浏览器上下文禁用 Service Worker，拦截 API 和 raw 请求；验证了空闲调度及定时器降级、提前切入、加载动画、加载中筛选、快速切换并发去重、API 失败后手动重试及空列表。尚未覆盖真实网络、Service Worker 和移动设备。
  - 待验证：对比三种时机的首页 LCP、长任务、请求次数与传输量，以及立即或停留后切入到卡片显示的时间；分别测试视频播放与暂停、冷/热缓存及 SW 受控状态。模拟 API 和 raw 失败、HTTP 错误与恢复，检查加载期间输入、快速切换、空列表、失败重试、并发去重与事件重复绑定。跨域 raw 内容不受当前 SW 缓存策略保护。
- [ ] **改善弱网缓存行为**：检查 `sw.js` 的 network-first 超时、HTTP 错误处理和缓存写入，仅缓存适当的成功响应；评估超时回退与 stale-while-revalidate 的时效性取舍，并将必要的缓存写入纳入事件生命周期。
- [ ] **验证离线阅读与回退**：检查 Gist raw 内容跨域缓存的可行性、容量及更新策略；测试已访问和未访问的 `post.html?slug=...`，避免详情地址回退到首页。预缓存成功不代表正文可离线读取。
- [ ] **检查缓存版本一致性**：验证全局 `caches.match()` 对静态和动态缓存的匹配顺序，以及 `skipWaiting()` / `clients.claim()` 接管旧标签页时的资源版本混用；测试新旧页面共存和离线更新。
- [ ] **检查 Service Worker 安装成本**：测量首次预缓存的流量与存储，模拟单个资源失败并确认安装行为，权衡离线覆盖范围。
- [ ] **测量移动端合成开销**：对比文章面板的 `backdrop-filter` 与视频同时运行、分别关闭时的滑动及滚动帧率；检查主题 View Transition 的全屏裁剪开销。
- [ ] **验证移动端操作**：在 iOS Safari 和 Android Chrome 检查首页按钮、文章面板原生滚动及返回按钮，避免误触和操作失效。
- [ ] **测量文章详情渲染**：检查 `post.html` 同步 vendor 脚本对 HTML 解析的影响，以及长 Markdown、图片加载和布局偏移；调整加载顺序时确保依赖先于 `post.js` 可用，始终保留 DOMPurify 净化。
- [ ] **评估大规模列表**：文章数量增长后测量搜索筛选、排序及 DOM 更新；必要时预计算搜索文本和排序或引入短防抖。管理页滚动容器仍会渲染全部行，需用不同数量测试后再考虑分页或虚拟化。
- [ ] **检查周期性动画开销**：低端设备上观察时钟数字动画、遮罩及进度条宽度更新是否造成周期性布局或绘制；仅在实测有必要时优化，保持时间准确及无障碍状态同步。

## 可选扩展

- ~~**使用 GitHub OAuth 替代 PAT 粘贴**~~ ❌ 当前架构不可行：GitHub 已移除 Device Flow（2021）；PKCE / Authorization Code 流程的 client_secret 不能放纯静态前端；GitHub Pages 无后端做 token 交换。保留 PAT 方案。
- ~~**增加 Service Worker 做离线缓存**~~ ✅ 已实现：根目录 `sw.js` + `res/js/sw-register.js` 全站共同注册。缓存策略——静态资源（HTML/CSS/JS/vendor/icon）cache-first；导航请求与 Gist API network-first（失败时回退缓存）。每次部署改 cache 名 `static-vN` 触发更新。
- **在 `index.json` 里保留关键词字段做更快的前端搜索** — 当前 `applyFilter` 已用 `${title} ${summary} ${tags}` 拼接 + `toLowerCase().includes()`，几十篇文章下 1ms 级完成，暂无瓶颈。文章超过 200 篇时再考虑。
- ~~**将 `marked` / `DOMPurify` 下载到本地避免依赖 CDN**~~ ✅ 已完成：下载 UMD 构建到 `res/js/vendor/marked.min.js` + `purify.min.js`，`post.html` 改本地路径。暴露全局 `marked` / `DOMPurify`，`post.js` 检查 `typeof` 的守卫仍然生效。

## 优化待办（按优先级，逐项实施）

> 2026-11-26 整理，按建议实施顺序排列；每项完成后验证并确认再进入下一项。

- [x] **重构：管理面板移除文章表格，编辑/删除移入文章列表（配置 PAT 时显示），草稿开关 + 编辑跳转**（2026-11-26）。
- [x] **P1 索引去冗余**：`admin.js` 保存时不要把正文 `body` 写入 `index.json` 条目，只存元数据，并清理历史冗余正文；不影响正文与编辑功能。
- [x] **P2 管理表格注入风险**：`renderTable` 由 `innerHTML` 改为 DOM API / `textContent`，错误提示同理，消除索引字段注入。
- [x] **P3 会话内复用 Gist 响应**：`getGist()` 结果内存缓存（短 TTL），管理/写操作复用，减少 `GET /gists/:id` 重复请求与匿名限流压力。
- [x] **P4 写路径健壮性**：`upsertPost`/`deletePost` 读取索引走 `ensureOK`，并复用调用方已获取的 gist/index。
- [x] **P5 slug 唯一性校验**：新建时校验重名，编辑时排除自身。
- [ ] **P6 搜索图标 `target="_blank"` 补 `rel="noopener noreferrer"`**（index.html 三个 `<a>`）。
- [ ] **P7 详情页 vendor 脚本加 `defer`**：`post.html` 的 marked/purify 不阻塞 HTML 解析。
- [ ] **P8 背景媒体降开销**：`rain.mp4`/`rain.mp3` 改 `preload="metadata"` 或延迟加载，评估压缩/降码率。
- [ ] **P9 SW 预缓存 `post.html` 壳页面**：解除注释并纳入 `STATIC_ASSETS`。
- [ ] **P10 SW 动态缓存**：只缓存成功响应、设容量上限或版本清理；API 评估 stale-while-revalidate。
- [ ] **P11 排序容错**：`created_at` 缺失/非法时的兜底排序。
- [ ] **P12 死资产清理**：`res/icon/capitalism.svg`、`res/template/bird*.html` 决定去留并处理引用。
- [ ] **P13 时钟每秒动画开销**：实测有掉帧再优化（低优先级）。
- [ ] **P14 SEO/分享元数据**：`post.html` 补 OG 与初始 title（产品取舍）。

## 已知陷阱

- 页面入口已按页面拆分：`index.js`、`post.js` 各自只加载一次，`admin.js` 由首页管理面板动态导入。新增页面时不要把它们全部引入，否则会重复绑定事件。
- `res/js/index.js` 是 ES Module，顶层函数不会挂到 `window`；不要在 HTML 里用 `onclick="..."` 之类的内联写法，统一用 `addEventListener` 绑定。
- 首页文章、搜索和管理入口切换同页的面板；`togglePage` 维护视图、焦点与无障碍状态，不要误改为独立页面跳转。管理面板复用 `admin.js` 的 `initAdmin()`，其初始化守卫避免重复绑定。
- 管理页保存依赖模块变量 `editingFilename`：`null` 表示新建，非空表示更新。不要再给 `#save` 额外设置 `onclick`，否则会重复写入。
- 点击文章列表「编辑」后自动滚动到编辑器顶部并聚焦标题输入框；编辑器底部增加重复保存按钮。Toast 改为绝对定位（相对于管理页容器），避免移动端软键盘遮挡。表格表头使用 sticky 定位，滚动时保持列名可见。
- 管理页更新文章时会从 `currentPosts` 保留 `created_at`；不要退回为每次保存都使用当前时间。
- `post.html` 依赖本地 UMD 构建的 `marked` 与 `DOMPurify`（`res/js/vendor/`），渲染必须经过 `DOMPurify.sanitize`，不要绕过。`post.js` 已对 `typeof marked` / `typeof DOMPurify` 缺失给出明确提示。不要改回 CDN 引用。
- 详情页通过 `res/js/nav.js` 的 `renderNav(page)` 渲染到 `#site-nav`；必须先渲染再初始化主题按钮。首页不调用共享导航。主题切换按钮内 🌞/🌙 两个图标按当前主题切换显示（暗色显月亮、亮色显太阳），由 `body.dark-mode` 与 CSS 控制，不在 JS 中切换。左上角返回按钮使用 ⬅️ 图标：站内来源（`document.referrer` 同源）走 `history.back()` 返回上一页，否则回 `index.html`。
- 共享导航样式支持横排与响应式纵排；详情页窄屏回退横排。
- 详情页上一篇/下一篇使用「已发布 + `created_at` 升序」列表定位，不要退回为直接取 `index.json` 原始数组的 `±1`，否则草稿和手动排序会污染导航。
- 详情页渲染前会处理正文开头的 H1：与标题重复时移除，否则降级为 H2（`post.js` 的 `normalizeLeadingTitle`），避免一页出现两个 H1；正文其他位置的 H1 样式按 `article h1` 收敛。
- 详情页 `#navigation` 默认带 `hidden`，只有存在上一篇/下一篇时才移除；`#next-post` 需要 `margin-left: auto` 才能单独靠右。
- 首页方向按钮控制面板、管理面板和全屏；详情页的 `#theme-toggle` 由 `theme.js` 单击切换主题。
- `theme.js` 的 `toggleFullscreen()` 使用 WebKit/MS 前缀做兼容，iOS Safari 与部分受限 WebView 不支持会静默跳过；不要依赖其返回值。
- 首页时钟变化的数字使用位移动画；页面隐藏时直接更新数字。
- 无障碍要求：不要删除全局 `:focus-visible` 规则。
- 首页使用 `<main>` + `.sr-only` 的 `<h1>`，文章列表区域使用 `<section>`；避免同一文档出现多个 `<main>`。
- 首页雨景视频的加载、播放和渐变兜底见「雨景背景与排查」；不要恢复已移除的椋鸟背景或按时间段切换背景的旧说明。
- 主题切换使用 `document.startViewTransition` + `html.theme-transitioning`；不支持或用户偏好减少动画时回退为直接切换。`--theme-x` / `--theme-y` 是圆形扩散的圆心，不要删除。
- 首页文章面板生成文章卡片，`#post-list.animate-in` 只用于首次加载和翻页；筛选输入时不要加该 class，否则每输入一个字符都会重播动画。

- 搜索引擎图标顺序保存在 `localStorage.searchEngineOrder`；搜索框有内容时禁止拖拽，这是有意行为。
- PAT 存在 `localStorage.gh_pat`，只用于 GitHub API 请求头，不得写入源码、示例、日志或提交记录。管理页初始化时若检测到已存 PAT，会自动把输入框 `disabled` + 灰化、隐藏眼睛按钮、提示 meta 改为「已在本地」；清除后恢复可编辑。
- `sw.js` 在根目录以最大 scope 注册，首次安装时预缓存 `STATIC_ASSETS` 中的固定列表；新增静态文件（CSS/JS/icon）时记得把路径加进去。部署更新时改 cache 名 `static-vN` 触发旧缓存淘汰。不要把 POST/PATCH 请求（API 写操作）放进缓存。
- `USE_MOCK_DATA = true` 时不会访问 GitHub，所有写操作只改内存，刷新后丢失；若线上"保存后刷新没了"或看到示例文章，先检查是不是被改成 `true`（当前默认 `false`）。
- 主题逻辑统一在 `res/js/theme.js`；不要再把 `applyTheme/setTheme/setupThemeToggle` 复制回 `index.js` 或 `admin.js`。新增需要主题切换的页面时从该模块导入。
- 不要提交任何 token、真实个人敏感信息；`.gitignore` 已忽略 `.vscode/`、`node_modules/`、`dist/`、`.vercel/`、`.old/`。

## 修改后的验证

无自动化测试，按以下清单人工验证：

1. `http://localhost:8000/`：时钟每秒更新，日期与今日进度正确；首页默认暗色，视频静音播放，加载前及失败时静态背景可见。检查雨声自动播放被允许及被阻止时的状态、手动播放和静音、循环与加载失败恢复，并验证按钮的无障碍状态。
2. 首页方向按钮和方向键切换同页搜索、文章和管理面板及全屏；检查左方向三次进入、计数重置、返回按钮和 Esc、全屏状态、焦点、`inert`、`aria-hidden`、输入控件按键、文章面板顶部及非顶部上方向键。验证滑动不再触发导航，文章面板原生触摸滚动正常；切换管理面板不确认未保存内容。
3. 首页空闲预取、提前切入、加载中筛选、快速切换去重及失败重试正常；首页文章面板的筛选、搜索、空状态、分页归顶与键盘焦点正常。详情页主题切换及刷新后持久化；首页当前没有共享主题按钮。
4. 下载/替换 vendor 依赖后，先 Read 文件前几行确认有实际代码（不是 0 字节空文件），再打开 `post.html?slug=...`：首屏暗色，主题按钮可切换并持久化 `localStorage.theme`；标题、日期（`YYYY.MM.DD`）与标签正常，标签为空时没有多余分隔符；正文的标题、列表、引用、代码块、表格与图片按阅读宽度排版，窄屏下 `pre` / 表格横向滚动而不撑破页面；上一篇/下一篇只在存在时显示，单独“下一篇”靠右，没有上下篇时底部不出现空分隔线。`Network` 面板确认 `marked.min.js` / `purify.min.js` 加载自 `res/js/vendor/`（不是 CDN）。若看到「Markdown 渲染资源加载失败」提示，优先检查 vendor 文件是否为空。
5. 检查首页管理面板：默认暗色；首次进入才初始化，重复进出不重复绑定且保留表单，不自动重新加载管理表格。文章列表拉取期间表格显示「加载中...」，失败时显示错误提示，零数据时显示引导行（不是空白表格）。手动刷新时确认按钮禁用、图标旋转；请求结束后按钮恢复且旋转停止。初次加载及保存、删除后的自动刷新不旋转。
   未设置 PAT 时：输入框可编辑、placeholder 为原始提示、meta 行显示「仅在本地使用」；保存后 → 输入框自动 disabled + 灰化、眼睛按钮隐藏、meta 行改为「已在本地」、placeholder 改为「已保存（点击清除后可修改）」；点击「清除」→ 恢复可编辑状态。
   已设置 PAT 时，标题为空点击保存 → toast「标题不能为空」、不触发 API。编辑中有内容点击「新建」→ 弹确认框，取消则不清空。
   点击某篇文章「编辑」→ 表单回填正确，slug 下方显示灰色 hint（含锁定的文件名），正文正确（YAML front matter 已剥离）；新建模式下 slug hint 隐藏。
   文章列表表格超出容器最大高度时表头固定、内部滚动；最大高度通常为 480px，小屏（≤768px）为 320px。小屏下表单变单列，PAT 工具栏也变纵向。
   窄屏下表格出现横向滚动条（列不被挤压变形）；Toast 显示在顶部居中（软键盘弹出时不被遮挡）。
   仅在受控测试 Gist 上验证真实新建、编辑和删除，确认刷新后持久化；不要用真实生产数据做破坏性测试。检查首页管理面板保存、删除后文章面板重新加载、失效标签重置，以及旧请求晚于写入完成时不会覆盖新数据；跨标签页和外部修改不会触发该通知。
6. Service Worker：检查注册和 `sw.js` 中实际版本的缓存；分别测试在线、离线、HTTP 错误及带 slug 的详情地址，记录实际回退。跨域 raw、雨景视频和雨声音频未由当前策略缓存，不保证离线正文可用。
7. 键盘 Tab 能看到清晰焦点；提交前运行 `git diff --check` 检查空白错误，并确认 `git status` 中没有 PAT 或本地配置文件。
