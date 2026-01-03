// js/config.js
// ------------------------------------------------------------
// 站点与 Gist 的基础配置。
// 你需要把 GIST_ID 与 OWNER 改为你的实际值。
// ------------------------------------------------------------
const CONFIG = {
  /**
   * 你的 Gist ID（创建 Gist 后，在 URL 末尾可见的一长串）
   * 例如: "a1b2c3d4e5f6abcdef1234567890abcd"
   */
  GIST_ID: "88a7fe50a4bbf2bba1a61124d5837a23", //"<YOUR_GIST_ID>",

  /**
   * 你的 GitHub 用户名（仅用于展示，不参与 API 鉴权）
   */
  OWNER: "baaaaaaaaad", //"<YOUR_GITHUB_USERNAME>",

  /**
   * 站点标题与描述（会渲染到页面）
   */
  SITE_TITLE: "My Gist Blog",
  SITE_DESC: "博客由 Gist 驱动（GitHub Pages + Gist + GitHub API）",

  /**
   * 列表分页大小
   */
  PAGE_SIZE: 10
};


// js/gist.js
// ------------------------------------------------------------
// 封装与 GitHub Gist 的交互：
// - 读：匿名 GET，无需 token（走 gist.files[].raw_url 更省配额）
// - 写：PATCH /gists/:id，需要在请求头带 Authorization: token <PAT>
// - 统一错误处理：尽量返回清晰的错误信息（含 HTTP 状态码与 GitHub 的 message）
// - 工具方法：slug 生成、时间戳、Front Matter 组装
// - Mock 数据：本地测试时使用，避免频繁请求 API
// 安全注意：不要在源码里硬编码 token，管理页会让用户粘贴 PAT 到 localStorage。
// ------------------------------------------------------------

const API_BASE = 'https://api.github.com';

// Mock 数据开关 - 设置为 true 时使用本地模拟数据
const USE_MOCK_DATA = true;

// Mock 数据定义
const MOCK_DATA = {
  index: {
    posts: [
      {
        title: "Hello World",
        slug: "hello-world",
        filename: "2025-01-01--hello-world.md",
        tags: ["intro", "test"],
        summary: "这是我的第一篇博客文章",
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
        status: "published"
      },
      {
        title: "测试文章二",
        slug: "test-post-2",
        filename: "2025-01-02--test-post-2.md",
        tags: ["test", "demo"],
        summary: "这是第二篇测试文章",
        created_at: "2025-01-02T00:00:00Z",
        updated_at: "2025-01-02T00:00:00Z",
        status: "published"
      },
      {
        title: "关于博客",
        slug: "about-this-blog",
        filename: "2025-01-03--about-this-blog.md",
        tags: ["about", "blog"],
        summary: "介绍这个博客的搭建过程和使用方法",
        created_at: "2025-01-03T00:00:00Z",
        updated_at: "2025-01-03T00:00:00Z",
        status: "published"
      }
    ]
  },
  posts: {
    "2025-01-01--hello-world.md": "---\ntitle: Hello World\nslug: hello-world\ntags: [intro, test]\nsummary: 这是我的第一篇博客文章\ncreated_at: 2025-01-01T00:00:00Z\nupdated_at: 2025-01-01T00:00:00Z\nstatus: published\n---\n\n# Hello World\n\n欢迎来到我的博客！这是我的第一篇文章。",
    "2025-01-02--test-post-2.md": "---\ntitle: 测试文章二\nslug: test-post-2\ntags: [test, demo]\nsummary: 这是第二篇测试文章\ncreated_at: 2025-01-02T00:00:00Z\nupdated_at: 2025-01-02T00:00:00Z\nstatus: published\n---\n\n# 测试文章二\n\n这是第二篇用于测试的文章内容。",
    "2025-01-03--about-this-blog.md": "---\ntitle: 关于博客\nslug: about-this-blog\ntags: [about, blog]\nsummary: 介绍这个博客的搭建过程和使用方法\ncreated_at: 2025-01-03T00:00:00Z\nupdated_at: 2025-01-03T00:00:00Z\nstatus: published\n---\n\n# 关于这个博客\n\n这个博客是使用 GitHub Gist 搭建的静态博客系统..."
  }
};

/** 从 localStorage 取出 PAT，拼装成 Authorization 头 */
function authHeaders() {
  const pat = localStorage.getItem('gh_pat') || '';
  return pat ? { 'Authorization': `token ${pat}` } : {};
}

/** 将 fetch 错误转换为更友好的 Error（含状态码与响应体） */
async function asJSONorText(res) {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
}
async function ensureOK(res) {
  if (!res.ok) {
    const body = await asJSONorText(res);
    const msg = typeof body === 'string' ? body : (body.message || JSON.stringify(body));
    throw new Error(`HTTP ${res.status}: ${msg}`);
  }
  return res;
}

/** GET JSON，自动附带 Accept 头 */
async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Accept': 'application/vnd.github+json',
      ...(opts.headers || {}),
    }
  });
  await ensureOK(res);
  return res.json();
}

/** GET 文本，通常用来拿 gist.files[].raw_url 的 Markdown 内容 */
async function fetchText(url, opts = {}) {
  const res = await fetch(url, opts);
  await ensureOK(res);
  return res.text();
}

