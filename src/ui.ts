import type { ImageDTO, SessionUser } from "./types";

/** 极简服务端渲染页面：干净、柔和蓝、响应式，无前端框架 */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const STYLE = `
:root{
  --bg:#f2f7fd;--fg:#14203a;--muted:#5d6d87;--card:#ffffff;--line:#e1e9f4;
  --primary:#2f7fe0;--primary-dark:#1f66c4;--radius:14px;
}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{
  min-height:100vh;color:var(--fg);
  font:15px/1.6 system-ui,-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;
  background:
    radial-gradient(900px 520px at 8% -12%, #dcecff 0%, transparent 62%),
    radial-gradient(720px 420px at 100% -6%, #e6f6ff 0%, transparent 56%),
    var(--bg);
}
a{color:var(--primary);text-decoration:none}
a:hover{text-decoration:underline}
.wrap{max-width:1100px;margin:0 auto;padding:0 20px 48px}
/* 顶栏 */
.top{position:sticky;top:0;z-index:10;background:linear-gradient(100deg,#1d4f9c,#2f7fe0);color:#fff}
.top .inner{max-width:1100px;margin:0 auto;padding:0 20px;height:56px;display:flex;align-items:center;gap:12px}
.brand{font-weight:700;letter-spacing:.01em;display:flex;align-items:center;gap:8px;color:#fff}
.brand:hover{text-decoration:none}
.top .spacer{flex:1}
.top .who{font-size:13px;opacity:.92}
.top form{margin:0}
.linkbtn{background:none;border:0;color:#fff;font:inherit;font-size:13px;opacity:.9;cursor:pointer;padding:6px 8px;border-radius:8px}
.linkbtn:hover{background:rgba(255,255,255,.14);opacity:1}
/* 卡片与表单 */
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);box-shadow:0 1px 2px rgba(20,50,90,.05),0 10px 24px -20px rgba(20,60,120,.35)}
.pad{padding:22px}
h1,h2{margin:0;letter-spacing:-.015em}
h1{font-size:22px}
h2{font-size:16px}
.sub{color:var(--muted);font-size:13px;margin:.35rem 0 0}
.field{display:flex;flex-direction:column;gap:6px;margin-top:14px}
label{font-size:13px;color:var(--muted)}
input[type=email],input[type=password],input[type=text],select{
  width:100%;height:40px;padding:0 12px;border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--fg);font:inherit;outline:none;transition:border-color .2s,box-shadow .2s;
}
input:focus,select:focus{border-color:var(--primary);box-shadow:0 0 0 3px rgba(47,127,224,.16)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:40px;padding:0 18px;border:0;border-radius:10px;background:var(--primary);color:#fff;font:inherit;font-weight:600;cursor:pointer;transition:background .2s,transform .12s}
.btn:hover{background:var(--primary-dark)}
.btn:active{transform:translateY(1px)}
.btn.ghost{background:transparent;color:var(--primary);border:1px solid var(--line)}
.btn.ghost:hover{background:#eef5ff}
/* 登录页 */
.auth{min-height:calc(100vh - 56px);display:flex;align-items:center;justify-content:center;padding:40px 20px}
.auth .card{width:100%;max-width:420px;padding:28px}
.auth .brand-badge{width:44px;height:44px;border-radius:12px;background:#e8f2ff;color:var(--primary);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px;margin-bottom:14px}
details{margin-top:18px;border-top:1px dashed var(--line);padding-top:14px}
summary{cursor:pointer;color:var(--muted);font-size:13px}
.msg{margin-top:14px;padding:10px 12px;border-radius:10px;font-size:13px;background:#fff4f4;color:#b42318;border:1px solid #f3c9c9}
.msg.ok{background:#f1fbf4;color:#1d7a3d;border-color:#c4ecd1}
/* 画廊 */
.upload{margin-top:22px}
.upload .row{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.upload input[type=file]{flex:1 1 220px;min-width:0;font-size:13px;border:1px dashed var(--line);border-radius:10px;padding:9px 12px;background:#fbfdff}
.upload select{width:auto;min-width:110px;flex:0 0 auto}
.section{margin-top:26px}
.section-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:12px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px}
.tile{margin:0;background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden;box-shadow:0 1px 2px rgba(20,50,90,.05);transition:transform .25s ease,box-shadow .25s ease;animation:rise .35s ease both}
.tile:hover{transform:translateY(-2px);box-shadow:0 10px 24px -16px rgba(20,60,120,.4)}
.tile img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;background:#eef3fa}
.tile figcaption{padding:9px 11px;font-size:12px;color:var(--muted);display:flex;justify-content:space-between;gap:8px}
.tile .name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--fg)}
.empty{color:var(--muted);font-size:13px;padding:26px;text-align:center;border:1px dashed var(--line);border-radius:12px;background:rgba(255,255,255,.6)}
@keyframes rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.tile{animation:none;transition:none}}
@media (max-width:640px){
  .top .who{display:none}
  .grid{grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px}
  .pad{padding:16px}
}
`;

