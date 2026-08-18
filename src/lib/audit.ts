import { insertAndGetId } from "./db";
import { getSession } from "./session";

export async function logAudit(params: {
  entityType: "organization" | "user" | "device";
  entityId: number;
  action: "create" | "update" | "delete";
  changes?: Record<string, { old: unknown; new: unknown }>;
  performedBy?: string;
}) {
  let performer = params.performedBy;
  if (!performer) {
    try {
      const session = await getSession();
      performer = session?.username || "admin";
    } catch {
      performer = "admin";
    }
  }

  await insertAndGetId(
    `INSERT INTO audit_logs (entity_type, entity_id, action, changes, performed_by) VALUES (?, ?, ?, ?, ?)`,
    [
      params.entityType,
      params.entityId,
      params.action,
      params.changes ? JSON.stringify(params.changes) : null,
      performer,
    ]
  );
}
