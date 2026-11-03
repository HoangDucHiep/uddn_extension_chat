import { defineConfig } from 'drizzle-kit'

/**
 * Drizzle config — sinh migration SQL tu src/db/schema.ts.
 * Docs: docs/SYSTEM_DESIGN.md §5.3
 */
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? 'postgresql://sidekick:sidekick_dev_pwd@localhost:5432/sidekick',
  },
  verbose: true,
  strict: true,
})
