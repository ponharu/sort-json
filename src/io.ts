/**
 * Runtime detection and file I/O utilities.
 * Uses Bun APIs when available, falls back to Node.js fs.
 */

declare const Bun: {
  file(path: string): { text(): Promise<string>; json(): Promise<unknown> };
  write(path: string, content: string): Promise<number>;
  Glob: new (pattern: string) => {
    scan(cwd: string): AsyncIterable<string>;
  };
} | undefined;

/**
 * Checks if running in Bun runtime.
 */
export function isBun(): boolean {
  return typeof Bun !== "undefined";
}

/**
 * Reads a file as text.
 */
export async function readFile(path: string): Promise<string> {
  if (isBun()) {
    return Bun!.file(path).text();
  }

  const fs = await import("node:fs/promises");
  return fs.readFile(path, "utf-8");
}

/**
 * Writes content to a file.
 */
export async function writeFile(path: string, content: string): Promise<void> {
  if (isBun()) {
    await Bun!.write(path, content);
    return;
  }

  const fs = await import("node:fs/promises");
  await fs.writeFile(path, content, "utf-8");
}

/**
 * Expands glob patterns to file paths.
 * Uses Bun.Glob when available, falls back to fast-glob.
 */
export async function expandGlob(patterns: string[]): Promise<string[]> {
  const results: string[] = [];

  for (const pattern of patterns) {
    // Check if it's a glob pattern or a direct file path
    if (!isGlobPattern(pattern)) {
      results.push(pattern);
      continue;
    }

    if (isBun()) {
      const glob = new Bun!.Glob(pattern);
      for await (const file of glob.scan(".")) {
        results.push(file);
      }
    } else {
      const fg = await import("fast-glob");
      const files = await fg.default(pattern, {
        dot: true,
        onlyFiles: true,
      });
      results.push(...files);
    }
  }

  // Remove duplicates and sort
  return [...new Set(results)].sort();
}

/**
 * Checks if a string contains glob pattern characters.
 */
function isGlobPattern(str: string): boolean {
  return /[*?[\]{}!]/.test(str);
}

/**
 * Checks if a file exists.
 */
export async function fileExists(path: string): Promise<boolean> {
  try {
    if (isBun()) {
      const file = Bun!.file(path);
      return (await file.text()).length >= 0;
    }

    const fs = await import("node:fs/promises");
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}
