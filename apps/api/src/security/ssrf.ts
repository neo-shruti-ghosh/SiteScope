import { lookup } from "node:dns/promises";
import ipaddr from "ipaddr.js";

export class UnsafeUrlError extends Error {}

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const ALLOWED_PORTS = new Set(["", "80", "443"]);

/** ipaddr.js labels globally routable addresses "unicast"; anything else is private, reserved or special. */
export const isPublicIp = (address: string): boolean => {
  if (!ipaddr.isValid(address)) return false;
  const parsed = ipaddr.parse(address);
  const ip =
    parsed.kind() === "ipv6" && (parsed as ipaddr.IPv6).isIPv4MappedAddress()
      ? (parsed as ipaddr.IPv6).toIPv4Address()
      : parsed;
  return ip.range() === "unicast";
};

/** Resolves a hostname (or IP literal) to all of its addresses. Throws if it can't be resolved. */
const resolveHost = async (hostname: string): Promise<string[]> => {
  const host = hostname.replace(/^\[|\]$/g, "");
  if (ipaddr.isValid(host)) return [host];
  const results = await lookup(host, { all: true, verbatim: true });
  return results.map((r) => r.address);
};

/** True when every address the host resolves to is public. */
export const isPublicHost = async (hostname: string): Promise<boolean> => {
  try {
    const addresses = await resolveHost(hostname);
    return addresses.length > 0 && addresses.every(isPublicIp);
  } catch {
    return false;
  }
};

/**
 * Rejects URLs that could reach internal infrastructure: non-http(s) schemes, odd ports,
 * credentials, and hostnames resolving to any non-public address.
 * Returns the normalised URL string.
 */
export const assertPublicUrl = async (raw: string): Promise<string> => {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("That doesn't look like a valid URL.");
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) throw new UnsafeUrlError("Only http and https URLs can be audited.");
  if (!ALLOWED_PORTS.has(url.port)) throw new UnsafeUrlError("Only standard ports (80/443) can be audited.");
  if (url.username || url.password) throw new UnsafeUrlError("URLs with embedded credentials aren't allowed.");

  const addresses = await resolveHost(url.hostname).catch(() => {
    throw new UnsafeUrlError(`Couldn't resolve ${url.hostname}.`);
  });
  if (addresses.length === 0 || !addresses.every(isPublicIp)) {
    throw new UnsafeUrlError("That address points to a private or local network and can't be audited.");
  }

  url.hash = "";
  return url.toString();
};
