
// js/gist.js
// ------------------------------------------------------------
// 封装与 GitHub Gist 的交互：
// - 读：匿名 GET，无需 token（走 gist.files[].raw_url 更省配额）
// - 写：PATCH /gists/:id，需要在请求头带 Authorization: token <PAT>
// - 统一错误处理：尽量返回清晰的错误信息（含 HTTP 状态码与 GitHub 的 message）
// - 工具方法：slug 生成、时间戳、Front Matter 组装
// 安全注意：不要在源码里硬编码 token，管理页会让用户粘贴 PAT 到 localStorage。
// ------------------------------------------------------------

import { CONFIG } from './config.js';

const API_BASE = 'https://api.github.com';

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

export const Gist = {
  /** 拉取 Gist 的完整结构（含 files 列表与 raw_url） */
  async getGist() {
    return fetchJSON(`${API_BASE}/gists/${CONFIG.GIST_ID}`);
  },

  /** 读取 index.json 的内容（优先用 raw_url 减少 API 配额消耗） */
  async getIndex() {
    const gist = await this.getGist();
    const idx = gist.files['index.json'];
    if (!idx) throw new Error('index.json 不存在，请先在你的 Gist 中创建它');
    const res = await fetch(idx.raw_url);
    await ensureOK(res);
    return res.json();
  },

  /** 根据文件名读取 Markdown 原文 */
  async getPostFile(filename) {
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
export const Util = {
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
