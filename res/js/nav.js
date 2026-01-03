// 加载导航条
document.addEventListener('DOMContentLoaded', function() {
  // 获取导航条容器元素
  const navContainer = document.getElementById('nav-container');

  if (navContainer) {
    // 使用 fetch 加载导航条 HTML
    fetch('./nav.html')
      .then(response => {
        if (!response.ok) {
          throw new Error('导航条加载失败');
        }
        return response.text();
      })
      .then(html => {
        // 将导航条 HTML 插入到容器中
        navContainer.innerHTML = html;
      })
      .catch(error => {
        console.error('导航条加载错误:', error);
        navContainer.innerHTML = '<div class="nav-bar"><a href="./">My Gist Blog</a></div>';
      });
  }
});