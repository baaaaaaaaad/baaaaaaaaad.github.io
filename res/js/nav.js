// 详情页与管理页共用的顶部导航条。
document.addEventListener('DOMContentLoaded', function() {
  const navContainer = document.getElementById('nav-container');
  if (!navContainer) return;

  navContainer.innerHTML = `
    <div class="nav-bar">
      <button id="back-home" class="back-home-button" aria-label="返回首页">← 首页</button>
      <div class="nav-links">
        <a href="admin.html">管理</a>
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
