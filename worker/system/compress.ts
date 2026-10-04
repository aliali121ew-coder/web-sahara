/** ضغط وفك ضغط gzip وبصمة SHA-256 (واجهات الويب القياسية المتوفرة في Workers) */

const collect = async (stream: ReadableStream<Uint8Array>): Promise<Uint8Array<ArrayBuffer>> => {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const out = new Uint8Array(chunks.reduce((a, c) => a + c.length, 0));
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
};

export const gzipBytes = (data: Uint8Array<ArrayBuffer>) =>
  collect(new Blob([data]).stream().pipeThrough(new CompressionStream('gzip')) as ReadableStream<Uint8Array>);

export const gzipText = (text: string) => gzipBytes(new TextEncoder().encode(text));
export const gzipJson = (value: unknown) => gzipText(JSON.stringify(value));

export const gunzipText = async (data: Uint8Array<ArrayBuffer> | ArrayBuffer) =>
  new TextDecoder().decode(await collect(new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip')) as ReadableStream<Uint8Array>));

export const sha256Hex = async (data: Uint8Array<ArrayBuffer> | string) => {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(d, x => x.toString(16).padStart(2, '0')).join('');
};
