import { defineConfig } from 'prisma/config';

// DATABASE_URL is only required for migrate/introspect commands, not for `prisma generate`.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