const Gist = {
  /** 拉取 Gist 的完整结构（含 files 列表与 raw_url） */
  async getGist() {
    if (USE_MOCK_DATA) {
      // 返回模拟的 gist 结构
      return {
        id: CONFIG.GIST_ID,
        description: 'blog data',
        files: {
          'index.json': {
            filename: 'index.json',
            raw_url: 'mock-url/index.json'
          },
          ...Object.keys(MOCK_DATA.posts).reduce((acc, filename) => {
            acc[filename] = {
              filename: filename,
              raw_url: `mock-url/${filename}`
            };
            return acc;
          }, {})
        }
      };
    }
    return fetchJSON(`${API_BASE}/gists/${CONFIG.GIST_ID}`);
  },

  /** 读取 index.json 的内容（优先用 raw_url 减少 API 配额消耗） */
  async getIndex() {
    if (USE_MOCK_DATA) {
      return MOCK_DATA.index;
    }
    const gist = await this.getGist();
    const idx = gist.files['index.json'];
    if (!idx) throw new Error('index.json 不存在，请先在你的 Gist 中创建它');
    const res = await fetch(idx.raw_url);
    await ensureOK(res);
    return res.json();
  },

  /** 根据文件名读取 Markdown 原文 */
  async getPostFile(filename) {
    if (USE_MOCK_DATA) {
      if (!MOCK_DATA.posts[filename]) {
        throw new Error(`未找到文章文件：${filename}`);
      }
      return MOCK_DATA.posts[filename];
    }
    const gist = await this.getGist();
    const f = gist.files[filename];
    if (!f) throw new Error(`未找到文章文件：${filename}`);
    return fetchText(f.raw_url);
  },

  /**
   * 新建/更新一篇文章：
   * - 写入（或覆盖）对应的 .md 文件
   * - 同时把 index.json 用 indexUpdater(index) 变换后回写
   */
  async upsertPost({ filename, markdown, indexUpdater }) {
    if (USE_MOCK_DATA) {
      // 更新模拟数据
      MOCK_DATA.posts[filename] = markdown;
      const newIndex = indexUpdater(MOCK_DATA.index);
      MOCK_DATA.index = newIndex;

      // 返回模拟的响应
      return {
        id: CONFIG.GIST_ID,
        description: 'blog data',
        files: {
          'index.json': {
            filename: 'index.json'
          },
          [filename]: {
            filename: filename
          }
        }
      };
    }
    const gist = await this.getGist();
    const idxFile = gist.files['index.json'];
    if (!idxFile) throw new Error('index.json 不存在');

    const index = await (await fetch(idxFile.raw_url)).json();
    const newIndex = indexUpdater(index);

    const body = {
      description: gist.description || 'blog data',
      files: {
        [filename]: { content: markdown },
        'index.json': { content: JSON.stringify(newIndex, null, 2) }
      }
    };

    const res = await fetch(`${API_BASE}/gists/${CONFIG.GIST_ID}`, {
      method: 'PATCH',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        ...authHeaders()
      },
      body: JSON.stringify(body)
    });
    await ensureOK(res);
    return res.json();
  },

  /**
   * 删除一篇文章：
   * - 在 PATCH body.files 中把该文件名设为 null
   * - 同时把 index.json 按 indexUpdater(index) 变换后回写
   */
  async deletePost({ filename, indexUpdater }) {
    if (USE_MOCK_DATA) {
      // 删除模拟数据
      delete MOCK_DATA.posts[filename];
      const newIndex = indexUpdater(MOCK_DATA.index);
      MOCK_DATA.index = newIndex;

      // 返回模拟的响应
      return {
        id: CONFIG.GIST_ID,
        description: 'blog data',
        files: {
          'index.json': {
            filename: 'index.json'
          }
        }
      };
    }
    const gist = await this.getGist();
    const idxFile = gist.files['index.json'];
    if (!idxFile) throw new Error('index.json 不存在');

    const index = await (await fetch(idxFile.raw_url)).json();
    const newIndex = indexUpdater(index);

    const body = {
      files: {
        [filename]: null, // 表示删除该文件
        'index.json': { content: JSON.stringify(newIndex, null, 2) }
      }
    };

    const res = await fetch(`${API_BASE}/gists/${CONFIG.GIST_ID}`, {
      method: 'PATCH',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        ...authHeaders()
      },
      body: JSON.stringify(body)
    });
    await ensureOK(res);
    return res.json();
  }
};

/** 小工具集合：slug 化、ISO 时间、文件名、Front Matter 组装 */
const Util = {
  /**
   * 将标题转为 URL 友好的 slug：
   * - 小写
   * - 去除无关符号（保留中文、英文、数字、空格、连字符）
   * - 空白替换为连字符
   * - 合并重复连字符
   */
  slugify(title) {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\u4e00-\u9fa5\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  },

  /** 当前时间的 ISO 字符串（用于 created_at/updated_at） */
  nowISO() {
    return new Date().toISOString();
  },

  /** 以 UTC 日期 + slug 生成标准文件名 */
  buildFilename(dateISO, slug) {
    const d = new Date(dateISO);
    const pad = n => n.toString().padStart(2, '0');
    const yyyy = d.getUTCFullYear();
    const mm = pad(d.getUTCMonth() + 1);
    const dd = pad(d.getUTCDate());
    return `${yyyy}-${mm}-${dd}--${slug}.md`;
  },

  /**
   * 生成包含 YAML Front Matter 的 Markdown：
   * - 冗余保存文章元信息，便于迁移/导出
   * - 主元数据仍以 index.json 为准
   */
  buildFrontMatter(meta) {
    const yaml = [
      '---',
      `title: ${meta.title}`,
      `slug: ${meta.slug}`,
      `tags: [${(meta.tags || []).join(', ')}]`,
      `summary: ${meta.summary || ''}`,
      `created_at: ${meta.created_at}`,
      `updated_at: ${meta.updated_at}`,
      `status: ${meta.status || 'published'}`,
      '---',
      ''
    ].join('\n');
    return yaml + (meta.body || '');
  }
};


