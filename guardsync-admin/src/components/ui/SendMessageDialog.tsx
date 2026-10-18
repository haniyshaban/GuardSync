import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Guard } from '@/types';

interface SendMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guard?: Guard | null;
  /** May return a promise; the dialog closes when it resolves and stays open if it rejects. */
  onSend?: (guard: Guard | null, message: string) => void | Promise<void>;
}

export default function SendMessageDialog({ open, onOpenChange, guard, onSend }: SendMessageDialogProps) {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!open) setMessage('');
  }, [open]);

  const handleSend = async () => {
    const text = message.trim();
    if (!text) return;
    setIsSending(true);
    try {
      await onSend?.(guard || null, text);
      onOpenChange(false);
    } catch {
      // The caller has shown the error; keep the text so it can be sent again
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Message {guard?.name}</DialogTitle>
        </DialogHeader>

        <div className="mt-2">
          <Textarea value={message} maxLength={1000} onChange={(e) => setMessage(e.target.value)} placeholder={`Type a short instruction to ${guard?.name}`} />
        </div>

        <DialogFooter className="mt-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSend} disabled={!message.trim() || isSending}>{isSending ? 'Sending...' : 'Send'}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
