/**
 * أنواع منصة Cloudflare المستخدمة في الخادم (الجزء الذي نحتاجه فقط، بدل حزمة الأنواع الكاملة).
 */

export interface D1Meta { duration?: number; size_after?: number; rows_read?: number; rows_written?: number; changes?: number }
export interface D1Result<T> { results: T[]; meta?: D1Meta }
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<{ meta?: D1Meta }>;
}
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<unknown>;
  exec(query: string): Promise<unknown>;
}

export interface R2Object {
  key: string;
  size: number;
  uploaded: Date;
  httpMetadata?: { contentType?: string };
  customMetadata?: Record<string, string>;
}
export interface R2ObjectBody extends R2Object {
  body: ReadableStream;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
}
export interface R2PutOptions {
  httpMetadata?: { contentType?: string };
  customMetadata?: Record<string, string>;
}
export interface R2Objects { objects: R2Object[]; truncated: boolean; cursor?: string }
export interface R2Bucket {
  put(key: string, value: ArrayBuffer | ArrayBufferView | string | Blob | ReadableStream | null, options?: R2PutOptions): Promise<R2Object>;
  get(key: string): Promise<R2ObjectBody | null>;
  head(key: string): Promise<R2Object | null>;
  delete(keys: string | string[]): Promise<void>;
  list(options?: { prefix?: string; cursor?: string; limit?: number }): Promise<R2Objects>;
}

export interface Env {
  DB: D1Database;
  /** مرفقات رصيد الصحاري والمحادثة */
  FILES: R2Bucket;
  /** النسخ الاحتياطية والأرشيف الشهري ونسخ الترحيل (حاوية منفصلة عن الملفات) */
  BACKUPS: R2Bucket;
  APP_TOKEN?: string;
  ANTHROPIC_API_KEY?: string;
  ASSETS: { fetch(request: Request): Promise<Response> };
  /** قناة التحديث اللحظي (Durable Object StateHub) */
  HUB?: DurableObjectNamespace;
}

export interface DurableObjectNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): { fetch(input: string | Request, init?: RequestInit): Promise<Response> };
}

export interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}
export interface ScheduledController {
  scheduledTime: number;
  cron: string;
}
