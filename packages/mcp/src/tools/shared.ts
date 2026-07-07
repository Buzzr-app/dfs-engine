import type { z } from 'zod';

/** Text content block returned to MCP clients. */
export type ToolTextContent = {
  type: 'text';
  text: string;
};

/** Result shape every @buzzr/mcp tool handler resolves with. */
export type ToolResult = {
  content: ToolTextContent[];
  isError?: boolean;
};

/** A fully-described MCP tool: schema for clients, handler for calls. */
export type BuzzrToolDefinition = {
  name: string;
  title: string;
  description: string;
  inputSchema: z.ZodType;
  handler: (args: unknown) => Promise<ToolResult>;
};

/** Wraps a value as pretty-printed JSON text content. */
export function jsonResult(value: unknown): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
  };
}

/** Wraps an error code + message (and optional details) as an MCP error result. */
export function errorResult(code: string, message: string, details?: unknown): ToolResult {
  const error: Record<string, unknown> = { code, message };
  if (details !== undefined) {
    error.details = details;
  }
  return {
    isError: true,
    content: [{ type: 'text', text: JSON.stringify({ error }, null, 2) }],
  };
}

/**
 * Builds a tool definition whose handler validates raw arguments against the
 * zod schema before running, and converts thrown errors into MCP error
 * results instead of propagating them to the transport.
 */
export function defineTool<Schema extends z.ZodType>(definition: {
  name: string;
  title: string;
  description: string;
  inputSchema: Schema;
  run: (input: z.output<Schema>) => Promise<ToolResult> | ToolResult;
}): BuzzrToolDefinition {
  return {
    name: definition.name,
    title: definition.title,
    description: definition.description,
    inputSchema: definition.inputSchema,
    handler: async (args: unknown): Promise<ToolResult> => {
      const parsed = definition.inputSchema.safeParse(args ?? {});
      if (!parsed.success) {
        return errorResult(
          'invalid_input',
          `${definition.name}: input failed schema validation.`,
          parsed.error.issues,
        );
      }
      try {
        return await definition.run(parsed.data as z.output<Schema>);
      } catch (error) {
        return errorResult(
          'tool_execution_failed',
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  };
}
