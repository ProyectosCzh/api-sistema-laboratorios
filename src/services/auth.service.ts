import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";
import { cache } from "../cache";
import { CACHE_KEYS } from "../cache/policies";
import { ApiErrors } from "../utils/errors";
import { toPublicUser } from "../utils/serializers";
import type { User } from "../types";
import type { UpdateProfileInput, ChangePasswordInput } from "../validators/auth.schema";

const DUMMY_HASH = "$2b$12$4Ho6xOIYPP6uKVrpf5dUQePwuNVVOzpON0JE4hxfALq0aZwoqsQeu";

/** Lecturas de validez de sesión en requireAuth: TTL corto, se invalida en cada rotación/logout/revoke. */
const SESSION_CACHE_TTL_MS = 30_000;

const sessionCacheKey = (id: string): string => `sess:${id}`;
const sessionCacheTag = (id: string): string => `sess:${id}`;
const SESSION_CACHE_PREFIX = "sess:";

function invalidateSessionCache(id: string): void {
  cache.del(sessionCacheKey(id));
}

function invalidateAllSessionsCache(): void {
  cache.invalidatePrefix(SESSION_CACHE_PREFIX);
}

export interface LoginMeta {
  userAgent?: string | null;
  ip?: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

type SessionRow = Awaited<ReturnType<typeof prisma.session.findFirst>>;

function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/**
 * Access JWT de vida corta con claims {sub, role, sid}. El rol del claim es
 * informativo: requireAuth siempre resuelve el usuario desde BD (cacheado).
 */
function signAccessToken(user: { id: string; role: string }, sessionId: string): string {
  return jwt.sign({ sub: user.id, role: user.role, sid: sessionId }, env.jwtSecret, {
    algorithm: "HS256",
    expiresIn: env.accessTokenTtl as jwt.SignOptions["expiresIn"],
  });
}

/**
 * Refresh JWT firmado (typ 'refresh', sid/jti = sessionId) que además lleva un
 * secreto aleatorio (`rnd`) cuyo hash sha256 vive en la Session: robar la firma
 * no basta sin la fila de sesión, y el hash permite validar sin guardar el token.
 */
function issueRefreshToken(userId: string, sessionId: string, randomSecret: string): string {
  return jwt.sign(
    { sub: userId, typ: "refresh", sid: sessionId, jti: sessionId, rnd: randomSecret },
    env.jwtSecret,
    {
      algorithm: "HS256",
      expiresIn: `${env.refreshTokenTtlDays}d` as jwt.SignOptions["expiresIn"],
    }
  );
}

async function createSession(
  userId: string,
  meta?: LoginMeta
): Promise<{ session: NonNullable<SessionRow>; refreshToken: string }> {
  const randomSecret = crypto.randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + env.refreshTokenTtlDays * 24 * 60 * 60 * 1000);
  const session = await prisma.session.create({
    data: {
      userId,
      refreshTokenHash: sha256Hex(randomSecret),
      userAgent: meta?.userAgent?.slice(0, 255) ?? null,
      ip: meta?.ip ?? null,
      expiresAt,
    },
  });
  return { session, refreshToken: issueRefreshToken(userId, session.id, randomSecret) };
}

function toTokenPair(user: { id: string; role: string }, sessionId: string, refreshToken: string): AuthTokens {
  return { accessToken: signAccessToken(user, sessionId), refreshToken };
}

/** Validez de sesión cacheada 30s (tag `sess:{id}`) para requireAuth. */
export async function isSessionActive(sessionId: string): Promise<boolean> {
  const result = await cache.getOrSet(
    sessionCacheKey(sessionId),
    async () => {
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        select: { revokedAt: true, expiresAt: true },
      });
      return { valid: Boolean(session && !session.revokedAt && session.expiresAt > new Date()) };
    },
    { ttlMs: SESSION_CACHE_TTL_MS, tags: [sessionCacheTag(sessionId)] }
  );
  return result.valid;
}

export async function login(email: string, password: string, meta?: LoginMeta): Promise<AuthTokens & { user: User }> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) throw ApiErrors.invalidCredentials();

  if (!user.active) throw ApiErrors.userInactive();

  const { session, refreshToken } = await createSession(user.id, meta);
  return { ...toTokenPair(user, session.id, refreshToken), user: toPublicUser(user) };
}

export interface RefreshResult extends AuthTokens {
  user: User;
}

/**
 * Rotación de refresh token con detección de reuso:
 * 1. Verifica firma/tipo y busca la sesión por sid.
 * 2. Si ya está revocada (token reusado tras rotación) o el hash no coincide,
 *    REVOKA TODAS las sesiones del usuario (contención de robo).
 * 3. Caso normal: guard atómico updateMany({revokedAt: null}) → nueva Session
 *    encadenada vía rotatedToId + pareja de tokens nueva.
 */
