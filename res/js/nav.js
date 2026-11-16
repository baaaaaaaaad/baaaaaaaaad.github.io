// 全站共享导航渲染器：各页统一使用 floating 图标导航。
const ICONS = {
  home: `<svg class="navigation-svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
    <path fill="currentColor" d="M12 3.2 2.8 11h2.4v9h5v-5.6h3.6V20h5v-9h2.4L12 3.2Z"/>
  </svg>`,
  search: `<svg class="navigation-svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
    <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"></circle>
    <path d="m20 20-3.5-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
  </svg>`,
  posts: `<svg class="navigation-svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
    <path fill="currentColor" d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm1 2v10h14V7H5Zm2 2h4v2H7V9Zm0 4h6v2H7v-2Zm8-4h2v2h-2V9Zm0 4h2v2h-2v-2Z"/>
  </svg>`,
  admin: `<svg class="navigation-svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
    <path fill="currentColor" d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5Z"/>
  </svg>`
};

const LINKS = {
  home: { href: 'index.html', label: '返回首页', title: '首页', icon: 'home' },
  search: { href: 'search.html', label: '打开搜索页', title: '搜索', icon: 'search' },
  posts: { href: 'posts.html', label: '查看文章列表', title: '文章列表', icon: 'posts' },
  admin: { href: 'admin.html', label: '管理', title: '管理', icon: 'admin' }
};

const PAGES = {
  index: { items: ['theme', 'search', 'posts'], themeTitle: '单击切换主题，双击全屏' },
  posts: { items: ['theme', 'home', 'search'], horizontal: true },
  search: { items: ['theme', 'home'] },
  post: { items: ['theme', 'search', 'home', 'admin'] },
  admin: { items: ['theme', 'search', 'home'] }
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
