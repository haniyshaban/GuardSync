import { describe, it, expect, vi, afterEach } from 'vitest';
import { messageGuard, pingGuard } from './guardMessages';
import { getApiErrorMessage } from './api';

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('@/components/ui/sonner', () => ({ toast }));

function reply(status: number, body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('guard messages', () => {
  it('posts a message as a guard notification and reports success', async () => {
    const fetchMock = vi.fn(() => reply(201, { success: true, data: { id: 'n1' } }));
    vi.stubGlobal('fetch', fetchMock);

    await messageGuard({ id: 'guard-2', name: 'Amit Singh' }, 'Go to gate B');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/api\/notifications$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      guardId: 'guard-2',
      type: 'info',
      title: 'Message from control room',
      message: 'Go to gate B',
    });
    expect(toast.success).toHaveBeenCalledWith('Message sent to Amit Singh');
  });

  it("shows the server's message and rejects when sending fails", async () => {
    vi.stubGlobal('fetch', vi.fn(() => reply(403, { success: false, error: { code: 'FORBIDDEN', message: "You don't have permission to do this" } })));

    await expect(messageGuard({ id: 'guard-2', name: 'Amit Singh' }, 'Hi')).rejects.toThrow("You don't have permission to do this");
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("You don't have permission to do this");
  });

  it('a failed ping is reported, not thrown', async () => {
    vi.stubGlobal('fetch', vi.fn(() => reply(401, { error: 'Unauthorized' })));

    await expect(pingGuard({ id: 'guard-2', name: 'Amit Singh' })).resolves.toBeUndefined();
    expect(toast.error).toHaveBeenCalledWith('Unauthorized');
  });
});

describe('getApiErrorMessage', () => {
  it('reads both error shapes and falls back', () => {
    expect(getApiErrorMessage({ success: false, error: { code: 'X', message: 'Plain words' } })).toBe('Plain words');
    expect(getApiErrorMessage({ error: 'Forbidden' })).toBe('Forbidden');
    expect(getApiErrorMessage(null, 'Fallback')).toBe('Fallback');
    expect(getApiErrorMessage({ error: { code: 'X' } }, 'Fallback')).toBe('Fallback');
  });
});