// js/nav.js
// 加载导航条
document.addEventListener('DOMContentLoaded', function() {
  // 获取导航条容器元素
  const navContainer = document.getElementById('nav-container');

  if (navContainer) {
    // 如果没有 nav.html 文件，直接创建导航内容
    navContainer.innerHTML = `
      <div class="nav-bar">
        <button id="back-home" style="border: none; background: none; font-weight: bold; font-size: 16px; cursor: pointer;">← 首页</button>
        <div class="nav-links">
          <a href="admin.html">管理</a>
        </div>
      </div>
    `;

    // 为返回首页按钮添加事件监听
    const backHomeBtn = document.getElementById('back-home');
    if (backHomeBtn) {
      backHomeBtn.addEventListener('click', function() {
        window.location.href = './index.html';
      });
    }
  }
});


// js/list.js（文章列表页逻辑）
// ------------------------------------------------------------
// 职责：
// 1) 拉取 Gist 的 index.json
// 2) 根据标签/关键词进行过滤
// 3) 分页渲染列表
// ------------------------------------------------------------

// 页面状态（内存中即可）
const state = {
    all: [],        // 所有文章（来自 index.json）
    filtered: [],   // 经过标签/搜索过滤后的文章
    tag: 'all',     // 当前筛选标签
    q: '',          // 当前搜索关键词（简单包含匹配）
    page: 1         // 当前页码（从 1 开始）
};

/** 渲染可视页的文章列表与分页信息 */
function renderList() {
    const start = (state.page - 1) * CONFIG.PAGE_SIZE;
    const end = start + CONFIG.PAGE_SIZE;
    const pageItems = state.filtered.slice(start, end);

    const ul = document.querySelector('#post-list');
    // 检查元素是否存在，避免 TypeError
    if (ul) {
        ul.innerHTML = '';

        for (const p of pageItems) {
            const li = document.createElement('li');
            li.innerHTML = `
        <a href="post.html?slug=${encodeURIComponent(p.slug)}">${p.title}</a>
        <span class="meta">${new Date(p.created_at).toLocaleDateString()} · ${p.tags?.join(', ') || ''}</span>
        <p class="summary">${p.summary || ''}</p>
      `;
            ul.appendChild(li);
        }
    }

    const totalPages = Math.max(1, Math.ceil(state.filtered.length / CONFIG.PAGE_SIZE));
    const paginationEl = document.querySelector('#pagination');
    // 检查元素是否存在，避免 TypeError
    if (paginationEl) {
        paginationEl.textContent = `第 ${state.page}/${totalPages} 页`;
    }
}

/** 根据所有文章数据重建标签下拉框 */
function rebuildFilters() {
    const tagSet = new Set(['all']);
    state.all.forEach(p => (p.tags || []).forEach(t => tagSet.add(t)));

    const sel = document.querySelector('#tag');
    // 检查元素是否存在，避免 TypeError
    if (sel) {
        sel.innerHTML = '';
        for (const t of [...tagSet]) {
            const opt = document.createElement('option');
            opt.value = t; opt.textContent = t;
            sel.appendChild(opt);
        }
    }
}

