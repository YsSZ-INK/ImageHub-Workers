import { Hono, type Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { createSessionToken, hashPassword, readSession, SESSION_COOKIE, verifyPassword } from "./auth";
import {
  countUsers,
  createImage,
  createUser,
  findImageById,
  findUserByEmail,
  listImagesByUser,
  listPublicImages,
} from "./db";
import { galleryPage, loginPage } from "./ui";
import type { Env, ImageDTO, ImageRow, SessionUser } from "./types";

type Variables = { user: SessionUser | null };

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// 请求上下文：解析会话 Cookie（无状态 JWT，不查库）
app.use("*", async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE);
  c.set("user", await readSession(c.env, token));
  await next();
});

// 表单/写接口的同源校验：浏览器带 Origin 时必须与当前站点一致（防 CSRF，配合 SameSite=Lax）
function sameOrigin(c: Context): boolean {
  const origin = c.req.header("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(c.req.url).host;
  } catch {
    return false;
  }
}

function isSecureRequest(url: string): boolean {
  return new URL(url).protocol === "https:";
}

function sessionCookieOptions(url: string) {
  return {
    httpOnly: true,
    sameSite: "Lax" as const,
    secure: isSecureRequest(url),
    path: "/",
    // 注意：不设置 maxAge/expires —— 会话 Cookie，关闭浏览器即失效
  };
}

function toDTO(img: ImageRow): ImageDTO {
  return {
    id: img.id,
    filename: img.filename,
    mimeType: img.mime_type,
    size: img.size,
    visibility: img.visibility,
    createdAt: new Date(img.created_at * 1000).toISOString(),
    ownerName: img.owner_name,
    rawUrl: `/img/${img.id}/raw`,
  };
}

function maxUploadBytes(env: Env): number {
  const mb = Number(env.MAX_UPLOAD_MB ?? "20");
  const safe = Number.isFinite(mb) && mb > 0 ? Math.min(mb, 512) : 20;
  return Math.round(safe * 1024 * 1024);
}

// ---------- 页面 ----------
app.get("/", async (c) => {
  const siteName = c.env.SITE_NAME ?? "ImageHub Lite";
  const user = c.get("user");
  const err = c.req.query("err");
  if (!user) return c.html(loginPage(siteName, err));

  const [publicImages, myImages] = await Promise.all([
    listPublicImages(c.env),
    listImagesByUser(c.env, user.id),
  ]);
  return c.html(
    galleryPage({
      siteName,
      user,
      publicImages: publicImages.map(toDTO),
      myImages: myImages.map(toDTO),
      maxUploadMB: Math.round(maxUploadBytes(c.env) / 1024 / 1024),
      notice: c.req.query("ok") ? "上传成功" : undefined,
      error: err,
    })
  );
});

// ---------- 认证 ----------
app.post("/register", async (c) => {
  if (!sameOrigin(c)) return c.redirect("/?err=" + encodeURIComponent("请求来源不合法"));
  const body = await c.req.parseBody();
  const email = String(body.email ?? "").trim().toLowerCase();
  const name = String(body.name ?? "").trim();
  const password = String(body.password ?? "");

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return c.redirect("/?err=" + encodeURIComponent("邮箱格式不正确"));
  if (!name || name.length > 40) return c.redirect("/?err=" + encodeURIComponent("用户名不能为空且不超过 40 字"));
  if (password.length < 8) return c.redirect("/?err=" + encodeURIComponent("密码至少 8 位"));
  if (await findUserByEmail(c.env, email)) return c.redirect("/?err=" + encodeURIComponent("该邮箱已注册"));

  // 站点已有用户且未开放注册时拒绝；第一个注册的用户自动成为管理员
  const total = await countUsers(c.env);
  if (total > 0 && c.env.ALLOW_REGISTER !== "true") {
    return c.redirect("/?err=" + encodeURIComponent("本站未开放注册"));
  }
  const role = total === 0 ? "ADMIN" : "USER";
  const user: SessionUser = { id: crypto.randomUUID(), email, name, role };
  await createUser(c.env, { ...user, passwordHash: await hashPassword(password) });

  const token = await createSessionToken(c.env, user);
  setCookie(c, SESSION_COOKIE, token, sessionCookieOptions(c.req.url));
  return c.redirect("/");
});

