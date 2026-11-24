export function startRefreshFeedback(button, manual) {
  if (!button) return 0;
  button.disabled = true;
  button.classList.toggle('is-refreshing', manual);
  return 0;
}

export async function finishRefreshFeedback(button, deadline, isCurrent = () => true) {
  if (!button || !isCurrent()) return;
  const remaining = deadline - performance.now();
  if (remaining > 0) await new Promise(resolve => setTimeout(resolve, Math.ceil(remaining)));
  if (!isCurrent()) return;
  button.classList.remove('is-refreshing');
  button.disabled = false;
}
