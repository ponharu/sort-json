#!/usr/bin/env node
/**
 * sort-json CLI
 * Fast JSON key sorter - Bun-optimized, Node.js compatible
 */

import { readFile, writeFile, expandGlob } from "./io.js";
import {
  sortKeysFromDepth,
  formatJson,
  detectJsonc,
  stripComments,
} from "./sort.js";
import { loadConfig, getFileConfig, type Config } from "./config.js";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { version: VERSION } = require("../package.json");

interface Options {
  check: boolean;
  write: boolean;
  force: boolean;
  indent: number;
  tabs: boolean;
  quiet: boolean;
  verbose: boolean;
  help: boolean;
  version: boolean;
  ignore: string[];
  respectGitignore: boolean;
  sortFrom: number | null;
}

interface ProcessOptions {
  check: boolean;
  write: boolean;
  force: boolean;
  indent: number;
  tabs: boolean;
  sortFrom: number;
}

interface Result {
  file: string;
  status: "success" | "skipped" | "error" | "changed";
  message?: string;
}

function printHelp(): void {
  console.log(`
sort-json v${VERSION}
Fast JSON key sorter - Bun-optimized, Node.js compatible

Usage:
  sort-json [options] [files...]

Arguments:
  files                JSON files to sort (glob patterns supported)
                       If not specified, uses 'include' from config file

Options:
  -c, --check          Check if files are sorted (exit 1 if not)
  -w, --write          Write changes to files (default: true)
  -f, --force          Force processing of JSONC files (comments will be lost)
  -i, --indent <n>     Indentation width (default: 2)
  --tabs               Use tabs for indentation
  --sort-from <n>      Depth to start sorting from (0=root, 1=children, etc.)
  --ignore <pattern>   Ignore files matching pattern (can be used multiple times)
  --no-gitignore       Don't respect .gitignore file
  -q, --quiet          Suppress output
  --verbose            Show detailed information (applied config per file)
  -h, --help           Show this help message
  -v, --version        Show version

Config file (.sortjsonrc.json):
  {
    "include": ["**/*.json"],
    "ignore": ["drizzle/migrations/**"],
    "sortFrom": 0,
    "files": {
      "package.json": { "sortFrom": 1 },
      "data/**/*.json": { "sortFrom": 0 }
    }
  }

Examples:
  sort-json                          # Uses config file settings
  sort-json config.json              # Sort specific file
  sort-json "**/*.json"              # Sort all JSON files
  sort-json --check "src/**/*.json"  # Check if files are sorted
  sort-json --verbose                # Show which config is applied
`);
}

function parseArgs(args: string[]): { options: Options; files: string[] } {
  const options: Options = {
    check: false,
    write: true,
    force: false,
    indent: 2,
    tabs: false,
    quiet: false,
    verbose: false,
    help: false,
    version: false,
    ignore: [],
    respectGitignore: true,
    sortFrom: null,
  };
  const files: string[] = [];

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    switch (arg) {
      case "-c":
      case "--check":
        options.check = true;
        options.write = false;
        break;
      case "-w":
      case "--write":
        options.write = true;
        break;
      case "-f":
      case "--force":
        options.force = true;
        break;
      case "-i":
      case "--indent":
        i++;
        options.indent = parseInt(args[i], 10) || 2;
        break;
      case "--tabs":
        options.tabs = true;
        break;
      case "--sort-from":
        i++;
        options.sortFrom = parseInt(args[i], 10) || 0;
        break;
      case "--ignore":
        i++;
        if (args[i]) {
          options.ignore.push(args[i]);
        }
        break;
      case "--no-gitignore":
        options.respectGitignore = false;
        break;
      case "-q":
      case "--quiet":
        options.quiet = true;
        break;
      case "--verbose":
        options.verbose = true;
        break;
      case "-h":
      case "--help":
        options.help = true;
        break;
      case "-v":
      case "--version":
        options.version = true;
        break;
      default:
        if (!arg.startsWith("-")) {
          files.push(arg);
        }
    }
    i++;
  }

  return { options, files };
}

