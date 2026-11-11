export const BASE_URL = 'http://localhost';

/** Builds a JSON `Request` against the in-process app (no server socket needed). */
export function jsonRequest(path: string, body?: unknown, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  if (body !== undefined) headers.set('content-type', 'application/json');

  return new Request(`${BASE_URL}${path}`, {
    ...init,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** Builds a request with a raw (possibly invalid) body; headers come from `init`. */
export function rawRequest(path: string, body: string, init: RequestInit = {}): Request {
  return new Request(`${BASE_URL}${path}`, { ...init, body });
}

export async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}
