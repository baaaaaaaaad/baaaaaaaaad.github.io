# AGENTS.md

本文件面向在本仓库中工作的编码代理。修改代码前请先阅读「项目结构」「数据读写」「已知陷阱」。

## 项目概览

纯静态、无后台的 Gist 博客，部署在 GitHub Pages（用户站点 `baaaaaaaaad.github.io`）。

- 托管：GitHub Pages，`main` 分支根目录直接发布，无构建步骤。
- 存储：GitHub Gist，`index.json` 保存文章元数据，每篇文章一个 `YYYY-MM-DD--slug.md`。
- 读写：浏览器直接调用 GitHub API；读取匿名，写入需要 PAT（仅 `gist` 权限）。
- 技术栈：原生 HTML / CSS / JavaScript ES Modules（无框架、无包管理、无打包器、无测试）。
- 页面语言与注释：中文。新增注释、文档、提交说明保持中文风格。

## 本地预览

不要用 `file://` 直接打开，ES Modules 与 `fetch` 会被浏览器拦截。在仓库根目录起静态服务器：

```powershell
python -m http.server 8000
# 或
npx --yes serve .
```

然后访问 `http://localhost:8000/`。没有 install、build、lint、test 命令。

## 实际文件结构

```text
.
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
│     └─ nav.js               # 详情页与管理页共用的导航条（经典脚本，非模块）
├─ sample-gist-files/         # Gist 数据示例，仅参考，不会自动上传
└─ .gitignore
```

页面加载关系（修改时保持一致）：

- `index.html`：`res/css/index.css` + `type="module"` 的 `res/js/index.js`。首页导航是静态 HTML，不需要 `nav.js`。
- `post.html`：`res/css/index.css` + CDN 的 `marked` / `DOMPurify` + `res/js/nav.js`（defer）+ `type="module"` 的 `res/js/post.js`。
- `admin.html`：`res/css/index.css` + `res/js/nav.js`（defer）+ `type="module"` 的 `res/js/admin.js`。

不要再引用 `js/`、`css/` 或 `res/js/merged.js`，这些旧路径已经不存在。

## 数据读写

`res/js/gist.js` 是唯一的 Gist 访问层，导出 `Gist` 与 `Util`；`res/js/config.js` 是唯一配置来源。

- `CONFIG.GIST_ID`：当前为真实 Gist ID。
- `CONFIG.OWNER`：仅展示用，不参与鉴权。
- `CONFIG.PAGE_SIZE`：列表分页大小，默认 10。
- `USE_MOCK_DATA`（`res/js/gist.js` 顶部）：**当前为 `true`**，所有读写走内存 Mock。接真实数据前改为 `false`。
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
- Markdown 文件带 YAML Front Matter，但 `index.json` 才是主数据源。
- 文件名由「UTC 日期 + slug」生成；更新文章时复用原文件名，避免链接失效。
- 删除文章 = 在 Gist PATCH 请求中把该文件名设为 `null`，同时回写 `index.json`。
- `slug` 生成规则见 `res/js/gist.js` 的 `Util.slugify`：小写、保留中英文数字、空白转 `-`。

## 编码约定

- 纯原生 JS，不引入框架、包管理器或打包流程；确需第三方库时沿用 CDN `<script>` 方式。
- 入口脚本使用 ES Modules；`nav.js` 保持经典脚本，便于直接通过 `<script defer>` 加载。
- 路径统一相对当前页面，静态资源放在 `res/` 下。
- 样式只改 `res/css/index.css`；使用已有 CSS 变量（`--bg-color`、`--text-color`、`--accent-color` 等）和 `clamp()` 响应式写法。
- 首页与详情/管理页的布局通过 `body.post-page`、`body.admin-page` 隔离，不要破坏首页的 flex 居中布局。
- 主题切换依赖 `body.dark-mode` 与 `localStorage.theme`。
- DOM 查询使用 `document.querySelector` 并保持空值判断；页面入口脚本只应操作本页存在的元素。
- 缩进：CSS 4 空格；JS 2 空格。
- 注释使用中文，不要为显而易见的代码新增注释。

