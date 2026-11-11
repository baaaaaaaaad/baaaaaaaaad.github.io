// 首页逻辑：文章列表、时钟、主题切换、搜索与页面切换。
// 详情页与管理页分别由 post.js、admin.js 加载，三者共享 config.js 与 gist.js。
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
  if (!searchInput) return;
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

// 首页搜索框与文章列表按钮的显隐状态
const CONTROLS_VISIBILITY_KEY = 'indexControlsVisible';
const THEME_CLICK_DELAY = 250;

function setControlsVisible(visible) {
  document.body.classList.toggle('controls-visible', visible);
  localStorage.setItem(CONTROLS_VISIBILITY_KEY, visible ? '1' : '0');

  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) themeToggle.setAttribute('aria-expanded', String(visible));
}

function setupControlsVisibility() {
  const visible = localStorage.getItem(CONTROLS_VISIBILITY_KEY) === '1';
  document.body.classList.toggle('controls-visible', visible);

  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) themeToggle.setAttribute('aria-expanded', String(visible));
}

// 尽早应用显隐状态，避免刷新时先显示再隐藏
setupControlsVisibility();

// 主题切换功能
function applyTheme(theme, persist) {
  const isDark = theme === 'dark';
  document.body.classList.toggle('dark-mode', isDark);
  if (persist) localStorage.setItem('theme', isDark ? 'dark' : 'light');

  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) themeToggle.setAttribute('aria-pressed', String(isDark));
}

function setTheme(theme, persist = true, origin = null) {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!origin || prefersReducedMotion || typeof document.startViewTransition !== 'function') {
    applyTheme(theme, persist);
    return;
  }

  document.documentElement.style.setProperty('--theme-x', `${origin.x}px`);
  document.documentElement.style.setProperty('--theme-y', `${origin.y}px`);
  document.documentElement.classList.add('theme-transitioning');

  try {
    const transition = document.startViewTransition(() => applyTheme(theme, persist));
    const cleanup = () => document.documentElement.classList.remove('theme-transitioning');
    transition.finished.then(cleanup, cleanup);
  } catch {
    document.documentElement.classList.remove('theme-transitioning');
    applyTheme(theme, persist);
  }
}

/** 键盘替代双击：Shift+T 切换搜索框与文章列表按钮的显隐 */
function setupKeyboardToggles() {
  document.addEventListener('keydown', (event) => {
    if (!event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key.toLowerCase() !== 't') return;

    const target = event.target;
    if (target instanceof HTMLElement) {
      if (target.isContentEditable) return;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
    }

    event.preventDefault();
    setControlsVisible(!document.body.classList.contains('controls-visible'));
  });
}

function setupThemeToggle() {
  const themeToggle = document.getElementById('theme-toggle');
  if (!themeToggle) return; // 如果主题切换按钮不存在，直接返回

  // 从 localStorage 加载主题设置，如果没有则使用默认主题（light）
  setTheme(localStorage.getItem('theme') || 'light', false);

  let clickTimer = null;
  let clickOrigin = null;

  themeToggle.addEventListener('click', (event) => {
    const rect = themeToggle.getBoundingClientRect();
    clickOrigin = {
      x: event.clientX || rect.left + rect.width / 2,
      y: event.clientY || rect.top + rect.height / 2
    };

    // 双击：只切换搜索框与文章列表按钮的显隐，不切换主题
    if (clickTimer) {
      clearTimeout(clickTimer);
      clickTimer = null;
      setControlsVisible(!document.body.classList.contains('controls-visible'));
      return;
    }

    // 单击：延迟执行，等待可能的第二次点击
    clickTimer = setTimeout(() => {
      clickTimer = null;
      const nextTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
      setTheme(nextTheme, true, clickOrigin);
    }, THEME_CLICK_DELAY);
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
  setupKeyboardToggles();

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

  // 文章列表内的“返回首页”按钮
  const backHome = document.getElementById('back-home');
  if (backHome) {
    backHome.addEventListener('click', function() {
      togglePage('main-page');
    });
  }
});
