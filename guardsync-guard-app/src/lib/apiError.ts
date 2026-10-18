/**
 * The message to show for a failed request.
 * The server answers errors as { code, message }, but some older replies carry a plain string,
 * and a thrown Error has its own message. Whichever shape it is, show the server's words;
 * use the fallback only when there are none.
 */
export function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'string') return error.trim() || fallback;
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}
