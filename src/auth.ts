import { SignJWT, jwtVerify } from "jose";
import type { Env, SessionUser } from "./types";

/**
 * 认证工具（Workers 原生，无 Node 依赖）：
 * - 密码：WebCrypto PBKDF2-SHA256（10 万次迭代），格式 pbkdf2$iter$salt$hash
 * - 会话：HS256 JWT 放 HttpOnly Cookie；Cookie 不带 Max-Age（会话 Cookie，关浏览器即失效）
 */

const encoder = new TextEncoder();
const PBKDF2_ITERATIONS = 100_000;
const SESSION_TTL_SECONDS = 24 * 60 * 60;

export const SESSION_COOKIE = "sid";

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromBase64(value: string): Uint8Array {
  const bin = atob(value);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as unknown as BufferSource, iterations, hash: "SHA-256" },
    key,
    256
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [algo, iter, saltB64, hashB64] = stored.split("$");
    if (algo !== "pbkdf2" || !iter || !saltB64 || !hashB64) return false;
    const expected = fromBase64(hashB64);
    const actual = await derive(password, fromBase64(saltB64), Number(iter));
    if (actual.length !== expected.length) return false;
    // 常数时间比较，避免按字节短路泄漏信息
    let diff = 0;
    for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
    return diff === 0;
  } catch {
    return false;
  }
}

function secretKey(env: Env): Uint8Array {
  if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 16) {
    throw new Error("AUTH_SECRET 未配置：本地写在 .dev.vars，线上用 wrangler secret put AUTH_SECRET");
  }
  return encoder.encode(env.AUTH_SECRET);
}

export async function createSessionToken(env: Env, user: SessionUser): Promise<string> {
  return new SignJWT({ email: user.email, name: user.name, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey(env));
}

export async function readSession(env: Env, token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(env), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    return {
      id: payload.sub,
      email: typeof payload.email === "string" ? payload.email : "",
      name: typeof payload.name === "string" ? payload.name : "",
      role: payload.role === "ADMIN" ? "ADMIN" : "USER",
    };
  } catch {
    return null;
  }
}