/** 应用当前筛选条件（标签 + 关键词），并按创建时间倒序排序 */
function applyFilter() {
    const { tag, q } = state;
    state.filtered = state.all.filter(p => {
        if (p.status !== 'published') return false; // 仅展示已发布
        const okTag = tag === 'all' || (p.tags || []).includes(tag);
        const text = `${p.title} ${p.summary} ${(p.tags || []).join(' ')}`.toLowerCase();
        const okQ = !q || text.includes(q.toLowerCase());
        return okTag && okQ;
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    state.page = 1;
    renderList();
}

async function main() {
    // 等待 DOM 加载完成
    if (document.readyState === 'loading') {
        await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
    }

    // 基本站点信息
    document.title = `${CONFIG.SITE_TITLE}`;
    const siteTitleEl = document.querySelector('#site-title');
    if (siteTitleEl) {
        siteTitleEl.textContent = CONFIG.SITE_TITLE;
    }
    const siteDescEl = document.querySelector('#site-desc');
    if (siteDescEl) {
        siteDescEl.textContent = CONFIG.SITE_DESC;
    }

    // 拉取索引并渲染
    const idx = await Gist.getIndex();
    state.all = idx.posts || [];
    rebuildFilters();
    applyFilter();

    // 绑定交互
    const tagEl = document.querySelector('#tag');
    if (tagEl) {
        tagEl.addEventListener('change', e => {
            state.tag = e.target.value; applyFilter();
        });
    }

    const qEl = document.querySelector('#q');
    if (qEl) {
        qEl.addEventListener('input', e => {
            state.q = e.target.value; applyFilter();
        });
    }

    const prevEl = document.querySelector('#prev');
    if (prevEl) {
        prevEl.addEventListener('click', () => {
            if (state.page > 1) { state.page--; renderList(); }
        });
    }

    const nextEl = document.querySelector('#next');
    if (nextEl) {
        nextEl.addEventListener('click', () => {
            const totalPages = Math.max(1, Math.ceil(state.filtered.length / CONFIG.PAGE_SIZE));
            if (state.page < totalPages) { state.page++; renderList(); }
        });
    }
}


/**
 * 主函数
 * 初始化页面，加载文章列表，绑定事件监听器
 */

main().catch(err => {
    console.error(err);
    document.querySelector('#post-list').innerHTML = `<li class="error">加载失败：${err.message}</li>`;
});


// js/post.js（文章详情页逻辑）
// ------------------------------------------------------------
// 职责：
// 1) 通过 URL ?slug=... 找到对应文章
// 2) 读取对应 Markdown 文件（通过 Gist raw_url）
// 3) 解析 YAML Front Matter，提取正文部分
// 4) 使用 marked + DOMPurify 渲染安全的 HTML
// ------------------------------------------------------------

/** 读取 URL 查询参数 */
function getQuery(name) {
  const u = new URL(location.href);
  return u.searchParams.get(name) || '';
}

/**
 * 简单的 Front Matter 解析：
 * - 仅解析最前面的 --- ... --- 区块
 * - 将形如 tags: [a, b] 的行解析为数组（宽松处理，不做严格 YAML）
 */
function parseFrontMatter(md) {
  if (md.startsWith('---')) {
    const end = md.indexOf('\n---', 3);
    if (end !== -1) {
      const yaml = md.slice(3, end).trim();
      const body = md.slice(end + 4);
      const meta = {};
      yaml.split(/\n+/).forEach(line => {
        const i = line.indexOf(':');
        if (i > 0) {
          const k = line.slice(0, i).trim();
          let v = line.slice(i + 1).trim();
          // 宽松处理数组：把未加引号的 a, b 变为 "a","b" 再 JSON.parse
          if (v.startsWith('[') && v.endsWith(']')) {
            try {
              v = JSON.parse(v.replace(/([a-zA-Z0-9_\-]+)(?=\s*,|\s*\])/g, '"$1"'));
            } catch {}
          }
          meta[k] = v;
        }
      });
      return { meta, body };
    }
  }
  return { meta: {}, body: md };
}

async function mainPost() {
  const slug = getQuery('slug');
  if (!slug) {
    const contentEl = document.querySelector('#content');
    if (contentEl) contentEl.textContent = '缺少 slug 参数';
    return;
  }

  // 在索引里找到对应文章
  const idx = await Gist.getIndex();
  const posts = idx.posts || [];
  const postIndex = posts.findIndex(p => p.slug === slug);
  const post = posts[postIndex];
  if (!post) {
    const contentEl = document.querySelector('#content');
    if (contentEl) contentEl.textContent = '未找到文章';
    return;
  }

  // 设置标题与元信息
  document.title = `${post.title} - ${CONFIG.SITE_TITLE}`;
  const h1El = document.querySelector('h1');
  const metaEl = document.querySelector('#meta');
  if (h1El) h1El.textContent = post.title;
  if (metaEl) metaEl.textContent = `${new Date(post.created_at).toLocaleString()} · ${(post.tags || []).join(', ')}`;

  // 取 Markdown、解析 Front Matter、渲染 HTML
  const md = await Gist.getPostFile(post.filename);
  const { body } = parseFrontMatter(md);
  const html = DOMPurify.sanitize(marked.parse(body));
  const contentEl = document.querySelector('#content');
  if (contentEl) contentEl.innerHTML = html;

  // 设置上一篇和下一篇链接
  const prevPost = posts[postIndex - 1];
  const nextPost = posts[postIndex + 1];

  const prevPostEl = document.querySelector('#prev-post');
  const nextPostEl = document.querySelector('#next-post');

  if (prevPost && prevPostEl) {
    prevPostEl.href = `post.html?slug=${encodeURIComponent(prevPost.slug)}`;
    prevPostEl.textContent = `上一篇: ${prevPost.title}`;
    prevPostEl.style.display = '';
  }

  if (nextPost && nextPostEl) {
    nextPostEl.href = `post.html?slug=${encodeURIComponent(nextPost.slug)}`;
    nextPostEl.textContent = `下一篇: ${nextPost.title}`;
    nextPostEl.style.display = '';
  }
}

// 只在 post.html 页面执行 mainPost 函数
if (location.pathname.includes('/post.html') || location.pathname.endsWith('/post.html')) {
  mainPost().catch(err => {
    console.error(err);
    const contentEl = document.querySelector('#content');
    if (contentEl) contentEl.textContent = `加载失败：${err.message}`;
  });
}


// js/admin.js（管理页：新建/编辑/删除）
// ------------------------------------------------------------
// 设计考虑：
// - 写操作需要 PAT（Personal Access Token，勾选 gist 权限即可）
// - PAT 只保存在浏览器 localStorage，提供保存/清除按钮
// - 新建：生成文件名 + Front Matter，更新 index.json
// - 编辑：读取 .md，回填到表单，保存时覆盖同一文件名
// - 删除：从 Gist 删除该 .md，并同步更新 index.json
// ------------------------------------------------------------

/** DOM 快捷选择 */
function $(s) { return document.querySelector(s); }

/** 简单的消息提示 */
function toast(msg) {
  const t = $('#toast');
  if (t) { // 检查元素是否存在
    t.textContent = msg;
    t.style.opacity = 1;
    setTimeout(() => t.style.opacity = 0, 2000);
  } else {
    console.log(msg); // 元素不存在时，降级为console.log
  }
}

/** 保证已配置 PAT，否则抛错提醒用户先配置 */
function requirePAT() {
  const pat = localStorage.getItem('gh_pat');
  if (!pat) throw new Error('未设置 PAT。请先在右上角输入（仅勾选 gist 权限）。');
}

/** 拉取 index.json 并渲染到列表表格 */
async function loadIndex() {
  const idx = await Gist.getIndex();
  renderTable(idx.posts || []);
}

/** 渲染列表表格（按创建时间倒序） */
function renderTable(posts) {
  const tbody = $('#posts tbody');
  if (tbody) { // 检查元素是否存在
    tbody.innerHTML = '';
    for (const p of posts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${p.title}</td>
        <td>${p.slug}</td>
        <td>${(p.tags || []).join(', ')}</td>
        <td>${p.status}</td>
        <td>${new Date(p.updated_at).toLocaleString()}</td>
        <td>
          <button data-act="edit" data-file="${p.filename}">编辑</button>
          <button data-act="del" data-file="${p.filename}">删除</button>
        </td>
      `;
      tbody.appendChild(tr);
    }
  }
}

/** 从表单读取当前输入，生成文章元数据与正文 */
function readForm() {
  // 检查所有必要元素是否存在
  const titleEl = $('#title');
  const summaryEl = $('#summary');
  const tagsEl = $('#tags');
  const statusEl = $('#status');
  const slugEl = $('#slug');
  const bodyEl = $('#body');

  if (!titleEl || !summaryEl || !tagsEl || !statusEl || !slugEl || !bodyEl) {
    return { title: '', summary: '', tags: [], status: 'published', slug: '', body: '' };
  }

  const title = titleEl.value.trim();
  const summary = summaryEl.value.trim();
  const tags = tagsEl.value.split(',').map(s => s.trim()).filter(Boolean);
  const status = statusEl.value;
  let slug = slugEl.value.trim();
  if (!slug) slug = Util.slugify(title);
  return { title, summary, tags, status, slug, body: bodyEl.value };
}

/** 将元数据回填到表单（用于编辑） */
function setForm(meta) {
  // 检查所有必要元素是否存在
  const titleEl = $('#title');
  const summaryEl = $('#summary');
  const tagsEl = $('#tags');
  const statusEl = $('#status');
  const slugEl = $('#slug');
  const bodyEl = $('#body');

  if (titleEl) titleEl.value = meta.title || '';
  if (summaryEl) summaryEl.value = meta.summary || '';
  if (tagsEl) tagsEl.value = (meta.tags || []).join(', ');
  if (statusEl) statusEl.value = meta.status || 'published';
  if (slugEl) slugEl.value = meta.slug || '';
  if (bodyEl) bodyEl.value = meta.body || '';
}

/**
 * 保存（新建或更新）：
 * - 新建：生成基于当前 UTC 日期的文件名
 * - 更新：复用原文件名（oldFilename）
 * - 两者都会：写入 .md + 更新 index.json
 */
async function upsert(isUpdate, oldFilename) {
  requirePAT();
  const now = Util.nowISO();
  const meta = readForm();

  // 文件名：更新时保持旧文件名，避免外链失效；新建时基于当前日期 + slug
  const filename = isUpdate ? (oldFilename) : Util.buildFilename(now, meta.slug);

  // 组装 Front Matter + 正文
  const markdown = Util.buildFrontMatter({ ...meta, created_at: now, updated_at: now });

  // 调用封装的 upsertPost 更新 Gist 与 index.json
  await Gist.upsertPost({
    filename,
    markdown,
    indexUpdater(index) {
      const posts = index.posts || [];
      const existsIdx = posts.findIndex(p => p.filename === filename);
      if (existsIdx >= 0) {
        // 更新：保留 created_at，更新其他字段与 updated_at
        posts[existsIdx] = { ...posts[existsIdx], ...meta, filename, updated_at: now };
      } else {
        // 新建：追加一条
        posts.push({ ...meta, filename, created_at: now, updated_at: now });
      }
      index.posts = posts;
      return index;
    }
  });

  toast('已保存');
  await loadIndex();
}

/** 删除文章（确认后执行） */
async function del(filename) {
  requirePAT();
  await Gist.deletePost({
    filename,
    indexUpdater(index) {
      index.posts = (index.posts || []).filter(p => p.filename !== filename);
      return index;
    }
  });
  toast('已删除');
  await loadIndex();
}

/** 绑定右上角工具栏：保存/清除 PAT、新建空白表单、保存按钮 */
function bindToolbar() {
  const patSaveBtn = $('#pat-save');
  const patClearBtn = $('#pat-clear');
  const newBtn = $('#new');
  const saveBtn = $('#save');
  const patInput = $('#pat');

  if (patSaveBtn && patInput) {
    patSaveBtn.addEventListener('click', () => {
      const v = patInput.value.trim();
      if (!v) { alert('请输入 PAT'); return; }
      localStorage.setItem('gh_pat', v);
      toast('PAT 已保存到本地');
    });
  }

  if (patClearBtn && patInput) {
    patClearBtn.addEventListener('click', () => {
      localStorage.removeItem('gh_pat');
      patInput.value = '';
      toast('已清除本地 PAT');
    });
  }

  if (newBtn) {
    newBtn.addEventListener('click', () => { setForm({}); });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', () => upsert(false));
  }
}

/**
 * 绑定表格中的"编辑/删除"按钮：
 * - 编辑：读取原 Markdown，解析 Front Matter，回填表单，重绑保存按钮为"更新"模式
 * - 删除：弹出确认框后直接删除
 */
function bindTable() {
  const postsTable = $('#posts');
  if (postsTable) { // 检查表格元素是否存在
    postsTable.addEventListener('click', async (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const act = btn.dataset.act;
      const filename = btn.dataset.file;

      if (act === 'edit') {
        // 拉取原文并解析 Front Matter
        const md = await Gist.getPostFile(filename);
        const fm = /^---([\s\S]*?)---\n?([\s\S]*)$/m.exec(md);
        let meta = { body: md };
        if (fm) {
          const yaml = fm[1].trim();
          const body = fm[2];
          meta = { body };
          yaml.split(/\n+/).forEach(line => {
            const i = line.indexOf(':');
            if (i > 0) {
              const k = line.slice(0, i).trim();
              let v = line.slice(i + 1).trim();
              if (v.startsWith('[') && v.endsWith(']')) {
                try { v = JSON.parse(v.replace(/([a-zA-Z0-9_\-]+)(?=\s*,|\s*\])/g, '"$1"')); } catch {}
              }
              meta[k] = v;
            }
          });
        }
        setForm(meta);

        // 将保存按钮临时变为"更新当前文件"
        const saveBtn = $('#save');
        if (saveBtn) {
          saveBtn.onclick = () => upsert(true, filename);
        }
      }

      if (act === 'del') {
          if (confirm('确认删除该文章？')) {
            await del(filename);
          }
        }
      });
    }
  }

async function mainAdmin() {
  document.title = `管理 - ${CONFIG.SITE_TITLE}`;
  bindToolbar();
  bindTable();
  await loadIndex();
}

mainAdmin().catch(err => alert(err.message));


// js/index.js 和 js/main.js 合并后的代码（时钟显示与动画、主题切换、搜索框功能、搜索引擎图标拖拽排序）
// 存储上一次的时间字符串，用于比较时间是否变化
let prevTimeStr = '';
let prevDateStr = '';

/**
 * 实时更新时间并拆分字符进行动画处理
 * 将时间字符串拆分为单个字符，对变化的字符应用动画效果
 */
function updateClock() {
  const now = new Date();
  // 格式化时间为 HH:MM:SS 格式
  const hours = String(now.getHours()).padStart(2, '0');  // 小时补零
  const minutes = String(now.getMinutes()).padStart(2, '0');  // 分钟补零
  const seconds = String(now.getSeconds()).padStart(2, '0');  // 秒钟补零
  const timeStr = `${hours}:${minutes}:${seconds}`;

  // 获取时钟显示元素
  const clockEl = document.getElementById('clock');

  // 检查时钟元素是否存在
  if (!clockEl) return;

  // 如果是首次加载（prevTimeStr为空），初始渲染所有字符
  if (prevTimeStr === '') {
    // 将时间字符串拆分为单个字符并渲染为带span标签的HTML
    clockEl.innerHTML = timeStr.split('').map((char, index) =>
      `<span class="char char-static">${char}</span>`
    ).join('');
  }
  // 如果时间发生变化，只更新变化的字符
  else if (timeStr !== prevTimeStr) {
    // 分割上一次和当前的时间字符串为字符数组
    const prevChars = prevTimeStr.split('');
    const currentChars = timeStr.split('');
    // 获取所有时钟字符元素
    const clockChars = clockEl.querySelectorAll('.char');

    // 确保时钟字符元素存在且数量正确
    if (clockChars.length >= timeStr.length) {
      // 遍历当前时间的每个字符
      currentChars.forEach((char, index) => {
        // 如果字符变化且不是冒号位置（2和5是冒号位置）
        if (char !== prevChars[index] && index !== 2 && index !== 5) {
          // 移除之前可能存在的动画类
          clockChars[index].classList.remove('char-jump-small', 'char-jump-medium', 'char-jump-large', 'char-jump-tiny', 'char-jump-extralarge', 'char-jump-xlarge');
          // 为不同位置的字符应用不同高度的弹跳动画，从左到右高度依次增加
          let animationType;
          if (index < 2) {
            // 小时部分（位置0-1）
            animationType = index === 0 ? 'char-jump-tiny' : 'char-jump-small';
          } else if (index < 5) {
            // 分钟部分（位置3-4）
            animationType = index === 3 ? 'char-jump-medium' : 'char-jump-large';
          } else {
            // 秒部分（位置6-7）
            animationType = index === 6 ? 'char-jump-extralarge' : 'char-jump-xlarge';
          }
          clockChars[index].classList.add(animationType);
          // 更新字符内容
          clockChars[index].textContent = char;

          // 动画结束后移除动画类，防止重复触发
          clockChars[index].addEventListener('animationend', function handler() {
            this.classList.remove(animationType);
            this.removeEventListener('animationend', handler);
          });
        }
        // 冒号位置的处理（不需要动画）
        else if (index === 2 || index === 5) {
          clockChars[index].textContent = char;
        }
      });
    }
  }

  // 更新日期显示
  updateDate(now);

  // 更新上一次时间记录
  prevTimeStr = timeStr;
}

/**
 * 更新公历日期显示
 * @param {Date} date - 当前日期
 */
function updateDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const weekDay = weekDays[date.getDay()];
  const dateStr = `${year}年${month}月${day}日 ${weekDay}`;

  // 只有当日期变化时才更新，避免不必要的DOM操作
  if (dateStr !== prevDateStr) {
    const dateEl = document.getElementById('date');
    if (dateEl) {
      dateEl.textContent = dateStr;
    }
    prevDateStr = dateStr;
  }
}



/**
 * 初始化时钟
 * 首次更新并设置定时器每秒更新一次
 */
function initClock() {
  updateClock();  // 立即更新一次
  setInterval(updateClock, 1000);  // 设置每秒更新
}


/**
 * 设置搜索引擎图标拖拽排序功能
 * 允许用户拖动调整搜索引擎图标的顺序并保存
 */
function setupDragAndDrop() {
  const container = document.getElementById('searchEnginesContainer');
  if (!container) return; // 如果容器不存在，直接返回
  const items = container.querySelectorAll('.search-engine-icon');
  if (!items.length) return; // 如果没有可拖拽元素，直接返回
  let draggedItem = null; // 跟踪当前正在拖拽的元素

  // 加载保存的排序顺序
  const savedOrder = localStorage.getItem('searchEngineOrder');
  if (savedOrder) {
    const order = savedOrder.split(',');
    // 按照保存的顺序重新排列元素
    order.forEach(id => {
      const item = document.getElementById(id);
      if (item) container.appendChild(item);
    });
  }

  // 为每个可拖拽元素添加事件监听器
  items.forEach(item => {
    // 开始拖拽时触发
    item.addEventListener('dragstart', function(e) {
      // 搜索框有内容时禁用拖拽
      const searchInput = document.getElementById('search-input');
      if (searchInput && searchInput.value.trim() !== '') {
        e.preventDefault();
        return;
      }

      draggedItem = this; // 记录正在拖拽的元素
      // 使用setTimeout确保样式应用在拖拽开始后
      setTimeout(() => this.classList.add('dragging'), 0);
      // 设置拖拽数据
      e.dataTransfer.setData('text/plain', this.id);
    });

    // 结束拖拽时触发
    item.addEventListener('dragend', function() {
      // 移除拖拽相关样式
      this.classList.remove('dragging');
      draggedItem = null;
      // 移除所有元素的drag-over样式
      container.querySelectorAll('.search-engine-icon').forEach(el => {
        el.classList.remove('drag-over');
      });

      // 保存新的排序顺序到本地存储
      const order = Array.from(container.querySelectorAll('.search-engine-icon'))
        .map(item => item.id); // 提取所有图标的ID
      localStorage.setItem('searchEngineOrder', order.join(','));
    });

    // 拖拽经过元素时触发
    item.addEventListener('dragover', function(e) {
      e.preventDefault(); // 允许放置
      this.classList.add('drag-over'); // 添加拖拽经过样式

      // 如果拖拽的不是当前元素本身
      if (draggedItem !== this) {
        const rect = this.getBoundingClientRect(); // 获取元素位置和尺寸
        const nextSibling = this.nextElementSibling;
        // 判断拖拽元素是在当前元素之前还是之后
        const isDraggedAfter = draggedItem.compareDocumentPosition(this) & Node.DOCUMENT_POSITION_PRECEDING;
        // 计算鼠标在当前元素内的X坐标
        const mouseX = e.clientX - rect.left;

        // 根据鼠标位置和相对位置决定插入位置
        // 如果鼠标在左半部分且拖拽元素在当前元素之后，则插入到当前元素之前
        if (mouseX < rect.width / 2 && isDraggedAfter) {
          container.insertBefore(draggedItem, this);
        }
        // 如果鼠标在右半部分且拖拽元素在当前元素之前，则插入到下一个元素之前
        else if (mouseX >= rect.width / 2 && !isDraggedAfter) {
          container.insertBefore(draggedItem, nextSibling);
        }
      }
    });

    // 拖拽离开元素时触发
    item.addEventListener('dragleave', function() {
      this.classList.remove('drag-over'); // 移除拖拽经过样式
    });

    // 在元素上放置时触发
    item.addEventListener('drop', function(e) {
      e.preventDefault(); // 阻止默认行为
      this.classList.remove('drag-over'); // 移除拖拽经过样式
    });
  });
}

/**
 * 使用指定的搜索引擎进行搜索
 * @param {string} engine - 搜索引擎名称（google/bing/baidu）
 */
function searchWithEngine(engine) {
  const searchInput = document.querySelector('.search-input');
  // 选中搜索框文字，使用setTimeout确保元素可交互
  setTimeout(() => searchInput.select(), 0);
  // 编码搜索查询字符串
  const query = encodeURIComponent(searchInput.value.trim());

  if (!query) return; // 不执行空搜索

  // 根据搜索引擎构建搜索URL
  let url = '';
  switch(engine) {
    case 'google':
      url = `https://www.google.com/search?q=${query}`;
      break;
    case 'bing':
      url = `https://www.bing.com/search?q=${query}`;
      break;
    case 'baidu':
      url = `https://www.baidu.com/s?wd=${query}`;
      break;
  }

  // 在新标签页打开搜索结果
  window.open(url, '_blank');
}

/**
 * 初始化函数
 * 启动所有页面功能模块
 */
function init() {
  // 初始化时钟显示
  initClock();

  // 初始化拖拽排序功能
  setupDragAndDrop();

  // 添加搜索框回车事件监听 - 按回车时使用第一个搜索引擎搜索
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        const firstEngine = document.querySelector('#searchEnginesContainer .search-engine-icon');
        if (firstEngine) {
          // 从元素ID中提取搜索引擎名称
          const engineName = firstEngine.id.split('-')[0];
          searchWithEngine(engineName);
        }
      }
    });

    // 添加搜索框输入监听 - 根据是否有输入内容切换搜索图标光标样式
    searchInput.addEventListener('input', function() {
      const searchIcons = document.querySelectorAll('.search-engine-icon');
      const hasText = this.value.trim() !== '';

      // 有内容时显示手型光标，否则使用默认光标
      searchIcons.forEach(icon => {
        icon.style.cursor = hasText ? 'pointer' : '';
      });
    });
  }
}

