/* ---------------------------------------------------------------
   Simple file-based report store
   --------------------------------------------------------------- */

import fs from "fs/promises";
import path from "path";
import { AuditResult } from "./audit/types";

const DATA_DIR = path.join(process.cwd(), ".data", "reports");

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function saveReport(result: AuditResult): Promise<string> {
  await ensureDir();
  await fs.writeFile(
    path.join(DATA_DIR, `${result.id}.json`),
    JSON.stringify(result),
    "utf-8"
  );
  return result.id;
}

export async function getReport(id: string): Promise<AuditResult | null> {
  try {
    const safe = id.replace(/[^a-zA-Z0-9-]/g, "");
    const data = await fs.readFile(
      path.join(DATA_DIR, `${safe}.json`),
      "utf-8"
    );
    return JSON.parse(data) as AuditResult;
  } catch {
    return null;
  }
}

export async function saveScreenshot(id: string, buffer: Buffer): Promise<void> {
  await ensureDir();
  await fs.writeFile(path.join(DATA_DIR, `${id}.jpg`), buffer);
}

export async function getScreenshot(id: string): Promise<Buffer | null> {
  try {
    const safe = id.replace(/[^a-zA-Z0-9-]/g, "");
    return await fs.readFile(path.join(DATA_DIR, `${safe}.jpg`));
  } catch {
    return null;
  }
}
