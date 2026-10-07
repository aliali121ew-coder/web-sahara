/**
 * قناة التحديث اللحظي (Durable Object واحد لكل النظام):
 * كل جهاز مفتوح يبقى متصلًا عبر WebSocket، وعند أي حفظ يرسل الخادم رقم النسخة الجديد لكل الأجهزة
 * فتجلب التغيير خلال أجزاء من الثانية بدل السؤال المتكرر.
 * - Hibernation: الاتصالات الساكنة لا تُبقي الكائن مستيقظًا (لا تكلفة أثناء الانتظار).
 * - ping/pong يُرد عليه تلقائيًا دون إيقاظ الكائن.
 * - القناة لا تحمل بيانات، فقط رقم النسخة؛ كل جهاز يجلب ما يحق له عبر /api/state بصلاحياته.
 */

interface HubWebSocket {
  send(data: string): void;
  close(code?: number, reason?: string): void;
}
interface HubState {
  acceptWebSocket(ws: HubWebSocket): void;
  getWebSockets(): HubWebSocket[];
  setWebSocketAutoResponse(pair: unknown): void;
}
declare const WebSocketPair: { new (): { 0: HubWebSocket; 1: HubWebSocket } };
declare const WebSocketRequestResponsePair: { new (request: string, response: string): unknown };

export class StateHub {
  constructor(private state: HubState) {
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
    if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') return new Response('expected websocket', { status: 426 });
    const pair = new WebSocketPair();
    this.state.acceptWebSocket(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] } as ResponseInit);
  }

  webSocketMessage() {
    /* لا رسائل من الأجهزة غير ping (يُرد عليها تلقائيًا) */
  }

  webSocketClose(ws: HubWebSocket, code: number) {
    try { ws.close(code === 1005 ? 1000 : code, 'closed'); } catch { /* مغلق مسبقًا */ }
  }

  webSocketError() {
    /* يُغلق الاتصال تلقائيًا ويعيد الجهاز الاتصال */
  }
}