// 页面加载完成后初始化所有功能
document.addEventListener('DOMContentLoaded', init);


// js/page.js 页面切换和主题切换功能模块

// 主题切换功能
function setupThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    if (!themeToggle) return; // 如果主题切换按钮不存在，直接返回

    const body = document.body;

    // 从 localStorage 加载主题设置，如果没有则使用默认主题（light）
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') {
        body.classList.add('dark-mode');
    } else {
        body.classList.remove('dark-mode');
    }

    // 添加主题切换事件监听
    themeToggle.addEventListener('click', () => {
        // 切换body的dark-mode类
        body.classList.toggle('dark-mode');

        // 将主题偏好保存到本地存储
        if (body.classList.contains('dark-mode')) {
            localStorage.setItem('theme', 'dark');
        } else {
            localStorage.setItem('theme', 'light');
        }
    });
}

// 页面切换功能
function togglePage(pageName) {
    // 隐藏所有页面
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => {
        page.style.display = 'none';
    });

    // 显示目标页面
    const targetPage = document.getElementById(pageName);
    if (targetPage) {
        targetPage.style.display = 'block';
    }

    // 更新按钮状态
    const buttons = document.querySelectorAll('.nav-button');
    buttons.forEach(button => {
        button.classList.remove('active');
        if (button.getAttribute('data-page') === pageName) {
            button.classList.add('active');
        }
    });

    // 如果是从文章详情页切换回主页，清空URL参数
    if (pageName === 'main-page') {
        const url = new URL(window.location);
        url.search = '';
        window.history.pushState({}, document.title, url);
    }
}