export async function refresh(refreshToken: string): Promise<RefreshResult> {
  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(refreshToken, env.jwtSecret, { algorithms: ["HS256"] }) as jwt.JwtPayload;
  } catch (e) {
    if (e instanceof jwt.TokenExpiredError) throw ApiErrors.tokenExpired();
    throw ApiErrors.tokenInvalid();
  }
  if (payload.typ !== "refresh") throw ApiErrors.tokenInvalid();

  const sessionId = typeof payload.sid === "string" ? payload.sid : typeof payload.jti === "string" ? payload.jti : null;
  const randomSecret = typeof payload.rnd === "string" ? payload.rnd : null;
  if (!sessionId || !randomSecret) throw ApiErrors.tokenInvalid();

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { id: true, userId: true, refreshTokenHash: true, expiresAt: true, revokedAt: true },
  });

  if (!session || session.revokedAt || session.expiresAt <= new Date() || sha256Hex(randomSecret) !== session.refreshTokenHash) {
    // Reuso o token huérfano: quema toda la familia del usuario.
    await revokeAllSessionsForUser(session?.userId ?? "__none__");
    throw ApiErrors.tokenInvalid();
  }

  const rotated = await prisma.$transaction(async tx => {
    const guard = await tx.session.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (guard.count !== 1) return null;

    const fresh = await createSession(session.userId, undefined);
    await tx.session.update({ where: { id: session.id }, data: { rotatedToId: fresh.session.id } });
    return fresh;
  });

  invalidateSessionCache(session.id);

  if (!rotated) {
    // Perdió la carrera contra otra petición con el mismo refresh: reuso real.
    await revokeAllSessionsForUser(session.userId);
    throw ApiErrors.tokenInvalid();
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || !user.active) {
    await revokeAllSessionsForUser(session.userId);
    throw ApiErrors.userInactive();
  }

  return { ...toTokenPair(user, rotated.session.id, rotated.refreshToken), user: toPublicUser(user) };
}

/** Revoca la sesión indicada (idempotente). */
export async function logout(sessionId: string): Promise<void> {
  const result = await prisma.session.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (result.count > 0) invalidateSessionCache(sessionId);
}

/**
 * Logout tolerante desde el BFF: acepta el access token (header Bearer o cookie
 * lm_access) y revoca su sesión si la firma es válida; nunca lanza por token
 * inválido/vencido para que el cierre siempre "funcione".
 */
export async function logoutWithAccessToken(accessToken: string | undefined | null): Promise<void> {
  if (!accessToken) return;
  try {
    const payload = jwt.verify(accessToken, env.jwtSecret, { algorithms: ["HS256"] }) as jwt.JwtPayload;
    if (typeof payload.sid === "string") await logout(payload.sid);
  } catch {
    // Token vencido/malformado: la sesión caducará sola; no es error.
  }
}

export async function revokeAllSessionsForUser(userId: string, exceptSessionId?: string): Promise<number> {
  const result = await prisma.session.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
    },
    data: { revokedAt: new Date() },
  });
  invalidateAllSessionsCache();
  return result.count;
}

export async function me(userId: string): Promise<User> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiErrors.tokenInvalid();
  return toPublicUser(user);
}

export async function updateProfile(userId: string, data: UpdateProfileInput): Promise<User> {
  const updateData: { name?: string; email?: string } = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.email !== undefined) updateData.email = data.email.toLowerCase();

  const user = await prisma.user.update({ where: { id: userId }, data: updateData });
  cache.del(CACHE_KEYS.user(userId));
  return toPublicUser(user);
}

/**
 * Cambio de contraseña: revoca todas las sesiones del usuario salvo la actual
 * y SIEMPRE invalida `user:{id}` para que requireAuth vea el nuevo estado.
 */
export async function changePassword(
  userId: string,
  data: ChangePasswordInput,
  currentSessionId?: string
): Promise<User> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiErrors.tokenInvalid();

  const valid = await bcrypt.compare(data.currentPassword, user.passwordHash);
  if (!valid) throw ApiErrors.currentPasswordInvalid();

  const passwordHash = await bcrypt.hash(data.newPassword, 12);
  const updated = await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  cache.del(CACHE_KEYS.user(userId));
  await revokeAllSessionsForUser(userId, currentSessionId);
  return toPublicUser(updated);
}

export interface SessionSummary {
  id: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  userAgent: string | null;
  ip: string | null;
  current: boolean;
}

export async function listSessions(userId: string, currentSessionId?: string): Promise<SessionSummary[]> {
  const sessions = await prisma.session.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return sessions.map(s => ({
    id: s.id,
    createdAt: s.createdAt.toISOString(),
    expiresAt: s.expiresAt.toISOString(),
    revokedAt: s.revokedAt ? s.revokedAt.toISOString() : null,
    userAgent: s.userAgent,
    ip: s.ip,
    current: currentSessionId === s.id,
  }));
}

/** Revoca una sesión SOLO si pertenece al usuario. */
export async function revokeSession(userId: string, sessionId: string): Promise<void> {
  const result = await prisma.session.updateMany({
    where: { id: sessionId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (result.count > 0) invalidateSessionCache(sessionId);
}

export { invalidateSessionCache };
