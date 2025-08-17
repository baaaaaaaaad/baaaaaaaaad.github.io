
// js/list.js（文章列表页逻辑）
// ------------------------------------------------------------
// 职责：
// 1) 拉取 Gist 的 index.json
// 2) 根据标签/关键词进行过滤
// 3) 分页渲染列表
// ------------------------------------------------------------

import { CONFIG } from './config.js';
import { Gist } from './gist.js';

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

  const totalPages = Math.max(1, Math.ceil(state.filtered.length / CONFIG.PAGE_SIZE));
  document.querySelector('#pagination').textContent = `第 ${state.page}/${totalPages} 页`;
}

/** 根据所有文章数据重建标签下拉框 */
function rebuildFilters() {
  const tagSet = new Set(['all']);
  state.all.forEach(p => (p.tags || []).forEach(t => tagSet.add(t)));

  const sel = document.querySelector('#tag');
  sel.innerHTML = '';
  for (const t of [...tagSet]) {
    const opt = document.createElement('option');
    opt.value = t; opt.textContent = t;
    sel.appendChild(opt);
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
  // 基本站点信息
  document.title = `${CONFIG.SITE_TITLE}`;
  document.querySelector('#site-title').textContent = CONFIG.SITE_TITLE;
  document.querySelector('#site-desc').textContent = CONFIG.SITE_DESC;

  // 拉取索引并渲染
  const idx = await Gist.getIndex();
  state.all = idx.posts || [];
  rebuildFilters();
  applyFilter();

  // 绑定交互
  document.querySelector('#tag').addEventListener('change', e => {
    state.tag = e.target.value; applyFilter();
  });
  document.querySelector('#q').addEventListener('input', e => {
    state.q = e.target.value; applyFilter();
  });
  document.querySelector('#prev').addEventListener('click', () => {
    if (state.page > 1) { state.page--; renderList(); }
  });
  document.querySelector('#next').addEventListener('click', () => {
    const totalPages = Math.max(1, Math.ceil(state.filtered.length / CONFIG.PAGE_SIZE));
    if (state.page < totalPages) { state.page++; renderList(); }
  });
}

main().catch(err => {
  console.error(err);
  document.querySelector('#post-list').innerHTML = `<li class="error">加载失败：${err.message}</li>`;
});
