/**
 * sort-json
 * Fast JSON key sorter - Bun-optimized, Node.js compatible
 *
 * @packageDocumentation
 */

export { sortKeys, sortKeysShallow, formatJson, detectJsonc, stripComments } from "./sort.js";
export { readFile, writeFile, expandGlob, isBun } from "./io.js";
