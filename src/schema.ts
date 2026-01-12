/**
 * Configuration schema using TypeBox
 * This is the single source of truth for both TypeScript types and JSON Schema
 */

import { Type, type Static } from "@sinclair/typebox";

export const FileConfigSchema = Type.Object(
  {
    sortFrom: Type.Optional(
      Type.Integer({
        minimum: 0,
        description: "Depth to start sorting from for this file pattern",
      })
    ),
    ignore: Type.Optional(
      Type.Boolean({
        default: false,
        description: "Whether to ignore files matching this pattern",
      })
    ),
  },
  { additionalProperties: false }
);

export const ConfigSchema = Type.Object(
  {
    $schema: Type.Optional(
      Type.String({
        description: "JSON Schema URL",
      })
    ),
    include: Type.Optional(
      Type.Array(Type.String(), {
        default: ["**/*.json"],
        description: "Glob patterns for files to include",
      })
    ),
    ignore: Type.Optional(
      Type.Array(Type.String(), {
        default: [],
        description: "Glob patterns for files to ignore",
      })
    ),
    sortFrom: Type.Optional(
      Type.Integer({
        minimum: 0,
        default: 1,
        description:
          "Depth to start sorting from (0 = root, 1 = first level children, etc.)",
      })
    ),
    files: Type.Optional(
      Type.Record(Type.String(), FileConfigSchema, {
        description:
          "Per-file configuration overrides (glob pattern -> config)",
      })
    ),
  },
  {
    additionalProperties: false,
    title: "sort-json configuration",
    description: "Configuration file for @ponharu/sort-json",
  }
);

export type FileConfig = Static<typeof FileConfigSchema>;
export type Config = Static<typeof ConfigSchema>;
