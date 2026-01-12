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

  it("should sort a JSON file with --sort-from 0", async () => {
    const filePath = join(tempDir, "test.json");
    await writeFile(filePath, '{"z": 1, "a": 2}');

    const proc = Bun.spawn(["bun", "run", "./src/cli.ts", "--sort-from", "0", filePath], {
      cwd: import.meta.dir.replace("/tests", ""),
    });
    await proc.exited;

    const result = await readFile(filePath, "utf-8");
    expect(JSON.parse(result)).toEqual({ a: 2, z: 1 });
    expect(Object.keys(JSON.parse(result))).toEqual(["a", "z"]);
  });

  it("should preserve root level order with default sortFrom 1", async () => {
    const filePath = join(tempDir, "test.json");
    await writeFile(filePath, '{"z": {"b": 1, "a": 2}, "a": {"d": 3, "c": 4}}');

    const proc = Bun.spawn(["bun", "run", "./src/cli.ts", "--sort-from", "1", filePath], {
      cwd: import.meta.dir.replace("/tests", ""),
    });
    await proc.exited;

    const result = JSON.parse(await readFile(filePath, "utf-8"));
    // Root level preserved: z before a
    expect(Object.keys(result)).toEqual(["z", "a"]);
    // Nested level sorted
    expect(Object.keys(result.z)).toEqual(["a", "b"]);
    expect(Object.keys(result.a)).toEqual(["c", "d"]);
  });

  it("should exit with 0 when --check passes", async () => {
    const filePath = join(tempDir, "sorted.json");
    await writeFile(filePath, '{\n  "a": 1,\n  "b": 2\n}\n');

    const proc = Bun.spawn(
      ["bun", "run", "./src/cli.ts", "--check", "--sort-from", "0", filePath],
      {
        cwd: import.meta.dir.replace("/tests", ""),
      },
    );
    const exitCode = await proc.exited;

    expect(exitCode).toBe(0);
  });

  it("should exit with 1 when --check fails", async () => {
    const filePath = join(tempDir, "unsorted.json");
    await writeFile(filePath, '{"z": 1, "a": 2}');

    const proc = Bun.spawn(
      ["bun", "run", "./src/cli.ts", "--check", "--sort-from", "0", filePath],
      {
        cwd: import.meta.dir.replace("/tests", ""),
      },
    );
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

    const proc = Bun.spawn(
      ["bun", "run", "./src/cli.ts", "--force", "--sort-from", "0", filePath],
      {
        cwd: import.meta.dir.replace("/tests", ""),
      },
    );
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

  it("should exit with 1 when no files found", async () => {
    const proc = Bun.spawn(["bun", "run", "./src/cli.ts", "nonexistent/**/*.json"], {
      cwd: tempDir,
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

  it("should show verbose output with --verbose", async () => {
    const filePath = join(tempDir, "test.json");
    await writeFile(filePath, '{"a": 1}');

    const proc = Bun.spawn(["bun", "run", "./src/cli.ts", "--verbose", filePath], {
      cwd: import.meta.dir.replace("/tests", ""),
      stdout: "pipe",
    });
    await proc.exited;
    const output = await new Response(proc.stdout).text();

    expect(output).toContain("sortFrom=");
  });

  it("should suppress output with --quiet", async () => {
    const filePath = join(tempDir, "test.json");
    await writeFile(filePath, '{"a": 1}');

    const proc = Bun.spawn(["bun", "run", "./src/cli.ts", "--quiet", filePath], {
      cwd: import.meta.dir.replace("/tests", ""),
      stdout: "pipe",
    });
    await proc.exited;
    const output = await new Response(proc.stdout).text();

    expect(output.trim()).toBe("");
  });
});

describe("CLI with Config File", () => {
  let tempDir: string;
  let cliPath: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "sort-json-config-test-"));
    cliPath = join(import.meta.dir.replace("/tests", ""), "src/cli.ts");
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("should use config file settings", async () => {
    const configPath = join(tempDir, ".sortjsonrc.json");
    const filePath = join(tempDir, "test.json");

    await writeFile(
      configPath,
      JSON.stringify({
        include: ["**/*.json"],
        sortFrom: 0,
      }),
    );
    await writeFile(filePath, '{"z": 1, "a": 2}');

    const proc = Bun.spawn(["bun", "run", cliPath], {
      cwd: tempDir,
      env: { ...process.env, PATH: process.env.PATH },
    });
    await proc.exited;

    const result = await readFile(filePath, "utf-8");
    expect(Object.keys(JSON.parse(result))).toEqual(["a", "z"]);
  });

  it("should use file-specific sortFrom from config", async () => {
    const configPath = join(tempDir, ".sortjsonrc.json");
    const dataPath = join(tempDir, "data.json");
    const configJsonPath = join(tempDir, "config.json");

    await writeFile(
      configPath,
      JSON.stringify({
        include: ["**/*.json"],
        sortFrom: 1,
        files: {
          "data.json": { sortFrom: 0 },
        },
      }),
    );
    await writeFile(dataPath, '{"z": 1, "a": 2}');
    await writeFile(configJsonPath, '{"z": 1, "a": 2}');

    const proc = Bun.spawn(["bun", "run", cliPath], {
      cwd: tempDir,
    });
    await proc.exited;

    // data.json should be sorted (sortFrom: 0)
    const dataResult = await readFile(dataPath, "utf-8");
    expect(Object.keys(JSON.parse(dataResult))).toEqual(["a", "z"]);

    // config.json should preserve root order (sortFrom: 1)
    const configResult = await readFile(configJsonPath, "utf-8");
    expect(Object.keys(JSON.parse(configResult))).toEqual(["z", "a"]);
  });

  it("should use sortOrder from config", async () => {
    const configPath = join(tempDir, ".sortjsonrc.json");
    const filePath = join(tempDir, "package.json");

    await writeFile(
      configPath,
      JSON.stringify({
        include: ["**/*.json"],
        files: {
          "package.json": {
            sortOrder: ["name", "version", "description"],
          },
        },
      }),
    );
    await writeFile(
      filePath,
      '{"description": "test", "name": "pkg", "version": "1.0.0", "other": true}',
    );

    const proc = Bun.spawn(["bun", "run", cliPath], {
      cwd: tempDir,
    });
    await proc.exited;

    const result = await readFile(filePath, "utf-8");
    const keys = Object.keys(JSON.parse(result));
    expect(keys).toEqual(["name", "version", "description", "other"]);
  });

  it("should ignore files specified in config", async () => {
    const configPath = join(tempDir, ".sortjsonrc.json");
    const filePath = join(tempDir, "ignore.json");

    await writeFile(
      configPath,
      JSON.stringify({
        include: ["**/*.json"],
        files: {
          "ignore.json": { ignore: true },
        },
      }),
    );
    await writeFile(filePath, '{"z": 1, "a": 2}');

    const proc = Bun.spawn(["bun", "run", cliPath], {
      cwd: tempDir,
      stdout: "pipe",
    });
    await proc.exited;
    const output = await new Response(proc.stdout).text();

    // File should not appear in output
    expect(output).not.toContain("ignore.json");

    // File should remain unsorted
    const result = await readFile(filePath, "utf-8");
    expect(Object.keys(JSON.parse(result))).toEqual(["z", "a"]);
  });

  it("should validate config file", async () => {
    const configPath = join(tempDir, ".sortjsonrc.json");

    await writeFile(
      configPath,
      JSON.stringify({
        sortFrom: "invalid", // should be number
      }),
    );

    const proc = Bun.spawn(["bun", "run", cliPath], {
      cwd: tempDir,
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();

    expect(exitCode).toBe(1);
    expect(stderr).toContain("Invalid config");
  });
});
