import "dotenv/config";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

const NODE_ENV = process.env.NODE_ENV ?? "development";

export const env = {
  nodeEnv: NODE_ENV,
  isProd: NODE_ENV === "production",
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "12h",
  /** TTL del access token de sesión (claims {sub, role, sid}). */
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL ?? "15m",
  /** Vida útil del refresh token / Session en días. */
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 7),
  /** Cookies Secure (solo detrás de HTTPS; en dev/local va en false). */
  cookieSecure: (process.env.COOKIE_SECURE ?? "false") === "true",
  trustProxy: (process.env.TRUST_PROXY ?? "false") === "true",
  /** Documentación Scalar/OpenAPI desactivable en producción. */
  docsEnabled: process.env.DOCS_ENABLED !== "false",
  /** Origen del BFF Astro; si está seteado, CORS se restringe a ese valor. */
  webOrigin: process.env.WEB_ORIGIN,
  port: Number(process.env.PORT ?? 3001),
  corsOrigin: (process.env.CORS_ORIGIN ?? "http://localhost:4321").split(",").map(s => s.trim()),
};
