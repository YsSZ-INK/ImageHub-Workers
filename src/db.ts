import type { Env, ImageRow, Role, UserRow } from "./types";

/** D1 数据访问：只放 SQL，不掺业务判断 */

export async function countUsers(env: Env): Promise<number> {
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>();
  return row?.n ?? 0;
}

export async function findUserByEmail(env: Env, email: string): Promise<UserRow | null> {
  return env.DB.prepare("SELECT * FROM users WHERE email = ?1").bind(email.toLowerCase()).first<UserRow>();
}

export async function createUser(
  env: Env,
  input: { id: string; email: string; name: string; passwordHash: string; role: Role }
): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO users (id, email, name, password_hash, role, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)"
  )
    .bind(input.id, input.email.toLowerCase(), input.name, input.passwordHash, input.role, Math.floor(Date.now() / 1000))
    .run();
}

export async function createImage(
  env: Env,
  input: {
    id: string;
    userId: string;
    filename: string;
    r2Key: string;
    mimeType: string;
    size: number;
    visibility: "PUBLIC" | "PRIVATE";
  }
): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO images (id, user_id, filename, r2_key, mime_type, size, visibility, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"
  )
    .bind(
      input.id,
      input.userId,
      input.filename,
      input.r2Key,
      input.mimeType,
      input.size,
      input.visibility,
      Math.floor(Date.now() / 1000)
    )
    .run();
}

export async function findImageById(env: Env, id: string): Promise<ImageRow | null> {
  return env.DB.prepare(
    "SELECT i.*, u.name AS owner_name FROM images i JOIN users u ON u.id = i.user_id WHERE i.id = ?1"
  )
    .bind(id)
    .first<ImageRow>();
}

export async function listPublicImages(env: Env, limit = 60): Promise<ImageRow[]> {
  const res = await env.DB.prepare(
    "SELECT i.*, u.name AS owner_name FROM images i JOIN users u ON u.id = i.user_id WHERE i.visibility = 'PUBLIC' ORDER BY i.created_at DESC LIMIT ?1"
  )
    .bind(limit)
    .all<ImageRow>();
  return res.results ?? [];
}

export async function listImagesByUser(env: Env, userId: string, limit = 60): Promise<ImageRow[]> {
  const res = await env.DB.prepare(
    "SELECT i.*, u.name AS owner_name FROM images i JOIN users u ON u.id = i.user_id WHERE i.user_id = ?1 ORDER BY i.created_at DESC LIMIT ?2"
  )
    .bind(userId, limit)
    .all<ImageRow>();
  return res.results ?? [];
}
