-- 初始表结构（D1 / SQLite）
-- 用户：简化版只有 USER / ADMIN 两种角色；第一个注册的用户自动成为 ADMIN
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,             -- pbkdf2$迭代次数$salt(base64)$hash(base64)
  role          TEXT NOT NULL DEFAULT 'USER',
  created_at    INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 图片：原图存 R2，这里只存元数据与对象键
CREATE TABLE IF NOT EXISTS images (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  filename   TEXT NOT NULL,
  r2_key     TEXT NOT NULL,
  mime_type  TEXT NOT NULL,
  size       INTEGER NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'PUBLIC', -- PUBLIC | PRIVATE
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_images_created ON images(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_images_user ON images(user_id, created_at DESC);
