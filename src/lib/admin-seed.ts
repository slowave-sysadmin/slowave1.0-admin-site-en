import { query, insertAndGetId } from "./db";
import bcrypt from "bcryptjs";

let seeded = false;

export async function ensureAdminTable() {
  if (seeded) return;
  seeded = true;

  await query(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(100) NOT NULL DEFAULT '',
      role ENUM('system_admin', 'admin') NOT NULL DEFAULT 'admin',
      page_permissions JSON DEFAULT NULL,
      status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  const initial = process.env.INITIAL_SYSTEM_ADMIN;
  if (!initial) return;

  const [username, password] = initial.split(":");
  if (!username || !password) return;

  const existing = await query<{ id: number }[]>(
    "SELECT id FROM admin_users WHERE username = ?",
    [username]
  );
  if (existing.length > 0) return;

  const hash = await bcrypt.hash(password, 10);
  await insertAndGetId(
    "INSERT INTO admin_users (username, password_hash, name, role) VALUES (?, ?, ?, 'system_admin')",
    [username, hash, username]
  );
  console.log(`[admin-seed] Initial system admin "${username}" created.`);
}
