// 主题切换：首页、搜索页、管理页共用
// - applyTheme 只切换 class 与 aria 状态
// - setTheme 在支持时使用 view-transition 圆形扩散
// - setupThemeToggle 默认单击切换；multiClick 时单击切主题、双击全屏
const THEME_CLICK_DELAY = 250;

export function applyTheme(theme, persist) {
  const isDark = theme === 'dark';
  document.body.classList.toggle('dark-mode', isDark);
  if (persist) localStorage.setItem('theme', isDark ? 'dark' : 'light');
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.setAttribute('aria-pressed', String(isDark));
}

export function setTheme(theme, persist = true, origin = null) {
  if (!origin || typeof document.startViewTransition !== 'function') {
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

function nextTheme() {
  return document.body.classList.contains('dark-mode') ? 'light' : 'dark';
}

function getOrigin(btn, event) {
  const rect = btn.getBoundingClientRect();
  return {
    x: event.clientX || rect.left + rect.width / 2,
    y: event.clientY || rect.top + rect.height / 2
  };
}

function toggleFullscreen() {
  const fsEl = document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
  if (fsEl) {
    const exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
    if (exit) exit.call(document);
  } else {
    const root = document.documentElement;
    const enter = root.requestFullscreen || root.webkitRequestFullscreen || root.msRequestFullscreen;
    if (enter) enter.call(root);
  }
}

export function setupThemeToggle({ multiClick = false } = {}) {
  applyTheme(localStorage.getItem('theme') || 'dark', false);
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;

  if (!multiClick) {
    btn.addEventListener('click', (event) => {
      setTheme(nextTheme(), true, getOrigin(btn, event));
    });
    return;
  }

  let clickTimer = null;
  let clickOrigin = null;
  let clickCount = 0;

  btn.addEventListener('click', (event) => {
    clickOrigin = getOrigin(btn, event);
    clickCount++;
    if (clickTimer) clearTimeout(clickTimer);

    clickTimer = setTimeout(() => {
      clickTimer = null;
      const count = clickCount;
      clickCount = 0;

      if (count === 1) {
        setTheme(nextTheme(), true, clickOrigin);
      } else if (count === 2) {
        toggleFullscreen();
      }
      clickOrigin = null;
    }, THEME_CLICK_DELAY);
  });
}
