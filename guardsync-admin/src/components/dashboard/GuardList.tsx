import { Guard } from '@/types';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast as sonnerToast } from '@/components/ui/sonner';
import SendMessageDialog from '@/components/ui/SendMessageDialog';
import { useState } from 'react';

interface GuardListProps {
  guards: Guard[];
  maxHeight?: string;
  onGuardClick?: (guard: Guard) => void;
  selectedGuardId?: string | null;
}

export function GuardList({ 
  guards, 
  maxHeight = '400px', 
  onGuardClick,
  selectedGuardId 
}: GuardListProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogGuard, setDialogGuard] = useState<Guard | null>(null);
  const getStatusVariant = (status: Guard['status']): "online" | "offline" | "idle" | "alert" | "secondary" => {
    switch (status) {
      case 'online': return 'online';
      case 'offline': return 'offline';
      case 'idle': return 'idle';
      case 'alert': return 'alert';
      default: return 'secondary';
    }
  };

  const sortedGuards = [...guards].sort((a, b) => {
    const statusOrder = { alert: 0, online: 1, idle: 2, offline: 3 };
    return statusOrder[a.status] - statusOrder[b.status];
  });

  return (
    <ScrollArea className={cn("pr-4")} style={{ maxHeight }}>
      <div className="space-y-2">
        {sortedGuards.map((guard, index) => (
          <div
            key={guard.id}
            onClick={() => onGuardClick?.(guard)}
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer animate-fade-in",
              selectedGuardId === guard.id 
                ? "bg-primary/10 border-primary/30" 
                : "bg-card/50 border-border hover:bg-accent/50 hover:border-accent"
            )}
            style={{ animationDelay: `${index * 20}ms` }}
          >
            {/* Status indicator */}
            <div className="relative">
              <div className={cn(
                "w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-semibold",
                guard.status === 'alert' && "ring-2 ring-destructive ring-offset-2 ring-offset-background"
              )}>
                {(guard.name || '??').split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <div className={cn(
                "absolute -bottom-0.5 -right-0.5 status-dot border-2 border-background",
                `status-${guard.status}`
              )} />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium truncate">{guard.name}</p>
                <Badge variant={getStatusVariant(guard.status)} className="text-xs">
                  {guard.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground font-mono">
                {guard.employeeId}
              </p>
              <div className="text-xs text-muted-foreground">
                {guard.shiftType === 'day' ? 'Day Shift' : guard.shiftType === 'night' ? 'Night Shift' : null}
              </div>
            </div>

            {/* Time + actions */}
            <div className="text-right flex flex-col items-end gap-2">
              <div>
                <p className="text-xs text-muted-foreground">
                  {guard.lastSeen ? formatDistanceToNow(new Date(guard.lastSeen), { addSuffix: true }) : 'Never seen'}
                </p>
                {guard.clockedIn && (
                  <p className="text-xs text-success">Clocked In</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); sonnerToast.success(`Nudge sent to ${guard.name}`); }}>
                  Ping
                </Button>

                <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setDialogGuard(guard); setDialogOpen(true); }}>
                  Message
                </Button>

                <Link to={`/guards/${guard.id}`} onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" variant="outline">View</Button>
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
      <SendMessageDialog open={dialogOpen} onOpenChange={setDialogOpen} guard={dialogGuard} onSend={(g, msg) => {
        sonnerToast(`Message sent to ${g?.name}: ${msg || '—'}`);
        console.log('Send message to', g?.id, msg);
      }} />
    </ScrollArea>
  );
}
