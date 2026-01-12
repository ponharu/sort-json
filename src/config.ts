/**
 * Configuration file handling for sort-json
 */

import { readFile } from "./io.js";
import type { Config, FileConfig } from "./schema.js";

export type { Config, FileConfig };

export const DEFAULT_CONFIG: Required<Omit<Config, "$schema" | "files">> & { files: Record<string, FileConfig> } = {
  include: ["**/*.json"],
  ignore: [],
  sortFrom: 1,
  files: {},
};

const CONFIG_FILE_NAMES = [
  ".sortjsonrc.json",
  ".sortjsonrc",
  "sortjson.config.json",
];

/**
 * Loads configuration from file or returns defaults
 */
export async function loadConfig(): Promise<Config> {
  for (const fileName of CONFIG_FILE_NAMES) {
    try {
      const content = await readFile(fileName);
      const config = JSON.parse(content) as Config;
      return mergeWithDefaults(config);
    } catch {
      // File not found or invalid, try next
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

/**
 * Gets the effective config for a specific file
 */
export function getFileConfig(filePath: string, config: Config): { sortFrom: number; ignore: boolean } {
  const baseConfig = {
    sortFrom: config.sortFrom ?? DEFAULT_CONFIG.sortFrom,
    ignore: false,
  };

  if (!config.files) {
    return baseConfig;
  }

  // Check each file pattern
  for (const [pattern, fileConfig] of Object.entries(config.files)) {
    if (matchesPattern(filePath, pattern)) {
      return {
        sortFrom: fileConfig.sortFrom ?? baseConfig.sortFrom,
        ignore: fileConfig.ignore ?? false,
      };
    }
  }

  return baseConfig;
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
  const regexPattern = pattern
    .replace(/\./g, "\\.")
    .replace(/\*\*/g, "{{GLOBSTAR}}")
    .replace(/\*/g, "[^/]*")
    .replace(/\{\{GLOBSTAR\}\}/g, ".*");

  return new RegExp(`^${regexPattern}$`).test(filePath);
}
