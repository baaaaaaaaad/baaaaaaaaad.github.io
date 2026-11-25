// 全站共享导航渲染器：详情页使用 floating 图标导航。
const PAGES = {
  post: { items: ['theme'] }
};

function themeButton(title) {
  return `<button id="theme-toggle" class="navigation-icon" aria-label="切换主题" aria-pressed="false" title="${title}"><span class="light-icon">🌞</span><span class="dark-icon">🌙</span></button>`;
}

function floatingItem(name, page) {
  if (name === 'theme') {
    return themeButton(PAGES[page].themeTitle || '单击切换主题');
  }
  return '';
}

function renderFloating(page) {
  const config = PAGES[page];
  const classes = ['navigation-container'];
  if (config.horizontal) classes.push('nav--horizontal');
  const items = config.items.map(name => floatingItem(name, page)).join('');
  return `<nav class="${classes.join(' ')}" aria-label="站点导航">${items}</nav>`;
}

/** 按页面渲染导航，需在初始化主题前调用 */
export function renderNav(page) {
  const root = document.getElementById('site-nav');
  if (!root || !PAGES[page]) return;
  root.innerHTML = renderFloating(page);
}
