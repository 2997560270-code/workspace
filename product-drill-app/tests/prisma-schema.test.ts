import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const schema = readFileSync("prisma/schema.prisma", "utf8");

describe("database schema foundation", () => {
  it("uses PostgreSQL for the MVP database", () => {
    expect(schema).toContain('provider = "postgresql"');
    expect(schema).toContain('url      = env("DATABASE_URL")');
  });

  it("defines the first three persisted models", () => {
    expect(schema).toContain("model User");
    expect(schema).toContain("model TrainingSession");
    expect(schema).toContain("model Message");
  });
});