async function processFile(
  file: string,
  options: ProcessOptions
): Promise<Result> {
  try {
    const content = await readFile(file);

    // Check for JSONC
    const isJsonc = detectJsonc(content);
    if (isJsonc && !options.force) {
      return {
        file,
        status: "skipped",
        message: "JSONC detected. Use --force to process (comments will be lost)",
      };
    }

    // Parse JSON
    let parsed: unknown;
    try {
      const jsonContent = isJsonc ? stripComments(content) : content;
      parsed = JSON.parse(jsonContent);
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      return {
        file,
        status: "error",
        message: `Parse error: ${error}`,
      };
    }

    // Sort keys with sortFrom depth
    const sorted = sortKeysFromDepth(parsed, options.sortFrom);

    // Format
    const formatted = formatJson(sorted, {
      indent: options.indent,
      useTabs: options.tabs,
    });

    // Check mode: compare with original
    if (options.check) {
      // Re-format original for fair comparison (ignore whitespace differences)
      const originalFormatted = formatJson(parsed, {
        indent: options.indent,
        useTabs: options.tabs,
      });

      if (formatted !== originalFormatted) {
        return {
          file,
          status: "changed",
          message: "Keys are not sorted",
        };
      }
      return { file, status: "success" };
    }

    // Write mode
    if (options.write) {
      await writeFile(file, formatted);
    }

    return { file, status: "success" };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return {
      file,
      status: "error",
      message: error,
    };
  }
}

function printResult(
  result: Result,
  quiet: boolean,
  verbose: boolean,
  verboseInfo?: { sortFrom: number; matchedPattern?: string }
): void {
  if (quiet && result.status === "success") {
    return;
  }

  const icon = {
    success: "\x1b[32m✓\x1b[0m",
    skipped: "\x1b[33m⚠\x1b[0m",
    error: "\x1b[31m✗\x1b[0m",
    changed: "\x1b[31m✗\x1b[0m",
  }[result.status];

  let message = result.message ? ` (${result.message})` : "";

  if (verbose && verboseInfo) {
    const configSource = verboseInfo.matchedPattern
      ? `pattern: "${verboseInfo.matchedPattern}"`
      : "default";
    message += ` \x1b[90m[sortFrom=${verboseInfo.sortFrom}, ${configSource}]\x1b[0m`;
  }

  console.log(`${icon} ${result.file}${message}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const { options, files: cliPatterns } = parseArgs(args);

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  if (options.version) {
    console.log(VERSION);
    process.exit(0);
  }

  // Load config file
  const config: Config = await loadConfig();

  // Determine patterns: CLI args override config
  const patterns =
    cliPatterns.length > 0 ? cliPatterns : config.include ?? ["**/*.json"];

  // Combine ignore patterns: CLI + config
  const ignorePatterns = [...options.ignore, ...(config.ignore ?? [])];

  // Expand glob patterns
  const files = await expandGlob(patterns, {
    ignore: ignorePatterns,
    respectGitignore: options.respectGitignore,
  });

  if (files.length === 0) {
    if (cliPatterns.length === 0) {
      console.error(
        "Error: No files found. Create .sortjsonrc.json or specify files."
      );
    } else {
      console.error("Error: No files found matching the patterns");
    }
    process.exit(1);
  }

  // Process files
  const results: Result[] = [];
  for (const file of files) {
    // Get file-specific config
    const fileConfig = getFileConfig(file, config);

    // Skip if file is marked as ignored in config
    if (fileConfig.ignore) {
      continue;
    }

    // Determine sortFrom: CLI > file config > global config
    const sortFrom = options.sortFrom ?? fileConfig.sortFrom;

    const processOptions: ProcessOptions = {
      check: options.check,
      write: options.write,
      force: options.force,
      indent: options.indent,
      tabs: options.tabs,
      sortFrom,
    };

    const result = await processFile(file, processOptions);
    results.push(result);
    printResult(result, options.quiet, options.verbose, {
      sortFrom,
      matchedPattern: fileConfig.matchedPattern,
    });
  }

  // Summary
  const successCount = results.filter((r) => r.status === "success").length;
  const skippedCount = results.filter((r) => r.status === "skipped").length;
  const errorCount = results.filter((r) => r.status === "error").length;
  const changedCount = results.filter((r) => r.status === "changed").length;

  if (!options.quiet) {
    console.log();
    const parts: string[] = [];
    if (successCount > 0) parts.push(`${successCount} sorted`);
    if (skippedCount > 0) parts.push(`${skippedCount} skipped`);
    if (errorCount > 0)
      parts.push(`${errorCount} error${errorCount > 1 ? "s" : ""}`);
    if (changedCount > 0) parts.push(`${changedCount} not sorted`);
    console.log(parts.join(", "));
  }

  // Exit code
  if (errorCount > 0 || changedCount > 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Fatal error:", e.message || e);
  process.exit(1);
});
