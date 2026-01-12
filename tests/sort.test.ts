import { describe, expect, it } from "bun:test";
import {
  sortKeys,
  sortKeysShallow,
  formatJson,
  detectJsonc,
  stripComments,
} from "../src/sort";

describe("sortKeys", () => {
  it("should sort object keys alphabetically", () => {
    const input = { z: 1, a: 2, m: 3 };
    const result = sortKeys(input);
    expect(Object.keys(result as object)).toEqual(["a", "m", "z"]);
  });

  it("should sort nested objects recursively", () => {
    const input = {
      z: { c: 1, a: 2 },
      a: { z: 1, b: 2 },
    };
    const result = sortKeys(input) as Record<string, Record<string, number>>;

    expect(Object.keys(result)).toEqual(["a", "z"]);
    expect(Object.keys(result.a)).toEqual(["b", "z"]);
    expect(Object.keys(result.z)).toEqual(["a", "c"]);
  });

  it("should preserve array order but sort objects inside arrays", () => {
    const input = [{ z: 1, a: 2 }, { c: 3, b: 4 }];
    const result = sortKeys(input) as Array<Record<string, number>>;

    expect(result.length).toBe(2);
    expect(Object.keys(result[0])).toEqual(["a", "z"]);
    expect(Object.keys(result[1])).toEqual(["b", "c"]);
  });

  it("should handle primitives", () => {
    expect(sortKeys("string")).toBe("string");
    expect(sortKeys(123)).toBe(123);
    expect(sortKeys(true)).toBe(true);
    expect(sortKeys(null)).toBe(null);
  });

  it("should handle empty objects and arrays", () => {
    expect(sortKeys({})).toEqual({});
    expect(sortKeys([])).toEqual([]);
  });

  it("should handle deeply nested structures", () => {
    const input = {
      z: {
        nested: {
          deep: { c: 1, a: 2, b: 3 },
        },
      },
    };
    const result = sortKeys(input) as any;
    expect(Object.keys(result.z.nested.deep)).toEqual(["a", "b", "c"]);
  });
});

describe("sortKeysShallow", () => {
  it("should sort only top-level keys", () => {
    const input = {
      z: { c: 1, a: 2 },
      a: { z: 1, b: 2 },
    };
    const result = sortKeysShallow(input) as Record<string, Record<string, number>>;

    expect(Object.keys(result)).toEqual(["a", "z"]);
    // Nested objects should NOT be sorted
    expect(Object.keys(result.a)).toEqual(["z", "b"]);
    expect(Object.keys(result.z)).toEqual(["c", "a"]);
  });

  it("should return non-objects as-is", () => {
    expect(sortKeysShallow([1, 2, 3])).toEqual([1, 2, 3]);
    expect(sortKeysShallow("string")).toBe("string");
    expect(sortKeysShallow(null)).toBe(null);
  });
});

describe("formatJson", () => {
  it("should format with 2 spaces by default", () => {
    const input = { a: 1 };
    const result = formatJson(input);
    expect(result).toBe('{\n  "a": 1\n}\n');
  });

  it("should format with custom indent", () => {
    const input = { a: 1 };
    const result = formatJson(input, { indent: 4 });
    expect(result).toBe('{\n    "a": 1\n}\n');
  });

  it("should format with tabs", () => {
    const input = { a: 1 };
    const result = formatJson(input, { useTabs: true });
    expect(result).toBe('{\n\t"a": 1\n}\n');
  });

  it("should always include trailing newline", () => {
    expect(formatJson({})).toEndWith("\n");
    expect(formatJson([])).toEndWith("\n");
    expect(formatJson("string")).toEndWith("\n");
  });
});

describe("detectJsonc", () => {
  it("should detect single-line comments", () => {
    const content = '{\n  // comment\n  "a": 1\n}';
    expect(detectJsonc(content)).toBe(true);
  });

  it("should detect multi-line comments", () => {
    const content = '{\n  /* comment */\n  "a": 1\n}';
    expect(detectJsonc(content)).toBe(true);
  });

  it("should not detect // inside strings", () => {
    const content = '{"url": "https://example.com"}';
    expect(detectJsonc(content)).toBe(false);
  });

  it("should return false for plain JSON", () => {
    const content = '{"a": 1, "b": 2}';
    expect(detectJsonc(content)).toBe(false);
  });
});

describe("stripComments", () => {
  it("should strip single-line comments", () => {
    const input = '{\n  // comment\n  "a": 1\n}';
    const result = stripComments(input);
    expect(result).not.toContain("//");
    expect(JSON.parse(result)).toEqual({ a: 1 });
  });

  it("should strip multi-line comments", () => {
    const input = '{\n  /* multi\n     line */\n  "a": 1\n}';
    const result = stripComments(input);
    expect(result).not.toContain("/*");
    expect(result).not.toContain("*/");
    expect(JSON.parse(result)).toEqual({ a: 1 });
  });

  it("should preserve // inside strings", () => {
    const input = '{"url": "https://example.com"}';
    const result = stripComments(input);
    expect(JSON.parse(result)).toEqual({ url: "https://example.com" });
  });

  it("should handle escaped quotes in strings", () => {
    const input = '{"text": "say \\"hello\\""}';
    const result = stripComments(input);
    expect(JSON.parse(result)).toEqual({ text: 'say "hello"' });
  });
});
