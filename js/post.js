
// js/post.js（文章详情页逻辑）
// ------------------------------------------------------------
// 职责：
// 1) 通过 URL ?slug=... 找到对应文章
// 2) 读取对应 Markdown 文件（通过 Gist raw_url）
// 3) 解析 YAML Front Matter，提取正文部分
// 4) 使用 marked + DOMPurify 渲染安全的 HTML
// ------------------------------------------------------------

import { CONFIG } from './config.js';
import { Gist } from './gist.js';

/** 读取 URL 查询参数 */
function getQuery(name) {
  const u = new URL(location.href);
  return u.searchParams.get(name) || '';
}

/**
 * 简单的 Front Matter 解析：
 * - 仅解析最前面的 --- ... --- 区块
 * - 将形如 tags: [a, b] 的行解析为数组（宽松处理，不做严格 YAML）
 */
function parseFrontMatter(md) {
  if (md.startsWith('---')) {
    const end = md.indexOf('\n---', 3);
    if (end !== -1) {
      const yaml = md.slice(3, end).trim();
      const body = md.slice(end + 4);
      const meta = {};
      yaml.split(/\n+/).forEach(line => {
        const i = line.indexOf(':');
        if (i > 0) {
          const k = line.slice(0, i).trim();
          let v = line.slice(i + 1).trim();
          // 宽松处理数组：把未加引号的 a, b 变为 "a","b" 再 JSON.parse
          if (v.startsWith('[') && v.endsWith(']')) {
            try {
              v = JSON.parse(v.replace(/([a-zA-Z0-9_\-]+)(?=\s*,|\s*\])/g, '"$1"'));
            } catch {}
          }
          meta[k] = v;
        }
      });
      return { meta, body };
    }
  }
  return { meta: {}, body: md };
}

async function main() {
  const slug = getQuery('slug');
  if (!slug) {
    document.querySelector('#content').textContent = '缺少 slug 参数';
    return;
  }

  // 在索引里找到对应文章
  const idx = await Gist.getIndex();
  const posts = idx.posts || [];
  const postIndex = posts.findIndex(p => p.slug === slug);
  const post = posts[postIndex];
  if (!post) {
    document.querySelector('#content').textContent = '未找到文章';
    return;
  }

  // 设置标题与元信息
  document.title = `${post.title} - ${CONFIG.SITE_TITLE}`;
  document.querySelector('h1').textContent = post.title;
  document.querySelector('#meta').textContent = `${new Date(post.created_at).toLocaleString()} · ${(post.tags || []).join(', ')}`;

  // 取 Markdown、解析 Front Matter、渲染 HTML
  const md = await Gist.getPostFile(post.filename);
  const { body } = parseFrontMatter(md);
  const html = DOMPurify.sanitize(marked.parse(body));
  document.querySelector('#content').innerHTML = html;

  // 设置上一篇和下一篇链接
  const prevPost = posts[postIndex - 1];
  const nextPost = posts[postIndex + 1];

  const prevPostEl = document.querySelector('#prev-post');
  const nextPostEl = document.querySelector('#next-post');

  if (prevPost) {
    prevPostEl.href = `post.html?slug=${encodeURIComponent(prevPost.slug)}`;
    prevPostEl.textContent = `上一篇: ${prevPost.title}`;
    prevPostEl.style.display = '';
  }

  if (nextPost) {
    nextPostEl.href = `post.html?slug=${encodeURIComponent(nextPost.slug)}`;
    nextPostEl.textContent = `下一篇: ${nextPost.title}`;
    nextPostEl.style.display = '';
  }
}

main().catch(err => {
  console.error(err);
  document.querySelector('#content').textContent = `加载失败：${err.message}`;
});
