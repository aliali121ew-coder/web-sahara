/**
 * قناة التحديث اللحظي (Durable Object واحد لكل النظام):
 * كل جهاز مفتوح يبقى متصلًا عبر WebSocket، وعند أي حفظ يرسل الخادم رقم النسخة الجديد لكل الأجهزة
 * فتجلب التغيير خلال أجزاء من الثانية بدل السؤال المتكرر.
 * - Hibernation: الاتصالات الساكنة لا تُبقي الكائن مستيقظًا (لا تكلفة أثناء الانتظار).
 * - ping/pong يُرد عليه تلقائيًا دون إيقاظ الكائن.
 * - القناة لا تحمل بيانات، فقط رقم النسخة؛ كل جهاز يجلب ما يحق له عبر /api/state بصلاحياته.
 * - الحضور: كل اتصال موسوم بمعرّف حسابه، فقائمة المتصلين الآن تُقرأ من الاتصالات نفسها (بلا D1)،
 *   وعند انقطاع آخر اتصال لحساب يُسجَّل «آخر ظهور» له.
 */
import type { D1Database } from '../types';

interface HubWebSocket {
  send(data: string): void;
  close(code?: number, reason?: string): void;
}
interface HubState {
  acceptWebSocket(ws: HubWebSocket, tags?: string[]): void;
  getWebSockets(tag?: string): HubWebSocket[];
  getTags(ws: HubWebSocket): string[];
  setWebSocketAutoResponse(pair: unknown): void;
}
declare const WebSocketPair: { new (): { 0: HubWebSocket; 1: HubWebSocket } };
declare const WebSocketRequestResponsePair: { new (request: string, response: string): unknown };

export class StateHub {
  constructor(private state: HubState, private env: { DB?: D1Database }) {
    this.state.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/notify' && request.method === 'POST') {
      const version = (await request.text()).slice(0, 200);
      for (const ws of this.state.getWebSockets()) {
        try { ws.send(version); } catch { /* اتصال مغلق */ }
      }
      return new Response('ok');
    }
    // صلاحيات حساب تغيّرت: إشارة «perms» لأجهزته المفتوحة فقط (تعرض خط النبض ثم تحدّث الصفحة)
    if (url.pathname === '/notify-user' && request.method === 'POST') {
      const user = (await request.text()).slice(0, 64);
      for (const ws of user ? this.state.getWebSockets(user) : []) {
        try { ws.send('perms'); } catch { /* اتصال مغلق */ }
      }
      return new Response('ok');
    }
    if (url.pathname === '/online') {
      const online = new Set<string>();
      for (const ws of this.state.getWebSockets()) {
        for (const tag of this.state.getTags(ws)) online.add(tag);
      }
      return new Response(JSON.stringify({ online: [...online] }), { headers: { 'content-type': 'application/json' } });
    }
    if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') return new Response('expected websocket', { status: 426 });
    const pair = new WebSocketPair();
    const user = (request.headers.get('x-hub-user') || '').slice(0, 64);
    this.state.acceptWebSocket(pair[1], user ? [user] : []);
    return new Response(null, { status: 101, webSocket: pair[0] } as ResponseInit);
  }

  webSocketMessage() {
    /* لا رسائل من الأجهزة غير ping (يُرد عليها تلقائيًا) */
  }

  async webSocketClose(ws: HubWebSocket, code: number) {
    try { ws.close(code === 1005 ? 1000 : code, 'closed'); } catch { /* مغلق مسبقًا */ }
    await this.markSeen(ws);
  }

  async webSocketError(ws: HubWebSocket) {
    /* يُغلق الاتصال تلقائيًا ويعيد الجهاز الاتصال */
    await this.markSeen(ws);
  }

  /** «آخر ظهور» = لحظة انقطاع آخر اتصال للحساب (جهاز آخر ما زال متصلًا = ما زال ظاهرًا) */
  private async markSeen(ws: HubWebSocket) {
    const [user] = this.state.getTags(ws);
    if (!user || !this.env.DB) return;
    if (this.state.getWebSockets(user).some(other => other !== ws)) return;
    try {
      await this.env.DB.prepare('UPDATE chat_users SET last_seen = ? WHERE id = ?').bind(Date.now(), user).run();
    } catch { /* الحضور لا يجب أن يُفشل القناة */ }
  }
}
