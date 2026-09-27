export class ApiError extends Error {
  constructor({ status, code, message, retryAfter }) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

export async function post(path, body) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError({
      status: 0,
      code: 'offline',
      message: 'Could not reach the server. Is it running?',
    });
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError({
      status: res.status,
      code: data.error || 'error',
      message: data.message || `Request failed (${res.status})`,
      retryAfter: data.retryAfter,
    });
  }
  return data;
}
