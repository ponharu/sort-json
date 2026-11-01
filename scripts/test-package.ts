import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

function run(program: string, args: string[], cwd: string, expectedStatus = 0): void {
  const result = spawnSync(program, args, { cwd, encoding: "utf8", shell: false });
  if (result.error) throw result.error;
  assert.equal(
    result.status,
    expectedStatus,
    `${program} failed:\n${result.stdout}\n${result.stderr}`,
  );
}

const root = process.cwd();
const temporaryDirectory = await mkdtemp(join(tmpdir(), "sort-json-package-"));

try {
  const packDirectory = join(temporaryDirectory, "pack");
  const consumer = join(temporaryDirectory, "consumer");
  await Promise.all([mkdir(packDirectory), mkdir(consumer)]);
  run("npm", ["pack", "--ignore-scripts", "--pack-destination", packDirectory], root);
  const archives = (await readdir(packDirectory)).filter((name) => name.endsWith(".tgz"));
  assert.equal(archives.length, 1, "npm pack must produce exactly one archive");
  const archive = archives[0];
  assert.ok(archive);
  await writeFile(
    join(consumer, "package.json"),
    JSON.stringify({ name: "package-verification", private: true, type: "module" }),
  );
  run(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--registry=https://registry.npmjs.org",
      join(packDirectory, archive),
    ],
    consumer,
  );

  const installedPackage = join(consumer, "node_modules", "@ponharu", "sort-json");
  await Promise.all([
    readFile(join(installedPackage, "schema.json"), "utf8"),
    readFile(join(installedPackage, "dist", "index.d.ts"), "utf8"),
  ]);
  const verificationScript = join(consumer, "verify.mjs");
  await writeFile(
    verificationScript,
    `import assert from "node:assert/strict";
import { sortKeys, sortKeysShallow, formatJson, expandGlob, isBun } from "@ponharu/sort-json";
const input = { z: { d: 1, c: 2 }, a: 3 };
const sorted = sortKeys(input);
assert.deepEqual(Object.keys(sorted), ["a", "z"]);
assert.deepEqual(Object.keys(sorted.z), ["c", "d"]);
assert.deepEqual(Object.keys(input), ["z", "a"]);
assert.deepEqual(Object.keys(input.z), ["d", "c"]);
const shallow = sortKeysShallow(input);
assert.deepEqual(Object.keys(shallow), ["a", "z"]);
assert.deepEqual(Object.keys(shallow.z), ["d", "c"]);
assert.equal(formatJson(sortKeys({ z: 1, a: 2 })), '{\\n  "a": 2,\\n  "z": 1\\n}\\n');
assert.equal(isBun(), Boolean(process.versions.bun));
assert.deepEqual(await expandGlob(["*.fixture.json"], { respectGitignore: false }), ["a.fixture.json", "z.fixture.json"]);
`,
  );

  for (const runtime of ["node", process.execPath]) {
    for (const name of ["a.fixture.json", "z.fixture.json"]) {
      await writeFile(join(consumer, name), '{"z":1,"a":2}');
    }
    run(runtime, [verificationScript], consumer);
    const cli = join(installedPackage, "dist", "cli.js");
    run(runtime, [cli, "--check", "--sort-from", "0", "*.fixture.json"], consumer, 1);
    run(runtime, [cli, "--sort-from", "0", "*.fixture.json"], consumer);
    for (const name of ["a.fixture.json", "z.fixture.json"]) {
      assert.equal(await readFile(join(consumer, name), "utf8"), '{\n  "a": 2,\n  "z": 1\n}\n');
    }
    run(runtime, [cli, "--check", "--sort-from", "0", "*.fixture.json"], consumer);
    run(runtime, [cli, "--version"], consumer);
    console.info(`Installed API and CLI verified with ${runtime === "node" ? "Node.js" : "Bun"}`);
  }
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
