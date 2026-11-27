/**
 * Persistent usage counters for Controlled Access policies.
 * Stored under data/permissions/counters.json
 */

import { promises as fs } from "fs";
import path from "path";
import { DATA_DIR } from "../config";

export interface UsageCounters {
  externalMessagesThisHour: number;
  browserSessionsToday: number;
  hourBucket: string; // YYYY-MM-DD-HH
  dayBucket: string; // YYYY-MM-DD
}

const DEFAULT: UsageCounters = {
  externalMessagesThisHour: 0,
  browserSessionsToday: 0,
  hourBucket: "",
  dayBucket: "",
};

function countersPath() {
  return path.join(DATA_DIR, "permissions", "counters.json");
}

function currentBuckets(now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  const hour = now.toISOString().slice(0, 13);
  return { dayBucket: day, hourBucket: hour };
}

export async function loadCounters(): Promise<UsageCounters> {
  try {
    const raw = await fs.readFile(countersPath(), "utf8");
    const data = JSON.parse(raw) as UsageCounters;
    const { dayBucket, hourBucket } = currentBuckets();
    // Reset windows when bucket changes
    if (data.hourBucket !== hourBucket) {
      data.externalMessagesThisHour = 0;
      data.hourBucket = hourBucket;
    }
    if (data.dayBucket !== dayBucket) {
      data.browserSessionsToday = 0;
      data.dayBucket = dayBucket;
    }
    return data;
  } catch {
    const { dayBucket, hourBucket } = currentBuckets();
    return { ...DEFAULT, dayBucket, hourBucket };
  }
}

export async function saveCounters(c: UsageCounters): Promise<void> {
  const dir = path.dirname(countersPath());
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(countersPath(), JSON.stringify(c, null, 2), "utf8");
}

export async function incrementExternalMessage(): Promise<UsageCounters> {
  const c = await loadCounters();
  c.externalMessagesThisHour += 1;
  await saveCounters(c);
  return c;
}

export async function incrementBrowserSession(): Promise<UsageCounters> {
  const c = await loadCounters();
  c.browserSessionsToday += 1;
  await saveCounters(c);
  return c;
}

/** Helper used by permission checks */
export async function getUsageSnapshot() {
  const c = await loadCounters();
  return {
    externalMessagesThisHour: c.externalMessagesThisHour,
    browserSessionsToday: c.browserSessionsToday,
  };
}
