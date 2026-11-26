// 管理页：新建/编辑/删除。
// - 写操作需要 PAT（Personal Access Token，勾选 gist 权限即可）
// - PAT 只保存在浏览器 localStorage，提供保存/清除按钮
// - 新建：生成文件名 + Front Matter，更新 index.json
// - 编辑：读取 .md，回填到表单，保存时覆盖同一文件名
// - 删除：从 Gist 删除该 .md，并同步更新 index.json
import { CONFIG } from './config.js';
import { Gist, Util } from './gist.js';
import { startRefreshFeedback, finishRefreshFeedback, updateRefreshTime } from './refresh-feedback.js';

/** DOM 快捷选择 */
function $(s) { return document.querySelector(s); }

/** 当前正在编辑的文件名；为 null 时表示新建 */
let editingFilename = null;

/** 当前索引中的文章，用于编辑时保留 created_at */
let currentPosts = [];
let indexRequestVersion = 0;
let hasLoadedIndex = false;

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
  if (!pat) throw new Error('未设置 PAT。请先在凭据设置中输入（仅勾选 gist 权限）。');
}

/** 拉取 index.json 并渲染到列表表格 */
async function loadIndex(manual = false) {
  const tbody = $('#posts-body');
  const refreshButton = $('#refresh-admin-posts');
  const refreshInfo = $('#admin-refresh-info');
  const requestVersion = ++indexRequestVersion;
  const refreshDeadline = startRefreshFeedback(refreshButton, manual);
  if (refreshInfo) refreshInfo.textContent = '正在刷新…';
  if (!hasLoadedIndex && tbody) {
    tbody.innerHTML = `<tr class="loading-row"><td colspan="6">加载中...</td></tr>`;
  }
  try {
    const idx = await Gist.getIndex();
    if (requestVersion !== indexRequestVersion) return;
    currentPosts = idx.posts || [];
    hasLoadedIndex = true;
    renderTable(currentPosts);
    updateRefreshTime(refreshInfo);
  } catch (err) {
    if (requestVersion !== indexRequestVersion) return;
    if (!hasLoadedIndex && tbody) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="6"></td></tr>';
      tbody.querySelector('td').textContent = `加载失败：${err.message || err}`;
    }
    if (refreshInfo) refreshInfo.textContent = '刷新失败';
  } finally {
    await finishRefreshFeedback(refreshButton, refreshDeadline, () => requestVersion === indexRequestVersion);
  }
}

/** 渲染列表表格（按创建时间倒序） */
function renderTable(posts) {
  const tbody = $('#posts-body');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (!posts.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">还没有文章，在下方编辑区填写内容后点击「保存」即可发布第一篇。</td></tr>`;
    return;
  }
  for (const p of [...posts].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p.title}</td>
      <td>${p.slug}</td>
      <td>${(p.tags || []).join(', ')}</td>
      <td>${p.status}</td>
      <td>${new Date(p.updated_at).toLocaleString()}</td>
      <td>
        <button data-act="edit" data-file="${p.filename}" aria-label="编辑" title="编辑">✏️</button>
        <button data-act="del" data-file="${p.filename}" aria-label="删除" title="删除">🗑️</button>
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

/** 将元数据回填到表单（用于编辑）。editingFilename 非空时为更新模式 */
function setForm(meta, editingFilename = null) {
  const titleEl = $('#title');
  const summaryEl = $('#summary');
  const tagsEl = $('#tags');
  const statusEl = $('#status');
  const slugEl = $('#slug');
  const bodyEl = $('#body');
  const hintEl = $('#slug-hint');

  if (titleEl) titleEl.value = meta.title || '';
  if (summaryEl) summaryEl.value = meta.summary || '';
  if (tagsEl) tagsEl.value = (meta.tags || []).join(', ');
  if (statusEl) statusEl.value = meta.status || 'published';
  if (slugEl) slugEl.value = meta.slug || '';
  if (bodyEl) bodyEl.value = meta.body || '';

  if (hintEl) {
    if (editingFilename) {
      hintEl.textContent = `更新时文件名保持 "${editingFilename}" 不变以保留已有外链。改 slug 仅影响列表展示。`;
      hintEl.style.display = 'block';
    } else {
      hintEl.textContent = '';
      hintEl.style.display = 'none';
    }
  }
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

  if (!meta.title) {
    toast('标题不能为空');
    return;
  }

  // 文件名：更新时保持旧文件名，避免外链失效；新建时基于当前日期 + slug
  const filename = isUpdate && oldFilename ? oldFilename : Util.buildFilename(now, meta.slug);
  const existing = isUpdate ? currentPosts.find(p => p.filename === filename) : null;
  const createdAt = existing?.created_at || now;

  // 索引只存元数据，正文 body 仅写入 .md 文件
  const metaForIndex = {
    title: meta.title,
    summary: meta.summary,
    tags: meta.tags,
    status: meta.status,
    slug: meta.slug
  };

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
        posts[existsIdx] = { ...posts[existsIdx], ...metaForIndex, filename, updated_at: now };
      } else {
        // 新建：追加一条
        posts.push({ ...metaForIndex, filename, created_at: createdAt, updated_at: now });
      }
      // 正文只存于 .md 文件：移除索引条目中的 body，并顺带清理历史冗余
      index.posts = posts.map(({ body, ...rest }) => rest);
      return index;
    }
  });

  document.dispatchEvent(new Event('admin-posts-changed'));
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
  document.dispatchEvent(new Event('admin-posts-changed'));
  if (editingFilename === filename) editingFilename = null;
  toast('已删除');
  await loadIndex();
}

