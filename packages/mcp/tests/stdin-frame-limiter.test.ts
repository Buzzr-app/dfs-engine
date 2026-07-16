import { finished } from 'node:stream/promises';
import { describe, expect, it } from 'vitest';

import {
  BoundedNewlineInput,
  MAX_STDIN_FRAME_BYTES,
  StdinFrameLimitError,
} from '../src/stdin-frame-limiter';

async function transformChunks(chunks: readonly Buffer[]) {
  const input = new BoundedNewlineInput();
  const output: Buffer[] = [];
  input.on('data', (chunk: Buffer) => output.push(chunk));

  const completion = finished(input).then(
    () => null,
    (error: unknown) => error,
  );
  for (const chunk of chunks) {
    if (!input.destroyed) {
      input.write(chunk);
    }
  }
  input.end();

  return {
    output: Buffer.concat(output),
    error: await completion,
  };
}

describe('BoundedNewlineInput', () => {
  it('accepts an exact-limit newline-delimited frame', async () => {
    const payload = Buffer.alloc(MAX_STDIN_FRAME_BYTES, 0x61);
    const result = await transformChunks([payload, Buffer.from('\n')]);

    expect(result.error).toBeNull();
    expect(result.output).toEqual(Buffer.concat([payload, Buffer.from('\n')]));
  });

  it('buffers split chunks by reference until the newline arrives', async () => {
    const result = await transformChunks([
      Buffer.from('{"jsonrpc":"2.0",'),
      Buffer.from('"id":1}'),
      Buffer.from('\n'),
    ]);

    expect(result.error).toBeNull();
    expect(result.output.toString()).toBe('{"jsonrpc":"2.0","id":1}\n');
  });

  it('accepts an exact-limit CRLF frame without counting the carriage return', async () => {
    const payload = Buffer.alloc(MAX_STDIN_FRAME_BYTES, 0x62);
    const result = await transformChunks([payload, Buffer.from('\r'), Buffer.from('\n')]);

    expect(result.error).toBeNull();
    expect(result.output).toEqual(Buffer.concat([payload, Buffer.from('\r\n')]));
  });

  it('emits multiple complete frames from one input chunk', async () => {
    const result = await transformChunks([Buffer.from('{"id":1}\n{"id":2}\r\n')]);

    expect(result.error).toBeNull();
    expect(result.output.toString()).toBe('{"id":1}\n{"id":2}\r\n');
  });

  it('rejects a frame one byte over the limit', async () => {
    const result = await transformChunks([
      Buffer.alloc(MAX_STDIN_FRAME_BYTES + 1, 0x63),
      Buffer.from('\n'),
    ]);

    expect(result.error).toBeInstanceOf(StdinFrameLimitError);
    expect(result.output).toHaveLength(0);
  });

  it('discards an incomplete final frame at EOF', async () => {
    const result = await transformChunks([Buffer.from('{"jsonrpc":')]);

    expect(result.error).toBeNull();
    expect(result.output).toHaveLength(0);
  });
});
