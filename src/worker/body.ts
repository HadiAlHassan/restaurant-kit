import { RequestError } from "./http";

/**
 * Reads a request body, failing with 413 as soon as it exceeds `maxBytes`. Checks Content-Length
 * first, then counts streamed bytes so a chunked body without the header can't slip past.
 */
export async function readBodyWithLimit(request: Request, maxBytes: number): Promise<Uint8Array<ArrayBuffer>> {
  const tooLarge = () => new RequestError(`Request body is too large (max ${maxBytes} bytes).`, 413);
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw tooLarge();
  if (!request.body) return new Uint8Array(new ArrayBuffer(0));

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw tooLarge();
    }
    chunks.push(value);
  }
  const body = new Uint8Array(new ArrayBuffer(total));
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}
