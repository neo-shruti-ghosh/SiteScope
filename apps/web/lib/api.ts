import type { CreateAuditInput } from "@sitescope/shared";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface ApiError {
  error: string;
  fieldErrors?: Partial<Record<string, string[]>>;
}

type Result<T> = { ok: true; data: T } | { ok: false; error: ApiError };

const request = async <T>(path: string, init: RequestInit): Promise<Result<T>> => {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: { "content-type": "application/json", ...init.headers },
    });
    const body: unknown = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, data: body as T } : { ok: false, error: body as ApiError };
  } catch {
    return { ok: false, error: { error: "Couldn't reach the SiteScope API. Is it running?" } };
  }
};

export const createAudit = (input: CreateAuditInput) =>
  request<{ auditId: string }>("/api/audits", { method: "POST", body: JSON.stringify(input) });

export const rerunAudit = (auditId: string) =>
  request<{ auditId: string }>(`/api/audits/${auditId}/rerun`, { method: "POST" });

export const auditEventsUrl = (auditId: string) => `${API_URL}/api/audits/${auditId}/events`;
