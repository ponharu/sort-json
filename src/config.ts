/**
 * Configuration file handling for sort-json
 */

import { Value } from "@sinclair/typebox/value";
import { readFile } from "./io.js";
import { ConfigSchema, type Config, type FileConfig } from "./schema.js";

export type { Config, FileConfig };

export const DEFAULT_CONFIG: Required<Omit<Config, "$schema" | "files">> & {
  files: Record<string, FileConfig>;
} = {
  include: ["**/*.json"],
  ignore: [],
  sortFrom: 1,
  files: {},
};

const CONFIG_FILE_NAMES = [".sortjsonrc.json", ".sortjsonrc", "sortjson.config.json"];

export class ConfigValidationError extends Error {
  constructor(
    message: string,
    public errors: Array<{ path: string; message: string }>,
  ) {
    super(message);
    this.name = "ConfigValidationError";
  }
}

/**
 * Loads configuration from file or returns defaults
 */
export async function loadConfig(): Promise<Config> {
  for (const fileName of CONFIG_FILE_NAMES) {
    try {
      const content = await readFile(fileName);
      const parsed = JSON.parse(content);

      // Validate with TypeBox
      if (!Value.Check(ConfigSchema, parsed)) {
        const errors = [...Value.Errors(ConfigSchema, parsed)].map((e) => ({
          path: e.path,
          message: e.message,
        }));
        throw new ConfigValidationError(
          `Invalid config in ${fileName}: ${errors[0]?.message ?? "unknown error"}`,
          errors,
        );
      }

      return mergeWithDefaults(parsed);
    } catch (e) {
      if (e instanceof ConfigValidationError) {
        throw e;
      }
      // File not found or JSON parse error, try next
      continue;
    }
  }
  return { ...DEFAULT_CONFIG };
}

/**
 * Merges user config with defaults
 */
function mergeWithDefaults(config: Config): Config {
  return {
    ...DEFAULT_CONFIG,
    ...config,
    ignore: [...(config.ignore ?? [])],
    files: { ...config.files },
  };
}

export interface FileConfigResult {
  sortFrom: number;
  ignore: boolean;
  sortOrder?: string[];
  matchedPattern?: string;
}

/**
 * Gets the effective config for a specific file.
 * When multiple patterns match, the most specific one wins.
 */
export function getFileConfig(filePath: string, config: Config): FileConfigResult {
  const baseConfig: FileConfigResult = {
    sortFrom: config.sortFrom ?? DEFAULT_CONFIG.sortFrom,
    ignore: false,
    sortOrder: undefined,
    matchedPattern: undefined,
  };

  if (!config.files) {
    return baseConfig;
  }

  // Find all matching patterns and their specificity scores
  const matches: Array<{
    pattern: string;
    config: FileConfig;
    score: number;
  }> = [];

  for (const [pattern, fileConfig] of Object.entries(config.files)) {
    if (matchesPattern(filePath, pattern)) {
      matches.push({
        pattern,
        config: fileConfig,
        score: getPatternSpecificity(pattern),
      });
    }
  }

  if (matches.length === 0) {
    return baseConfig;
  }

  // Sort by specificity (highest first) and use the most specific match
  matches.sort((a, b) => b.score - a.score);
  const bestMatch = matches[0];

  return {
    sortFrom: bestMatch.config.sortFrom ?? baseConfig.sortFrom,
    ignore: bestMatch.config.ignore ?? false,
    sortOrder: bestMatch.config.sortOrder,
    matchedPattern: bestMatch.pattern,
  };
}

/**
 * Calculate pattern specificity score.
 * Higher score = more specific pattern.
 */
function getPatternSpecificity(pattern: string): number {
  let score = 0;

  // Exact match (no wildcards) is most specific
  if (!pattern.includes("*")) {
    score += 1000;
  }

  // More path segments = more specific
  score += (pattern.match(/\//g) || []).length * 10;

  // Single * is more specific than **
  const doubleStarCount = (pattern.match(/\*\*/g) || []).length;
  const singleStarCount = (pattern.match(/\*/g) || []).length - doubleStarCount * 2;
  score -= doubleStarCount * 5;
  score += singleStarCount * 1;

  // Longer patterns tend to be more specific
  score += pattern.length;

  return score;
}

/**
 * Simple glob pattern matching
 */
function matchesPattern(filePath: string, pattern: string): boolean {
  // Exact match
  if (filePath === pattern) {
    return true;
  }

  // Convert glob to regex
  let regexPattern = pattern
    .replace(/\./g, "\\.")
    .replace(/\*\*/g, "{{GLOBSTAR}}")
    .replace(/\*/g, "[^/]*")
    .replace(/\{\{GLOBSTAR\}\}/g, ".*");

  // Handle **/ at the start - should match zero or more directories
  // e.g., **/*.json should match both "foo/bar.json" and "bar.json"
  if (regexPattern.startsWith(".*/")) {
    regexPattern = "(.*/)?".concat(regexPattern.slice(3));
  }

  return new RegExp(`^${regexPattern}$`).test(filePath);
}
