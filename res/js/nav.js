// 详情页与管理页共用的顶部导航条。
document.addEventListener('DOMContentLoaded', function() {
  const navContainer = document.getElementById('nav-container');
  if (!navContainer) return;

  const isPostPage = document.body.classList.contains('post-page');
  const searchLink = isPostPage ? '<a href="search.html">搜索</a>' : '';
  const themeButton = isPostPage
    ? '<button id="theme-toggle" class="nav-theme-toggle" aria-label="切换主题" aria-pressed="false" title="切换主题"><span class="light-icon">🌞</span><span class="dark-icon">🌙</span></button>'
    : '';

  navContainer.innerHTML = `
    <div class="nav-bar">
      <button id="back-home" class="back-home-button" aria-label="返回首页">← 首页</button>
      <div class="nav-links">
        ${searchLink}
        <a href="admin.html">管理</a>
        ${themeButton}
      </div>
    </div>
  `;

  const backHomeBtn = document.getElementById('back-home');
  if (backHomeBtn) {
    backHomeBtn.addEventListener('click', function() {
      window.location.href = './index.html';
    });
  }
});
