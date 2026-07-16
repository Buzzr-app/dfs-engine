import type { z } from 'zod';

const MAX_IN_FLIGHT_CALLS = 32;
const MAX_VALIDATION_ISSUES = 8;
const MAX_VALIDATION_MESSAGE_LENGTH = 200;
const MAX_VALIDATION_PATH_SEGMENTS = 8;
const MAX_VALIDATION_PATH_STRING_LENGTH = 64;
const MAX_TOOL_RESULT_BYTES = 1_048_576;
let processWideInFlightCalls = 0;
const RESULT_SERIALIZATION_FAILED = {
  error: {
    code: 'result_serialization_failed',
    message: 'Tool result could not be serialized.',
  },
};
const RESULT_TOO_LARGE = {
  error: {
    code: 'result_too_large',
    message: 'Tool result exceeded the maximum response size.',
  },
};

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

function fixedErrorResult(value: typeof RESULT_SERIALIZATION_FAILED | typeof RESULT_TOO_LARGE) {
  return {
    isError: true,
    content: [{ type: 'text' as const, text: JSON.stringify(value) }],
  };
}

function serializeResult(value: unknown, isError = false): ToolResult {
  let text: string | undefined;
  try {
    text = JSON.stringify(value);
  } catch {
    return fixedErrorResult(RESULT_SERIALIZATION_FAILED);
  }
  if (text === undefined) {
    return fixedErrorResult(RESULT_SERIALIZATION_FAILED);
  }
  if (Buffer.byteLength(text, 'utf8') > MAX_TOOL_RESULT_BYTES) {
    return fixedErrorResult(RESULT_TOO_LARGE);
  }
  return {
    ...(isError ? { isError: true } : {}),
    content: [{ type: 'text', text }],
  };
}

/** Wraps a value as compact JSON text content. */
export function jsonResult(value: unknown): ToolResult {
  return serializeResult(value);
}

/** Wraps an error code + message (and optional details) as an MCP error result. */
export function errorResult(code: string, message: string, details?: unknown): ToolResult {
  const error: Record<string, unknown> = { code, message };
  if (details !== undefined) {
    error.details = details;
  }
  return serializeResult({ error }, true);
}

function normalizeValidationIssues(issues: readonly z.core.$ZodIssue[]) {
  return issues.slice(0, MAX_VALIDATION_ISSUES).map((issue) => ({
    code: String(issue.code).slice(0, 64),
    path: issue.path
      .slice(0, MAX_VALIDATION_PATH_SEGMENTS)
      .map((segment) =>
        typeof segment === 'number'
          ? segment
          : String(segment).slice(0, MAX_VALIDATION_PATH_STRING_LENGTH),
      ),
    message: issue.message.slice(0, MAX_VALIDATION_MESSAGE_LENGTH),
  }));
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
      if (processWideInFlightCalls >= MAX_IN_FLIGHT_CALLS) {
        return errorResult('server_busy', 'The server is handling too many requests. Retry later.');
      }

      processWideInFlightCalls += 1;
      try {
        const parsed = definition.inputSchema.safeParse(args ?? {});
        if (!parsed.success) {
          return errorResult(
            'invalid_input',
            `${definition.name}: input failed schema validation.`,
            normalizeValidationIssues(parsed.error.issues),
          );
        }
        return await definition.run(parsed.data as z.output<Schema>);
      } catch {
        return errorResult('tool_execution_failed', 'Tool execution failed.');
      } finally {
        processWideInFlightCalls -= 1;
      }
    },
  };
}
