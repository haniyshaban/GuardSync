import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Guard, Site } from '@/types';
import { API_BASE_URL } from '@/lib/utils';
import { fetchJson, fetchWithAuth, getApiErrorMessage, parseApiData } from '@/lib/api';
import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { siteFromImport } from '@/lib/siteImport';
import { MapContainer, TileLayer, Marker, Polygon, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Building2, 
  Plus, 
  Search, 
  MapPin,
  Users,
  Settings
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function SitesPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [guards, setGuards] = useState<Guard[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [activeSite, setActiveSite] = useState<Site | null>(null);
  const [geofenceMode, setGeofenceMode] = useState<'radius' | 'polygon'>('radius');
  const [radiusValue, setRadiusValue] = useState<number>(100);
  const [polygonText, setPolygonText] = useState<string>('');
  const [polygonPoints, setPolygonPoints] = useState<{lat:number;lng:number}[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  const { toast } = useToast();

  // Load guards from API
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
        } else {
          console.error('Failed to load guards:', res.status);
        }
      } catch (e) {
        console.error('Error loading guards:', e);
      }
    };
    loadGuards();
  }, []);

  // Load sites from backend (on mount and after an import)
  const loadSites = useCallback(async (isCancelled: () => boolean = () => false) => {
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/api/sites`);
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Failed to load sites:', res.status, errorText);
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }
      const json = await res.json();
      const data = parseApiData(json);
      if (isCancelled()) return;
      if (Array.isArray(data)) {
        // normalize types
        const rev = data.map((s: any) => ({
          ...s,
          createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
          geofenceRadius: s.geofenceRadius ? Number(s.geofenceRadius) : 0,
        }));
        setSites(rev as Site[]);
      } else {
        console.warn('API returned non-array data for sites');
      }
    } catch (err) {
      console.error('Error loading sites:', err);
      // If backend is not reachable, show error
      toast({ 
        title: 'Could not load sites from server', 
        description: err instanceof Error ? err.message : 'Please check if the API is running.',
        variant: 'destructive'
      });
    }
  }, [toast]);

  useEffect(() => {
    let cancelled = false;
    loadSites(() => cancelled);
    return () => { cancelled = true; };
  }, [loadSites]);

  // Import: each valid entry is created on the server (POST /api/sites), then the list is
  // reloaded from the server. Entries that are invalid or already exist are skipped.
  const importSites = async (text: string) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      toast({ title: 'Import failed', description: 'The file is not valid JSON.', variant: 'destructive' });
      return;
    }
    const entries = Array.isArray(parsed) ? parsed
      : parsed && typeof parsed === 'object' && Array.isArray((parsed as { sites?: unknown }).sites) ? (parsed as { sites: unknown[] }).sites
      : null;
    if (!entries) {
      toast({ title: 'Import failed', description: 'Expected a list of sites (or { "sites": [...] }).', variant: 'destructive' });
      return;
    }

    setIsImporting(true);
    let saved = 0;
    const skipped: string[] = [];
    for (const [index, entry] of entries.entries()) {
      const { site, error } = siteFromImport(entry, index);
      if (!site) {
        skipped.push(error || `Entry ${index + 1} is invalid`);
        continue;
      }
      if (site.id && sites.some(s => s.id === site.id)) {
        skipped.push(`"${site.name}": a site with this id already exists`);
        continue;
      }
      try {
        await fetchJson(`${API_BASE_URL}/api/sites`, 'POST', site);
        saved += 1;
      } catch (e) {
        skipped.push(`"${site.name}": ${e instanceof Error ? e.message : 'could not be saved'}`);
      }
    }
    setIsImporting(false);
    await loadSites();

    const details = skipped.length > 0
      ? `${skipped.length} skipped. ${skipped.slice(0, 3).join('; ')}${skipped.length > 3 ? '; …' : ''}`
      : 'All sites in the file were saved.';
    toast({
      title: `Imported ${saved} of ${entries.length} site${entries.length === 1 ? '' : 's'}`,
      description: details,
      variant: saved === 0 && entries.length > 0 ? 'destructive' : undefined,
    });
  };

  const filteredSites = sites.filter(site =>
    (site.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (site.address || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getGuardCount = (siteId: string) => {
    return guards.filter(g => g.siteId === siteId).length;
  };

  const getActiveGuardCount = (siteId: string) => {
    return guards.filter(g => g.siteId === siteId && (g.status === 'online' || g.status === 'idle')).length;
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Site Management</h1>
              <p className="text-sm text-muted-foreground">
                {sites.length} sites • {sites.filter(s => s.isActive).length} active
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input id="site-import" type="file" accept="application/json" onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const reader = new FileReader();
              reader.onload = () => { importSites(String(reader.result || '')); };
              reader.onerror = () => toast({ title: 'Import failed', description: 'The file could not be read.', variant: 'destructive' });
              reader.readAsText(f);
              // reset input
              (e.target as HTMLInputElement).value = '';
            }} style={{ display: 'none' }} />

            <Button variant="outline" disabled={isImporting} onClick={() => {
              const input = document.getElementById('site-import') as HTMLInputElement | null;
              input?.click();
            }}>{isImporting ? 'Importing...' : 'Import'}</Button>

            <Button variant="glow" onClick={() => {
              const data = JSON.stringify(sites, null, 2);
              const blob = new Blob([data], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'guardsync-sites.json';
              a.click();
              URL.revokeObjectURL(url);
            }}>
              <Plus className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Configure Geofence Dialog */}
        <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Configure Geofence</DialogTitle>
              <DialogDescription>Choose geofence type and edit values for {activeSite?.name}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              <div>
                <div className="text-sm text-muted-foreground mb-2">Geofence Mode</div>
                <RadioGroup value={geofenceMode} onValueChange={(v: any) => setGeofenceMode(v)} className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <RadioGroupItem value="radius" />
                    <span>Radius (meters)</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <RadioGroupItem value="polygon" />
                    <span>Custom Polygon</span>
                  </label>
                </RadioGroup>
              </div>

              {geofenceMode === 'radius' && (
                <div>
                  <div className="text-sm text-muted-foreground mb-2">Radius (meters)</div>
                  <Input value={radiusValue} onChange={(e) => setRadiusValue(Number(e.target.value))} type="number" />
                </div>
              )}

              {geofenceMode === 'polygon' && (
                <div>
                  <div className="text-sm text-muted-foreground mb-2">Draw polygon on map (click to add points)</div>
                  <div className="w-full h-64 rounded-md overflow-hidden border">
                    <MapContainer center={[activeSite?.location?.lat || 12.97, activeSite?.location?.lng || 77.59]} zoom={13} className="w-full h-full">
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      <Polygon positions={polygonPoints.map(p => [p.lat, p.lng]) as any} pathOptions={{ color: 'blue', fillOpacity: 0.1 }} />
                      {polygonPoints.map((p, i) => (
                        <Marker key={i} position={[p.lat, p.lng]} />
                      ))}
                      {/* show guards assigned to this site as small dots */}
                      {guards.filter(g => g.siteId === activeSite?.id && g.location).map(g => (
                        <Marker key={g.id} position={[g.location!.lat, g.location!.lng]} icon={L.divIcon({
                          className: 'small-guard-marker',
                          html: `<div style="width:10px;height:10px;border-radius:50%;background:${g.status==='online'? '#22c55e': g.status==='idle'? '#f59e0b': g.status==='alert'? '#dc2626':'#ef4444'};border:2px solid white"></div>`,
                          iconSize: [12,12],
                          iconAnchor: [6,6]
                        })} />
                      ))}
                      <MapClickHandler onClick={(lat,lng) => setPolygonPoints(prev => [...prev, {lat,lng}])} />
                    </MapContainer>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Button variant="outline" size="sm" onClick={() => setPolygonPoints(prev => prev.slice(0,-1))}>Undo</Button>
                    <Button variant="ghost" size="sm" onClick={() => setPolygonPoints([])}>Clear</Button>
                    <div className="text-xs text-muted-foreground ml-auto">You can also paste JSON below</div>
                  </div>
                  <Textarea value={polygonText} onChange={(e) => setPolygonText(e.target.value)} rows={3} className="mt-2" />
                </div>
              )}
            </div>

            <DialogFooter>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setIsConfigOpen(false)}>Cancel</Button>
                <Button onClick={async () => {
                  if (!activeSite) return;
                  // only the geofence fields are sent
                  const updatedSite: any = {};
                  updatedSite.geofenceType = geofenceMode;
                  if (geofenceMode === 'radius') {
                    updatedSite.geofenceRadius = Number(radiusValue) || 0;
                  } else {
                    if (polygonPoints && polygonPoints.length > 0) {
                      updatedSite.geofencePolygon = polygonPoints.map(p => ({ lat: Number(p.lat), lng: Number(p.lng) }));
                    } else {
                      try {
                        const parsed = JSON.parse(polygonText);
                        if (Array.isArray(parsed)) {
                          updatedSite.geofencePolygon = parsed.map((p: any) => ({ lat: Number(p.lat), lng: Number(p.lng) }));
                        }
                      } catch (err) {
                        // ignore
                      }
                    }
                  }

                  try {
                    const res = await fetchWithAuth(`${API_BASE_URL}/api/sites/${encodeURIComponent(String(activeSite.id))}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(updatedSite),
                    });
                    if (!res.ok) throw new Error(getApiErrorMessage(await res.json().catch(() => null), `HTTP ${res.status}`));
                    // the server only returns { ok: true } — fetch the authoritative record
                    let savedSite: any = null;
                    const getRes = await fetchWithAuth(`${API_BASE_URL}/api/sites/${encodeURIComponent(String(activeSite.id))}`);
                    if (getRes.ok) savedSite = parseApiData(await getRes.json());
                    const merged = savedSite ? { ...activeSite, ...savedSite } : { ...activeSite };
                    // update local UI
                    const updated = sites.map(s => s.id === activeSite.id ? merged : s);
                    setSites(updated as Site[]);
                    toast({ title: 'Site saved', description: 'Geofence saved to server.' });
                  } catch (err) {
                    toast({ title: 'Failed to save site', description: err instanceof Error ? err.message : 'Could not connect to backend.', variant: 'destructive' });
                  }

                  setIsConfigOpen(false);
                }}>Save</Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

          {/* Map click handler component */}
        

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search sites..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Sites Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSites.length === 0 && (
            <div className="col-span-full text-center py-12">
              <Building2 className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-lg font-medium text-muted-foreground">
                {sites.length === 0 ? 'No sites found' : 'No sites match your search'}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                {sites.length === 0 
                  ? 'Check the browser console for error messages or try refreshing the page.' 
                  : `Showing 0 of ${sites.length} total sites`}
              </p>
            </div>
          )}
          {filteredSites.map((site, index) => (
            <Card 
              key={site.id} 
              variant="elevated"
              className="animate-fade-in hover:border-primary/30 transition-all overflow-hidden"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base truncate">{site.name}</CardTitle>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{site.address}</span>
                      </div>
                    </div>
                  </div>
                  <Badge variant={site.isActive ? 'success' : 'secondary'} className="flex-shrink-0">
                    {site.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 overflow-hidden px-6">
                {/* Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="w-4 h-4" />
                      <span className="text-xs">Guards</span>
                    </div>
                    <p className="text-xl font-bold font-mono mt-1">
                      {getActiveGuardCount(site.id)}/{getGuardCount(site.id)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      <span className="text-xs">Geofence</span>
                    </div>
                    <p className="text-xl font-bold font-mono mt-1">
                      {site.geofenceType === 'polygon' ? 'Polygon' : `${site.geofenceRadius}m`}
                    </p>
                  </div>
                </div>

                {/* Coordinates */}
                <div className="text-xs text-muted-foreground font-mono p-2 rounded bg-muted/30 break-all">
                  {site.location && Number.isFinite(site.location.lat) && Number.isFinite(site.location.lng)
                    ? `${site.location.lat.toFixed(4)}°N, ${site.location.lng.toFixed(4)}°E`
                    : 'No location'}
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2">
                  <Link to={`/live-map?site=${site.id}`} className="w-full">
                    <Button variant="default" size="sm" className="h-9 w-full flex items-center justify-center gap-1 text-xs">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>View</span>
                    </Button>
                  </Link>
                  <Link to={`/manage-site/${site.id}`} className="w-full">
                    <Button variant="outline" size="sm" className="h-9 w-full flex items-center justify-center gap-1 text-xs">
                      <Settings className="w-3.5 h-3.5" />
                      <span>Manage</span>
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}

// Map click handler to capture clicks and pass lat/lng to parent
function MapClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
}
