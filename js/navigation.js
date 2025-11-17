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

// 加载导航组件
fetch('navigation.html')
    .then(response => response.text())
    .then(html => {
        document.getElementById('navigation-container').innerHTML = html;
        setupThemeToggle();
    });