// 初始页面加载处理
document.addEventListener('DOMContentLoaded', () => {
    // 设置主题切换
    setupThemeToggle();

    // 检查URL参数是否包含slug
    const urlParams = new URLSearchParams(window.location.search);
    const slug = urlParams.get('slug');
    const postPage = document.getElementById('post-page');

    if (slug && postPage) {
        // 如果有slug参数，显示文章详情页面
        togglePage('post-page');

        // 更新按钮状态
        const buttons = document.querySelectorAll('.nav-button');
        buttons.forEach(button => {
            button.classList.remove('active');
        });
    } else {
        // 否则默认显示主页
        togglePage('main-page');
    }

    // 导航按钮事件监听
    const buttons = document.querySelectorAll('.nav-button');
    buttons.forEach(button => {
        button.addEventListener('click', () => {
            const pageName = button.getAttribute('data-page');
            togglePage(pageName);
        });
    });

    // 搜索图标点击事件监听
    const searchIcons = document.querySelectorAll('.search-engine-icon');
    if (searchIcons.length) {
        searchIcons.forEach(icon => {
            icon.addEventListener('click', function() {
                // 获取搜索引擎名称
                const engineName = this.id.split('-')[0];
                searchWithEngine(engineName);
            });
        });
    }
});

// 导航图标点击动画效果
document.addEventListener('DOMContentLoaded', () => {
    const navIcons = document.querySelectorAll('.nav-button');
    if (navIcons.length) {
        navIcons.forEach(icon => {
            icon.addEventListener('click', function() {
                // 添加点击动画类
                this.classList.add('nav-button-clicked');

                // 动画结束后移除动画类
                this.addEventListener('animationend', function handler() {
                    this.classList.remove('nav-button-clicked');
                    this.removeEventListener('animationend', handler);
                });
            });
        });
    }

    // 添加页面切换按钮事件监听
    const pageToggle = document.getElementById('page-toggle');
    if (pageToggle) {
        pageToggle.addEventListener('click', function() {
            // 切换到文章列表页面
            togglePage('article-page');
        });
    }
});