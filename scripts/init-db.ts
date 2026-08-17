import { databaseMode, ensureDatabase } from "../lib/db/client";
import { seedDatabase } from "../lib/db/seed";

await ensureDatabase();
await seedDatabase();
console.log(`정석몰 DB 초기화 완료 (${await databaseMode()})`);
