/**
 * 页面主脚本文件
 * 功能包括：时钟显示与动画、主题切换、搜索框功能、搜索引擎图标拖拽排序
 */

// 存储上一次的时间字符串，用于比较时间是否变化
let prevTimeStr = '';

/**
 * 实时更新时间并拆分字符进行动画处理
 * 将时间字符串拆分为单个字符，对变化的字符应用动画效果
 */
function updateClock() {
  const now = new Date();
  // 格式化时间为 HH:MM:SS 格式
  const hours = String(now.getHours()).padStart(2, '0');  // 小时补零
  const minutes = String(now.getMinutes()).padStart(2, '0');  // 分钟补零
  const seconds = String(now.getSeconds()).padStart(2, '0');  // 秒钟补零
  const timeStr = `${hours}:${minutes}:${seconds}`;

  // 获取时钟显示元素
  const clockEl = document.getElementById('clock');

  // 如果是首次加载（prevTimeStr为空），初始渲染所有字符
  if (prevTimeStr === '') {
    // 将时间字符串拆分为单个字符并渲染为带span标签的HTML
    clockEl.innerHTML = timeStr.split('').map((char, index) =>
      `<span class="char char-static">${char}</span>`
    ).join('');
  }
  // 如果时间发生变化，只更新变化的字符
  else if (timeStr !== prevTimeStr) {
    // 分割上一次和当前的时间字符串为字符数组
    const prevChars = prevTimeStr.split('');
    const currentChars = timeStr.split('');
    // 获取所有时钟字符元素
    const clockChars = clockEl.querySelectorAll('.char');

    // 遍历当前时间的每个字符
    currentChars.forEach((char, index) => {
      // 如果字符变化且不是冒号位置（2和5是冒号位置）
      if (char !== prevChars[index] && index !== 2 && index !== 5) {
        // 移除之前可能存在的动画类
        clockChars[index].classList.remove('char-jump-small', 'char-jump-medium', 'char-jump-large');
        // 为不同位置的字符应用不同高度的弹跳动画
        const animationType = ['char-jump-small', 'char-jump-medium', 'char-jump-large'][index % 3];
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

  // 更新上一次时间记录
  prevTimeStr = timeStr;
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
 * 设置主题切换功能
 * 实现亮色/暗色主题的切换并记住用户偏好
 */
function setupThemeToggle() {
  const toggleButton = document.getElementById('theme-toggle');
  const body = document.body;

  // 初始化主题：优先使用本地存储的主题偏好，否则根据系统设置
  if (localStorage.getItem('theme') === 'dark' ||
      (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    body.classList.add('dark-mode');
  }

  // 添加主题切换按钮点击事件
  toggleButton.addEventListener('click', () => {
    // 切换body的dark-mode类
    body.classList.toggle('dark-mode');

    // 将主题偏好保存到本地存储
    if (body.classList.contains('dark-mode')) {
      localStorage.setItem('theme', 'dark');
    } else {
      localStorage.setItem('theme', 'light');
    }
  });
}

/**
 * 设置搜索引擎图标拖拽排序功能
 * 允许用户拖动调整搜索引擎图标的顺序并保存
 */
function setupDragAndDrop() {
  const container = document.getElementById('searchEnginesContainer');
  const items = container.querySelectorAll('.search-engine-icon');
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

  // 初始化主题切换功能
  setupThemeToggle();

  // 初始化拖拽排序功能
  setupDragAndDrop();

  // 添加搜索框回车事件监听 - 按回车时使用第一个搜索引擎搜索
  document.getElementById('search-input').addEventListener('keypress', function(e) {
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
  document.getElementById('search-input').addEventListener('input', function() {
    const searchIcons = document.querySelectorAll('.search-engine-icon');
    const hasText = this.value.trim() !== '';

    // 有内容时显示手型光标，否则使用默认光标
    searchIcons.forEach(icon => {
      icon.style.cursor = hasText ? 'pointer' : '';
    });
  });
}

// 页面加载完成后初始化所有功能
document.addEventListener('DOMContentLoaded', init);