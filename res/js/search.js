// 搜索页：外部搜索引擎输入、图标排序与回车搜索
import { setupThemeToggle } from './theme.js';
import { renderNav } from './nav.js';

const ORDER_KEY = 'searchEngineOrder';
const ENGINE_URLS = {
  google: 'https://www.google.com/search?q=',
  bing: 'https://www.bing.com/search?q=',
  baidu: 'https://www.baidu.com/s?wd='
};

function getInput() {
  return document.getElementById('search-input');
}

function showHint(message) {
  const hint = document.getElementById('search-hint');
  if (hint) hint.textContent = message;
}

/** 根据输入内容切换清空按钮与图标光标 */
function updateSearchAffordances() {
  const input = getInput();
  const clearButton = document.getElementById('search-clear');
  if (!input) return;

  const hasText = input.value.trim() !== '';
  if (clearButton) clearButton.hidden = !hasText;

  document.querySelectorAll('.search-engine-icon').forEach(icon => {
    icon.style.cursor = hasText ? 'pointer' : '';
  });
}

/** 在 Google / Bing / 百度中搜索当前输入 */
function searchWithEngine(engine) {
  const input = getInput();
  const base = ENGINE_URLS[engine];
  if (!input || !base) return;

  const query = input.value.trim();
  if (!query) {
    input.focus();
    showHint('请输入搜索内容');
    return;
  }

  showHint('');
  window.open(`${base}${encodeURIComponent(query)}`, '_blank', 'noopener');
}

/** 搜索引擎图标拖拽排序，顺序保存到 localStorage */
function setupDragAndDrop() {
  const container = document.getElementById('searchEnginesContainer');
  if (!container) return;
  const items = container.querySelectorAll('.search-engine-icon');
  if (!items.length) return;
  let draggedItem = null;

  const savedOrder = localStorage.getItem(ORDER_KEY);
  if (savedOrder) {
    savedOrder.split(',').forEach(id => {
      const item = document.getElementById(id);
      if (item) container.appendChild(item);
    });
  }

  items.forEach(item => {
    item.addEventListener('dragstart', function (e) {
      const input = getInput();
      if (input && input.value.trim() !== '') {
        e.preventDefault();
        return;
      }
      draggedItem = this;
      setTimeout(() => this.classList.add('dragging'), 0);
      e.dataTransfer.setData('text/plain', this.id);
    });

    item.addEventListener('dragend', function () {
      this.classList.remove('dragging');
      draggedItem = null;
      container.querySelectorAll('.search-engine-icon').forEach(el => {
        el.classList.remove('drag-over');
      });
      const order = Array.from(container.querySelectorAll('.search-engine-icon')).map(el => el.id);
      localStorage.setItem(ORDER_KEY, order.join(','));
    });

    item.addEventListener('dragover', function (e) {
      e.preventDefault();
      this.classList.add('drag-over');
      if (draggedItem === this) return;

      const rect = this.getBoundingClientRect();
      const nextSibling = this.nextElementSibling;
      const isDraggedAfter = draggedItem.compareDocumentPosition(this) & Node.DOCUMENT_POSITION_PRECEDING;
      const mouseX = e.clientX - rect.left;

      if (mouseX < rect.width / 2 && isDraggedAfter) {
        container.insertBefore(draggedItem, this);
      } else if (mouseX >= rect.width / 2 && !isDraggedAfter) {
        container.insertBefore(draggedItem, nextSibling);
      }
    });

    item.addEventListener('dragleave', function () {
      this.classList.remove('drag-over');
    });

    item.addEventListener('drop', function (e) {
      e.preventDefault();
      this.classList.remove('drag-over');
    });
  });
}

function init() {
  renderNav('search');
  setupThemeToggle();
  setupDragAndDrop();

  const input = getInput();
  const clearButton = document.getElementById('search-clear');

  if (input) {
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        const firstEngine = document.querySelector('#searchEnginesContainer .search-engine-icon');
        if (firstEngine) searchWithEngine(firstEngine.id.split('-')[0]);
      } else if (e.key === 'Escape') {
        if (input.value) {
          input.value = '';
          updateSearchAffordances();
        }
        showHint('');
        input.blur();
      }
    });

    input.addEventListener('input', function () {
      showHint('');
      updateSearchAffordances();
    });
  }

  if (clearButton && input) {
    clearButton.addEventListener('click', function () {
      input.value = '';
      updateSearchAffordances();
      input.focus();
    });
  }

  document.querySelectorAll('.search-engine-icon').forEach(icon => {
    icon.addEventListener('click', function () {
      searchWithEngine(this.id.split('-')[0]);
    });
  });

  updateSearchAffordances();
  if (input) input.focus();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
