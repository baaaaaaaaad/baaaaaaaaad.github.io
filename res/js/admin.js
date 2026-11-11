// 管理页：新建/编辑/删除。
// - 写操作需要 PAT（Personal Access Token，勾选 gist 权限即可）
// - PAT 只保存在浏览器 localStorage，提供保存/清除按钮
// - 新建：生成文件名 + Front Matter，更新 index.json
// - 编辑：读取 .md，回填到表单，保存时覆盖同一文件名
// - 删除：从 Gist 删除该 .md，并同步更新 index.json
import { CONFIG } from './config.js';
import { Gist, Util } from './gist.js';

/** DOM 快捷选择 */
function $(s) { return document.querySelector(s); }

/** 当前正在编辑的文件名；为 null 时表示新建 */
let editingFilename = null;

/** 当前索引中的文章，用于编辑时保留 created_at */
let currentPosts = [];

/** 简单的消息提示 */
function toast(msg) {
  const t = $('#toast');
  if (t) {
    t.textContent = msg;
    t.style.opacity = 1;
    setTimeout(() => t.style.opacity = 0, 2000);
  } else {
    console.log(msg);
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
  currentPosts = idx.posts || [];
  renderTable(currentPosts);
}

/** 渲染列表表格（按创建时间倒序） */
function renderTable(posts) {
  const tbody = $('#posts tbody');
  if (!tbody) return;

  tbody.innerHTML = '';
  for (const p of [...posts].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))) {
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

/** 从表单读取当前输入，生成文章元数据与正文 */
function readForm() {
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
  const filename = isUpdate && oldFilename ? oldFilename : Util.buildFilename(now, meta.slug);
  const existing = isUpdate ? currentPosts.find(p => p.filename === filename) : null;
  const createdAt = existing?.created_at || now;

  // 组装 Front Matter + 正文
  const markdown = Util.buildFrontMatter({ ...meta, created_at: createdAt, updated_at: now });

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
        posts.push({ ...meta, filename, created_at: createdAt, updated_at: now });
      }
      index.posts = posts;
      return index;
    }
  });

  // 保存后继续编辑同一篇；点击“新建”才会重置
  editingFilename = filename;
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
  if (editingFilename === filename) editingFilename = null;
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
    newBtn.addEventListener('click', () => {
      editingFilename = null;
      setForm({});
    });
  }

  if (saveBtn) {
    // 只保留一个监听器，避免编辑后又触发新建逻辑
    saveBtn.addEventListener('click', () => upsert(Boolean(editingFilename), editingFilename));
  }
}

/**
 * 绑定表格中的“编辑/删除”按钮：
 * - 编辑：读取原 Markdown，解析 Front Matter，回填表单并记录文件名
 * - 删除：弹出确认框后直接删除
 */
function bindTable() {
  const postsTable = $('#posts');
  if (!postsTable) return;

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
      editingFilename = filename;
    }

    if (act === 'del') {
      if (confirm('确认删除该文章？')) {
        await del(filename);
      }
    }
  });
}

async function main() {
  document.title = `管理 - ${CONFIG.SITE_TITLE}`;
  bindToolbar();
  bindTable();
  await loadIndex();
}

main().catch(err => alert(err.message));
