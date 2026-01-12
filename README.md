# @ponharu/sort-json

[![npm version](https://img.shields.io/npm/v/@ponharu/sort-json.svg)](https://www.npmjs.com/package/@ponharu/sort-json)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Bun](https://img.shields.io/badge/Bun-%3E%3D1.0-black)](https://bun.sh)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-green)](https://nodejs.org)

Fast JSON key sorter - Bun-optimized, Node.js compatible.

## Features

- **Fast**: Uses Bun APIs when available (1.5-2x faster JSON parsing)
- **Compatible**: Falls back to Node.js when Bun is not available
- **Zero config**: Works out of the box
- **CI-friendly**: `--check` mode for validation
- **Glob support**: Process multiple files with patterns
- **Safe JSONC handling**: Skips files with comments by default to prevent data loss

## Why not...?

| Tool                        | Issue                             |
| --------------------------- | --------------------------------- |
| `prettier-plugin-sort-json` | Requires Prettier (heavy)         |
| `jq -S`                     | No in-place edit, no glob support |
| `json-sort-cli`             | Node.js only, slower startup      |

## Installation

```bash
# npm
npm install -g @ponharu/sort-json

# bun
bun add -g @ponharu/sort-json

# pnpm
pnpm add -g @ponharu/sort-json
```

## Usage

### Basic

```bash
# Sort a single file
sort-json config.json

# Sort multiple files
sort-json "**/*.json"

# Sort with glob patterns
sort-json "src/**/*.json" "config/*.json"
```

### Check Mode (CI)

```bash
# Check if files are sorted (exit 1 if not)
sort-json --check "**/*.json"
```

### JSONC Files

By default, files with comments (JSONC) are skipped to prevent data loss.

```bash
# Force processing JSONC (comments will be removed)
sort-json --force tsconfig.json
```

### Options

```
Options:
  -c, --check          Check if files are sorted (exit 1 if not)
  -w, --write          Write changes to files (default: true)
  -f, --force          Force processing of JSONC files (comments will be lost)
  -i, --indent <n>     Indentation width (default: 2)
  --tabs               Use tabs for indentation
  --no-deep            Sort top-level keys only
  -q, --quiet          Suppress output
  -h, --help           Show help message
  -v, --version        Show version
```

## Integration

### lefthook

```yaml
# lefthook.yml
pre-commit:
    commands:
        sort-json:
            glob: "*.json"
            exclude: "package-lock.json"
            run: sort-json {staged_files}
```

### husky + lint-staged

```json
{
    "lint-staged": {
        "*.json": "sort-json"
    }
}
```

### GitHub Actions

```yaml
- name: Check JSON format
  run: npx @ponharu/sort-json --check "**/*.json"
```

## Exit Codes

| Code | Description                      |
| ---- | -------------------------------- |
| `0`  | All files processed successfully |
| `1`  | Check failed or error occurred   |

## Programmatic API

```typescript
import { sortKeys, formatJson } from "@ponharu/sort-json";

const data = { z: 1, a: 2, m: { c: 3, b: 4 } };
const sorted = sortKeys(data);
// { a: 2, m: { b: 4, c: 3 }, z: 1 }

const json = formatJson(sorted, { indent: 2 });
// Formatted JSON string with trailing newline
```

## License

MIT
