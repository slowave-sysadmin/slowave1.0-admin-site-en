import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  timezone: "+09:00",
  ssl: { rejectUnauthorized: false },
});

export default pool;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function query<T>(sql: string, params?: any[]): Promise<T> {
  const [rows] = params && params.length > 0
    ? await pool.query(sql, params)
    : await pool.query(sql);
  return rows as T;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function insertAndGetId(sql: string, params?: any[]): Promise<number> {
  const [result] = params && params.length > 0
    ? await pool.query(sql, params)
    : await pool.query(sql);
  return (result as { insertId: number }).insertId;
}
