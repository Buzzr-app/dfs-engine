import { Transform } from 'node:stream';
import type { TransformCallback } from 'node:stream';

const CARRIAGE_RETURN = 0x0d;
const NEWLINE = 0x0a;
const NEWLINE_BUFFER = Buffer.from('\n');

export const MAX_STDIN_FRAME_BYTES = 2 * 1_024 * 1_024;

export class StdinFrameLimitError extends Error {
  override readonly name = 'StdinFrameLimitError';

  constructor() {
    super('Input frame exceeded the configured limit.');
  }
}

/**
 * Holds chunk slices until a newline arrives, then emits one complete frame.
 * This bounds the SDK's downstream ReadBuffer and avoids repeated concatenation
 * while a frame is still arriving.
 */
export class BoundedNewlineInput extends Transform {
  private chunks: Buffer[] = [];
  private bufferedBytes = 0;

  override _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
    let offset = 0;

    while (offset < chunk.length) {
      const newlineIndex = chunk.indexOf(NEWLINE, offset);
      if (newlineIndex === -1) {
        this.appendReference(chunk.subarray(offset));
        if (this.exceedsPendingLimit()) {
          this.reject(callback);
          return;
        }
        callback();
        return;
      }

      this.appendReference(chunk.subarray(offset, newlineIndex));
      if (this.framePayloadBytes() > MAX_STDIN_FRAME_BYTES) {
        this.reject(callback);
        return;
      }

      this.push(Buffer.concat([...this.chunks, NEWLINE_BUFFER], this.bufferedBytes + 1));
      this.reset();
      offset = newlineIndex + 1;
    }

    callback();
  }

  override _flush(callback: TransformCallback): void {
    // MCP stdio requires newline-delimited JSON. An incomplete EOF frame is
    // intentionally discarded and never reaches the SDK's parser.
    this.reset();
    callback();
  }

  private appendReference(chunk: Buffer): void {
    if (chunk.length === 0) {
      return;
    }
    this.chunks.push(chunk);
    this.bufferedBytes += chunk.length;
  }

  private exceedsPendingLimit(): boolean {
    const allowance = this.endsWithCarriageReturn() ? 1 : 0;
    return this.bufferedBytes > MAX_STDIN_FRAME_BYTES + allowance;
  }

  private framePayloadBytes(): number {
    return this.bufferedBytes - (this.endsWithCarriageReturn() ? 1 : 0);
  }

  private endsWithCarriageReturn(): boolean {
    const finalChunk = this.chunks.at(-1);
    return finalChunk !== undefined && finalChunk.at(-1) === CARRIAGE_RETURN;
  }

  private reject(callback: TransformCallback): void {
    this.reset();
    callback(new StdinFrameLimitError());
  }

  private reset(): void {
    this.chunks = [];
    this.bufferedBytes = 0;
  }
}