## 已知陷阱

- 三个页面入口已按页面拆分：`index.js`、`post.js`、`admin.js` 各自只加载一次。新增页面时不要把它们全部引入，否则会重复绑定事件。
- `res/js/index.js` 是 ES Module，顶层函数不会挂到 `window`；不要在 HTML 里用 `onclick="searchWithEngine(...)"` 之类的内联写法，统一用 `addEventListener` 绑定。
- `res/js/index.js` 顶部仍会调用列表 `main()`，但已用 `#post-list` 存在性做守卫；不要在无列表元素的页面加载它。
- 管理页保存依赖模块变量 `editingFilename`：`null` 表示新建，非空表示更新。不要再给 `#save` 额外设置 `onclick`，否则会重复写入。
- 管理页更新文章时会从 `currentPosts` 保留 `created_at`；不要退回为每次保存都使用当前时间。
- `post.html` 依赖 CDN 的 `marked` 与 `DOMPurify`，渲染必须经过 `DOMPurify.sanitize`，不要绕过。CDN 不可用时详情页无法渲染。
- `index.html` 依赖 CDN 的 Font Awesome 6.4.0（带 integrity），升级时同步更新哈希。
- 首页 `.search-container` 与 `#page-toggle` 默认隐藏；`#theme-toggle` 单击会延迟 250ms 切换主题，双击只切换这两个控件的显隐（`body.controls-visible`），状态存 `localStorage.indexControlsVisible`。不要改回即时 click 处理，否则双击会切换两次主题。
- 首页氛围背景由 `body[data-time="dawn|day|dusk|night"]` 驱动，时间段在 `res/js/index.js` 的 `getTimeOfDay` 中计算；新增时间段时同步补 `res/css/index.css` 的 `--ambient-a` / `--ambient-b` 变量（含暗色主题）。
- 主题切换使用 `document.startViewTransition` + `html.theme-transitioning`；不支持或用户偏好减少动画时回退为直接切换。`--theme-x` / `--theme-y` 是圆形扩散的圆心，不要删除。
- 文章卡片由 `res/js/index.js` 的 `createPostCard` 生成，`#post-list.animate-in` 只用于首次加载和翻页；筛选输入时不要加该 class，否则每输入一个字符都会重播动画。
- 搜索引擎图标顺序保存在 `localStorage.searchEngineOrder`；搜索框有内容时禁止拖拽，这是有意行为。
- PAT 存在 `localStorage.gh_pat`，只用于 GitHub API 请求头，不得写入源码、示例、日志或提交记录。
- `USE_MOCK_DATA = true` 时不会访问 GitHub；若线上看到示例文章，先检查该开关。
- 不要提交任何 token、真实个人敏感信息；`.gitignore` 已忽略 `.vscode/`、`node_modules/`、`dist/`、`.vercel/`、`.old/`。

## 修改后的验证

无自动化测试，按以下清单人工验证：

1. `http://localhost:8000/` 时钟每秒跳动、日期正确、主题切换可持久化。
2. 首页点击文章列表按钮，标签筛选、搜索、分页正常；「返回首页」可回到时钟页。
3. 打开 `post.html?slug=hello-world`，正文渲染正常，上一篇/下一篇链接可用。
4. 打开 `admin.html`，Mock 模式下新建、编辑、删除不会重复写入；浏览器控制台无 404、无模块解析错误。
5. 若改动写入逻辑，先保持 `USE_MOCK_DATA = true` 验证，再切换真实 Gist 并用仅 `gist` 权限的 PAT 测试。
6. 提交前运行 `git diff --check` 检查空白错误，并确认 `git status` 中没有 PAT 或本地配置文件。
