export function startRefreshFeedback(button, manual) {
  if (!button) return 0;
  button.disabled = true;
  button.classList.toggle('is-refreshing', manual);
  return performance.now();
}

export async function finishRefreshFeedback(button, deadline, isCurrent = () => true) {
  if (!button || !isCurrent()) return;
  const elapsed = performance.now() - deadline;
  const minDuration = 400;
  const remaining = Math.max(0, minDuration - elapsed);
  if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining));
  if (!isCurrent()) return;
  button.classList.remove('is-refreshing');
  button.disabled = false;
}

/** 更新列表刷新时间（HH:MM:SS），供文章面板与管理面板复用 */
export function updateRefreshTime(el, date = new Date()) {
  if (!el) return;
  const pad = n => String(n).padStart(2, '0');
  el.dateTime = date.toISOString();
  el.textContent = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
