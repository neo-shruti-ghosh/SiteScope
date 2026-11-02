import { assertPublicUrl } from "../../security/ssrf";

const MAX_REDIRECTS = 5;

export interface SafeResponse {
  url: string;
  status: number;
  contentType: string;
  body: string;
}

/**
 * fetch() that re-validates every redirect hop against the SSRF guard, enforces a timeout,
 * and stops reading after `maxBytes`.
 */
export const fetchSafe = async (
  rawUrl: string,
  { timeoutMs = 15_000, maxBytes = 2_000_000 }: { timeoutMs?: number; maxBytes?: number } = {},
): Promise<SafeResponse> => {
  const signal = AbortSignal.timeout(timeoutMs);

  const follow = async (url: string, hops: number): Promise<Response & { finalUrl: string }> => {
    const safeUrl = await assertPublicUrl(url);
    const res = await fetch(safeUrl, {
      redirect: "manual",
      signal,
      headers: { "user-agent": "SiteScopeBot/1.0 (+website audit)", accept: "text/html,text/plain,*/*" },
    });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      if (hops >= MAX_REDIRECTS) throw new Error("Too many redirects");
      return follow(new URL(location, safeUrl).toString(), hops + 1);
    }
    return Object.assign(res, { finalUrl: safeUrl });
  };

  const res = await follow(rawUrl, 0);
  const reader = res.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (reader && size < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
  }
  await reader?.cancel().catch(() => undefined);

  return {
    url: res.finalUrl,
    status: res.status,
    contentType: res.headers.get("content-type") ?? "",
    body: Buffer.concat(chunks).toString("utf8").slice(0, maxBytes),
  };
};
