import { defineConfig } from "drizzle-kit";

// tells drizzle where the schema lives and where to write migrations
export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
