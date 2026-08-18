import { query } from "@/lib/db";

const FIELD_LABEL: Record<string, string> = {
  product_serial_number: "제품 시리얼",
  mac_address: "MAC 주소",
  usb_serial_number: "USB 시리얼",
};

type ConflictRow = {
  device_id: number;
  product_serial_number: string;
  mac_address: string;
  usb_serial_number: string;
} & Record<string, unknown>;

export async function findDuplicateConflict(
  values: { product_serial_number?: string; mac_address?: string; usb_serial_number?: string },
  excludeDeviceId?: number
): Promise<string | null> {
  const checks: { field: keyof typeof FIELD_LABEL; value: string }[] = [];
  if (values.product_serial_number) checks.push({ field: "product_serial_number", value: values.product_serial_number });
  if (values.mac_address) checks.push({ field: "mac_address", value: values.mac_address });
  if (values.usb_serial_number) checks.push({ field: "usb_serial_number", value: values.usb_serial_number });
  if (checks.length === 0) return null;

  const whereParts = checks.map((c) => `${c.field} = ?`);
  const params: unknown[] = checks.map((c) => c.value);
  let sql = `SELECT device_id, product_serial_number, mac_address, usb_serial_number
             FROM devices
             WHERE status <> 'retired' AND (${whereParts.join(" OR ")})`;
  if (excludeDeviceId !== undefined) {
    sql += ` AND device_id <> ?`;
    params.push(excludeDeviceId);
  }
  const rows = await query<ConflictRow[]>(sql, params);
  if (rows.length === 0) return null;

  for (const c of checks) {
    const hit = rows.find((r) => r[c.field] === c.value);
    if (hit) {
      return `${FIELD_LABEL[c.field]} '${c.value}'이(가) 이미 등록되어 있습니다. (device_id=${hit.device_id})`;
    }
  }
  return null;
}
