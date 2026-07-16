import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import { defineTool, errorResult, jsonResult } from '../src/tools/shared';
import type { ToolResult } from '../src/tools/shared';

function parseResult(result: ToolResult): Record<string, unknown> {
  expect(result.content).toHaveLength(1);
  return JSON.parse(result.content[0].text) as Record<string, unknown>;
}

describe('tool handler safety boundary', () => {
  it('returns a stable public error without exposing thrown internals', async () => {
    const tool = defineTool({
      name: 'throws_secret',
      title: 'Throws secret',
      description: 'Test-only tool.',
      inputSchema: z.object({}),
      run: () => {
        throw new TypeError('database password was hunter2');
      },
    });

    const result = await tool.handler({});
    const error = parseResult(result).error as Record<string, unknown>;

    expect(result.isError).toBe(true);
    expect(error).toEqual({
      code: 'tool_execution_failed',
      message: 'Tool execution failed.',
    });
    expect(result.content[0].text).not.toContain('hunter2');
    expect(result.content[0].text).not.toContain('TypeError');
  });

  it('caps and normalizes schema-validation details', async () => {
    const tool = defineTool({
      name: 'bounded_validation',
      title: 'Bounded validation',
      description: 'Test-only tool.',
      inputSchema: z.object({
        values: z.array(z.string().max(1)).max(4),
      }),
      run: () => jsonResult({ ok: true }),
    });

    const result = await tool.handler({ values: Array.from({ length: 50 }, () => 'too-long') });
    const error = parseResult(result).error as Record<string, unknown>;
    const details = error.details as Array<Record<string, unknown>>;

    expect(details.length).toBeLessThanOrEqual(8);
    for (const detail of details) {
      expect(Object.keys(detail).sort()).toEqual(['code', 'message', 'path']);
      expect(String(detail.message).length).toBeLessThanOrEqual(200);
      expect((detail.path as unknown[]).length).toBeLessThanOrEqual(8);
    }
  });

  it('rejects a serialized tool result larger than one MiB', async () => {
    const tool = defineTool({
      name: 'oversized_result',
      title: 'Oversized result',
      description: 'Test-only tool.',
      inputSchema: z.object({}),
      run: () => jsonResult({ payload: 'x'.repeat(1_048_576) }),
    });

    const result = await tool.handler({});

    expect(result.isError).toBe(true);
    expect(parseResult(result).error).toEqual({
      code: 'result_too_large',
      message: 'Tool result exceeded the maximum response size.',
    });
    expect(result.content[0].text).not.toContain('xxxxx');
  });

  it('applies the response cap to exported error details too', () => {
    const result = errorResult('upstream_failed', 'Upstream failed.', {
      debug: 'secret'.repeat(200_000),
    });

    expect(result.isError).toBe(true);
    expect(parseResult(result).error).toEqual({
      code: 'result_too_large',
      message: 'Tool result exceeded the maximum response size.',
    });
    expect(result.content[0].text).not.toContain('secret');
  });

  it('allows 32 in-flight calls and rejects the next until capacity returns', async () => {
    const releases: Array<() => void> = [];
    const tool = defineTool({
      name: 'bounded_concurrency',
      title: 'Bounded concurrency',
      description: 'Test-only tool.',
      inputSchema: z.object({ index: z.number().int() }),
      run: async ({ index }) => {
        await new Promise<void>((resolve) => releases.push(resolve));
        return jsonResult({ index });
      },
    });

    const accepted = Array.from({ length: 32 }, (_, index) => tool.handler({ index }));
    await Promise.resolve();

    const rejected = await tool.handler({ index: 32 });
    expect(rejected.isError).toBe(true);
    expect(parseResult(rejected).error).toEqual({
      code: 'server_busy',
      message: 'The server is handling too many requests. Retry later.',
    });

    for (const release of releases) {
      release();
    }
    const completed = await Promise.all(accepted);
    expect(completed.every((result) => result.isError === undefined)).toBe(true);

    const recovered = tool.handler({ index: 33 });
    await Promise.resolve();
    releases.at(-1)?.();
    expect((parseResult(await recovered).index as number) ?? -1).toBe(33);
  });

  it('shares the 32-call limit across distinct tool definitions', async () => {
    const releases: Array<() => void> = [];
    const buildHeldTool = (name: string) =>
      defineTool({
        name,
        title: name,
        description: 'Test-only tool.',
        inputSchema: z.object({ index: z.number().int() }),
        run: async ({ index }) => {
          await new Promise<void>((resolve) => releases.push(resolve));
          return jsonResult({ index });
        },
      });
    const firstTool = buildHeldTool('global_limit_first');
    const secondTool = buildHeldTool('global_limit_second');

    const accepted = [
      ...Array.from({ length: 20 }, (_, index) => firstTool.handler({ index })),
      ...Array.from({ length: 12 }, (_, index) => secondTool.handler({ index: index + 20 })),
    ];
    await Promise.resolve();

    const extraCall = secondTool.handler({ index: 32 });
    let observed: ToolResult | null = null;
    try {
      observed = await Promise.race([
        extraCall,
        new Promise<null>((resolve) => setImmediate(() => resolve(null))),
      ]);

      expect(observed).not.toBeNull();
      expect(observed?.isError).toBe(true);
      expect(parseResult(observed as ToolResult).error).toEqual({
        code: 'server_busy',
        message: 'The server is handling too many requests. Retry later.',
      });
    } finally {
      for (const release of releases) {
        release();
      }
      await Promise.all([...accepted, extraCall]);
    }
  });
});
