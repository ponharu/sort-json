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

export interface SortOptions {
  sortFrom: number;
  sortOrder?: string[];
}

/**
 * Sorts keys starting from a specific depth with optional custom order.
 * @param value - The JSON value to sort
 * @param options - Sort options (sortFrom, sortOrder)
 * @param currentDepth - Current depth (used internally for recursion)
 */
export function sortKeysFromDepth(
  value: unknown,
  options: SortOptions | number,
  currentDepth: number = 0
): unknown {
  // Support legacy signature (sortFrom as number)
  const { sortFrom, sortOrder } =
    typeof options === "number" ? { sortFrom: options, sortOrder: undefined } : options;

  if (Array.isArray(value)) {
    return value.map((item) =>
      sortKeysFromDepth(item, { sortFrom, sortOrder: undefined }, currentDepth)
    );
  }

  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value);

    let processedEntries: [string, unknown][];

    if (currentDepth >= sortFrom) {
      // Use custom sort order at root level (depth 0) if provided
      if (currentDepth === 0 && sortOrder && sortOrder.length > 0) {
        processedEntries = sortEntriesWithCustomOrder(entries, sortOrder);
      } else {
        processedEntries = entries.sort(([a], [b]) => a.localeCompare(b));
      }
    } else {
      processedEntries = entries;
    }

    return Object.fromEntries(
      processedEntries.map(([key, val]) => [
        key,
        sortKeysFromDepth(val, { sortFrom, sortOrder: undefined }, currentDepth + 1),
      ])
    );
  }

  return value;
}

/**
 * Sorts entries with custom key order.
 * Keys in sortOrder come first in that order, remaining keys are sorted alphabetically.
 */
function sortEntriesWithCustomOrder(
  entries: [string, unknown][],
  sortOrder: string[]
): [string, unknown][] {
  const orderMap = new Map(sortOrder.map((key, index) => [key, index]));

  return entries.sort(([a], [b]) => {
    const aIndex = orderMap.get(a);
    const bIndex = orderMap.get(b);

    // Both in sortOrder: sort by order index
    if (aIndex !== undefined && bIndex !== undefined) {
      return aIndex - bIndex;
    }

    // Only a in sortOrder: a comes first
    if (aIndex !== undefined) {
      return -1;
    }

    // Only b in sortOrder: b comes first
    if (bIndex !== undefined) {
      return 1;
    }

    // Neither in sortOrder: sort alphabetically
    return a.localeCompare(b);
  });
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
