function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// Секрет для JWT
export const JWT_SECRET: string = process.env.JWT_SECRET || "change-me";

// TTL можно переопределить через переменные окружения (в минутах)
export const ACCESS_TTL_MIN: number = parseNumber(
  process.env.ACCESS_TTL_MIN,
  10
);

export const REFRESH_TTL_MIN: number = parseNumber(
  process.env.REFRESH_TTL_MIN,
  7 * 24 * 60
);
