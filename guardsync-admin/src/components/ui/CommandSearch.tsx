import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command';
import { Guard, Site } from '@/types';
import { API_BASE_URL } from '@/lib/utils';
import { fetchWithAuth } from '@/lib/api';

type Item = {
  id: string;
  type: 'guard' | 'site';
  title: string;
  subtitle?: string;
};

export default function CommandSearch() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [guards, setGuards] = useState<Guard[]>([]);
  const [sites, setSites] = useState<Site[]>([]);

  // Fetch guards and sites from API
  useEffect(() => {
    const loadData = async () => {
      try {
        const [guardsRes, sitesRes] = await Promise.all([
          fetchWithAuth(`${API_BASE_URL}/api/guards`),
          fetchWithAuth(`${API_BASE_URL}/api/sites`),
        ]);
        if (guardsRes.ok) {
          const data = await guardsRes.json();
          if (Array.isArray(data)) setGuards(data);
        }
        if (sitesRes.ok) {
          const data = await sitesRes.json();
          if (Array.isArray(data)) setSites(data);
        }
      } catch (e) {
        // ignore
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    const onOpenEvent = () => setOpen(true);
    window.addEventListener('open-command-search', onOpenEvent as EventListener);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('open-command-search', onOpenEvent as EventListener);
    };
  }, []);

  const items: Item[] = useMemo(() => {
    const guardItems = guards.map(g => ({
      id: g.id,
      type: 'guard' as const,
      title: g.name || 'Unknown',
      subtitle: g.employeeId || '',
    }));
    const siteItems = sites.map(s => ({
      id: s.id,
      type: 'site' as const,
      title: s.name,
      subtitle: s.address,
    }));
    return [...guardItems, ...siteItems];
  }, [guards, sites]);

  const onSelect = (item: Item) => {
    setOpen(false);
    if (item.type === 'guard') {
      navigate(`/guards/${item.id}`);
    } else {
      navigate(`/live-map?site=${encodeURIComponent(item.id)}`);
    }
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search guards, employees, or sites... (Cmd/Ctrl+K)" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>

        <CommandGroup heading="Guards">
          {items.filter(i => i.type === 'guard').map(it => (
            <CommandItem key={it.id} onSelect={() => onSelect(it)}>
              <div className="flex flex-col">
                <span className="text-sm">{it.title}</span>
                <span className="text-xs text-muted-foreground">{it.subtitle}</span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Sites">
          {items.filter(i => i.type === 'site').map(it => (
            <CommandItem key={it.id} onSelect={() => onSelect(it)}>
              <div className="flex flex-col">
                <span className="text-sm">{it.title}</span>
                <span className="text-xs text-muted-foreground">{it.subtitle}</span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
