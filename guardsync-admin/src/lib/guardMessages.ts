// Messages and pings from the control room to a guard's phone. They are saved as guard
// notifications (POST /api/notifications) and show up in the guard app's Alerts.
import { toast as sonnerToast } from '@/components/ui/sonner';
import { Guard } from '@/types';
import { API_BASE_URL } from './utils';
import { fetchJson } from './api';

type NotificationType = 'info' | 'warning' | 'alert';

function notifyGuard(guardId: string, type: NotificationType, title: string, message: string) {
  return fetchJson(`${API_BASE_URL}/api/notifications`, 'POST', { guardId, type, title, message });
}

/**
 * Sends a typed message to the guard. Shows a toast with the outcome, and throws when it
 * could not be sent so a dialog can stay open with the text.
 */
export async function messageGuard(guard: Pick<Guard, 'id' | 'name'>, text: string): Promise<void> {
  try {
    await notifyGuard(guard.id, 'info', 'Message from control room', text);
    sonnerToast.success(`Message sent to ${guard.name}`);
  } catch (e) {
    sonnerToast.error(e instanceof Error ? e.message : `Could not send the message to ${guard.name}`);
    throw e;
  }
}

/** Asks the guard to check in with the control room. Shows a toast with the outcome. */
export async function pingGuard(guard: Pick<Guard, 'id' | 'name'>): Promise<void> {
  try {
    await notifyGuard(guard.id, 'warning', 'Please check in', 'The control room asked you to check in.');
    sonnerToast.success(`Ping sent to ${guard.name}`);
  } catch (e) {
    sonnerToast.error(e instanceof Error ? e.message : `Could not ping ${guard.name}`);
  }
}
