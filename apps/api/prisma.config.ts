import { defineConfig } from "prisma/config";

/**
 * Prisma 7 no longer loads `.env` automatically — a deliberate change, since
 * implicit dotenv loading made it ambiguous which values a command actually ran
 * with. Loading it explicitly here keeps `prisma migrate` / `prisma studio`
 * working from the CLI while staying honest about where config comes from.
 */
process.loadEnvFile?.(".env");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
});
