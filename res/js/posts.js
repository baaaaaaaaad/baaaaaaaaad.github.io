// 文章列表页逻辑：标签筛选、站内搜索与分页。
import { CONFIG } from './config.js';
import { Gist } from './gist.js';
import { setupThemeToggle } from './theme.js';

// 页面状态（内存中即可）
const state = {
  all: [],        // 所有文章（来自 index.json）
  filtered: [],   // 经过标签/搜索过滤后的文章
  tag: 'all',     // 当前筛选标签
  q: '',          // 当前搜索关键词（简单包含匹配）
  page: 1         // 当前页码（从 1 开始）
};

/** 将 ISO 时间格式化为 YYYY.MM.DD */
function formatPostDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

/** 创建文章卡片 */
function createPostCard(post, index) {
  const li = document.createElement('li');
  li.className = 'post-card';
  li.style.setProperty('--i', index);

  const head = document.createElement('div');
  head.className = 'post-card-head';

  const link = document.createElement('a');
  link.className = 'post-card-title';
  link.href = `post.html?slug=${encodeURIComponent(post.slug)}`;
  link.textContent = post.title || '';

  const date = document.createElement('time');
  date.className = 'post-card-date';
  date.dateTime = post.created_at || '';
  date.textContent = formatPostDate(post.created_at);

  head.append(link, date);

  const summary = document.createElement('p');
  summary.className = 'post-card-summary';
  summary.textContent = post.summary || '';

  const tags = document.createElement('div');
  tags.className = 'post-card-tags';
  (post.tags || []).forEach(tag => {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.textContent = tag;
    tags.append(chip);
  });

  li.append(head, summary);
  if (tags.childElementCount) li.append(tags);
  return li;
}

/** 渲染加载 / 空列表提示 */
function renderListStatus(message) {
  const ul = document.querySelector('#post-list');
  if (!ul) return;
  ul.classList.remove('animate-in');
  const li = document.createElement('li');
  li.className = 'post-list-status';
  li.textContent = message;
  ul.replaceChildren(li);
}

/** 渲染可视页的文章列表与分页信息 */
function renderList(animate = false) {
  const start = (state.page - 1) * CONFIG.PAGE_SIZE;
  const end = start + CONFIG.PAGE_SIZE;
  const pageItems = state.filtered.slice(start, end);

  const ul = document.querySelector('#post-list');
  if (ul) {
    ul.classList.toggle('animate-in', animate && pageItems.length > 0);
    if (!pageItems.length) {
      const hasPublished = state.all.some(post => post.status === 'published');
      const li = document.createElement('li');
      li.className = 'post-list-status';
      li.textContent = hasPublished ? '没有找到匹配的文章' : '这里还没有文章';
      ul.replaceChildren(li);
    } else {
      const fragment = document.createDocumentFragment();
      pageItems.forEach((post, index) => fragment.append(createPostCard(post, index)));
      ul.replaceChildren(fragment);
    }
  }

  const totalPages = Math.max(1, Math.ceil(state.filtered.length / CONFIG.PAGE_SIZE));
  const paginationEl = document.querySelector('#pagination');
  if (paginationEl) {
    paginationEl.textContent = `第 ${state.page}/${totalPages} 页`;
  }
}

/** 根据所有文章数据重建标签下拉框 */
function rebuildFilters() {
  const tagSet = new Set(['all']);
  state.all.forEach(p => (p.tags || []).forEach(t => tagSet.add(t)));

  const sel = document.querySelector('#tag');
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
function applyFilter(animate = false) {
  const { tag, q } = state;
  state.filtered = state.all.filter(p => {
    if (p.status !== 'published') return false; // 仅展示已发布
    const okTag = tag === 'all' || (p.tags || []).includes(tag);
    const text = `${p.title} ${p.summary} ${(p.tags || []).join(' ')}`.toLowerCase();
    const okQ = !q || text.includes(q.toLowerCase());
    return okTag && okQ;
  }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  state.page = 1;
  renderList(animate);
}

async function main() {
  // 等待 DOM 加载完成
  if (document.readyState === 'loading') {
    await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
  }

  // 列表页不存在时直接返回
  if (!document.querySelector('#post-list')) return;

  document.title = `文章 · ${CONFIG.SITE_TITLE}`;

  // 拉取索引并渲染
  renderListStatus('正在加载文章…');
  const idx = await Gist.getIndex();
  state.all = idx.posts || [];
  rebuildFilters();
  applyFilter(true);

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
      if (state.page > 1) { state.page--; renderList(true); }
    });
  }

  const nextEl = document.querySelector('#next');
  if (nextEl) {
    nextEl.addEventListener('click', () => {
      const totalPages = Math.max(1, Math.ceil(state.filtered.length / CONFIG.PAGE_SIZE));
      if (state.page < totalPages) { state.page++; renderList(true); }
    });
  }
}

setupThemeToggle();

main().catch(err => {
  console.error(err);
  const list = document.querySelector('#post-list');
  if (list) {
    const li = document.createElement('li');
    li.className = 'error';
    li.textContent = `加载失败：${err.message}`;
    list.replaceChildren(li);
  }
});
