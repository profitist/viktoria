import type { JsonRpcMessage } from "./types";

const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000";

export class WsClient {
  private workspaceId: string;
  private getToken: () => string | null;
  private socket: WebSocket | null = null;
  private handlers: Map<
    string,
    Set<(params: Record<string, unknown>) => void>
  > = new Map();
  private retryDelay: number = 1000;
  private shouldReconnect: boolean = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(workspaceId: string, getToken: () => string | null) {
    this.workspaceId = workspaceId;
    this.getToken = getToken;
  }

  connect(): void {
    this.shouldReconnect = true;

    const token = this.getToken();
    const tokenParam = token !== null ? `?token=${encodeURIComponent(token)}` : "";
    const url = `${WS_BASE_URL}/ws/${this.workspaceId}${tokenParam}`;

    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      // Успешное соединение — сброс задержки
      this.retryDelay = 1000;
    };

    this.socket.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as unknown;
        if (
          typeof data === "object" &&
          data !== null &&
          "jsonrpc" in data &&
          (data as Record<string, unknown>)["jsonrpc"] === "2.0" &&
          "method" in data &&
          typeof (data as Record<string, unknown>)["method"] === "string"
        ) {
          this.dispatch(data as JsonRpcMessage);
        }
      } catch {
        // Тихое игнорирование ошибок парсинга
      }
    };

    this.socket.onclose = () => {
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    };

    this.socket.onerror = () => {
      // Браузер всегда вызывает onclose после onerror — reconnect делает только onclose
    };
  }

  disconnect(): void {
    this.shouldReconnect = false;

    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    if (this.socket !== null) {
      this.socket.close();
      this.socket = null;
    }
  }

  on(
    method: string,
    handler: (params: Record<string, unknown>) => void
  ): void {
    if (!this.handlers.has(method)) {
      this.handlers.set(method, new Set());
    }
    this.handlers.get(method)!.add(handler);
  }

  off(
    method: string,
    handler: (params: Record<string, unknown>) => void
  ): void {
    const set = this.handlers.get(method);
    if (!set) return;

    set.delete(handler);

    if (set.size === 0) {
      this.handlers.delete(method);
    }
  }

  private dispatch(message: JsonRpcMessage): void {
    const set = this.handlers.get(message.method);
    if (!set || set.size === 0) return;

    for (const handler of set) {
      try {
        handler(message.params);
      } catch {
        // Ошибка одного обработчика не прерывает вызов остальных
      }
    }
  }

  private scheduleReconnect(): void {
    this.retryTimer = setTimeout(() => {
      this.connect();
    }, this.retryDelay);

    // Экспоненциальная задержка: удваивать, но не более 30 сек
    this.retryDelay = Math.min(this.retryDelay * 2, 30000);
  }
}
