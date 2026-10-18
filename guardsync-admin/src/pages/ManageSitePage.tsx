import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, GripVertical, Search, UserPlus, X, Check, Sun, Moon, AlertTriangle } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { MapContainer, TileLayer, Marker, Polygon, Circle, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { API_BASE_URL } from '@/lib/utils';
import { fetchJson, fetchWithAuth, getApiErrorMessage, parseApiData } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Guard } from '@/types';

// Map center when a site has no stored location
const FALLBACK_CENTER: [number, number] = [12.97, 77.59];

const toPolygon = (points: unknown): { lat: number; lng: number }[] =>
  Array.isArray(points) ? points.map((p: { lat?: unknown; lng?: unknown }) => ({ lat: Number(p?.lat), lng: Number(p?.lng) })) : [];

interface PatrolCheckpoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  order: number;
}

export default function ManageSitePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const siteId = String(id || '');
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  const [site, setSite] = useState<any>(null);
  const [isLoadingSite, setIsLoadingSite] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState<boolean>(true);
  const [assignedGuardIds, setAssignedGuardIds] = useState<string[]>([]);
  const [geofenceMode, setGeofenceMode] = useState<'radius' | 'polygon'>('radius');
  const [radiusValue, setRadiusValue] = useState<number>(100);
  const [polygonText, setPolygonText] = useState<string>('');
  const [polygonPoints, setPolygonPoints] = useState<{lat:number;lng:number}[]>([]);
  
  // Patrol route state
  const [patrolCheckpoints, setPatrolCheckpoints] = useState<PatrolCheckpoint[]>([]);
  const [newCheckpointRadius, setNewCheckpointRadius] = useState(15);
  const [patrolEditMode, setPatrolEditMode] = useState(false);

  // Guards state - fetch from API
  const [allGuards, setAllGuards] = useState<Guard[]>([]);
  const [isAddGuardDialogOpen, setIsAddGuardDialogOpen] = useState(false);
  const [guardSearchQuery, setGuardSearchQuery] = useState('');
  const [selectedGuardsToAdd, setSelectedGuardsToAdd] = useState<string[]>([]);
  const [shiftFilter, setShiftFilter] = useState<'all' | 'day' | 'night'>('all');
  
  // Delete confirmation dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Replies are {success, data}; parseApiData unwraps them
  async function loadGuards() {
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/api/guards`);
      if (res.ok) {
        const data = parseApiData(await res.json());
        if (Array.isArray(data)) {
          setAllGuards(data);
        }
      }
    } catch (e) {
      console.log('Could not load guards from backend', e);
    }
  }

  // Puts a site from the server into the page's state (on load and after a save)
  function applySite(data: any) {
    setSite(data);
    setName(data.name || '');
    setIsActive(!!data.isActive);
    setAssignedGuardIds(Array.isArray(data.assignedGuards) ? data.assignedGuards.slice() : []);
    setGeofenceMode(data.geofenceType === 'polygon' ? 'polygon' : 'radius');
    setRadiusValue(data.geofenceRadius || 100);
    setPolygonText(data.geofencePolygon ? JSON.stringify(data.geofencePolygon, null, 2) : '');
    setPolygonPoints(toPolygon(data.geofencePolygon));
    setPatrolCheckpoints(Array.isArray(data.patrolRoute) ? data.patrolRoute : []);
  }

  // Fetch all guards from API
  useEffect(() => {
    loadGuards();
  }, []);

  // Fetch site from API on mount
  useEffect(() => {
    const loadSite = async () => {
      setIsLoadingSite(true);
      try {
        const res = await fetchWithAuth(`${API_BASE_URL}/api/sites/${encodeURIComponent(siteId)}`);
        if (res.ok) {
          const data = parseApiData(await res.json());
          if (data && typeof data === 'object') applySite(data);
        }
      } catch (e) {
        console.log('Could not load site from backend');
      } finally {
        setIsLoadingSite(false);
      }
    };
    loadSite();
  }, [siteId]);

  if (!site && isLoadingSite) {
    return (
      <DashboardLayout>
        <div className="p-6 text-sm text-muted-foreground">Loading site…</div>
      </DashboardLayout>
    );
  }

  if (!site) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <Card>
            <CardHeader>
              <CardTitle>Site not found</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">The requested site does not exist.</p>
              <div className="mt-4">
                <Link to="/sites">
                  <Button variant="outline">Back to Sites</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const hasLocation = Number.isFinite(Number(site.location?.lat)) && Number.isFinite(Number(site.location?.lng));
  const center: [number, number] = hasLocation ? [Number(site.location.lat), Number(site.location.lng)] : FALLBACK_CENTER;

  // Use allGuards from API instead of mockGuards
  const assignedGuards = allGuards.filter(g => assignedGuardIds.includes(g.id));
  
  // Filter assigned guards by shift type
  const filteredAssignedGuards = assignedGuards.filter(g => {
    if (shiftFilter === 'all') return true;
    return g.shiftType === shiftFilter;
  });
  
  const availableGuards = allGuards.filter(g => !assignedGuardIds.includes(g.id));
  
  // Filter available guards based on search query
  const filteredAvailableGuards = availableGuards.filter(g => 
    (g.name?.toLowerCase() || '').includes(guardSearchQuery.toLowerCase()) ||
    (g.employeeId?.toLowerCase() || '').includes(guardSearchQuery.toLowerCase()) ||
    (g.phone || '').includes(guardSearchQuery)
  );

  // Toggle guard selection for adding
  function toggleGuardSelection(guardId: string) {
    setSelectedGuardsToAdd(prev => 
      prev.includes(guardId) 
        ? prev.filter(id => id !== guardId)
        : [...prev, guardId]
    );
  }

  // Add selected guards
  function addSelectedGuards() {
    if (selectedGuardsToAdd.length === 0) return;
    setAssignedGuardIds(prev => [...prev, ...selectedGuardsToAdd]);
    setSelectedGuardsToAdd([]);
    setGuardSearchQuery('');
    setIsAddGuardDialogOpen(false);
  }

  // Get status badge variant
  function getStatusVariant(status: string): "online" | "offline" | "idle" | "alert" | "pending" | "secondary" {
    const validStatuses = ['online', 'offline', 'idle', 'alert', 'pending'];
    return validStatuses.includes(status) ? status as any : 'secondary';
  }

  // Saves only what was changed on the page: the site's own fields with PUT /api/sites/:id,
  // and each added or removed guard with PUT /api/guards/:id {siteId}.
  async function saveChanges() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast({ title: 'Not saved', description: "Site name can't be empty.", variant: 'destructive' });
      return;
    }

    const changes: Record<string, unknown> = {};
    if (trimmedName !== site.name) changes.name = trimmedName;
    if (isActive !== !!site.isActive) changes.isActive = isActive;

    const savedMode = site.geofenceType === 'polygon' ? 'polygon' : 'radius';
    if (geofenceMode === 'radius') {
      if (savedMode !== 'radius') changes.geofenceType = 'radius';
      if (savedMode !== 'radius' || Number(radiusValue) !== (site.geofenceRadius || 100)) {
        changes.geofenceRadius = Number(radiusValue);
      }
    } else {
      // prefer drawn polygon points, fallback to parsed JSON
      let polygon = polygonPoints;
      if (polygon.length === 0) {
        try {
          polygon = toPolygon(JSON.parse(polygonText));
        } catch (err) {
          polygon = [];
        }
      }
      if (polygon.length < 3 || polygon.some(p => !Number.isFinite(p.lat) || !Number.isFinite(p.lng))) {
        toast({ title: 'Not saved', description: 'A polygon geofence needs at least 3 points on the map.', variant: 'destructive' });
        return;
      }
      if (savedMode !== 'polygon') changes.geofenceType = 'polygon';
      if (JSON.stringify(polygon) !== JSON.stringify(toPolygon(site.geofencePolygon))) changes.geofencePolygon = polygon;
    }

    const savedRoute = Array.isArray(site.patrolRoute) ? site.patrolRoute : [];
    if (JSON.stringify(patrolCheckpoints) !== JSON.stringify(savedRoute)) changes.patrolRoute = patrolCheckpoints;

    const savedGuardIds: string[] = Array.isArray(site.assignedGuards) ? site.assignedGuards : [];
    const addedGuardIds = assignedGuardIds.filter(gid => !savedGuardIds.includes(gid));
    const removedGuardIds = savedGuardIds.filter(gid => !assignedGuardIds.includes(gid));
    if (addedGuardIds.length > 0 || removedGuardIds.length > 0) changes.assignedGuards = assignedGuardIds;

    if (Object.keys(changes).length === 0) {
      toast({ title: 'Nothing to save', description: 'No changes were made.' });
      return;
    }

    setIsSaving(true);
    try {
      const sitePath = `${API_BASE_URL}/api/sites/${encodeURIComponent(String(site.id))}`;
      await fetchJson(sitePath, 'PUT', changes);
      for (const guardId of addedGuardIds) {
        await fetchJson(`${API_BASE_URL}/api/guards/${encodeURIComponent(guardId)}`, 'PUT', { siteId: site.id });
      }
      for (const guardId of removedGuardIds) {
        // A guard listed here but already moved to another site keeps that other site
        const guard = allGuards.find(g => g.id === guardId);
        if (guard && guard.siteId && guard.siteId !== site.id) continue;
        await fetchJson(`${API_BASE_URL}/api/guards/${encodeURIComponent(guardId)}`, 'PUT', { siteId: null });
      }

      // Show what the server now holds
      applySite(await fetchJson(sitePath));
      await loadGuards();
      toast({ title: 'Site saved', description: 'Your changes were saved.' });
    } catch (err) {
      console.error('Failed to save site:', err);
      toast({ title: 'Not saved', description: err instanceof Error ? err.message : 'Failed to save site.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  }

  // Removing is applied with Save, like adding
  function removeGuard(guardId: string) {
    setAssignedGuardIds(prev => prev.filter(id => id !== guardId));
  }

  // Active/Inactive is saved straight away; only that field is sent
  async function setActiveOnServer(value: boolean) {
    if (value === !!site.isActive) {
      setIsActive(value);
      return;
    }
    setIsActive(value);
    try {
      await fetchJson(`${API_BASE_URL}/api/sites/${encodeURIComponent(String(site.id))}`, 'PUT', { isActive: value });
      setSite({ ...site, isActive: value });
      toast({ title: value ? 'Site activated' : 'Site deactivated' });
    } catch (e) {
      setIsActive(!!site.isActive);
      toast({ title: 'Not saved', description: e instanceof Error ? e.message : 'Could not change the site status.', variant: 'destructive' });
    }
  }

  async function deleteSite() {
    if (!site || deleteConfirmText !== site.name) {
      toast({ title: 'Not deleted', description: 'Please type the exact site name to confirm deletion.', variant: 'destructive' });
      return;
    }
    try {
      // Delete from API (the server unassigns the site's guards)
      const res = await fetchWithAuth(`${API_BASE_URL}/api/sites/${encodeURIComponent(String(site.id))}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(getApiErrorMessage(data, 'Failed to delete site'));
      }
      toast({ title: 'Site deleted', description: `${site.name} was deleted.` });
      navigate('/sites');
    } catch (err) {
      console.error('Failed to delete site:', err);
      toast({ title: 'Not deleted', description: err instanceof Error ? err.message : 'Failed to delete site.', variant: 'destructive' });
    } finally {
      setShowDeleteDialog(false);
      setDeleteConfirmText('');
    }
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="mb-4">
          <Button variant="ghost" onClick={() => navigate(-1)} className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Manage Site — {site.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-muted-foreground">Site Name</label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-2" />
                  </div>

                  <div>
                    <label className="text-sm text-muted-foreground">Status</label>
                    <div className="mt-2">
                      <Button 
                        variant={isActive ? 'glow' : 'outline'} 
                        size="sm" 
                        onClick={() => setActiveOnServer(true)} 
                        className="mr-2"
                      >
                        Active
                      </Button>
                      <Button 
                        variant={!isActive ? 'outline' : 'ghost'} 
                        size="sm" 
                        onClick={() => setActiveOnServer(false)}
                      >
                        Inactive
                      </Button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm text-muted-foreground">Assigned Guards</label>
                      <div className="flex items-center gap-2">
                        {/* Shift Filter */}
                        <div className="flex items-center gap-1 mr-2">
                          <Button 
                            variant={shiftFilter === 'all' ? 'default' : 'ghost'} 
                            size="sm" 
                            onClick={() => setShiftFilter('all')}
                            className="h-7 px-2"
                          >
                            All
                          </Button>
                          <Button 
                            variant={shiftFilter === 'day' ? 'default' : 'ghost'} 
                            size="sm" 
                            onClick={() => setShiftFilter('day')}
                            className="h-7 px-2"
                          >
                            <Sun className="w-3 h-3 mr-1" />
                            Day
                          </Button>
                          <Button 
                            variant={shiftFilter === 'night' ? 'default' : 'ghost'} 
                            size="sm" 
                            onClick={() => setShiftFilter('night')}
                            className="h-7 px-2"
                          >
                            <Moon className="w-3 h-3 mr-1" />
                            Night
                          </Button>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {filteredAssignedGuards.length} assigned
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
                      {filteredAssignedGuards.length === 0 && (
                        <div className="text-sm text-muted-foreground text-center py-4 bg-muted/10 rounded-lg">
                          {shiftFilter === 'all' ? 'No guards assigned to this site' : `No ${shiftFilter} shift guards assigned`}
                        </div>
                      )}
                      {filteredAssignedGuards.map(g => (
                        <div key={g.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                              {(g.name || '?').charAt(0)}
                            </div>
                            <div>
                              <div className="font-medium">{g.name || 'Unknown'}</div>
                              <div className="text-xs text-muted-foreground">{g.employeeId || 'N/A'} • {g.phone || 'N/A'}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {g.shiftType && (
                              <Badge variant="outline" className="text-xs">
                                {g.shiftType === 'day' ? <Sun className="w-3 h-3 mr-1" /> : <Moon className="w-3 h-3 mr-1" />}
                                {g.shiftType}
                              </Badge>
                            )}
                            <Badge variant={getStatusVariant(g.status)} className="text-xs">
                              {g.status}
                            </Badge>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => removeGuard(g.id)}
                              className="text-red-500 hover:text-red-600 hover:bg-red-50"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <p className="mt-2 text-xs text-muted-foreground">Guards you add or remove are saved when you press Save.</p>
                    <Button
                      onClick={() => {
                        setSelectedGuardsToAdd([]);
                        setGuardSearchQuery('');
                        setIsAddGuardDialogOpen(true);
                      }} 
                      variant="outline" 
                      className="mt-4 w-full"
                    >
                      <UserPlus className="w-4 h-4 mr-2" />
                      Add Guard to Site
                    </Button>
                  </div>

                  {/* Patrol Route Editor */}
                  <div className="mt-6 pt-6 border-t">
                    <div className="flex items-center justify-between mb-4">
                      <label className="text-sm text-muted-foreground font-medium">Patrol Route Checkpoints</label>
                      <Button
                        variant={patrolEditMode ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setPatrolEditMode(!patrolEditMode)}
                      >
                        {patrolEditMode ? 'Done Editing' : 'Edit Route'}
                      </Button>
                    </div>

                    {patrolEditMode && (
                      <div className="mb-2 text-xs text-muted-foreground">
                        Click on the map below to add checkpoints. Each click adds a numbered checkpoint.
                      </div>
                    )}

                    {/* Patrol Route Map */}
                    {/* `isolate` keeps the z-[1000] map controls below the page's menus and overlays */}
                    <div className="w-full h-96 rounded-md overflow-hidden border relative isolate">
                      {/* Radius input - top right */}
                      {patrolEditMode && (
                        <div className="absolute top-2 right-2 z-[1000] bg-background/95 backdrop-blur-sm p-2 rounded-lg shadow-lg border">
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-muted-foreground whitespace-nowrap">Radius (m)</label>
                            <Input
                              type="number"
                              value={newCheckpointRadius}
                              onChange={(e) => setNewCheckpointRadius(Number(e.target.value))}
                              className="w-20 h-8 text-sm"
                            />
                          </div>
                        </div>
                      )}
                      
                      {/* Clear all button - bottom right */}
                      {patrolEditMode && patrolCheckpoints.length > 0 && (
                        <div className="absolute bottom-2 right-2 z-[1000]">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setPatrolCheckpoints([])}
                            className="shadow-lg"
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Clear All
                          </Button>
                        </div>
                      )}
                      
                      <MapContainer
                        center={center}
                        zoom={16}
                        className="w-full h-full"
                      >
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        {/* Site center marker */}
                        {hasLocation && <Marker position={center} />}
                        {/* Patrol checkpoints */}
                        {patrolCheckpoints.map((cp, i) => (
                          <Circle
                            key={cp.id}
                            center={[cp.latitude, cp.longitude]}
                            radius={cp.radiusMeters}
                            pathOptions={{ color: '#22c55e', fillColor: '#22c55e', fillOpacity: 0.2 }}
                          />
                        ))}
                        {patrolCheckpoints.map((cp, i) => (
                          <Marker
                            key={`marker-${cp.id}`}
                            position={[cp.latitude, cp.longitude]}
                            icon={L.divIcon({
                              className: 'patrol-checkpoint-marker',
                              html: `<div style="width:24px;height:24px;border-radius:50%;background:#22c55e;border:2px solid white;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:12px;">${cp.order}</div>`,
                              iconSize: [24, 24],
                              iconAnchor: [12, 12],
                            })}
                          />
                        ))}
                        {patrolEditMode && (
                          <PatrolMapClickHandler
                            onAdd={(lat, lng) => {
                              const newCp: PatrolCheckpoint = {
                                id: `pp-${Date.now()}`,
                                name: `Checkpoint ${patrolCheckpoints.length + 1}`,
                                latitude: lat,
                                longitude: lng,
                                radiusMeters: newCheckpointRadius,
                                order: patrolCheckpoints.length + 1,
                              };
                              setPatrolCheckpoints([...patrolCheckpoints, newCp]);
                            }}
                          />
                        )}
                      </MapContainer>
                    </div>
                    
                    {/* Checkpoint Tags */}
                    {patrolCheckpoints.length > 0 && (
                      <div className="mt-3 p-3 bg-muted/20 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-muted-foreground font-medium">
                            {patrolCheckpoints.length} Checkpoint{patrolCheckpoints.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {patrolCheckpoints.map((cp) => (
                            <div
                              key={cp.id}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-500/10 border border-green-500/30 rounded-full text-sm"
                            >
                              <span className="w-5 h-5 rounded-full bg-green-500 text-white text-xs flex items-center justify-center font-bold">
                                {cp.order}
                              </span>
                              <span className="text-muted-foreground text-xs ml-1">
                                {cp.radiusMeters}m
                              </span>
                              {patrolEditMode && (
                                <button
                                  onClick={() => {
                                    // Remove the checkpoint and renumber
                                    const filtered = patrolCheckpoints.filter(c => c.id !== cp.id);
                                    const renumbered = filtered.map((c, index) => ({
                                      ...c,
                                      order: index + 1,
                                      name: `Checkpoint ${index + 1}`
                                    }));
                                    setPatrolCheckpoints(renumbered);
                                  }}
                                  className="ml-1 w-4 h-4 rounded-full bg-red-500/20 hover:bg-red-500/40 flex items-center justify-center text-red-500 transition-colors"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {patrolCheckpoints.length === 0 && !patrolEditMode && (
                      <div className="text-sm text-muted-foreground text-center py-2">
                        No patrol checkpoints defined. Enable edit mode to add checkpoints.
                      </div>
                    )}
                  </div>
                  
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Geofence</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">Geofence Mode</div>
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

                  {geofenceMode === 'radius' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">Radius</div>
                        <div className="text-sm font-semibold bg-primary/10 px-3 py-1 rounded-full">
                          {radiusValue}m
                        </div>
                      </div>
                      <Slider
                        value={[radiusValue]}
                        onValueChange={(value) => setRadiusValue(value[0])}
                        min={50}
                        max={1000}
                        step={10}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>50m</span>
                        <span>1000m</span>
                      </div>
                      
                      {/* Live preview map */}
                      <div className="w-full h-64 rounded-md overflow-hidden border mt-4">
                        <MapContainer
                          center={center}
                          zoom={15}
                          className="w-full h-full"
                        >
                          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                          {hasLocation && <Marker position={center} />}
                          <Circle
                            center={center}
                            radius={radiusValue}
                            pathOptions={{ color: '#4D6A57', fillColor: '#4D6A57', fillOpacity: 0.2 }}
                          />
                        </MapContainer>
                      </div>
                    </div>
                  )}

                  {geofenceMode === 'polygon' && (
                    <div>
                      <div className="text-sm text-muted-foreground mb-2">Draw polygon on map (click to add points)</div>
                      <div className="w-full h-72 rounded-md overflow-hidden border">
                        <MapContainer center={center} zoom={13} className={`w-full h-full ${geofenceMode === 'polygon' ? 'cursor-pin' : ''}`}>
                          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                          <Polygon positions={polygonPoints.map(p => [p.lat, p.lng]) as any} pathOptions={{ color: 'blue', fillOpacity: 0.1 }} />
                            {polygonPoints.map((p, i) => (
                              <Marker key={i} position={[p.lat, p.lng]} />
                            ))}
                            {allGuards.filter(g => g.siteId === site.id && g.location).map(g => (
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
                        <div className="text-xs text-muted-foreground ml-auto">{polygonPoints.length} point{polygonPoints.length !== 1 ? 's' : ''}</div>
                      </div>
                    </div>
                  )}
                  
                  {/* Save actions under the map */}
                  <div className="mt-4">
                    <Button onClick={saveChanges} disabled={isSaving} className="w-full h-10">{isSaving ? 'Saving...' : 'Save'}</Button>
                    <Button variant="outline" onClick={() => navigate('/sites')} className="w-full mt-2">Cancel</Button>
                  </div>

                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Danger zone: moved lower so user must scroll to reach it (admins only) */}
        {isAdmin && (
        <div className="mt-8">
          <Card className="border-destructive/30 bg-destructive/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                Danger Zone
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Deleting a site removes it and will unassign any guards. This action is irreversible.</p>
              <div className="mt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteDialog(true)}
                  className="w-full sm:w-1/5 text-left border-red-200 text-red-600 bg-red-50 hover:bg-red-100 hover:text-red-700 hover:border-red-300 focus:text-red-700"
                >
                  Delete site
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        )}
      </div>

      {/* Add Guard Dialog */}
      <Dialog open={isAddGuardDialogOpen} onOpenChange={setIsAddGuardDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              Add Guards to Site
            </DialogTitle>
            <DialogDescription>
              Search and select guards to add to {site.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, ID, or phone..."
                value={guardSearchQuery}
                onChange={(e) => setGuardSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Available Guards List */}
            <div className="border rounded-lg max-h-80 overflow-y-auto">
              {filteredAvailableGuards.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {guardSearchQuery ? (
                    <div>
                      <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No guards found matching "{guardSearchQuery}"</p>
                    </div>
                  ) : (
                    <div>
                      <UserPlus className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">All guards are already assigned</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="divide-y">
                  {filteredAvailableGuards.map(g => {
                    const isSelected = selectedGuardsToAdd.includes(g.id);
                    return (
                      <div
                        key={g.id}
                        onClick={() => toggleGuardSelection(g.id)}
                        className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${
                          isSelected 
                            ? 'bg-primary/10 border-l-4 border-l-primary' 
                            : 'hover:bg-muted/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                            isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                          }`}>
                            {isSelected ? <Check className="w-5 h-5" /> : (g.name || '?').charAt(0)}
                          </div>
                          <div>
                            <div className="font-medium">{g.name || 'Unknown'}</div>
                            <div className="text-xs text-muted-foreground">{g.employeeId || 'N/A'} • {g.phone || 'N/A'}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={getStatusVariant(g.status)} className="text-xs">
                            {g.status}
                          </Badge>
                          {g.siteId && (
                            <Badge variant="secondary" className="text-xs">
                              Assigned
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Selection Summary */}
            {selectedGuardsToAdd.length > 0 && (
              <div className="flex items-center justify-between p-2 bg-primary/10 rounded-lg">
                <span className="text-sm font-medium">
                  {selectedGuardsToAdd.length} guard{selectedGuardsToAdd.length > 1 ? 's' : ''} selected
                </span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setSelectedGuardsToAdd([])}
                  className="text-xs"
                >
                  Clear selection
                </Button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddGuardDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={addSelectedGuards}
              disabled={selectedGuardsToAdd.length === 0}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add {selectedGuardsToAdd.length > 0 ? `(${selectedGuardsToAdd.length})` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Site Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={(open) => {
        setShowDeleteDialog(open);
        if (!open) setDeleteConfirmText('');
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Delete Site
            </DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>{site?.name}</strong> and all associated data. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Type <strong className="text-destructive">{site?.name}</strong> to confirm:
              </label>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Enter site name"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setDeleteConfirmText('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={deleteSite}
              disabled={deleteConfirmText !== site?.name}
            >
              Delete Site
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
// Patrol route map click handler
function PatrolMapClickHandler({ onAdd }: { onAdd: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onAdd(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
}