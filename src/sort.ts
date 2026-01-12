/**
 * Recursively sorts all keys in a JSON value.
 * - Objects: keys are sorted alphabetically
 * - Arrays: elements are recursively sorted (order preserved)
 * - Primitives: returned as-is
 */
export function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, val]) => [key, sortKeys(val)])
    );
  }

  return value;
}

/**
 * Sorts keys at top level only (non-recursive).
 */
export function sortKeysShallow(value: unknown): unknown {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
    );
  }

  return value;
}

/**
 * Sorts keys starting from a specific depth.
 * @param value - The JSON value to sort
 * @param sortFrom - Depth to start sorting from (0 = root, 1 = first level children, etc.)
 * @param currentDepth - Current depth (used internally for recursion)
 */
export function sortKeysFromDepth(
  value: unknown,
  sortFrom: number,
  currentDepth: number = 0
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortKeysFromDepth(item, sortFrom, currentDepth));
  }

  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value);

    // Sort entries if we're at or past the sortFrom depth
    const processedEntries = currentDepth >= sortFrom
      ? entries.sort(([a], [b]) => a.localeCompare(b))
      : entries;

    return Object.fromEntries(
      processedEntries.map(([key, val]) => [
        key,
        sortKeysFromDepth(val, sortFrom, currentDepth + 1),
      ])
    );
  }

  return value;
}

/**
 * Formats a JSON value with the specified indentation.
 * Always appends a trailing newline.
 */
export function formatJson(
  value: unknown,
  options: { indent?: number; useTabs?: boolean } = {}
): string {
  const { indent = 2, useTabs = false } = options;
  const indentStr = useTabs ? "\t" : " ".repeat(indent);
  return JSON.stringify(value, null, indentStr) + "\n";
}

/**
 * Checks if the content appears to be JSONC (JSON with Comments).
 * This is a simple heuristic check, not a full parser.
 */
export function detectJsonc(content: string): boolean {
  // Remove strings to avoid false positives
  const withoutStrings = content.replace(/"(?:[^"\\]|\\.)*"/g, '""');

  // Check for // or /* comments
  return /\/\/|\/\*/.test(withoutStrings);
}

/**
 * Strips comments from JSONC content.
 * WARNING: This is destructive - comments will be lost.
 */
export function stripComments(content: string): string {
  let result = "";
  let i = 0;
  let inString = false;
  let escaped = false;

  while (i < content.length) {
    const char = content[i];
    const next = content[i + 1];

    if (inString) {
      result += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      i++;
      continue;
    }

    if (char === '"') {
      inString = true;
      result += char;
      i++;
      continue;
    }

    // Single-line comment
    if (char === "/" && next === "/") {
      while (i < content.length && content[i] !== "\n") {
        i++;
      }
      continue;
    }

    // Multi-line comment
    if (char === "/" && next === "*") {
      i += 2;
      while (i < content.length - 1) {
        if (content[i] === "*" && content[i + 1] === "/") {
          i += 2;
          break;
        }
        i++;
      }
      continue;
    }

    result += char;
    i++;
  }

  return result;
}
