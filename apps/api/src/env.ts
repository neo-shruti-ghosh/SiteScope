import { z } from "zod";

const optional = z
  .string()
  .optional()
  .transform((v) => v || undefined);

const EnvSchema = z.object({
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required (must match the web app)"),
  DATABASE_URL: z.string().min(1),
  API_PORT: z.coerce.number().int().default(4000),
  /** Base URL the browser uses to reach this API (for screenshot links). */
  API_PUBLIC_URL: optional,
  WEB_ORIGIN: z.string().default("http://localhost:3000"),
  AUDIT_RATE_LIMIT_PER_HOUR: z.coerce.number().int().positive().default(5),
  AUDIT_MOCK_MODE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  LIGHTHOUSE_CACHE_TTL_MS: z.coerce.number().int().nonnegative().default(15 * 60 * 1000),
  LANGUAGETOOL_URL: z.string().default("https://api.languagetool.org/v2/check"),
  CHROME_PATH: optional,
  /** Optional: without it, Claude-powered analysis is skipped and those categories show as not scored. */
  ANTHROPIC_API_KEY: optional,
  CLAUDE_MODEL: z.string().default("claude-sonnet-5-5"),
});

const parsed = EnvSchema.parse(process.env);

export const env = {
  ...parsed,
  API_PUBLIC_URL: parsed.API_PUBLIC_URL ?? `http://localhost:${parsed.API_PORT}`,
};
