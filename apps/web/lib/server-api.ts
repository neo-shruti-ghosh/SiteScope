import { type AuditDetail, AuditDetailSchema, type AuditSummary, AuditSummarySchema } from "@sitescope/shared";
import { cookies } from "next/headers";
import { z } from "zod";
import { API_URL } from "./api";

/** Server-side GET to the API, forwarding the user's session cookie. Returns null on 404. */
const get = async <T>(path: string, schema: z.ZodType<T>): Promise<T | null> => {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { cookie: (await cookies()).toString() },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API ${path} responded ${res.status}`);
  return schema.parse(await res.json());
};

export const fetchAudits = async (): Promise<AuditSummary[]> =>
  (await get("/api/audits", z.array(AuditSummarySchema))) ?? [];

export const fetchAudit = (id: string): Promise<AuditDetail | null> => get(`/api/audits/${id}`, AuditDetailSchema);
