/**
 * Runtime detection and file I/O utilities.
 * Uses Bun APIs when available, falls back to Node.js fs.
 */

declare const Bun:
  | {
      file(path: string): { text(): Promise<string>; json(): Promise<unknown> };
      write(path: string, content: string): Promise<number>;
      Glob: new (pattern: string) => {
        scan(cwd: string): AsyncIterable<string>;
      };
    }
  | undefined;

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
 * Reads .gitignore file and returns ignore patterns.
 */
export async function readGitignore(): Promise<string[]> {
  try {
    const content = await readFile(".gitignore");
    return content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((pattern) => {
        // Convert gitignore patterns to glob patterns
        if (pattern.startsWith("/")) {
          return pattern.slice(1) + "/**";
        }
        if (!pattern.includes("/")) {
          return "**/" + pattern + "/**";
        }
        return pattern + "/**";
      });
  } catch {
    return [];
  }
}

export interface ExpandGlobOptions {
  ignore?: string[];
  respectGitignore?: boolean;
}

/**
 * Expands glob patterns to file paths.
 * Uses Bun.Glob when available, falls back to fast-glob.
 */
export async function expandGlob(
  patterns: string[],
  options: ExpandGlobOptions = {},
): Promise<string[]> {
  const { ignore = [], respectGitignore = true } = options;

  // Combine ignore patterns
  let ignorePatterns = [...ignore];
  if (respectGitignore) {
    const gitignorePatterns = await readGitignore();
    ignorePatterns = [...ignorePatterns, ...gitignorePatterns];
  }

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
        // Apply ignore patterns manually for Bun
        if (!shouldIgnore(file, ignorePatterns)) {
          results.push(file);
        }
      }
    } else {
      const fg = await import("fast-glob");
      const files = await fg.default(pattern, {
        dot: true,
        onlyFiles: true,
        ignore: ignorePatterns,
      });
      results.push(...files);
    }
  }

  // Remove duplicates and sort
  return [...new Set(results)].toSorted();
}

/**
 * Checks if a file should be ignored based on ignore patterns.
 */
function shouldIgnore(file: string, ignorePatterns: string[]): boolean {
  for (const pattern of ignorePatterns) {
    // Simple glob matching for common patterns
    const regexPattern = pattern.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*").replace(/\?/g, ".");
    if (new RegExp(`^${regexPattern}$`).test(file)) {
      return true;
    }
    // Also check if the file path contains the ignore pattern directory
    if (pattern.endsWith("/**") && file.startsWith(pattern.slice(0, -3))) {
      return true;
    }
  }
  return false;
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
