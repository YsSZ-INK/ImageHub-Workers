/** 运行环境绑定与共享类型 */

export type Env = {
  DB: D1Database;
  BUCKET: R2Bucket;
  /** 会话签名密钥（wrangler secret / .dev.vars） */
  AUTH_SECRET: string;
  SITE_NAME?: string;
  MAX_UPLOAD_MB?: string;
  /** 是否开放注册：默认关闭，仅首个用户（管理员）可注册 */
  ALLOW_REGISTER?: string;
  /** R2 公开访问前缀（可选）：配置后匿名访问公开图会 302 到该域名 */
  PUBLIC_R2_BASE?: string;
};

export type Role = "USER" | "ADMIN";

export type UserRow = {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  role: Role;
  created_at: number;
};

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

export type ImageRow = {
  id: string;
  user_id: string;
  filename: string;
  r2_key: string;
  mime_type: string;
  size: number;
  visibility: "PUBLIC" | "PRIVATE";
  created_at: number;
  owner_name?: string;
};

/** 对外返回的图片信息（不暴露 R2 对象键） */
export type ImageDTO = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  visibility: "PUBLIC" | "PRIVATE";
  createdAt: string;
  ownerName?: string;
  rawUrl: string;
};
