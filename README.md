
# Gist Blog（无后台）— GitHub Pages + Gist + GitHub API

这是一个前端纯静态的博客系统：
- 使用 **GitHub Pages** 托管静态页面
- 使用 **Gist** 存储文章与索引（`index.json` + 多个 `.md`）
- 通过 **GitHub API** 直接在浏览器进行读（匿名）/写（携带 PAT）
- 无需任何后台服务器

> 写操作需要 Personal Access Token（PAT），仅勾选 `gist` 权限。
> 切勿把 PAT 写进源码；本项目的 `admin.html` 仅把 PAT 存进当前浏览器的 `localStorage`，并提供一键清除。

## 快速开始

1. 在 https://gist.github.com/new 创建 **公开 Gist**，添加 `index.json` 文件：

   ```json
   {
     "version": 1,
     "site": { "title": "My Gist Blog", "description": "博客由 Gist 驱动", "author": "yourname" },
     "posts": []
   }
   ```

   记下 **Gist ID**（URL 末尾的一长串）。

2. 打开 `js/config.js`，把 `GIST_ID`、`OWNER` 改为你的实际值。
3. 把本项目所有文件推送到你的 GitHub Pages 仓库（根目录或 `docs/`）。
4. 在仓库 Settings → Pages 启用 Pages，访问站点：
   - `index.html`：文章列表
   - `post.html?slug=...`：详情页
   - `admin.html`：管理端（发文/改文/删文）
5. 第一次发布：进入 `admin.html`，粘贴**仅 `gist` 权限**的 PAT，填好内容后点击「保存」。

## 结构

```
.
├─ index.html         # 列表页
├─ post.html          # 文章详情页
├─ admin.html         # 管理页（需要 PAT 才能写）
├─ css/styles.css     # 基础样式
└─ js                 # 前端逻辑（ES Modules）
   ├─ config.js       # 站点和 Gist 配置
   ├─ gist.js         # 与 GitHub API 交互的封装（读/写）
   ├─ list.js         # 列表页逻辑：筛选/搜索/分页
   ├─ post.js         # 详情页逻辑：Front Matter 解析、Markdown 渲染
   └─ admin.js        # 管理页逻辑：新建/编辑/删除
```

## 安全提示

- PAT 权限**仅勾选 `gist`**；不要勾选 `repo` 或其他权限。
- PAT 只保存在浏览器本地（`localStorage`），可在管理页右上角随时清除。
- 切勿把 PAT 写入源码或推到仓库。

## Gist 数据约定

- `index.json` 维护站点信息与文章列表（元数据）。
- 每篇文章为一个 Markdown 文件：`YYYY-MM-DD--slug.md`。
- 文件内含 YAML Front Matter（冗余存储元数据，主数据仍以 `index.json` 为准）。

示例：见 `sample-gist-files` 目录（仅示例用，不会自动上传到 Gist）。

## 可选扩展
- 使用 GitHub OAuth（PKCE/Device Flow）替代 PAT 粘贴。
- 增加 Service Worker 做离线缓存。
- 在 `index.json` 里保留关键词字段，做更快的前端全文搜索。
