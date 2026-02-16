import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Guard } from '@/types';

interface SendMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guard?: Guard | null;
  onSend?: (guard: Guard | null, message: string) => void;
}

export default function SendMessageDialog({ open, onOpenChange, guard, onSend }: SendMessageDialogProps) {
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!open) setMessage('');
  }, [open]);

  const handleSend = () => {
    onSend?.(guard || null, message);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Message {guard?.name}</DialogTitle>
        </DialogHeader>

        <div className="mt-2">
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder={`Type a short instruction to ${guard?.name}`} />
        </div>

        <DialogFooter className="mt-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSend}>Send</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
