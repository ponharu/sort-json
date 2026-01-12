#!/usr/bin/env bun
/**
 * Generates schema.json from TypeBox schema definition
 */

import { writeFileSync } from "fs";
import { join } from "path";
import { ConfigSchema } from "../src/schema.js";

const schema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  ...ConfigSchema,
};

const outPath = join(import.meta.dir, "..", "schema.json");
writeFileSync(outPath, JSON.stringify(schema, null, 2) + "\n");
console.log(`Generated: ${outPath}`);
