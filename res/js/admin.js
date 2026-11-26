// 管理页：PAT 凭据 + 新建/编辑文章。
// - 写操作需要 PAT（Personal Access Token，勾选 gist 权限即可）
// - PAT 只保存在浏览器 localStorage，提供保存/清除按钮
// - 新建：生成文件名 + Front Matter，更新 index.json
// - 编辑：由首页文章列表调用 openEditor() 回填表单，保存时覆盖同一文件名
import { Gist, Util } from './gist.js';

/** DOM 快捷选择 */
function $(s) { return document.querySelector(s); }

/** 当前正在编辑的文件名；为 null 时表示新建 */
let editingFilename = null;

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
      hintEl.textContent = `更新时文件名保持 "${editingFilename}" 不变；修改 slug 会改变文章链接。`;
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

  // 读取最新索引，用于 slug 唯一性与保留 created_at
  const index = await Gist.getIndex();
  const posts = index.posts || [];

  // slug 唯一性校验：新建时不得与已有文章重名，编辑时排除自身
  const slugConflict = posts.some(p =>
    p.filename !== (isUpdate ? oldFilename : null) && p.slug === meta.slug
  );
  if (slugConflict) {
    toast(`slug「${meta.slug}」已存在，请更换后再保存`);
    return;
  }

  // 文件名：更新时保持旧文件名，避免外链失效；新建时基于当前日期 + slug
  const filename = isUpdate && oldFilename ? oldFilename : Util.buildFilename(now, meta.slug);
  const existing = isUpdate ? posts.find(p => p.filename === filename) : null;
  if (isUpdate && !existing) {
    toast('该文章已不存在，可能已被删除');
    return;
  }
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

  // 复用刚取的最新索引，避免 upsertPost 再读一次
  await Gist.upsertPost({
    filename,
    markdown,
    index,
    indexUpdater(currentIndex) {
      const list = currentIndex.posts || [];
      const existsIdx = list.findIndex(p => p.filename === filename);
      if (existsIdx >= 0) {
        // 更新：保留 created_at，更新其他字段与 updated_at
        list[existsIdx] = { ...list[existsIdx], ...metaForIndex, filename, updated_at: now };
      } else {
        // 新建：追加一条
        list.push({ ...metaForIndex, filename, created_at: createdAt, updated_at: now });
      }
      // 正文只存于 .md 文件：移除索引条目中的 body，并顺带清理历史冗余
      currentIndex.posts = list.map(({ body, ...rest }) => rest);
      return currentIndex;
    }
  });

  document.dispatchEvent(new Event('admin-posts-changed'));
  editingFilename = filename;
  toast('已保存');
}

/** 绑定工具栏与编辑器：保存/清除 PAT、新建空白表单、保存按钮 */
function bindToolbar() {
  const patSaveBtn = $('#pat-save');
  const patClearBtn = $('#pat-clear');
  const newBtn = $('#new');
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

  if (patInput) patInput.addEventListener('input', syncPatState);

  syncPatState();

  if (patSaveBtn && patInput) {
    patSaveBtn.addEventListener('click', () => {
      const v = patInput.value.trim();
      if (!v) { alert('请输入 PAT'); return; }
      localStorage.setItem('gh_pat', v);
      toast('PAT 已保存到本地');
      syncPatState();
      document.dispatchEvent(new Event('pat-changed'));
    });
  }

  if (patClearBtn && patInput) {
    patClearBtn.addEventListener('click', () => {
      if (!confirm('确定清除本地保存的 PAT？清除后无法写入 Gist。')) return;
      localStorage.removeItem('gh_pat');
      toast('已清除本地 PAT');
      syncPatState();
      document.dispatchEvent(new Event('pat-changed'));
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
    saveBtn.addEventListener('click', () => upsert(Boolean(editingFilename), editingFilename));
  }
  const saveBottomBtn = $('#save-bottom');
  if (saveBottomBtn) {
    saveBottomBtn.addEventListener('click', () => upsert(Boolean(editingFilename), editingFilename));
  }
}

let initialized = false;

export async function initAdmin() {
  if (initialized) return;
  initialized = true;
  bindToolbar();
}

/** 首页文章列表点击“编辑”时调用：回填表单并进入编辑模式 */
export async function openEditor(post) {
  await initAdmin();
  const md = await Gist.getPostFile(post.filename);
  const fmStripped = md.replace(/^---[\s\S]*?---\n?/, '');
  setForm({ ...post, body: fmStripped }, post.filename);
  editingFilename = post.filename;
  const adminPage = document.getElementById('admin-page');
  adminPage?.scrollTo({ top: 0, behavior: 'smooth' });
  document.getElementById('title')?.focus();
}
