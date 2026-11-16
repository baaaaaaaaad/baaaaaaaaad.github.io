// 首页逻辑：时钟、日期、今日进度与主题切换。
// 文章列表页由 posts.js 加载；详情页与管理页分别由 post.js、admin.js 加载。
import { setupThemeToggle } from './theme.js';
import { renderNav } from './nav.js';

renderNav('index');

// 存储上一次的时间字符串，用于比较时间是否变化
let prevTimeStr = '';
let prevDateStr = '';
let prevTimeOfDay = '';

/**
 * 实时更新时间并拆分字符进行动画处理
 * 将时间字符串拆分为单个字符，对变化的字符应用动画效果
 */
function updateClock() {
  const now = new Date();
  applyTimeOfDay(now);
  updateDayProgress(now);

  // 格式化时间为 HH:MM:SS 格式
  const hours = String(now.getHours()).padStart(2, '0');  // 小时补零
  const minutes = String(now.getMinutes()).padStart(2, '0');  // 分钟补零
  const seconds = String(now.getSeconds()).padStart(2, '0');  // 秒钟补零
  const timeStr = `${hours}:${minutes}:${seconds}`;

  // 获取时钟显示元素
  const clockEl = document.getElementById('clock');

  // 检查时钟元素是否存在
  if (!clockEl) return;

  // 如果是首次加载（prevTimeStr为空），初始渲染所有字符
  if (prevTimeStr === '') {
    // 将时间字符串拆分为单个字符并渲染为带span标签的HTML
    clockEl.innerHTML = timeStr.split('').map(char =>
      `<span class="char ${char === ':' ? 'char-colon' : 'char-static'}">${char}</span>`
    ).join('');
  }
  // 如果时间发生变化，只更新变化的字符
  else if (timeStr !== prevTimeStr) {
    // 分割上一次和当前的时间字符串为字符数组
    const prevChars = prevTimeStr.split('');
    const currentChars = timeStr.split('');
    // 获取所有时钟字符元素
    const clockChars = clockEl.querySelectorAll('.char');

    // 确保时钟字符元素存在且数量正确
    if (clockChars.length >= timeStr.length) {
      // 遍历当前时间的每个字符
      currentChars.forEach((char, index) => {
        // 如果字符变化且不是冒号位置（2和5是冒号位置）
        if (char !== prevChars[index] && index !== 2 && index !== 5) {
          // 移除之前可能存在的动画类
          clockChars[index].classList.remove('char-jump-small', 'char-jump-medium', 'char-jump-large', 'char-jump-tiny', 'char-jump-extralarge', 'char-jump-xlarge');
          // 为不同位置的字符应用不同高度的弹跳动画，从左到右高度依次增加
          let animationType;
          if (index < 2) {
            // 小时部分（位置0-1）
            animationType = index === 0 ? 'char-jump-tiny' : 'char-jump-small';
          } else if (index < 5) {
            // 分钟部分（位置3-4）
            animationType = index === 3 ? 'char-jump-medium' : 'char-jump-large';
          } else {
            // 秒部分（位置6-7）
            animationType = index === 6 ? 'char-jump-extralarge' : 'char-jump-xlarge';
          }
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
  }

  // 更新日期显示
  updateDate(now);

  // 更新上一次时间记录
  prevTimeStr = timeStr;
}

/**
 * 更新公历日期显示
 * @param {Date} date - 当前日期
 */
function updateDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const weekDay = weekDays[date.getDay()];
  const dateStr = `${year}年${month}月${day}日 ${weekDay}`;

  // 只有当日期变化时才更新，避免不必要的DOM操作
  if (dateStr !== prevDateStr) {
    const dateEl = document.getElementById('date');
    if (dateEl) {
      dateEl.textContent = dateStr;
    }
    prevDateStr = dateStr;
  }
}

/** 根据小时返回时间段 */
function getTimeOfDay(hour) {
  if (hour >= 5 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'dusk';
  return 'night';
}

/** 将时间段写到 body，用于切换氛围背景 */
function applyTimeOfDay(date) {
  const period = getTimeOfDay(date.getHours());
  if (period === prevTimeOfDay) return;
  prevTimeOfDay = period;
  document.body.dataset.time = period;
}

/** 更新「今日进度」文案与进度条 */
function updateDayProgress(date) {
  const elapsed = date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
  const percent = Math.min(100, (elapsed / 86400) * 100);

  const bar = document.getElementById('day-progress');
  const fill = document.getElementById('day-progress-fill');
  const text = document.getElementById('day-progress-text');

  if (fill) fill.style.width = `${percent.toFixed(2)}%`;
  if (text) text.textContent = `今日 ${Math.floor(percent)}%`;
  if (bar) bar.setAttribute('aria-valuenow', String(Math.round(percent)));
}

/**
 * 初始化时钟
 * 首次更新并设置定时器每秒更新一次
 */
function initClock() {
  updateClock();  // 立即更新一次
  setInterval(updateClock, 1000);  // 设置每秒更新
}

// 页面加载完成后初始化时钟
document.addEventListener('DOMContentLoaded', initClock);

document.addEventListener('DOMContentLoaded', () => {
  setupThemeToggle({ multiClick: true });
});
