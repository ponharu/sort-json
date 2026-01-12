#!/usr/bin/env node
/**
 * sort-json CLI
 * Fast JSON key sorter - Bun-optimized, Node.js compatible
 */

import { readFile, writeFile, expandGlob } from "./io.js";
import {
  sortKeys,
  sortKeysShallow,
  formatJson,
  detectJsonc,
  stripComments,
} from "./sort.js";

const VERSION = "0.1.0";

interface Options {
  check: boolean;
  write: boolean;
  force: boolean;
  indent: number;
  tabs: boolean;
  deep: boolean;
  quiet: boolean;
  help: boolean;
  version: boolean;
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
  sort-json [options] <files...>

Arguments:
  files                JSON files to sort (glob patterns supported)

Options:
  -c, --check          Check if files are sorted (exit 1 if not)
  -w, --write          Write changes to files (default: true)
  -f, --force          Force processing of JSONC files (comments will be lost)
  -i, --indent <n>     Indentation width (default: 2)
  --tabs               Use tabs for indentation
  --no-deep            Sort top-level keys only
  -q, --quiet          Suppress output
  -h, --help           Show this help message
  -v, --version        Show version

Examples:
  sort-json config.json
  sort-json "**/*.json"
  sort-json --check "src/**/*.json"
  sort-json --force tsconfig.json
`);
}

function parseArgs(args: string[]): { options: Options; files: string[] } {
  const options: Options = {
    check: false,
    write: true,
    force: false,
    indent: 2,
    tabs: false,
    deep: true,
    quiet: false,
    help: false,
    version: false,
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
      case "--no-deep":
        options.deep = false;
        break;
      case "-q":
      case "--quiet":
        options.quiet = true;
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
  options: Options
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

    // Sort keys
    const sorted = options.deep ? sortKeys(parsed) : sortKeysShallow(parsed);

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

function printResult(result: Result, quiet: boolean): void {
  if (quiet && result.status === "success") {
    return;
  }

  const icon = {
    success: "\x1b[32m✓\x1b[0m",
    skipped: "\x1b[33m⚠\x1b[0m",
    error: "\x1b[31m✗\x1b[0m",
    changed: "\x1b[31m✗\x1b[0m",
  }[result.status];

  const message = result.message ? ` (${result.message})` : "";
  console.log(`${icon} ${result.file}${message}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const { options, files: patterns } = parseArgs(args);

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  if (options.version) {
    console.log(VERSION);
    process.exit(0);
  }

  if (patterns.length === 0) {
    console.error("Error: No files specified");
    console.error('Run "sort-json --help" for usage');
    process.exit(1);
  }

  // Expand glob patterns
  const files = await expandGlob(patterns);

  if (files.length === 0) {
    console.error("Error: No files found matching the patterns");
    process.exit(1);
  }

  // Process files
  const results: Result[] = [];
  for (const file of files) {
    const result = await processFile(file, options);
    results.push(result);
    printResult(result, options.quiet);
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
    if (errorCount > 0) parts.push(`${errorCount} error${errorCount > 1 ? "s" : ""}`);
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
