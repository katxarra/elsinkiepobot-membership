import { mkdirSync, readFileSync, writeFileSync, existsSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";

export interface Membership {
  userId: number;
  plan: string;
  expiresAt: number;
  createdAt: number;
}

interface DataFile {
  memberships: Record<string, Membership>;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const DATA_FILE = join(DATA_DIR, "store.json");

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function load(): DataFile {
  ensureDir();
  if (!existsSync(DATA_FILE)) return { memberships: {} };
  try {
    return JSON.parse(readFileSync(DATA_FILE, "utf-8")) as DataFile;
  } catch {
    return { memberships: {} };
  }
}

function save(data: DataFile) {
  ensureDir();
  const tmp = `${DATA_FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
  renameSync(tmp, DATA_FILE);
}

export function getMembership(userId: number): Membership | undefined {
  const data = load();
  return data.memberships[String(userId)];
}

export function isActive(userId: number): boolean {
  const m = getMembership(userId);
  return !!m && m.expiresAt > Date.now();
}

export function upsertMembership(userId: number, plans: { plan: string; days: number }): Membership {
  const data = load();
  const key = String(userId);
  const existing = data.memberships[key];
  // Extend from current expiry if still valid, otherwise from now.
  const base = existing && existing.expiresAt > Date.now() ? existing.expiresAt : Date.now();
  const membership: Membership = {
    userId,
    plan: plans.plan,
    createdAt: existing?.createdAt ?? Date.now(),
    expiresAt: base + plans.days * 24 * 60 * 60 * 1000,
  };
  data.memberships[key] = membership;
  save(data);
  return membership;
}

export function revokeMembership(userId: number): boolean {
  const data = load();
  const key = String(userId);
  if (!data.memberships[key]) return false;
  delete data.memberships[key];
  save(data);
  return true;
}

export function isAdmin(userId: number): boolean {
  return config.ADMIN_IDS.includes(userId);
}
