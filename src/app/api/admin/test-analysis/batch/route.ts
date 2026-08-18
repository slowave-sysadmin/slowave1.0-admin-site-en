export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/session";

const PRESIGN_URL =
  "https://eku2fbvobb.execute-api.ap-northeast-2.amazonaws.com/prod/files/presign-get";

const BATCH_SIZE = 1000;
const CONCURRENCY = 16;

interface PendingTest {
  test_id: string;
  created_at: string;
}

interface DeviceLog {
  CradleOn?: { Time?: string | null; BatteryLevel?: number | null; RawPacked?: string | null };
  ImpedanceTest?: {
    LOFFStartTime?: string | null;
    Channel1?: number | string | null;
    Channel2?: number | string | null;
    LOFFStartTimePacked?: string | null;
  };
}

// Device only stores day/hour/min/sec; pick month/year by walking back from
// `anchor` (Downloaded — the latest reliable wall-clock instant) until the
// day-of-month matches. CradleOn/Impedance always precede Downloaded.
function parsePackedDate(rawPacked: string | null | undefined, anchor: Date): Date | null {
  if (!rawPacked) return null;
  const hex = rawPacked.replace(/^0x/i, "");
  if (hex.length !== 8 || /[^0-9a-f]/i.test(hex)) return null;
  const day = parseInt(hex.slice(0, 2), 16);
  const hour = parseInt(hex.slice(2, 4), 16);
  const min = parseInt(hex.slice(4, 6), 16);
  const sec = parseInt(hex.slice(6, 8), 16);
  if (day < 1 || day > 31 || hour > 23 || min > 59 || sec > 59) return null;

  let year = anchor.getFullYear();
  let month = anchor.getMonth();
  for (let i = 0; i < 13; i++) {
    const d = new Date(year, month, day, hour, min, sec);
    if (d.getMonth() === month && d.getTime() <= anchor.getTime()) return d;
    month--;
    if (month < 0) { month = 11; year--; }
  }
  return null;
}

function toMysqlDatetime(d: Date | null): string | null {
  if (!d) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

interface FetchedLog {
  downloaded: string | null;
  deviceLog: DeviceLog | null;
}

async function fetchDeviceLog(testId: string): Promise<FetchedLog | "missing" | null> {
  try {
    const presignRes = await fetch(PRESIGN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ testId, fileName: `${testId}_device_log.json` }),
    });
    if (!presignRes.ok) return "missing";
    const { url } = await presignRes.json();
    const logRes = await fetch(url);
    if (!logRes.ok) return "missing";
    const data = await logRes.json();
    return {
      downloaded: (data.Downloaded ?? null) as string | null,
      deviceLog: (data.DeviceLog ?? null) as DeviceLog | null,
    };
  } catch {
    return null;
  }
}

interface AnalyzedRow {
  test_id: string;
  has_log: 0 | 1;
  cradle_on_time: string | null;
  cradle_on_battery: number | null;
  impedance_time: string | null;
  impedance_ch1: string | null;
  impedance_ch2: string | null;
}

function analyze(testId: string, createdAt: string, fetched: FetchedLog): AnalyzedRow {
  const log = fetched.deviceLog;
  if (!log) {
    return {
      test_id: testId,
      has_log: 1,
      cradle_on_time: null,
      cradle_on_battery: null,
      impedance_time: null,
      impedance_ch1: null,
      impedance_ch2: null,
    };
  }
  const anchor = fetched.downloaded ? new Date(fetched.downloaded) : new Date(createdAt);
  const cradleDate = parsePackedDate(log.CradleOn?.RawPacked, anchor);
  const impedanceDate = parsePackedDate(log.ImpedanceTest?.LOFFStartTimePacked, anchor);
  const ch1 = log.ImpedanceTest?.Channel1;
  const ch2 = log.ImpedanceTest?.Channel2;
  return {
    test_id: testId,
    has_log: 1,
    cradle_on_time: toMysqlDatetime(cradleDate),
    cradle_on_battery: log.CradleOn?.BatteryLevel ?? null,
    impedance_time: toMysqlDatetime(impedanceDate),
    impedance_ch1: ch1 == null ? null : String(ch1),
    impedance_ch2: ch2 == null ? null : String(ch2),
  };
}

async function processOne(t: PendingTest): Promise<AnalyzedRow> {
  const result = await fetchDeviceLog(t.test_id);
  if (result === "missing" || result === null) {
    return {
      test_id: t.test_id,
      has_log: result === "missing" ? 0 : 0,
      cradle_on_time: null,
      cradle_on_battery: null,
      impedance_time: null,
      impedance_ch1: null,
      impedance_ch2: null,
    };
  }
  return analyze(t.test_id, t.created_at, result);
}

async function runWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await worker(items[i]);
    }
  });
  await Promise.all(runners);
  return results;
}

export async function POST(_req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "system_admin") {
    return NextResponse.json({ error: "시스템관리자만 실행할 수 있습니다." }, { status: 403 });
  }

  try {
    const pending = await query<PendingTest[]>(
      `SELECT t.test_id, t.created_at
       FROM tests t
       LEFT JOIN test_analysis a ON t.test_id = a.test_id
       WHERE a.test_id IS NULL
       ORDER BY t.created_at DESC
       LIMIT ${BATCH_SIZE}`
    );

    if (pending.length === 0) {
      const remainingRow = await query<{ remaining: number }[]>(
        `SELECT COUNT(*) AS remaining FROM tests t
         LEFT JOIN test_analysis a ON t.test_id = a.test_id
         WHERE a.test_id IS NULL`
      );
      return NextResponse.json({ processed: 0, withLog: 0, withoutLog: 0, remaining: remainingRow[0].remaining });
    }

    const rows = await runWithConcurrency(pending, CONCURRENCY, processOne);

    const values: unknown[] = [];
    const placeholders: string[] = [];
    for (const r of rows) {
      placeholders.push("(?,?,?,?,?,?,?)");
      values.push(r.test_id, r.has_log, r.cradle_on_time, r.cradle_on_battery, r.impedance_time, r.impedance_ch1, r.impedance_ch2);
    }
    await query(
      `INSERT INTO test_analysis (test_id, has_log, cradle_on_time, cradle_on_battery, impedance_time, impedance_ch1, impedance_ch2)
       VALUES ${placeholders.join(",")}
       ON DUPLICATE KEY UPDATE
         has_log=VALUES(has_log),
         cradle_on_time=VALUES(cradle_on_time),
         cradle_on_battery=VALUES(cradle_on_battery),
         impedance_time=VALUES(impedance_time),
         impedance_ch1=VALUES(impedance_ch1),
         impedance_ch2=VALUES(impedance_ch2),
         analyzed_at=CURRENT_TIMESTAMP`,
      values
    );

    const remainingRow = await query<{ remaining: number }[]>(
      `SELECT COUNT(*) AS remaining FROM tests t
       LEFT JOIN test_analysis a ON t.test_id = a.test_id
       WHERE a.test_id IS NULL`
    );

    const withLog = rows.filter((r) => r.has_log === 1).length;
    return NextResponse.json({
      processed: rows.length,
      withLog,
      withoutLog: rows.length - withLog,
      remaining: remainingRow[0].remaining,
    });
  } catch (error) {
    console.error("POST /api/admin/test-analysis/batch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
