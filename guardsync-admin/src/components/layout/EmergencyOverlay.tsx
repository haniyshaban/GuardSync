import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Guard } from '@/types';
import { Button } from '@/components/ui/button';

interface EmergencyOverlayProps {
  guards?: Guard[];
}

// Guards whose banner was dismissed in this browser session (storage access may be blocked)
const DISMISSED_KEY = 'guardsync_dismissed_emergencies';

function readDismissed(): string[] {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(DISMISSED_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeDismissed(ids: string[]) {
  try {
    sessionStorage.setItem(DISMISSED_KEY, JSON.stringify(ids));
  } catch {
    // Storage unavailable: the dismissal lasts until the page is reloaded
  }
}

// The server puts a guard in status 'alert' when they raise an SOS; 'panic' is kept for older data
const isEmergency = (g: Guard) => g.status === 'alert' || g.status === 'panic';

export function EmergencyOverlay({ guards = [] }: EmergencyOverlayProps) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState<string[]>(readDismissed);

  // Forget dismissals for guards who are no longer in an emergency, so a new SOS shows again
  useEffect(() => {
    if (!guards.length) return;
    const active = new Set(guards.filter(isEmergency).map(g => g.id));
    setDismissed(prev => {
      const next = prev.filter(id => active.has(id));
      if (next.length === prev.length) return prev;
      writeDismissed(next);
      return next;
    });
  }, [guards]);

  const emergencyGuards = guards.filter(g => isEmergency(g) && !dismissed.includes(g.id));

  // Early return AFTER all hooks
  if (!emergencyGuards.length) return null;

  const first = emergencyGuards[0];
  const names = emergencyGuards.length === 1 ? first.name : `${first.name} +${emergencyGuards.length - 1} more`;

  // The SOS is handled (and resolved) on the Alerts page
  const handleDispatch = () => {
    navigate('/alerts');
  };

  // Hides the banner for this session only; the SOS stays active on the Alerts page
  const handleDismiss = () => {
    const next = Array.from(new Set([...dismissed, ...emergencyGuards.map(g => g.id)]));
    writeDismissed(next);
    setDismissed(next);
  };

  return (
    // Sticks below the mobile top bar (53px tall) on phones and at the very top on wider
    // screens, with room on the right for the floating Search button
    <div
      role="alert"
      className="sticky top-[53px] sm:top-0 z-[45] flex flex-wrap items-center justify-between gap-2 sm:gap-4 p-3 px-4 sm:pr-32 md:pr-48 bg-[hsl(var(--status-panic))] text-white shadow-lg"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="w-3 h-3 rounded-full bg-white/90 animate-pulse" />
        <div className="font-semibold">EMERGENCY: {names}</div>
        <div className="text-sm text-white/90 ml-2">SOS alert raised</div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="destructive" onClick={handleDispatch}>Dispatch Help</Button>
        <Button variant="ghost" onClick={handleDismiss}>Dismiss</Button>
      </div>
    </div>
  );
}

export default EmergencyOverlay;