function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${escapeHtml(title)}</title>
<style>${STYLE}</style>
</head>
<body>${body}</body>
</html>`;
}

export function loginPage(siteName: string, error?: string): string {
  const err = error ? `<div class="msg">${escapeHtml(error)}</div>` : "";
  const body = `
<div class="auth">
  <div class="card">
    <div class="brand-badge">IH</div>
    <h1>${escapeHtml(siteName)}</h1>
    <p class="sub">私有图床 · 登录后使用</p>
    ${err}
    <form method="post" action="/login">
      <div class="field"><label for="email">邮箱</label><input id="email" name="email" type="email" required autocomplete="username"></div>
      <div class="field"><label for="password">密码</label><input id="password" name="password" type="password" required autocomplete="current-password"></div>
      <div class="field"><button class="btn" type="submit" style="width:100%">登录</button></div>
    </form>
    <details>
      <summary>没有账号？注册一个</summary>
      <form method="post" action="/register">
        <div class="field"><label for="r-email">邮箱</label><input id="r-email" name="email" type="email" required autocomplete="username"></div>
        <div class="field"><label for="r-name">用户名</label><input id="r-name" name="name" type="text" required maxlength="40"></div>
        <div class="field"><label for="r-password">密码（至少 8 位）</label><input id="r-password" name="password" type="password" required minlength="8" autocomplete="new-password"></div>
        <div class="field"><button class="btn" type="submit" style="width:100%">注册并登录</button></div>
      </form>
    </details>
  </div>
</div>`;
  return layout(siteName, body);
}

function tiles(images: ImageDTO[]): string {
  return images
    .map(
      (img) => `<figure class="tile">
  <a href="${img.rawUrl}" target="_blank" rel="noreferrer"><img src="${img.rawUrl}" alt="${escapeHtml(img.filename)}" loading="lazy"></a>
  <figcaption><span class="name">${escapeHtml(img.filename)}</span><span>${formatBytes(img.size)}</span></figcaption>
</figure>`
    )
    .join("");
}

export function galleryPage(args: {
  siteName: string;
  user: SessionUser;
  publicImages: ImageDTO[];
  myImages: ImageDTO[];
  maxUploadMB: number;
  notice?: string;
  error?: string;
}): string {
  const { siteName, user, publicImages, myImages, maxUploadMB } = args;
  const msg = args.error
    ? `<div class="msg">${escapeHtml(args.error)}</div>`
    : args.notice
      ? `<div class="msg ok">${escapeHtml(args.notice)}</div>`
      : "";

  const body = `
<header class="top">
  <div class="inner">
    <a class="brand" href="/">${escapeHtml(siteName)}</a>
    <span class="spacer"></span>
    <span class="who">${escapeHtml(user.name)}（${user.role === "ADMIN" ? "管理员" : "用户"}）</span>
    <form method="post" action="/logout"><button class="linkbtn" type="submit">退出</button></form>
  </div>
</header>
<div class="wrap">
  ${msg}
  <section class="card pad upload">
    <h2>上传图片</h2>
    <p class="sub">单张最大 ${maxUploadMB} MB，支持常见图片格式。</p>
    <form method="post" action="/upload" enctype="multipart/form-data" class="row" style="margin-top:12px">
      <input type="file" name="file" accept="image/*" required>
      <select name="visibility" aria-label="可见性">
        <option value="PUBLIC">公开</option>
        <option value="PRIVATE">私有</option>
      </select>
      <button class="btn" type="submit">上传</button>
    </form>
  </section>

  <section class="section">
    <div class="section-head"><h2>公共画廊</h2><span class="sub">${publicImages.length} 张</span></div>
    ${publicImages.length ? `<div class="grid">${tiles(publicImages)}</div>` : `<div class="empty">还没有公开图片，上传第一张吧</div>`}
  </section>

  <section class="section">
    <div class="section-head"><h2>我的图片</h2><span class="sub">${myImages.length} 张</span></div>
    ${myImages.length ? `<div class="grid">${tiles(myImages)}</div>` : `<div class="empty">你还没有上传过图片</div>`}
  </section>
</div>`;
  return layout(siteName, body);
}
