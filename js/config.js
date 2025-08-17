
// js/config.js
// ------------------------------------------------------------
// 站点与 Gist 的基础配置。
// 你需要把 GIST_ID 与 OWNER 改为你的实际值。
// ------------------------------------------------------------
export const CONFIG = {
  /**
   * 你的 Gist ID（创建 Gist 后，在 URL 末尾可见的一长串）
   * 例如: "a1b2c3d4e5f6abcdef1234567890abcd"
   */
  GIST_ID: "88a7fe50a4bbf2bba1a61124d5837a23", //"<YOUR_GIST_ID>",

  /**
   * 你的 GitHub 用户名（仅用于展示，不参与 API 鉴权）
   */
  OWNER: "baaaaaaaaad", //"<YOUR_GITHUB_USERNAME>",

  /**
   * 站点标题与描述（会渲染到页面）
   */
  SITE_TITLE: "My Gist Blog",
  SITE_DESC: "博客由 Gist 驱动（GitHub Pages + Gist + GitHub API）",

  /**
   * 列表分页大小
   */
  PAGE_SIZE: 10
};
