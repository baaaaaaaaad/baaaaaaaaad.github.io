// 首页逻辑：文章列表、时钟、搜索与页面切换。
// 详情页与管理页分别由 post.js、admin.js 加载，三者共享 config.js 与 gist.js。
import { CONFIG } from './config.js';
import { Gist } from './gist.js';

renderNav('index');

// 存储上一次的时间字符串，用于比较时间是否变化
let prevTimeStr = '';
let prevDateStr = '';

/**
 * 实时更新时间并拆分字符进行动画处理
 * 将时间字符串拆分为单个字符，对变化的字符应用动画效果
 */
function updateClock() {
  const now = new Date();
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


// 页面切换功能
function togglePage(pageName, focus = true) {
  const views = { 'main-page': 'home', 'search-page': 'search', 'article-page': 'article' };
  const view = views[pageName];
  if (!view) return;
  const stage = document.getElementById('slide-stage');
  stage.dataset.view = view;
  Object.keys(views).forEach(id => {
    const page = document.getElementById(id);
    const active = id === pageName;
    page.inert = !active;
    page.setAttribute('aria-hidden', String(!active));
  });
  document.querySelector('.slide-navigation').inert = view !== 'home';
  if (focus) document.getElementById(pageName).focus({ preventScroll: true });
}

function setupSlides() {
  const stage = document.getElementById('slide-stage');
  const fullscreenButton = document.getElementById('fullscreen-toggle');
  const updateFullscreenButton = () => {
    const active = Boolean(document.fullscreenElement);
    fullscreenButton.setAttribute('aria-pressed', String(active));
    fullscreenButton.setAttribute('aria-label', active ? '退出全屏' : '进入全屏');
  };
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    } catch (error) {
      console.warn('无法切换全屏模式', error);
    }
  };
  fullscreenButton.addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', updateFullscreenButton);
  updateFullscreenButton();
  const pages = { home: 'main-page', search: 'search-page', article: 'article-page' };
  document.querySelectorAll('[data-slide]').forEach(button => {
    button.addEventListener('click', () => togglePage(pages[button.dataset.slide]));
  });
  document.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.defaultPrevented) return;
    if (event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    const view = stage.dataset.view;
    if (view === 'home' && event.key === 'ArrowUp') {
      event.preventDefault();
      toggleFullscreen();
      return;
    }
    let target;
    if (view === 'home' && event.key === 'ArrowRight') target = 'search';
    if (view === 'home' && event.key === 'ArrowDown') target = 'article';
    if (view === 'home' && event.key === 'ArrowLeft') target = 'admin';
    if ((view === 'search' && event.key === 'ArrowLeft') || (view === 'article' && event.key === 'ArrowUp') || (view !== 'home' && event.key === 'Escape')) target = 'home';
    if (!target) return;
    event.preventDefault();
    if (target === 'admin') window.location.href = 'admin.html';
    else togglePage(pages[target]);
  });
  let start = null;
  stage.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.target.closest('a, button, input, select, textarea, [draggable="true"]')) return;
    start = { x: event.clientX, y: event.clientY, id: event.pointerId };
  });
  window.addEventListener('pointercancel', () => { start = null; });
  window.addEventListener('pointerup', event => {
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    start = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 80) return;
    const view = stage.dataset.view;
    let target;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (view === 'home') target = dx > 0 ? 'search' : 'admin';
      else if (view === 'search' && dx < 0) target = 'home';
    } else {
      if (view === 'home' && dy < 0) {
        toggleFullscreen();
        return;
      }
      if (view === 'home' && dy > 0) target = 'article';
      else if (view === 'article' && dy < 0 && document.getElementById('article-page').scrollTop === 0) target = 'home';
    }
    if (target === 'admin') window.location.href = 'admin.html';
    else if (target) togglePage(pages[target]);
  });
}

// 初始页面加载处理
document.addEventListener('DOMContentLoaded', () => {
  setupSlides();

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
    togglePage('main-page', false);
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
        const engineName = this.id.split('-')[0];
        searchWithEngine(engineName);
      });
      icon.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          icon.click();
        }
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

  // 文章列表内的“返回首页”按钮
  const backHome = document.getElementById('back-home');
  if (backHome) {
    backHome.addEventListener('click', function() {
      togglePage('main-page');
    });
  }
});
