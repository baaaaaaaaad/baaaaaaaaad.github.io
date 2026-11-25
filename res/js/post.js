// 文章详情页逻辑：
// 1) 通过 URL ?slug=... 找到对应文章
// 2) 读取对应 Markdown 文件（通过 Gist raw_url）
// 3) 移除 Front Matter，提取正文
// 4) 使用 marked + DOMPurify 渲染安全的 HTML
import { CONFIG } from './config.js';
import { Gist } from './gist.js';
import { setupThemeToggle } from './theme.js';
import { renderNav } from './nav.js';

renderNav('post');

/** 返回上一页：站内来源使用浏览器历史，否则回首页 */
function setupBackButton() {
  const btn = document.querySelector('#back-button');
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (document.referrer && new URL(document.referrer).origin === location.origin) {
      history.back();
    } else {
      location.href = 'index.html';
    }
  });
}

setupBackButton();

/** 读取 URL 查询参数 */
function getQuery(name) {
  const u = new URL(location.href);
  return u.searchParams.get(name) || '';
}

/** 移除开头的 YAML Front Matter，只保留正文 */
function stripFrontMatter(md) {
  return md.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
}

/** 处理正文开头的 H1：与标题重复时移除，否则降级为 H2，避免一页两个 H1 */
function normalizeLeadingTitle(body, title) {
  const match = body.match(/^(\s*)#\s+(.+?)\s*(?:\r?\n|$)/);
  if (!match) return body;
  if (match[2].trim() === title.trim()) {
    return body.slice(match[0].length);
  }
  return body.replace(/^(\s*)#(?=\s)/, '$1##');
}

/** 将 ISO 时间格式化为 YYYY.MM.DD */
function formatDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

/** 统一的错误/空状态展示 */
function showError(title, message) {
  document.title = `${title} - ${CONFIG.SITE_TITLE}`;
  const titleEl = document.querySelector('#post-title');
  if (titleEl) titleEl.textContent = title;

  const metaEl = document.querySelector('#meta');
  if (metaEl) metaEl.textContent = '';

  const contentEl = document.querySelector('#content');
  if (contentEl) {
    contentEl.removeAttribute('aria-busy');
    contentEl.textContent = message;
  }

  const navEl = document.querySelector('#navigation');
  if (navEl) navEl.hidden = true;
}

async function main() {
  const contentEl = document.querySelector('#content');
  if (!contentEl) return;

  const slug = getQuery('slug');
  if (!slug) {
    showError('缺少参数', '请在链接中提供文章 slug。');
    return;
  }

  if (typeof marked === 'undefined' || typeof DOMPurify === 'undefined') {
    showError('无法加载文章', 'Markdown 渲染资源加载失败，请检查网络后刷新。');
    return;
  }

  const gist = await Gist.getGist();
  const idx = await Gist.getIndex(gist);
  const allPosts = idx.posts || [];
  const post = allPosts.find(p => p.slug === slug);
  if (!post) {
    showError('未找到文章', '这篇文章可能已被删除或尚未发布。');
    return;
  }

  const title = post.title || '📝 未命名文章';
  document.title = `${title} - ${CONFIG.SITE_TITLE}`;
  const titleEl = document.querySelector('#post-title');
  if (titleEl) titleEl.textContent = title;

  const metaEl = document.querySelector('#meta');
  if (metaEl) {
    metaEl.replaceChildren();
    const dateText = formatDate(post.created_at);
    if (dateText) {
      const time = document.createElement('time');
      time.dateTime = post.created_at || '';
      time.textContent = dateText;
      metaEl.append(time);
    }
    const tags = post.tags || [];
    if (tags.length) {
      if (metaEl.childNodes.length) metaEl.append(' · ');
      metaEl.append(tags.join(', '));
    }
  }

  const descEl = document.querySelector('meta[name="description"]');
  if (descEl) descEl.setAttribute('content', post.summary || CONFIG.SITE_DESC || '');

  const md = await Gist.getPostFile(post.filename, gist);
  const body = normalizeLeadingTitle(stripFrontMatter(md), title);
  contentEl.innerHTML = DOMPurify.sanitize(marked.parse(body));
  contentEl.removeAttribute('aria-busy');

  // 上一篇/下一篇只使用已发布文章，并按创建时间升序排列
  const published = allPosts
    .filter(p => p.status === 'published')
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const navIndex = published.findIndex(p => p.slug === slug);
  const prevPost = navIndex > 0 ? published[navIndex - 1] : null;
  const nextPost = navIndex >= 0 && navIndex < published.length - 1 ? published[navIndex + 1] : null;

  const navEl = document.querySelector('#navigation');
  const prevPostEl = document.querySelector('#prev-post');
  const nextPostEl = document.querySelector('#next-post');

  if (prevPost && prevPostEl) {
    prevPostEl.href = `post.html?slug=${encodeURIComponent(prevPost.slug)}`;
    prevPostEl.textContent = `← ${prevPost.title}`;
    prevPostEl.hidden = false;
  }

  if (nextPost && nextPostEl) {
    nextPostEl.href = `post.html?slug=${encodeURIComponent(nextPost.slug)}`;
    nextPostEl.textContent = `→ ${nextPost.title}`;
    nextPostEl.hidden = false;
  }

  if (navEl) navEl.hidden = !(prevPost || nextPost);
}

document.addEventListener('DOMContentLoaded', () => setupThemeToggle());

main().catch(err => {
  console.error(err);
  showError('加载失败', '文章加载失败，请稍后重试。');
});
