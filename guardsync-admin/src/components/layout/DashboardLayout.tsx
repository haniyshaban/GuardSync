import { ReactNode, useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { useSidebar } from './SidebarContext';
import { useNavigate } from 'react-router-dom';
import { Menu, ArrowLeft, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import EmergencyOverlay from './EmergencyOverlay';
import CommandSearch from '@/components/ui/CommandSearch';
import { Guard } from '@/types';
import { API_BASE_URL } from '@/lib/utils';
import { fetchWithAuth } from '@/lib/api';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [guards, setGuards] = useState<Guard[]>([]);
  const { collapsed: sidebarCollapsed } = useSidebar();
  const navigate = useNavigate();

  // Fetch guards for emergency overlay
  useEffect(() => {
    const loadGuards = async () => {
      try {
        const res = await fetchWithAuth(`${API_BASE_URL}/api/guards`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) setGuards(data);
        }
      } catch (e) {
        // ignore
      }
    };
    loadGuards();
    const interval = setInterval(loadGuards, 10000); // Poll every 10s for panic alerts
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-background bg-grid">
      {/* Global emergency overlay (shows whenever any guard is in 'panic') */}
      <EmergencyOverlay guards={guards} />
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      {/* Mobile top bar */}
      <div className="sm:hidden fixed top-0 left-0 right-0 z-40">
        <div className="p-2 bg-background border-b flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="font-semibold">GuardSync</div>
          <Button variant="ghost" size="sm" onClick={() => setMobileOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <main className={`${sidebarCollapsed ? 'sm:ml-[72px]' : 'sm:ml-64'} min-h-screen transition-all duration-200 animate-fade-in pt-12`}>
        {/* Floating search button (top-right) */}
        <div className="fixed top-4 right-4 z-50 hidden sm:flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.dispatchEvent(new CustomEvent('open-command-search'))}
            className="flex items-center gap-2"
          >
            <Search className="w-4 h-4" />
            <span className="hidden md:inline">Search</span>
            <span className="ml-2 text-xs text-muted-foreground font-mono">⌘K</span>
          </Button>
        </div>

        {children}
        <CommandSearch />
      </main>
    </div>
  );
}
