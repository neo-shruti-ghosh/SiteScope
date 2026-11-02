import { decode } from "@auth/core/jwt";
import { parseCookie } from "cookie";
import type { Request, RequestHandler } from "express";
import { env } from "../env";

// Auth.js names the cookie by protocol; the cookie name doubles as the JWE salt.
const COOKIE_NAMES = ["__Secure-authjs.session-token", "authjs.session-token"] as const;

const userIds = new WeakMap<Request, string>();

const userIdFromCookies = async (header: string | undefined): Promise<string | null> => {
  if (!header) return null;
  const cookies = parseCookie(header);
  const name = COOKIE_NAMES.find((n) => cookies[n]);
  if (!name) return null;

  try {
    const token = await decode({ token: cookies[name], secret: env.AUTH_SECRET, salt: name });
    return typeof token?.sub === "string" ? token.sub : null;
  } catch {
    return null;
  }
};

/** Verifies the Auth.js session cookie (an encrypted JWT) set by the web app. */
export const requireUser: RequestHandler = async (req, res, next) => {
  const userId = await userIdFromCookies(req.headers.cookie);
  if (!userId) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }
  userIds.set(req, userId);
  next();
};

/** The signed-in user's id; only valid behind `requireUser`. */
export const userIdOf = (req: Request): string => {
  const userId = userIds.get(req);
  if (!userId) throw new Error("requireUser middleware missing");
  return userId;
};
