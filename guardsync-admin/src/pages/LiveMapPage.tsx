import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { LiveMap } from '@/components/map/LiveMap';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { API_BASE_URL } from '@/lib/utils';
import { fetchWithAuth, parseApiData } from '@/lib/api';
import { useState, useEffect, useRef } from 'react';
import { toast as sonnerToast } from '@/components/ui/sonner';
import SendMessageDialog from '@/components/ui/SendMessageDialog';
import { 
  Map, 
  Layers, 
  Users, 
  Building2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Guard, Site } from '@/types';
import { useSearchParams, Link } from 'react-router-dom';

export default function LiveMapPage() {
  const [guards, setGuards] = useState<Guard[]>([]);
  const [sites, setSites] = useState<Site[]>([]);

  // Fetch sites from API
  useEffect(() => {
    const loadSites = async () => {
      try {
        const res = await fetchWithAuth(`${API_BASE_URL}/api/sites`);
        if (res.ok) {
          const json = await res.json();
          console.log('🗺️ Sites API response:', json);
          const data = parseApiData(json);
          console.log('🗺️ Sites extracted:', Array.isArray(data) ? data.length : 'not array');
          if (Array.isArray(data) && data.length > 0) {
            console.log('🗺️ First site sample:', data[0]);
            console.log('🗺️ First site location:', data[0]?.location);
          }
          if (Array.isArray(data)) {
            setSites(data);
          }
        } else {
          console.error('❌ Sites fetch failed:', res.status, res.statusText);
        }
      } catch (e) {
        console.log('Could not load sites from backend', e);
      }
    };
    loadSites();
  }, []);

  // Fetch guards from API
  useEffect(() => {
    const loadGuards = async () => {
      try {
        const res = await fetchWithAuth(`${API_BASE_URL}/api/guards`);
        if (res.ok) {
          const json = await res.json();
          const data = parseApiData(json);
          if (Array.isArray(data)) {
            setGuards(data);
          }
        }
      } catch (e) {
        console.log('Could not load guards from backend', e);
      }
    };
    loadGuards();
    const interval = setInterval(loadGuards, 15000); // Refresh every 15 seconds
    return () => clearInterval(interval);
  }, []);
  const [showSites, setShowSites] = useState(true);
  const [showGuards, setShowGuards] = useState(true);
  const [showTrails, setShowTrails] = useState(true);
  const [selectedGuard, setSelectedGuard] = useState<Guard | null>(null);
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [playbackTrigger, setPlaybackTrigger] = useState(0);
  const [playbackGuardId, setPlaybackGuardId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const focusSiteId = searchParams.get('site');

  const onlineGuards = guards.filter(g => g.status === 'online').length;
  const idleGuards = guards.filter(g => g.status === 'idle').length;
  const alertGuards = guards.filter(g => g.status === 'alert').length;

  // If a site id is provided via query param, expand/select that site on load
  useEffect(() => {
    if (focusSiteId) {
      const s = sites.find(s => s.id === focusSiteId) || null;
      setSelectedSite(s as any);
    }
  }, [focusSiteId, sites]);
  const listRef = useRef<HTMLDivElement | null>(null);

  const scrollList = (delta: number) => {
    if (!listRef.current) return;
    listRef.current.scrollBy({ left: delta, behavior: 'smooth' });
  };

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-0px)] flex flex-col">
        {/* Header */}
        <div className="p-6 pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-border gap-3">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <Map className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Live Map</h1>
              <p className="text-sm text-muted-foreground">
                Real-time guard positions across all sites
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
            {/* Quick Stats */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="status-dot status-online" />
                <span className="text-sm font-mono">{onlineGuards}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="status-dot status-idle" />
                <span className="text-sm font-mono">{idleGuards}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="status-dot status-alert" />
                <span className="text-sm font-mono">{alertGuards}</span>
              </div>
            </div>

            {/* Layer Controls */}
            <div className="flex items-center gap-4 border-l border-border pl-4">
              <div className="flex items-center gap-2">
                <Switch 
                  id="show-sites" 
                  checked={showSites}
                  onCheckedChange={setShowSites}
                />
                <Label htmlFor="show-sites" className="text-sm">Sites</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch 
                  id="show-guards" 
                  checked={showGuards}
                  onCheckedChange={setShowGuards}
                />
                <Label htmlFor="show-guards" className="text-sm">Guards</Label>
              </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="show-trails"
                    checked={showTrails}
                    onCheckedChange={setShowTrails}
                  />
                  <Label htmlFor="show-trails" className="text-sm">Show Movement Trails</Label>
                </div>
            </div>

            <Button variant="outline" size="icon">
              <Maximize2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Map Content */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0">
          {/* Main Map */}
          <div className="flex-1 p-4 min-h-0">
            <div className="h-[60vh] sm:h-full min-h-[280px] rounded-lg overflow-hidden">
              <LiveMap
                guards={guards}
                sites={sites}
                showSites={showSites}
                showGeofences={showSites} // Sites toggle controls both icons and borders
                showGuards={showGuards}
                selectedGuardId={selectedGuard?.id}
                onGuardClick={setSelectedGuard}
                onSiteClick={setSelectedSite}
                focusSiteId={focusSiteId || undefined}
                showTrails={showTrails}
                playbackGuardId={playbackGuardId}
                playbackTrigger={playbackTrigger}
              />
            </div>
          </div>

          {/* Mobile sliding site panel (hidden when a site is selected) */}
          {!selectedSite && (
            <div className="sm:hidden fixed left-0 right-0 bottom-0 z-40 p-3 pointer-events-auto">
              <div className="relative">
                <button aria-label="scroll left" onClick={() => scrollList(-240)} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-card/80 p-1 rounded-md">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div ref={listRef} className="overflow-x-auto no-scrollbar flex gap-3 snap-x snap-mandatory py-2 px-8">
                  {sites.map(site => (
                    <div key={site.id} onClick={() => { setSelectedSite(site); try{ setSearchParams({ site: site.id }); } catch(e){} }} className="snap-start min-w-[72%] bg-card p-3 rounded-lg border border-border cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{site.name}</p>
                          <p className="text-xs text-muted-foreground">{site.address}</p>
                        </div>
                        <Badge variant={site.isActive ? 'success' : 'secondary'} className="text-xs">{site.isActive ? 'Active' : 'Inactive'}</Badge>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        <span>{site.assignedGuards.length} guards</span>
                      </div>
                    </div>
                  ))}
                </div>
                <button aria-label="scroll right" onClick={() => scrollList(240)} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-card/80 p-1 rounded-md">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Mobile bottom sheet for selected site so it doesn't push/cover the map */}
          {selectedSite && (
            <div className="sm:hidden fixed left-0 right-0 bottom-0 z-50 p-4 bg-card border-t border-border">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium">{selectedSite.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedSite.address}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={selectedSite.isActive ? 'success' : 'secondary'} className="text-xs">{selectedSite.isActive ? 'Active' : 'Inactive'}</Badge>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedSite(null)}>Close</Button>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="p-2 rounded bg-muted/30">
                  <div className="text-xs text-muted-foreground">Guards</div>
                  <div className="font-mono font-bold">{selectedSite.assignedGuards.length}</div>
                </div>
                <div className="p-2 rounded bg-muted/30">
                  <div className="text-xs text-muted-foreground">Geofence</div>
                  <div className="font-mono font-bold">{selectedSite.geofenceType === 'polygon' ? 'Polygon' : `${selectedSite.geofenceRadius || '—'}m`}</div>
                </div>
              </div>
              <div className="mt-3">
                <Link to={`/manage-site/${selectedSite.id}`} onClick={(e) => e.stopPropagation()}>
                  <Button variant="outline" className="w-full" size="sm">Manage Site</Button>
                </Link>
              </div>
            </div>
          )}

          {/* Sidebar Panel (hidden on small screens; mobile uses bottom-sheet) */}
          <div className="hidden lg:block w-80 border-l border-border p-4 space-y-4 overflow-y-auto">
            {/* Sites Overview */}
            <Card variant="elevated">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  Sites Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {sites.map(site => (
                  <div 
                    key={site.id}
                    onClick={() => {
                      // toggle expand/collapse
                      if (selectedSite?.id === site.id) {
                        setSelectedSite(null);
                        try { setSearchParams({}); } catch (e) {}
                      } else {
                        setSelectedSite(site);
                        try { setSearchParams({ site: site.id }); } catch (e) {}
                      }
                    }}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedSite?.id === site.id 
                        ? 'bg-primary/10 border-primary/30' 
                        : 'bg-card/50 border-border hover:bg-accent/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{site.name}</p>
                      <Badge variant={site.isActive ? 'success' : 'secondary'} className="text-xs">
                        {site.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{site.address}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Users className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {site.assignedGuards.length} guards assigned
                      </span>
                    </div>

                    {selectedSite?.id === site.id && (
                      <div className="mt-3 border-t pt-3 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Status</span>
                          <Badge variant={site.isActive ? 'success' : 'secondary'}>
                            {site.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Geofence</span>
                          <span className="font-mono">{site.geofenceRadius || '—'}m</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Guards</span>
                          <span>{site.assignedGuards.length}</span>
                        </div>
                        <div className="pt-2">
                          <Link to={`/manage-site/${site.id}`} onClick={(e) => e.stopPropagation()}>
                            <Button variant="outline" className="w-full" size="sm">Manage Site</Button>
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Selected Guard/Site Details */}
            {selectedGuard && (
              <Card variant="glow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    Selected Guard
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-lg font-semibold flex-shrink-0">
                      {selectedGuard.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{selectedGuard.name}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate">{selectedGuard.employeeId}</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <Badge variant={selectedGuard.status as any}>{selectedGuard.status}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Phone</span>
                      <span className="font-mono text-xs">{selectedGuard.phone}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Clocked In</span>
                      <span>{selectedGuard.clockedIn ? 'Yes' : 'No'}</span>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button size="sm" variant="ghost" onClick={() => sonnerToast.success(`Nudge sent to ${selectedGuard.name}`)}>Ping</Button>
                      <Button size="sm" variant="ghost" onClick={() => setMessageDialogOpen(true)}>Message</Button>
                      <Button size="sm" variant="ghost" onClick={() => { setPlaybackGuardId(selectedGuard.id); setPlaybackTrigger(t => t + 1); }}>Playback</Button>
                    </div>
                    <div className="sm:ml-auto w-full sm:w-auto">
                      <Button variant="outline" className="w-full sm:w-auto" size="sm">View Full Profile</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            <SendMessageDialog open={messageDialogOpen} onOpenChange={setMessageDialogOpen} guard={selectedGuard || undefined} onSend={(g, msg) => {
              sonnerToast(`Message sent to ${g?.name}: ${msg || '—'}`);
              console.log('Send message to', g?.id, msg);
            }} />
            
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
