import { randomBytes, randomUUID } from "node:crypto";
import { execute, query } from "@/lib/db/client";
import { DEMO_CUSTOMER } from "@/lib/demo";
import { hashPassword } from "@/lib/security/password";

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: "CONTENT_EDITOR" | "ADMIN" | "SUPER_ADMIN";
  status: "ACTIVE" | "DISABLED";
};

type UserRow = AdminUser & { password_hash: string };

export type CustomerUser = {
  id: string;
  email: string;
  name: string;
  role: "CUSTOMER";
  status: "ACTIVE" | "DISABLED";
};

type CustomerRow = CustomerUser & { password_hash: string };

export async function hasAnyAdmin(): Promise<boolean> {
  const rows = await query<{ exists: boolean }>(
    "SELECT EXISTS(SELECT 1 FROM users WHERE role IN ('ADMIN','SUPER_ADMIN')) AS exists",
  );
  return Boolean(rows[0]?.exists);
}

export async function createFirstAdmin(input: { email: string; name: string; passwordHash: string }): Promise<AdminUser> {
  const existing = await hasAnyAdmin();
  if (existing) throw new Error("ADMIN_ALREADY_EXISTS");
  const id = randomUUID();
  const rows = await query<AdminUser>(
    `INSERT INTO users(id, email, name, password_hash, role)
     VALUES ($1, $2, $3, $4, 'SUPER_ADMIN')
     RETURNING id, email, name, role, status`,
    [id, input.email.toLowerCase(), input.name, input.passwordHash],
  );
  return rows[0];
}

export async function findUserForLogin(email: string): Promise<UserRow | null> {
  const rows = await query<UserRow>(
    `SELECT id, email, name, password_hash, role, status
     FROM users WHERE lower(email) = lower($1) LIMIT 1`,
    [email],
  );
  return rows[0] ?? null;
}

export async function ensureDemoCustomer(): Promise<CustomerUser> {
  const existing = await query<CustomerUser>(
    `SELECT id, email, name, role, status FROM users
     WHERE lower(email)=lower($1) AND role='CUSTOMER' LIMIT 1`,
    [DEMO_CUSTOMER.email],
  );
  if (existing[0]) return existing[0];
  const rows = await query<CustomerUser>(
    `INSERT INTO users(id, email, name, password_hash, role)
     VALUES ($1,$2,$3,$4,'CUSTOMER')
     ON CONFLICT(email) DO UPDATE SET name=EXCLUDED.name
     RETURNING id, email, name, role, status`,
    [randomUUID(), DEMO_CUSTOMER.email, DEMO_CUSTOMER.name, await hashPassword(DEMO_CUSTOMER.password)],
  );
  return rows[0];
}

export async function findCustomerForLogin(email: string): Promise<CustomerRow | null> {
  const rows = await query<CustomerRow>(
    `SELECT id, email, name, password_hash, role, status
     FROM users WHERE lower(email)=lower($1) AND role='CUSTOMER' LIMIT 1`,
    [email],
  );
  return rows[0] ?? null;
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
  await execute(
    "INSERT INTO sessions(id, user_id, expires_at) VALUES ($1, $2, $3)",
    [token, userId, expiresAt],
  );
  return { token, expiresAt };
}

export async function getAdminBySession(token: string): Promise<AdminUser | null> {
  const rows = await query<AdminUser>(
    `SELECT u.id, u.email, u.name, u.role, u.status
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = $1 AND s.expires_at > now() AND u.status = 'ACTIVE'
       AND u.role IN ('CONTENT_EDITOR','ADMIN','SUPER_ADMIN')
     LIMIT 1`,
    [token],
  );
  return rows[0] ?? null;
}

export async function getCustomerBySession(token: string): Promise<CustomerUser | null> {
  const rows = await query<CustomerUser>(
    `SELECT u.id, u.email, u.name, u.role, u.status
     FROM sessions s JOIN users u ON u.id=s.user_id
     WHERE s.id=$1 AND s.expires_at > now() AND u.status='ACTIVE' AND u.role='CUSTOMER'
     LIMIT 1`,
    [token],
  );
  return rows[0] ?? null;
}

export async function deleteSession(token: string): Promise<void> {
  await execute("DELETE FROM sessions WHERE id = $1", [token]);
}

export async function purgeExpiredSessions(): Promise<void> {
  await execute("DELETE FROM sessions WHERE expires_at <= now()");
}

export type StaffUser = AdminUser & { created_at: string };

export async function listStaffUsers(): Promise<StaffUser[]> {
  return query<StaffUser>(
    `SELECT id, email, name, role, status, created_at FROM users
     WHERE role IN ('CONTENT_EDITOR','ADMIN','SUPER_ADMIN') ORDER BY created_at`,
  );
}

export async function createStaffUser(input: { email: string; name: string; role: "CONTENT_EDITOR" | "ADMIN"; passwordHash: string }): Promise<StaffUser> {
  const rows = await query<StaffUser>(
    `INSERT INTO users(id, email, name, password_hash, role) VALUES ($1,$2,$3,$4,$5)
     RETURNING id, email, name, role, status, created_at`,
    [randomUUID(), input.email.toLowerCase(), input.name, input.passwordHash, input.role],
  );
  return rows[0];
}

export async function updateStaffUser(input: { id: string; role: "CONTENT_EDITOR" | "ADMIN"; status: "ACTIVE" | "DISABLED" }): Promise<StaffUser | null> {
  const rows = await query<StaffUser>(
    `UPDATE users SET role=$2, status=$3, updated_at=now()
     WHERE id=$1 AND role<>'SUPER_ADMIN'
     RETURNING id, email, name, role, status, created_at`,
    [input.id, input.role, input.status],
  );
  if (input.status === "DISABLED") await execute("DELETE FROM sessions WHERE user_id=$1", [input.id]);
  return rows[0] ?? null;
}
