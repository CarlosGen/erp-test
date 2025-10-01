import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import db from "../db";
import { ACCESS_TTL_MIN, REFRESH_TTL_MIN, JWT_SECRET } from "../config";

interface DbUserRow {
  id: string;
  password_hash: string;
}

interface DbSessionRow {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string;
  access_expires_at: number;
  refresh_expires_at: number;
  revoked_at: number | null;
  created_at: number;
  user_agent: string | null;
  ip: string | null;
}

interface JwtPayloadSidSub extends jwt.JwtPayload {
  sub: string;
  sid: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: number;
  refreshExpiresAt: number;
  sessionId: string;
}

export async function signUp(
  userId: string,
  password: string
): Promise<TokenPair> {
  const existing = db
    .prepare("SELECT id FROM users WHERE id = ?")
    .get(userId) as { id: string } | undefined;
  if (existing) {
    throw new Error("Пользователь уже существует");
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const now = Date.now();
  db.prepare(
    "INSERT INTO users (id, password_hash, created_at) VALUES (?, ?, ?)"
  ).run(userId, passwordHash, now);
  return createSession(userId);
}

export async function signIn(
  userId: string,
  password: string
): Promise<TokenPair> {
  const user = db
    .prepare("SELECT id, password_hash FROM users WHERE id = ?")
    .get(userId) as DbUserRow | undefined;
  if (!user) throw new Error("неверные данные");
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) throw new Error("неверные данные");
  return createSession(userId);
}

export function refreshToken(oldRefreshToken: string): TokenPair {
  const session = db
    .prepare(
      "SELECT * FROM sessions WHERE refresh_token = ? AND (revoked_at IS NULL) AND refresh_expires_at > ?"
    )
    .get(oldRefreshToken, Date.now()) as DbSessionRow | undefined;
  if (!session) throw new Error("неверный refresh token");

  // обновляем токены
  const now = Date.now();
  const accessTtlMs = ACCESS_TTL_MIN * 60 * 1000;
  const refreshTtlMs = REFRESH_TTL_MIN * 60 * 1000;
  const accessExpiresAt = now + accessTtlMs;
  const refreshExpiresAt = now + refreshTtlMs;

  const accessToken = jwt.sign(
    { sub: session.user_id, sid: session.id },
    JWT_SECRET,
    { expiresIn: Math.floor(accessTtlMs / 1000) }
  );
  const refreshTokenStr = crypto.randomUUID();

  db.prepare(
    "UPDATE sessions SET access_token = ?, refresh_token = ?, access_expires_at = ?, refresh_expires_at = ? WHERE id = ?"
  ).run(
    accessToken,
    refreshTokenStr,
    accessExpiresAt,
    refreshExpiresAt,
    session.id
  );

  return {
    accessToken,
    refreshToken: refreshTokenStr,
    accessExpiresAt,
    refreshExpiresAt,
    sessionId: session.id,
  };
}

export function revokeSession(sessionId: string): void {
  db.prepare("UPDATE sessions SET revoked_at = ? WHERE id = ?").run(
    Date.now(),
    sessionId
  );
}

export function revokeAllUserSessionsExcept(
  userId: string,
  exceptSessionId: string
): void {
  // Для выполнения требования о выходе только текущего устройства
  // мы не трогаем другие сессии пользователя
  db.prepare(
    "UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND id != ? AND revoked_at IS NULL"
  ).run(Date.now(), userId, exceptSessionId);
}

export function createSession(userId: string): TokenPair {
  const now = Date.now();
  const sessionId = crypto.randomUUID();
  const accessTtlMs = ACCESS_TTL_MIN * 60 * 1000;
  const refreshTtlMs = REFRESH_TTL_MIN * 60 * 1000;
  const accessExpiresAt = now + accessTtlMs;
  const refreshExpiresAt = now + refreshTtlMs;

  const accessToken = jwt.sign({ sub: userId, sid: sessionId }, JWT_SECRET, {
    expiresIn: Math.floor(accessTtlMs / 1000),
  });
  const refreshToken = crypto.randomUUID();

  db.prepare(
    "INSERT INTO sessions (id, user_id, access_token, refresh_token, access_expires_at, refresh_expires_at, created_at, user_agent, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(
    sessionId,
    userId,
    accessToken,
    refreshToken,
    accessExpiresAt,
    refreshExpiresAt,
    now,
    null,
    null
  );

  return {
    accessToken,
    refreshToken,
    accessExpiresAt,
    refreshExpiresAt,
    sessionId,
  };
}

export function verifyAccessToken(
  token: string
): { userId: string; sessionId: string } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayloadSidSub;
    const session = db
      .prepare(
        "SELECT id, user_id, access_token, access_expires_at, revoked_at FROM sessions WHERE id = ? AND access_token = ?"
      )
      .get(payload.sid, token) as
      | Pick<
          DbSessionRow,
          "id" | "user_id" | "access_token" | "access_expires_at" | "revoked_at"
        >
      | undefined;
    if (!session) return null;
    if (session.revoked_at) return null;
    if (session.access_expires_at <= Date.now()) return null;
    return { userId: session.user_id, sessionId: session.id };
  } catch {
    return null;
  }
}
