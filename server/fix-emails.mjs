import { drizzle } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";

const db = drizzle(process.env.DATABASE_URL);

// Find duplicates
const dupes = await db.execute(sql`SELECT email, COUNT(*) as cnt FROM users GROUP BY email HAVING cnt > 1`);
console.log("Duplicate emails:", dupes[0]);

// List all users
const all = await db.execute(sql`SELECT id, openId, name, email, role, status FROM users ORDER BY email, id`);
console.log("All users:");
for (const row of all[0]) {
  console.log(`  id=${row.id} email=${row.email} name=${row.name} role=${row.role} status=${row.status} openId=${row.openId?.substring(0,20)}`);
}

// Delete duplicate invite records (keep the one with real openId, delete invite_ ones)
const inviteUsers = await db.execute(sql`SELECT id, openId, email FROM users WHERE openId LIKE 'invite_%'`);
console.log("\nInvite-placeholder users:", inviteUsers[0]);

for (const inv of inviteUsers[0]) {
  // Check if there's a real user with same email
  const real = await db.execute(sql`SELECT id FROM users WHERE email = ${inv.email} AND openId NOT LIKE 'invite_%'`);
  if (real[0].length > 0) {
    console.log(`Deleting duplicate invite user id=${inv.id} email=${inv.email}`);
    await db.execute(sql`DELETE FROM users WHERE id = ${inv.id}`);
  }
}

// Now try adding unique index
try {
  await db.execute(sql`ALTER TABLE users ADD UNIQUE INDEX idx_users_email (email)`);
  console.log("\nUnique index added successfully!");
} catch (e) {
  console.log("\nFailed to add unique index:", e.message);
}

process.exit(0);
