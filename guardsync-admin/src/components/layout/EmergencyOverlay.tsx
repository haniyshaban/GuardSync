import React, { useEffect, useState } from 'react';
import { Guard } from '@/types';
import { Button } from '@/components/ui/button';
import { toast as sonnerToast } from '@/components/ui/sonner';
import { useSidebar } from './SidebarContext';
import { API_BASE_URL } from '@/lib/utils';
import { fetchWithAuth } from '@/lib/api';

interface EmergencyOverlayProps {
  guards?: Guard[];
}

export function EmergencyOverlay({ guards = [] }: EmergencyOverlayProps) {
  const { collapsed } = useSidebar();
  const [isDesktop, setIsDesktop] = useState<boolean>(typeof window !== 'undefined' ? window.innerWidth >= 640 : true);

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const panicGuards = guards.filter(g => g.status === 'panic');
  
  // Early return AFTER all hooks
  if (!panicGuards.length) return null;

  const leftOffset = isDesktop ? (collapsed ? '72px' : '16rem') : '0px';
  const first = panicGuards[0];
  const names = panicGuards.length === 1 ? first.name : `${first.name} +${panicGuards.length - 1} more`;

  const handleDispatch = async (guardId?: string) => {
    // Placeholder: wire this up to a real dispatch/notification system
    console.warn('Dispatch requested for', guardId || 'multiple');
    alert(`Dispatching help for ${guardId || 'guards in panic'}`);
  };

  const handleDismiss = async () => {
    // Update panic guards to online status via API
    try {
      for (const g of panicGuards) {
        await fetchWithAuth(`${API_BASE_URL}/api/guards/${g.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'online', lastSeen: new Date().toISOString() }),
        });
      }
      sonnerToast.success(`Cleared panic for ${panicGuards.length} guard(s)`);
      // Reload to reflect changes
      setTimeout(() => {
        try { window.location.reload(); } catch (e) { /* ignore */ }
      }, 700);
    } catch (e) {
      sonnerToast.error('Failed to clear panic status');
    }
  };

  return (
    <div
      style={{ left: leftOffset, right: 0, width: `calc(100% - ${leftOffset})` }}
      className="fixed top-0 z-[99999] flex items-center justify-between gap-4 p-3 px-4 bg-[hsl(var(--status-panic))] text-white shadow-lg"
    >
      <div className="flex items-center gap-3">
        <div className="w-3 h-3 rounded-full bg-white/90 animate-pulse" />
        <div className="font-semibold">EMERGENCY: {names}</div>
        <div className="text-sm text-white/90 ml-2">High priority panic alert</div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="destructive" onClick={() => handleDispatch(first.id)}>Dispatch Help</Button>
        <Button variant="ghost" onClick={handleDismiss}>Dismiss</Button>
      </div>
    </div>
  );
}

export default EmergencyOverlay;
