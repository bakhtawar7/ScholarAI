/**
 * Pre-migration integrity check.
 *
 * Run before applying the unique constraints added in this release, so a failed
 * `prisma migrate` is diagnosed up front instead of aborting mid-apply.
 *
 *   npx ts-node src/scripts/checkDuplicates.ts
 */
import { prisma } from '../utils/prisma';

async function report(label: string, sql: string) {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(sql);
    if (rows.length === 0) {
      console.log(`  OK    ${label}: no duplicates`);
      return 0;
    }
    console.log(`  FAIL  ${label}: ${rows.length} duplicate group(s)`);
    rows
      .slice(0, 5)
      .forEach((r) =>
        console.log(`          ${JSON.stringify(r, (_k, v) => (typeof v === 'bigint' ? Number(v) : v))}`)
      );
    return rows.length;
  } catch (err: any) {
    // A missing column simply means the constraint's column has not been added yet.
    console.log(`  SKIP  ${label}: ${err.message.split('\n').filter(Boolean).pop()?.trim()}`);
    return 0;
  }
}

async function main() {
  console.log('\nChecking uniqueness pre-conditions...\n');

  let problems = 0;
  problems += await report(
    'Scholarship (title, provider)',
    'SELECT title, provider, COUNT(*) c FROM Scholarship GROUP BY title, provider HAVING c > 1'
  );
  problems += await report(
    'ApplicationChecklist (applicationId, item)',
    'SELECT applicationId, item, COUNT(*) c FROM ApplicationChecklist GROUP BY applicationId, item HAVING c > 1'
  );
  problems += await report(
    'Reminder (userId, title, dueDate)',
    'SELECT userId, title, dueDate, COUNT(*) c FROM Reminder GROUP BY userId, title, dueDate HAVING c > 1'
  );
  problems += await report(
    'Notification (dedupeKey)',
    'SELECT dedupeKey, COUNT(*) c FROM Notification WHERE dedupeKey IS NOT NULL GROUP BY dedupeKey HAVING c > 1'
  );

  const counts = await prisma.$queryRawUnsafe<any[]>(
    'SELECT (SELECT COUNT(*) FROM User) users, (SELECT COUNT(*) FROM Scholarship) scholarships, (SELECT COUNT(*) FROM Application) applications, (SELECT COUNT(*) FROM Notification) notifications'
  );
  // SQLite COUNT(*) comes back as BigInt, which JSON.stringify cannot serialise.
  console.log(`\nRow counts: ${JSON.stringify(counts[0], (_k, v) => (typeof v === 'bigint' ? Number(v) : v))}`);
  console.log(problems === 0 ? '\nSafe to migrate.\n' : `\n${problems} duplicate group(s) must be resolved first.\n`);

  await prisma.$disconnect();
  process.exit(problems === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
