import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "./env";

export const STORAGE_DIR = path.resolve(import.meta.dirname, "../storage");

/** Saves a screenshot for an audit and returns the URL the web app can load it from. */
export const saveScreenshot = async (auditId: string, name: string, data: Buffer): Promise<string> => {
  const dir = path.join(STORAGE_DIR, auditId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), data);
  return `${env.API_PUBLIC_URL}/api/audits/${auditId}/screenshots/${name}`;
};

export const screenshotPath = (auditId: string, name: string) => path.join(STORAGE_DIR, auditId, name);
