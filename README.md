# Gist Blog（无后台）— GitHub Pages + Gist + GitHub API

一个前端纯静态的博客系统：

- 使用 **GitHub Pages** 托管静态页面
- 使用 **Gist** 存储文章与索引（`index.json` + 多个 `.md`）
- 通过 **GitHub API** 直接在浏览器进行读（匿名）/写（携带 PAT）
- 无需任何后台服务器、无构建步骤

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
5. 首次使用真实数据前，把 `res/js/gist.js` 顶部的 `USE_MOCK_DATA` 改为 `false`。
   默认值为 `true`，所有读写都走内存 Mock，不会访问 Gist。
6. 第一次发布：进入 `admin.html`，粘贴**仅 `gist` 权限**的 PAT，填好内容后点击「保存」。

## 本地预览

不要用 `file://` 直接打开，ES Modules、`fetch` 会被浏览器拦截。在仓库根目录启动静态服务器：

```powershell
python -m http.server 8000
# 或
npx --yes serve .
```

然后访问 `http://localhost:8000/`。本项目没有 install、build、lint、test 命令。

## 页面

- `index.html`：首页时钟、搜索与文章列表（标签筛选、搜索、分页）
- `post.html?slug=...`：文章详情页
- `admin.html`：管理页（新建 / 编辑 / 删除文章，需要 PAT）

## 结构

```text
.
├─ index.html                 # 首页 + 内嵌文章列表页
├─ post.html                  # 文章详情页（marked + DOMPurify）
├─ admin.html                 # 管理页（需要 PAT 才能写）
├─ res/
│  ├─ css/index.css           # 全站唯一样式表（主题变量 + 响应式）
│  ├─ icon/                   # favicon 与搜索引擎图标
│  └─ js/
│     ├─ config.js            # 站点与 Gist 配置（CONFIG）
│     ├─ gist.js              # GitHub API 封装、Mock 数据、slug / Front Matter 工具
│     ├─ index.js             # 首页逻辑（列表、时钟、主题、搜索、页面切换）
│     ├─ post.js              # 详情页逻辑（Front Matter 解析、Markdown 渲染）
│     ├─ admin.js             # 管理页逻辑（新建 / 编辑 / 删除）
│     └─ nav.js               # 详情页与管理页共用的顶部导航条
├─ sample-gist-files/         # Gist 数据示例，仅参考，不会自动上传
└─ .gitignore
```

`config.js` 与 `gist.js` 是三个页面入口共享的模块；修改数据读写行为时只需改这两处。

## 数据约定

- `index.json` 维护站点信息与文章列表（元数据）。
- 每篇文章为一个 Markdown 文件：`YYYY-MM-DD--slug.md`。
- 文件内含 YAML Front Matter（冗余存储元数据，主数据仍以 `index.json` 为准）。
- 列表只展示 `status === "published"` 的文章，按 `created_at` 倒序。
- 更新文章时复用原文件名，删除时在 Gist PATCH 请求中把文件名设为 `null`。

示例：见 `sample-gist-files` 目录（仅示例用，不会自动上传到 Gist）。

## 安全提示

- PAT 权限**仅勾选 `gist`**；不要勾选 `repo` 或其他权限。
- PAT 只保存在浏览器本地（`localStorage.gh_pat`），可在管理页右上角随时清除。
- 切勿把 PAT 写入源码或推到仓库。

## 可选扩展

- 使用 GitHub OAuth（PKCE/Device Flow）替代 PAT 粘贴。
- 增加 Service Worker 做离线缓存。
- 在 `index.json` 里保留关键词字段，做更快的前端全文搜索。
- 将 `marked` / `DOMPurify` 下载到本地，避免依赖 CDN。
