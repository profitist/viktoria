const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

// =============================================================================
// Модульное состояние (module-level state)
// =============================================================================

let accessToken: string | null = null;
let onLogout: (() => void) | null = null;

// Mutex для параллельных 401: если refresh уже запущен — ждать его, не запускать новый
let refreshPromise: Promise<string | null> | null = null;

// =============================================================================
// Управление токеном и callback-ами
// =============================================================================

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function registerLogoutCallback(cb: () => void): void {
  onLogout = cb;
}

// =============================================================================
// Внутренняя функция refresh (прямой fetch, не через apiFetch — нет рекурсии)
// =============================================================================

async function executeRefresh(): Promise<string | null> {
  const refreshToken = sessionStorage.getItem("refresh_token");

  if (!refreshToken) {
    sessionStorage.removeItem("refresh_token");
    onLogout?.();
    return null;
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  } catch {
    // Сетевая ошибка — не разлогиниваем, просто возвращаем null
    return null;
  }

  if (!res.ok) {
    // 401, 403, 5xx и прочие ошибки — разлогиниваем и очищаем storage
    sessionStorage.removeItem("refresh_token");
    sessionStorage.removeItem("user");
    onLogout?.();
    return null;
  }

  let data: { access_token: string };
  try {
    data = (await res.json()) as { access_token: string };
  } catch {
    // Невалидный JSON от сервера — разлогиниваем
    sessionStorage.removeItem("refresh_token");
    sessionStorage.removeItem("user");
    onLogout?.();
    return null;
  }

  setAccessToken(data.access_token);
  return data.access_token;
}

async function doRefresh(): Promise<string | null> {
  // Все параллельные 401 берут ссылку на один промис ДО его завершения
  if (refreshPromise !== null) return refreshPromise;
  refreshPromise = executeRefresh();
  const result = await refreshPromise;
  // Обнуляем только после await — не в .finally()
  refreshPromise = null;
  return result;
}

// =============================================================================
// Основной fetch-враппер
// =============================================================================

export async function apiFetch(
  path: string,
  options?: RequestInit
): Promise<Response> {
  const url = `${BASE_URL}${path}`;

  // Формируем заголовки с Bearer токеном
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string> | undefined),
  };
  if (accessToken !== null) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const res = await fetch(url, { ...options, headers });

  // Не 401 — возвращаем как есть, вызывающий код решает что делать
  if (res.status !== 401) {
    return res;
  }

  // 401: пробуем refresh через mutex (защита от параллельных запросов)
  // doRefresh() гарантирует что все параллельные 401 ждут одного промиса
  const newToken = await doRefresh();

  if (newToken === null) {
    // Refresh не удался — logout уже вызван внутри doRefresh
    return res;
  }

  // Повторяем запрос с новым токеном
  const retryHeaders: Record<string, string> = {
    ...(options?.headers as Record<string, string> | undefined),
  };
  if (accessToken !== null) {
    retryHeaders["Authorization"] = `Bearer ${accessToken}`;
  }

  // Повторный запрос 401 не обрабатываем — возвращаем как есть
  return fetch(url, { ...options, headers: retryHeaders });
}

// =============================================================================
// Типизированная ошибка с HTTP-статусом
// =============================================================================

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// =============================================================================
// Хелпер для обработки HTTP-ошибок (4xx, 5xx кроме 401)
// =============================================================================

async function handleError(res: Response): Promise<never> {
  let body: unknown;
  let detail: string | undefined;
  try {
    body = await res.json();
    detail = (body as { detail?: string })?.detail;
  } catch {
    // Тело не распарсилось — используем статус-код
  }
  throw new ApiError(detail ?? `HTTP ${res.status}`, res.status, body);
}

// =============================================================================
// Объект-хелпер api
// =============================================================================

export const api = {
  async get<T>(path: string): Promise<T> {
    const res = await apiFetch(path, { method: "GET" });
    if (!res.ok) return handleError(res);
    return res.json() as Promise<T>;
  },

  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await apiFetch(path, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) return handleError(res);
    return res.json() as Promise<T>;
  },

  async patch<T>(path: string, body: unknown): Promise<T> {
    const res = await apiFetch(path, {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) return handleError(res);
    return res.json() as Promise<T>;
  },

  async put<T>(path: string, body: unknown): Promise<T> {
    const res = await apiFetch(path, {
      method: "PUT",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) return handleError(res);
    return res.json() as Promise<T>;
  },

  async delete(path: string): Promise<void> {
    const res = await apiFetch(path, { method: "DELETE" });
    if (!res.ok) return handleError(res);
  },
};
