import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("CLI Integration", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "sort-json-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("should sort a JSON file in place", async () => {
    const filePath = join(tempDir, "test.json");
    await writeFile(filePath, '{"z": 1, "a": 2}');

    const proc = Bun.spawn(["bun", "run", "./src/cli.ts", filePath], {
      cwd: import.meta.dir.replace("/tests", ""),
    });
    await proc.exited;

    const result = await readFile(filePath, "utf-8");
    expect(JSON.parse(result)).toEqual({ a: 2, z: 1 });
    expect(Object.keys(JSON.parse(result))).toEqual(["a", "z"]);
  });

  it("should exit with 0 when --check passes", async () => {
    const filePath = join(tempDir, "sorted.json");
    await writeFile(filePath, '{\n  "a": 1,\n  "b": 2\n}\n');

    const proc = Bun.spawn(["bun", "run", "./src/cli.ts", "--check", filePath], {
      cwd: import.meta.dir.replace("/tests", ""),
    });
    const exitCode = await proc.exited;

    expect(exitCode).toBe(0);
  });

  it("should exit with 1 when --check fails", async () => {
    const filePath = join(tempDir, "unsorted.json");
    await writeFile(filePath, '{"z": 1, "a": 2}');

    const proc = Bun.spawn(["bun", "run", "./src/cli.ts", "--check", filePath], {
      cwd: import.meta.dir.replace("/tests", ""),
    });
    const exitCode = await proc.exited;

    expect(exitCode).toBe(1);
  });

  it("should skip JSONC files without --force", async () => {
    const filePath = join(tempDir, "config.json");
    await writeFile(filePath, '{\n  // comment\n  "a": 1\n}');

    const proc = Bun.spawn(["bun", "run", "./src/cli.ts", filePath], {
      cwd: import.meta.dir.replace("/tests", ""),
      stdout: "pipe",
    });
    await proc.exited;
    const output = await new Response(proc.stdout).text();

    expect(output).toContain("JSONC detected");
    expect(output).toContain("skipped");
  });

  it("should process JSONC files with --force", async () => {
    const filePath = join(tempDir, "config.json");
    await writeFile(filePath, '{\n  // comment\n  "z": 1,\n  "a": 2\n}');

    const proc = Bun.spawn(["bun", "run", "./src/cli.ts", "--force", filePath], {
      cwd: import.meta.dir.replace("/tests", ""),
    });
    await proc.exited;

    const result = await readFile(filePath, "utf-8");
    expect(result).not.toContain("//");
    expect(Object.keys(JSON.parse(result))).toEqual(["a", "z"]);
  });

  it("should handle parse errors gracefully", async () => {
    const filePath = join(tempDir, "invalid.json");
    await writeFile(filePath, "{ invalid json }");

    const proc = Bun.spawn(["bun", "run", "./src/cli.ts", filePath], {
      cwd: import.meta.dir.replace("/tests", ""),
    });
    const exitCode = await proc.exited;

    expect(exitCode).toBe(1);
  });

  it("should print version with --version", async () => {
    const proc = Bun.spawn(["bun", "run", "./src/cli.ts", "--version"], {
      cwd: import.meta.dir.replace("/tests", ""),
      stdout: "pipe",
    });
    await proc.exited;
    const output = await new Response(proc.stdout).text();

    expect(output.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("should print help with --help", async () => {
    const proc = Bun.spawn(["bun", "run", "./src/cli.ts", "--help"], {
      cwd: import.meta.dir.replace("/tests", ""),
      stdout: "pipe",
    });
    await proc.exited;
    const output = await new Response(proc.stdout).text();

    expect(output).toContain("sort-json");
    expect(output).toContain("--check");
    expect(output).toContain("--force");
  });

  it("should exit with 1 when no files specified", async () => {
    const proc = Bun.spawn(["bun", "run", "./src/cli.ts"], {
      cwd: import.meta.dir.replace("/tests", ""),
    });
    const exitCode = await proc.exited;

    expect(exitCode).toBe(1);
  });

  it("should format with custom indent", async () => {
    const filePath = join(tempDir, "test.json");
    await writeFile(filePath, '{"a": 1}');

    const proc = Bun.spawn(["bun", "run", "./src/cli.ts", "--indent", "4", filePath], {
      cwd: import.meta.dir.replace("/tests", ""),
    });
    await proc.exited;

    const result = await readFile(filePath, "utf-8");
    expect(result).toBe('{\n    "a": 1\n}\n');
  });

  it("should format with tabs", async () => {
    const filePath = join(tempDir, "test.json");
    await writeFile(filePath, '{"a": 1}');

    const proc = Bun.spawn(["bun", "run", "./src/cli.ts", "--tabs", filePath], {
      cwd: import.meta.dir.replace("/tests", ""),
    });
    await proc.exited;

    const result = await readFile(filePath, "utf-8");
    expect(result).toBe('{\n\t"a": 1\n}\n');
  });
});