/** 绑定右上角工具栏：保存/清除 PAT、新建空白表单、保存按钮 */
function bindToolbar() {
  const patSaveBtn = $('#pat-save');
  const patClearBtn = $('#pat-clear');
  const newBtn = $('#new');
  const refreshBtn = $('#refresh-admin-posts');
  const saveBtn = $('#save');
  const patInput = $('#pat');
  const patToggle = $('#pat-toggle');
  const patMeta = document.querySelector('header .meta');

  function syncPatState() {
    const hasPat = !!localStorage.getItem('gh_pat');
    if (patInput) {
      patInput.disabled = hasPat;
      if (hasPat) patInput.value = '';
      patInput.placeholder = hasPat ? '已保存（点击清除后可修改）' : '输入 PAT（仅 gist 权限）';
    }
    if (patToggle) {
      patToggle.style.display = hasPat ? 'none' : '';
    }
    if (patMeta) {
      patMeta.textContent = hasPat ? 'PAT 已在本地，点击「清除」后可重新输入' : '仅在本地使用 PAT 写入 Gist';
    }
    if (patSaveBtn) {
      patSaveBtn.disabled = hasPat || !patInput?.value.trim();
    }
  }

  if (patInput) {
    patInput.addEventListener('input', syncPatState);
  }

  syncPatState();

  if (refreshBtn) refreshBtn.addEventListener('click', () => loadIndex(true));

  if (patSaveBtn && patInput) {
    patSaveBtn.addEventListener('click', () => {
      const v = patInput.value.trim();
      if (!v) { alert('请输入 PAT'); return; }
      localStorage.setItem('gh_pat', v);
      toast('PAT 已保存到本地');
      syncPatState();
    });
  }

  if (patClearBtn && patInput) {
    patClearBtn.addEventListener('click', () => {
      if (!confirm('确定清除本地保存的 PAT？清除后无法写入 Gist。')) return;
      localStorage.removeItem('gh_pat');
      toast('已清除本地 PAT');
      syncPatState();
    });
  }

  if (patToggle && patInput) {
    patToggle.addEventListener('click', () => {
      const isHidden = patInput.type === 'password';
      patInput.type = isHidden ? 'text' : 'password';
      patToggle.setAttribute('aria-label', isHidden ? '隐藏 PAT' : '显示 PAT');
      patToggle.textContent = isHidden ? '🙈' : '👁';
    });
  }

  if (newBtn) {
    newBtn.addEventListener('click', () => {
      const titleEl = $('#title');
      const bodyEl = $('#body');
      const hasContent = editingFilename ||
        (titleEl && titleEl.value.trim()) ||
        (bodyEl && bodyEl.value.trim());
      if (hasContent && !confirm('点击「新建」会清空当前表单，未保存的内容将丢失。确认继续？')) {
        return;
      }
      editingFilename = null;
      setForm({});
    });
  }

  if (saveBtn) {
    // 只保留一个监听器，避免编辑后又触发新建逻辑
    saveBtn.addEventListener('click', () => upsert(Boolean(editingFilename), editingFilename));
  }
  const saveBottomBtn = $('#save-bottom');
  if (saveBottomBtn) {
    saveBottomBtn.addEventListener('click', () => upsert(Boolean(editingFilename), editingFilename));
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
      const md = await Gist.getPostFile(filename);
      const post = currentPosts.find(p => p.filename === filename) || {};
      const fmStripped = md.replace(/^---[\s\S]*?---\n?/, '');
      setForm({ ...post, body: fmStripped }, filename);
      editingFilename = filename;
      // 编辑后滚动到顶部并聚焦标题输入框
      const adminPage = document.getElementById('admin-page');
      adminPage?.scrollTo({ top: 0, behavior: 'smooth' });
      document.getElementById('title')?.focus();
    }

    if (act === 'del') {
      if (confirm('确认删除该文章？')) {
        await del(filename);
      }
    }
  });
}

let initialized = false;

export async function initAdmin() {
  if (initialized) return;
  initialized = true;
  bindToolbar();
  bindTable();
  await loadIndex();
}

if (document.body.classList.contains('admin-page')) {
  document.title = `管理 - ${CONFIG.SITE_TITLE}`;
  initAdmin().catch(err => alert(err.message));
}
