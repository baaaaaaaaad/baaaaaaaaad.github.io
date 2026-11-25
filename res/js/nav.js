// 全站共享导航渲染器：详情页使用 floating 图标导航。
const ICONS = {
  home: `<svg class="navigation-svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
    <path fill="currentColor" d="M12 3.2 2.8 11h2.4v9h5v-5.6h3.6V20h5v-9h2.4L12 3.2Z"/>
  </svg>`
};

const LINKS = {
  home: { href: 'index.html', label: '返回首页', title: '首页', icon: 'home' }
};

const PAGES = {
  post: { items: ['theme', 'home'] }
};

function themeButton(title) {
  return `<button id="theme-toggle" class="navigation-icon" aria-label="切换主题" aria-pressed="false" title="${title}"><span class="light-icon">🌞</span><span class="dark-icon">🌙</span></button>`;
}

function floatingItem(name, page) {
  if (name === 'theme') {
    return themeButton(PAGES[page].themeTitle || '单击切换主题');
  }
  const link = LINKS[name];
  if (!link) return '';
  return `<a href="${link.href}" class="navigation-icon" aria-label="${link.label}" title="${link.title}">${ICONS[link.icon]}</a>`;
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
