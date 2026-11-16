// 首页逻辑：文章列表、时钟、主题切换、搜索与页面切换。
// 详情页与管理页分别由 post.js、admin.js 加载，三者共享 config.js 与 gist.js。
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

  // 列表页不存在时直接返回，避免在非首页误执行
  if (!document.querySelector('#post-list')) return;

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

// 存储上一次的时间字符串，用于比较时间是否变化
let prevTimeStr = '';
let prevDateStr = '';
let prevTimeOfDay = '';

/**
 * 实时更新时间并拆分字符进行动画处理
 * 将时间字符串拆分为单个字符，对变化的字符应用动画效果
 */
function updateClock() {
  const now = new Date();
  applyTimeOfDay(now);
  updateDayProgress(now);

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
    clockEl.innerHTML = timeStr.split('').map(char =>
      `<span class="char ${char === ':' ? 'char-colon' : 'char-static'}">${char}</span>`
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

/** 根据小时返回时间段 */
function getTimeOfDay(hour) {
  if (hour >= 5 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'dusk';
  return 'night';
}

/** 将时间段写到 body，用于切换氛围背景 */
function applyTimeOfDay(date) {
  const period = getTimeOfDay(date.getHours());
  if (period === prevTimeOfDay) return;
  prevTimeOfDay = period;
  document.body.dataset.time = period;
}

/** 更新「今日进度」文案与进度条 */
function updateDayProgress(date) {
  const elapsed = date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
  const percent = Math.min(100, (elapsed / 86400) * 100);

  const bar = document.getElementById('day-progress');
  const fill = document.getElementById('day-progress-fill');
  const text = document.getElementById('day-progress-text');

  if (fill) fill.style.width = `${percent.toFixed(2)}%`;
  if (text) text.textContent = `今日 ${Math.floor(percent)}%`;
  if (bar) bar.setAttribute('aria-valuenow', String(Math.round(percent)));
}

/**
 * 初始化时钟
 * 首次更新并设置定时器每秒更新一次
 */
function initClock() {
  updateClock();  // 立即更新一次
  setInterval(updateClock, 1000);  // 设置每秒更新
}

// 页面加载完成后初始化时钟
document.addEventListener('DOMContentLoaded', initClock);

// 首页与文章列表页切换
function togglePage(pageName) {
  document.querySelectorAll('.page').forEach(page => {
    page.style.display = 'none';
  });

  const targetPage = document.getElementById(pageName);
  if (targetPage) targetPage.style.display = 'block';

  if (pageName === 'main-page') {
    const url = new URL(window.location);
    url.search = '';
    window.history.pushState({}, document.title, url);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setupThemeToggle({ multiClick: true });
  togglePage('main-page');

  const pageToggle = document.getElementById('page-toggle');
  if (pageToggle) {
    pageToggle.addEventListener('click', () => togglePage('article-page'));
  }

  const backHome = document.getElementById('back-home');
  if (backHome) {
    backHome.addEventListener('click', () => togglePage('main-page'));
  }
});