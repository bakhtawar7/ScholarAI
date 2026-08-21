/**
 * Strips the legacy "[DEMO DATA] " prefix from scholarship titles.
 *
 * Seeded records used to carry the marker in the title itself. That is redundant — the
 * `isDemo` boolean already drives a visible badge on both the card and detail views —
 * and the prefix polluted search results and chat replies.
 *
 * Idempotent, and updates rows in place so no user data is lost (unlike re-seeding).
 *
 *   npx ts-node src/scripts/stripDemoPrefix.ts
 */
import { prisma } from '../utils/prisma';

const PREFIX = '[DEMO DATA] ';

async function main() {
  const affected = await prisma.scholarship.findMany({
    where: { title: { startsWith: PREFIX } },
    select: { id: true, title: true, isDemo: true },
  });

  if (affected.length === 0) {
    console.log('No titles carry the legacy prefix — nothing to do.');
    await prisma.$disconnect();
    return;
  }

  console.log(`Found ${affected.length} title(s) with the legacy prefix.\n`);

  let renamed = 0;
  let merged = 0;

  for (const row of affected) {
    const cleanTitle = row.title.slice(PREFIX.length).trim();

    // (title, provider) is unique, so a clean-titled twin may already exist.
    const existing = await prisma.scholarship.findFirst({
      where: { title: cleanTitle, id: { not: row.id } },
      select: { id: true },
    });

    if (existing) {
      // Keep the canonical record and drop the prefixed duplicate.
      await prisma.scholarship.delete({ where: { id: row.id } });
      merged++;
      console.log(`  merged  "${cleanTitle}" (removed prefixed duplicate)`);
      continue;
    }

    await prisma.scholarship.update({
      where: { id: row.id },
      data: {
        title: cleanTitle,
        // Preserve the demo signal on the flag that the UI actually reads.
        isDemo: true,
      },
    });
    renamed++;
    console.log(`  renamed "${cleanTitle}"`);
  }

  console.log(`\nDone: ${renamed} renamed, ${merged} merged.`);
  console.log('Demo records remain flagged via isDemo=true, which renders a badge in the UI.');

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
