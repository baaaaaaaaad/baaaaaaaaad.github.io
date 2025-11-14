// 存储上一次的时间字符串
let prevTimeStr = '';

// 实时更新时间并拆分字符
function updateClock() {
  const now = new Date();
  // 格式化时间为 HH:MM:SS
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const timeStr = `${hours}:${minutes}:${seconds}`;

  const clockEl = document.getElementById('clock');

  // 如果是首次加载或时间变化
  if (prevTimeStr === '') {
    // 初始渲染所有字符
    clockEl.innerHTML = timeStr.split('').map((char, index) =>
      `<span class="char char-static">${char}</span>`
    ).join('');
  } else if (timeStr !== prevTimeStr) {
    // 时间变化时，更新变化的字符
    const prevChars = prevTimeStr.split('');
    const currentChars = timeStr.split('');
    const clockChars = clockEl.querySelectorAll('.char');

    currentChars.forEach((char, index) => {
      if (char !== prevChars[index] && index !== 2 && index !== 5) { // 跳过冒号
        // 移除现有动画类
        clockChars[index].classList.remove('char-jump-small', 'char-jump-medium', 'char-jump-large');
        // 添加新的动画类
        const animationType = ['char-jump-small', 'char-jump-medium', 'char-jump-large'][index % 3];
        clockChars[index].classList.add(animationType);
        // 更新字符内容
        clockChars[index].textContent = char;

        // 动画结束后移除动画类
        clockChars[index].addEventListener('animationend', function handler() {
          this.classList.remove(animationType);
          this.removeEventListener('animationend', handler);
        });
      } else if (index === 2 || index === 5) {
        // 冒号保持静态
        clockChars[index].textContent = char;
      }
    });
  }

  // 更新上一次时间
  prevTimeStr = timeStr;
}

// 初始化并每秒更新一次
function initClock() {
  updateClock();
  setInterval(updateClock, 1000);
}

// 主题切换功能
function setupThemeToggle() {
  const toggleButton = document.getElementById('theme-toggle');
  const body = document.body;

  // 检查本地存储中的主题偏好
  if (localStorage.getItem('theme') === 'dark' ||
      (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    body.classList.add('dark-mode');
  }

  toggleButton.addEventListener('click', () => {
    body.classList.toggle('dark-mode');

    // 保存主题偏好到本地存储
    if (body.classList.contains('dark-mode')) {
      localStorage.setItem('theme', 'dark');
    } else {
      localStorage.setItem('theme', 'light');
    }
  });
}

// 拖拽排序功能
function setupDragAndDrop() {
  const container = document.getElementById('searchEnginesContainer');
  const items = container.querySelectorAll('.search-engine-icon');
  let draggedItem = null;

  // 加载保存的顺序
  const savedOrder = localStorage.getItem('searchEngineOrder');
  if (savedOrder) {
    const order = savedOrder.split(',');
    order.forEach(id => {
      const item = document.getElementById(id);
      if (item) container.appendChild(item);
    });
  }

  items.forEach(item => {
    item.addEventListener('dragstart', function(e) {
      // 检查搜索框是否有输入内容
      const searchInput = document.getElementById('search-input');
      if (searchInput && searchInput.value.trim() !== '') {
        e.preventDefault();
        return;
      }
      draggedItem = this;
      setTimeout(() => this.classList.add('dragging'), 0);
      e.dataTransfer.setData('text/plain', this.id);
    });

    item.addEventListener('dragend', function() {
      this.classList.remove('dragging');
      draggedItem = null;
      container.querySelectorAll('.search-engine-icon').forEach(el => {
        el.classList.remove('drag-over');
      });

      // 保存新顺序
      const order = Array.from(container.querySelectorAll('.search-engine-icon'))
        .map(item => item.id);
      localStorage.setItem('searchEngineOrder', order.join(','));
    });

    item.addEventListener('dragover', function(e) {
      e.preventDefault();
      this.classList.add('drag-over');
      if (draggedItem !== this) {
        const rect = this.getBoundingClientRect();
        const nextSibling = this.nextElementSibling;
        const isDraggedAfter = draggedItem.compareDocumentPosition(this) & Node.DOCUMENT_POSITION_PRECEDING;

        const mouseX = e.clientX - rect.left;

        // 如果鼠标位置在当前元素左半部分, 且拖拽元素在当前元素之后则将拖拽元素插入到当前元素之前
        if (mouseX < rect.width / 2 && isDraggedAfter) {
          container.insertBefore(draggedItem, this);
        } else if (mouseX >= rect.width / 2 && !isDraggedAfter) {
          container.insertBefore(draggedItem, nextSibling);
        }
      }
    });

    item.addEventListener('dragleave', function() {
      this.classList.remove('drag-over');
    });

    item.addEventListener('drop', function(e) {
      e.preventDefault();
      this.classList.remove('drag-over');
    });
  });
}

// 搜索功能
function searchWithEngine(engine) {
  const searchInput = document.querySelector('.search-input');
  // 选中搜索框文字，使用setTimeout确保元素可交互
  setTimeout(() => searchInput.select(), 0);
  const query = encodeURIComponent(searchInput.value.trim());

  if (!query) return; // 不执行空搜索

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

  window.open(url, '_blank');
}

// 初始化函数
function init() {
  // 初始化时钟
  initClock();

  // 初始化主题切换
  setupThemeToggle();

  // 初始化拖拽排序
  setupDragAndDrop();

  // 添加搜索框回车事件监听
  document.getElementById('search-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const firstEngine = document.querySelector('#searchEnginesContainer .search-engine-icon');
      if (firstEngine) {
        const engineName = firstEngine.id.split('-')[0];
        searchWithEngine(engineName);
      }
    }
  });

  // 添加搜索框输入监听以切换搜索图标光标样式
  document.getElementById('search-input').addEventListener('input', function() {
    const searchIcons = document.querySelectorAll('.search-engine-icon');
    const hasText = this.value.trim() !== '';

    searchIcons.forEach(icon => {
      icon.style.cursor = hasText ? 'pointer' : '';
    });
  });
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);