app.post("/login", async (c) => {
  if (!sameOrigin(c)) return c.redirect("/?err=" + encodeURIComponent("请求来源不合法"));
  const body = await c.req.parseBody();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  const row = await findUserByEmail(c.env, email);
  if (!row || !(await verifyPassword(password, row.password_hash))) {
    return c.redirect("/?err=" + encodeURIComponent("邮箱或密码错误"));
  }
  const user: SessionUser = { id: row.id, email: row.email, name: row.name, role: row.role };
  const token = await createSessionToken(c.env, user);
  setCookie(c, SESSION_COOKIE, token, sessionCookieOptions(c.req.url));
  return c.redirect("/");
});

app.post("/logout", (c) => {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.redirect("/");
});

// ---------- 上传 ----------
app.post("/upload", async (c) => {
  const user = c.get("user");
  if (!user) return c.redirect("/?err=" + encodeURIComponent("请先登录"));
  if (!sameOrigin(c)) return c.redirect("/?err=" + encodeURIComponent("请求来源不合法"));

  const form = await c.req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return c.redirect("/?err=" + encodeURIComponent("请选择图片文件"));
  if (!file.type.startsWith("image/")) return c.redirect("/?err=" + encodeURIComponent("只支持图片文件"));
  if (file.size > maxUploadBytes(c.env)) {
    return c.redirect("/?err=" + encodeURIComponent(`文件超过 ${Math.round(maxUploadBytes(c.env) / 1024 / 1024)} MB 上限`));
  }

  const visibility = form.get("visibility") === "PRIVATE" ? "PRIVATE" : "PUBLIC";
  const id = crypto.randomUUID();
  // 对象键按用户分目录，便于以后做配额/迁移
  const r2Key = `u/${user.id}/${id}`;
  await c.env.BUCKET.put(r2Key, file.stream(), { httpMetadata: { contentType: file.type } });

  const filename = (file.name || "image").split(/[\\/]/).pop() || "image";
  await createImage(c.env, {
    id,
    userId: user.id,
    filename,
    r2Key,
    mimeType: file.type,
    size: file.size,
    visibility,
  });
  return c.redirect("/?ok=1");
});

// ---------- 图片访问 ----------
app.get("/img/:id/raw", async (c) => {
  const img = await findImageById(c.env, c.req.param("id"));
  if (!img) return c.text("Not Found", 404);

  const user = c.get("user");
  const isOwner = user?.id === img.user_id;
  const isAdmin = user?.role === "ADMIN";
  if (img.visibility !== "PUBLIC" && !isOwner && !isAdmin) {
    return c.text(user ? "Forbidden" : "Unauthorized", user ? 403 : 401);
  }

  // 公开图直连 R2 自定义域：字节不再经过 Worker（与完整版的 r2PublicBase 思路一致）
  const base = c.env.PUBLIC_R2_BASE?.trim().replace(/\/+$/, "");
  if (base && !user && img.visibility === "PUBLIC") {
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${base}/${img.r2_key}`,
        "Cache-Control": "public, max-age=300",
      },
    });
  }

  const object = await c.env.BUCKET.get(img.r2_key);
  if (!object) return c.text("Not Found", 404);

  const etag = object.httpEtag;
  if (c.req.header("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  return new Response(object.body, {
    headers: {
      "Content-Type": img.mime_type,
      "Content-Length": String(object.size),
      // 对象内容不可变（简化版没有旋转/覆盖），公开图可长缓存
      "Cache-Control":
        img.visibility === "PUBLIC"
          ? "public, max-age=31536000, immutable"
          : "private, max-age=3600",
      ETag: etag,
      "X-Content-Type-Options": "nosniff",
    },
  });
});

// ---------- JSON API（供后续前端/迁移脚本使用） ----------
app.get("/api/health", (c) => c.json({ ok: true, ts: Date.now() }));

app.get("/api/session", (c) => c.json({ user: c.get("user") }));

app.get("/api/images", async (c) => {
  if (!c.get("user")) return c.json({ error: "未登录" }, 401);
  const rows = await listPublicImages(c.env, 100);
  return c.json({ images: rows.map(toDTO) });
});

app.notFound((c) => c.text("Not Found", 404));

export default app;
