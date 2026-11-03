export class ApiError extends Error { constructor(public code: string, message: string, public status: number) { super(message); } }
let clockOffset = 0;
export const serverClockNow = () => Date.now() + clockOffset;
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const sent = Date.now();
  const response = await fetch('/api' + path, { method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'X-Flat-League': '1' },
    credentials: 'same-origin', cache: 'no-store', ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const data = await response.json();
  if (typeof data.serverNow === 'number') clockOffset = data.serverNow - (sent + Date.now()) / 2;
  if (!response.ok) throw new ApiError(data.error, data.message || 'Something went wrong.', response.status);
  return data as T;
}
