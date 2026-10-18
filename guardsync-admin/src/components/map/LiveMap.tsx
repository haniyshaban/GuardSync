import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polygon, useMap, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Guard, Site } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import SendMessageDialog from '@/components/ui/SendMessageDialog';
import { messageGuard, pingGuard } from '@/lib/guardMessages';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

// Fix for default marker icons in React-Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom guard marker icons based on status
// Custom guard marker icons based on status
const createGuardIcon = (status: Guard['status']) => {
  const colors = {
    online: '#22c55e',
    offline: '#ef4444',
    idle: '#f59e0b',
    alert: '#dc2626',
    panic: '#ff1744',
  };

  const color = colors[status] || '#ef4444';
  const pulseClass = status === 'alert' ? 'animate-ping-slow' : (status === 'panic' ? 'marker-panic' : '');

  return L.divIcon({
    className: 'custom-guard-marker',
    html: `
      <div class="relative">
        <div class="absolute -inset-2 rounded-full ${pulseClass}" style="background: ${color}40;"></div>
        <div class="relative w-4 h-4 rounded-full border-2 border-white shadow-lg" style="background: ${color};"></div>
      </div>
    `,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
};

// Site marker icon (active/inactive)
const createSiteIcon = (active: boolean = true) => {
  if (active) {
    return L.divIcon({
      className: 'custom-site-marker',
      html: `
        <div class="relative">
          <div class="w-8 h-8 rounded-lg bg-primary/80 border-2 border-primary flex items-center justify-center shadow-lg" style="background: #4D6A57; border-color: #4D6A57;">
            <svg class="w-4 h-4" fill="white" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clip-rule="evenodd" />
            </svg>
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
  }

  // Inactive - greyed, muted icon
  return L.divIcon({
    className: 'custom-site-marker-inactive',
    html: `
      <div class="relative">
        <div class="w-8 h-8 rounded-lg bg-gray-200 border-2 border-gray-300 flex items-center justify-center shadow-sm" style="background: #e5e7eb; border-color: #d1d5db;">
          <svg class="w-4 h-4 text-gray-600" fill="#6b7280" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
          </svg>
        </div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

interface MapBoundsUpdaterProps {
  guards: Guard[];
  sites: Site[];
  focusSiteId?: string | null;
}

function MapBoundsUpdater({ guards, sites, focusSiteId }: MapBoundsUpdaterProps) {
  const map = useMap();
  const hasSetBounds = useRef(false);

  useEffect(() => {
    // If a specific site focus is requested, skip auto-fitting to all points
    if (focusSiteId) {
      return;
    }
    
    const allPoints: [number, number][] = [];
    
    guards.forEach(guard => {
      if (guard.location) {
        allPoints.push([guard.location.lat, guard.location.lng]);
      }
    });
    
    sites.forEach(site => {
      allPoints.push([site.location.lat, site.location.lng]);
      // include polygon points in bounds if present
      if ((site as any).geofenceType === 'polygon' && Array.isArray((site as any).geofencePolygon)) {
        ((site as any).geofencePolygon as Array<any>).forEach((p: any) => {
          if (p && typeof p.lat === 'number' && typeof p.lng === 'number') {
            allPoints.push([p.lat, p.lng]);
          }
        });
      }
    });

    // Only fit bounds if we have points and haven't done so yet
    if (allPoints.length > 0 && !hasSetBounds.current) {
      console.log('🗺️ MapBoundsUpdater: Fitting bounds to', allPoints.length, 'points');
      const bounds = L.latLngBounds(allPoints);
      map.fitBounds(bounds, { padding: [50, 50] });
      hasSetBounds.current = true;
    } else if (allPoints.length === 0) {
      console.log('🗺️ MapBoundsUpdater: No points to fit (guards:', guards.length, 'sites:', sites.length, ')');
    }
  }, [map, guards, sites, focusSiteId]);

  return null;
}

// Focus handler: recenters/zooms map to a specific site's geofence when requested
function MapFocusHandler({ sites, focusSiteId }: { sites: Site[]; focusSiteId?: string | null }) {
  const map = useMap();

  useEffect(() => {
    if (!focusSiteId) return;
    const site = sites.find(s => s.id === focusSiteId);
    if (!site) return;

    // cancellation tokens and timeout trackers live in the effect scope
    let cancelled = false;
    const timeouts: number[] = [];

    try {
      map.invalidateSize();
      map.whenReady(() => {
        try {
          // Polygon geofence -> flyToBounds with animation and padding
          if ((site as any).geofenceType === 'polygon' && Array.isArray((site as any).geofencePolygon) && (site as any).geofencePolygon.length > 0) {
            const pts = ((site as any).geofencePolygon as Array<any>).map((p: any) => [p.lat, p.lng]);
            const bounds = L.latLngBounds(pts as any);
            if (bounds) {
              try {
                const size = map.getSize();
                const padX = Math.round((size?.x || 800) * 0.12);
                const padY = Math.round((size?.y || 600) * 0.12);
                const MAX_FOCUS_ZOOM = 16; // avoid over-zooming into blank tiles
                if ((map as any).flyToBounds) {
                  (map as any).flyToBounds(bounds, { padding: [padX, padY], duration: 0.9, maxZoom: MAX_FOCUS_ZOOM });
                } else {
                  map.fitBounds(bounds, { padding: [padX, padY], maxZoom: MAX_FOCUS_ZOOM });
                }
              } catch (e) {
                map.fitBounds(bounds, { padding: [80, 80], maxZoom: 16 });
              }
            }
            return;
          }

          // Radius geofence -> compute zoom so radius occupies ~60% of map width and animate
          const radius = Number((site as any).geofenceRadius) || 0;
          if (radius > 0) {
            const lat = site.location.lat;
            const lng = site.location.lng;
            const mapSize = map.getSize();
            const mapWidth = (mapSize && mapSize.x) ? mapSize.x : 800;
            const desiredFraction = 0.6; // target diameter occupies 60% of map width
            const metersPerPixel = (radius * 2) / (mapWidth * desiredFraction);
            const equatorMPerPx = 156543.03392804097;
            const metersPerPixelAtZoom0 = equatorMPerPx * Math.cos(lat * Math.PI / 180);
            let zoom = Math.floor(Math.log2(metersPerPixelAtZoom0 / metersPerPixel));
            if (!isFinite(zoom) || Number.isNaN(zoom)) zoom = 15;
            const MAX_FOCUS_ZOOM_LOCAL = 16;
            zoom = Math.min(Math.max(zoom, 3), MAX_FOCUS_ZOOM_LOCAL);

            // Retry logic using moveend: wait for the map to finish moving before retrying.
            let attempts = 0;
            const maxAttempts = 4;
            const attemptFocus = () => {
              if (cancelled) return;
              attempts += 1;
              try { map.flyTo([lat, lng], zoom, { animate: true, duration: 0.9 }); } catch (e) {}

              const onMoveEnd = () => {
                try {
                  if (cancelled) {
                    map.off('moveend', onMoveEnd);
                    return;
                  }
                  const center = map.getCenter();
                  const dist = center ? center.distanceTo(L.latLng(lat, lng)) : Infinity;
                  if (!cancelled && dist > Math.max(30, radius * 0.6) && attempts < maxAttempts) {
                    // schedule a gentle retry after a short pause to allow tiles/rendering
                    const t = window.setTimeout(() => {
                      if (!cancelled) attemptFocus();
                    }, 300);
                    timeouts.push(t);
                  }
                } finally {
                  map.off('moveend', onMoveEnd);
                }
              };

              map.on('moveend', onMoveEnd);
            };

            // start first attempt
            attemptFocus();

            return;
          }

          // Fallback: simple setView
          map.setView([site.location.lat, site.location.lng], 16);
        } catch (err) {
          // ignore
        }
      });
    } catch (err) {
      // ignore
    }

    // effect cleanup: cancel any pending retries when focusSiteId or map changes
    return () => {
      cancelled = true;
      timeouts.forEach(t => clearTimeout(t));
    };
  }, [map, focusSiteId, sites]);

  return null;
}

interface LiveMapProps {
  guards: Guard[];
  sites: Site[];
  showSites?: boolean;
  showGeofences?: boolean;
  showGuards?: boolean;
  selectedGuardId?: string | null;
  onGuardClick?: (guard: Guard) => void;
  onSiteClick?: (site: Site) => void;
  focusSiteId?: string;
  showTrails?: boolean;
  playbackGuardId?: string | null;
  playbackTrigger?: number;
}

export function LiveMap({
  guards,
  sites,
  showSites = true,
  showGeofences = true,
  showGuards = true,
  selectedGuardId,
  onGuardClick,
  onSiteClick,
  focusSiteId,
  showTrails = true,
  playbackGuardId,
  playbackTrigger,
}: LiveMapProps) {
  console.log('🗺️ LiveMap render - sites:', sites?.length || 0, 'showSites:', showSites);
  if (sites && sites.length > 0) {
    console.log('🗺️ LiveMap first site:', sites[0]);
  }
  
  const [activePopupGuardId, setActivePopupGuardId] = useState<string | null>(null);
  const [localPlaybackTrigger, setLocalPlaybackTrigger] = useState(0);
  const [localPlaybackGuardId, setLocalPlaybackGuardId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogGuard, setDialogGuard] = useState<Guard | null>(null);
  // Default center on Delhi NCR region
  const defaultCenter: [number, number] = [28.6139, 77.2090];
  const defaultZoom = 10;

  // Helper to compute zoom for radius geofences (meters) using map width and latitude
  const computeZoomForRadius = (r: number, lat: number, mapWidthPx: number) => {
    const desiredFraction = 0.6; // target diameter will occupy 60% of the map width
    const metersPerPixel = (r * 2) / (mapWidthPx * desiredFraction);
    const equatorMPerPx = 156543.03392804097; // meters per pixel at zoom 0 at equator
    const metersPerPixelAtZoom0 = equatorMPerPx * Math.cos(lat * Math.PI / 180);
    let zoom = Math.floor(Math.log2(metersPerPixelAtZoom0 / metersPerPixel));
    if (!isFinite(zoom) || Number.isNaN(zoom)) zoom = 15;
    // clamp to avoid over-zooming
    const MAX_FOCUS_ZOOM = 16;
    zoom = Math.min(Math.max(zoom, 3), MAX_FOCUS_ZOOM);
    return zoom;
  };

  // Compute a reasonable marker position for a site.
  // For polygon geofences, return the polygon centroid (area-weighted) as the marker position.
  // Fallback to the configured `site.location` when polygon data is missing or degenerate.
  const getSiteMarkerPosition = (site: Site): [number, number] => {
    try {
      if ((site as any).geofenceType === 'polygon' && Array.isArray((site as any).geofencePolygon) && (site as any).geofencePolygon.length > 0) {
        const pts = (site as any).geofencePolygon as Array<any>;
        const n = pts.length;
        if (n === 0) return [site.location.lat, site.location.lng];

        // Use area-weighted centroid formula for polygons
        let area = 0;
        let cx = 0;
        let cy = 0;
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n;
          const xi = pts[i].lng;
          const yi = pts[i].lat;
          const xj = pts[j].lng;
          const yj = pts[j].lat;
          const a = xi * yj - xj * yi;
          area += a;
          cx += (xi + xj) * a;
          cy += (yi + yj) * a;
        }
        area = area / 2;
        if (area === 0) {
          // degenerate polygon: fall back to average of points
          const avgLat = pts.reduce((s, p) => s + Number(p.lat || 0), 0) / n;
          const avgLng = pts.reduce((s, p) => s + Number(p.lng || 0), 0) / n;
          return [avgLat, avgLng];
        }
        const centroidLng = cx / (6 * area);
        const centroidLat = cy / (6 * area);
        return [centroidLat, centroidLng];
      }
    } catch (e) {
      // ignore and fallback
    }
    return [site.location.lat, site.location.lng];
  };

  const getStatusVariant = (status: Guard['status']): "online" | "offline" | "idle" | "alert" | "secondary" => {
    switch (status) {
      case 'online': return 'online';
      case 'offline': return 'offline';
      case 'idle': return 'idle';
      case 'alert': return 'alert';
      case 'panic': return 'alert';
      default: return 'secondary';
    }
  };

  // Point-in-polygon (ray-casting) helper
  const pointInPolygon = (point: [number, number], vs: Array<[number, number]>): boolean => {
    const x = point[0], y = point[1];
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
      const xi = vs[i][0], yi = vs[i][1];
      const xj = vs[j][0], yj = vs[j][1];
      const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi + Number.EPSILON) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };

  const isPointInsideSiteGeofence = (lat: number, lng: number, site: Site) => {
    const pt: [number, number] = [lat, lng];
    if ((site as any).geofenceType === 'polygon' && Array.isArray((site as any).geofencePolygon) && (site as any).geofencePolygon.length > 0) {
      const vs = (site as any).geofencePolygon.map((p: any) => [p.lat, p.lng] as [number, number]);
      return pointInPolygon(pt, vs);
    }
    // fallback to circle
    const dist = L.latLng(lat, lng).distanceTo(L.latLng(site.location.lat, site.location.lng));
    return dist <= (site.geofenceRadius || 0);
  };

  const tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  // Generate a mock trail (breadcrumb) of up to `count` coordinates for a guard.
  // Prefer `locationHistory` when present; otherwise synthesize around current location.
  const generateMockTrail = (guard: Guard, count = 10) => {
    if (guard.locationHistory && guard.locationHistory.length > 0) {
      try {
        console.log('generateMockTrail:', guard.id, 'historyLen=', guard.locationHistory.length);
      } catch (e) {}
      const hist = guard.locationHistory.slice(-count).map(h => [h.lat, h.lng] as [number, number]);
      return hist;
    }
    if (!guard.location) return [] as [number, number][];
    const pts: [number, number][] = [];
    const baseLat = guard.location.lat;
    const baseLng = guard.location.lng;
    for (let i = count - 1; i >= 0; i--) {
      const factor = (i + 1) / count; // older points further from current
      const jitterLat = (Math.random() - 0.5) * 0.001 * factor;
      const jitterLng = (Math.random() - 0.5) * 0.001 * factor;
      pts.push([baseLat - jitterLat, baseLng - jitterLng]);
    }
    return pts;
  };

  // Playback controller component - animates a marker along given positions when trigger changes
  function PlaybackController({ positions, trigger }: { positions: [number, number][]; trigger?: number }) {
    const map = useMap();
    const markerRef = useRef<L.Marker | null>(null);
    useEffect(() => {
      if (!positions || positions.length === 0) return;
      if (trigger === undefined) return;
      try { console.log('PlaybackController start - positions:', positions.length, 'trigger=', trigger); } catch (e) {}
      // remove existing marker if any
      if (markerRef.current) {
        try { map.removeLayer(markerRef.current); } catch (e) {}
        markerRef.current = null;
      }

      const movingMarker = L.marker(positions[0], { zIndexOffset: 10000 });
      movingMarker.addTo(map);
      markerRef.current = movingMarker;

      let idx = 0;
      const step = () => {
        idx += 1;
        if (idx >= positions.length) {
          // finish
          setTimeout(() => {
            try { map.removeLayer(movingMarker); } catch (e) {}
          }, 500);
          return;
        }
        movingMarker.setLatLng(positions[idx]);
        setTimeout(step, 400);
      };

      setTimeout(step, 400);

      return () => {
        try { map.removeLayer(movingMarker); } catch (e) {}
        markerRef.current = null;
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [trigger]);

    return null;
  }

  return (
    <div className="relative w-full h-full rounded-lg overflow-hidden border border-border">
      
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        className="w-full h-full z-0"
        zoomControl={true}
      >
        {/*
          Using a minimalist raster basemap (CartoDB Positron) reduces visual clutter.
          Note: to fully hide specific POI types (e.g. hospitals/temples) while keeping others
          (e.g. bus stops), you need vector tiles with a styled renderer (Mapbox/MapTiler + MapLibre/Mapbox GL).
          That approach requires an API key and switching to a vector renderer. This raster layer is a quick, no-key improvement.
        */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &amp; <a href="https://carto.com/">CARTO</a>'
          url={tileUrl}
        />
        
        <MapBoundsUpdater guards={guards} sites={sites} focusSiteId={focusSiteId ?? null} />
        <MapFocusHandler sites={sites} focusSiteId={focusSiteId ?? null} />

        {/* Render site geofences (radius or polygon) */}
        {showGeofences && sites.map(site => (
          site.isActive && (
            ((site as any).geofenceType === 'polygon' && Array.isArray((site as any).geofencePolygon) && (site as any).geofencePolygon.length > 0)
            ? (
              <Polygon
                key={`geofence-poly-${site.id}`}
                positions={((site as any).geofencePolygon as Array<any>).map((p: any) => [p.lat, p.lng]) as any}
                pathOptions={{
                  color: '#4D6A57',
                  fillColor: '#4D6A57',
                  fillOpacity: 0.08,
                  weight: 2,
                }}
              />
            ) : (
              <Circle
                key={`geofence-${site.id}`}
                center={[site.location.lat, site.location.lng]}
                radius={site.geofenceRadius}
                pathOptions={{
                  color: '#4D6A57',
                  fillColor: '#4D6A57',
                  fillOpacity: 0.1,
                  weight: 2,
                  dashArray: '5, 5',
                }}
              />
            )
          )
        ))}

        {/* Render site markers */}
        {showSites && sites.map(site => {
          const pos = getSiteMarkerPosition(site);
          console.log('🗺️ Rendering site marker:', site.name, 'at', pos, 'active:', site.isActive);
          return (
          <Marker
            key={site.id}
            position={pos}
            icon={createSiteIcon(!!site.isActive)}
            eventHandlers={{
              click: () => onSiteClick?.(site),
            }}
          >
            <Popup>
              <div className="p-2 min-w-[200px]">
                <h3 className="font-semibold text-foreground" style={{ color: '#121412' }}>{site.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">{site.address}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant={site.isActive ? 'success' : 'secondary'}>
                    {site.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {site.assignedGuards.length} guards
                  </span>
                </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      { (site as any).geofenceType === 'polygon' && Array.isArray((site as any).geofencePolygon)
                        ? `Geofence: custom polygon (${(site as any).geofencePolygon.length} points)`
                        : `Geofence: ${site.geofenceRadius}m radius`
                      }
                    </p>
                    <div className="mt-3">
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/manage-site/${site.id}`}>Manage Site</Link>
                      </Button>
                    </div>
              </div>
            </Popup>
          </Marker>
        );
        })}


        {/* Render guard markers if enabled */}
          {(() => {
          console.log('🔵 Rendering guards:', showGuards, 'total guards:', guards.length, 'with location:', guards.filter(g => g.location).length);
          return showGuards && guards.map((guard) => {
          if (!guard.location) {
            console.log('🔵 Guard without location:', guard.name, guard.id);
            return null;
          }
          const insideAny = sites.some(site => isPointInsideSiteGeofence(guard.location!.lat, guard.location!.lng, site));
          const effectiveStatus: Guard['status'] = guard.status === 'panic' ? 'panic' : (guard.status === 'alert' ? 'alert' : (insideAny ? 'online' : guard.status));
          return (
            <Marker
              key={guard.id}
              position={[guard.location.lat, guard.location.lng]}
              icon={createGuardIcon(effectiveStatus)}
              eventHandlers={{
                click: () => {
                  onGuardClick?.(guard);
                  setActivePopupGuardId(guard.id);
                },
                popupclose: () => {
                  setActivePopupGuardId(null);
                }
              }}
            >
              <Popup>
                <div className="p-2 min-w-[200px] relative">
                  <div className="absolute right-2 top-2">
                    <Link to={`/guards/${guard.id}`} onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="outline">View</Button>
                    </Link>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`status-dot status-${guard.status}`} />
                    <h3 className="font-semibold text-foreground" style={{ color: '#121412' }}>{guard.name}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">ID: {guard.employeeId}</p>
                  <p className="text-xs text-muted-foreground mt-1">Phone: <a href={`tel:${guard.phone}`} className="underline">{guard.phone}</a></p>
                  <div className="mt-2">
                    <Badge variant={getStatusVariant(guard.status)}>
                      {guard.status.charAt(0).toUpperCase() + guard.status.slice(1)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Last seen: {formatDistanceToNow(guard.lastSeen, { addSuffix: true })}</p>
                  {guard.clockedIn && guard.clockInTime && (
                    <p className="text-xs text-muted-foreground">Clocked in: {formatDistanceToNow(guard.clockInTime, { addSuffix: true })}</p>
                  )}
                  <div className="mt-3 flex items-center gap-2">
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); pingGuard(guard); }}>Ping</Button>
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setDialogGuard(guard); setDialogOpen(true); }}>Message</Button>
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setLocalPlaybackGuardId(guard.id); setLocalPlaybackTrigger(t => t + 1); }}>Playback</Button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        });
        })()}

        {/* Render movement trail for selected guard if enabled */}
        {showTrails && (() => {
          const id = activePopupGuardId || selectedGuardId;
          if (!id) return null;
          const g = guards.find(x => x.id === id);
          if (!g) return null;
          const trail = generateMockTrail(g, 10);
          return (
            <>
              <Polyline key={`trail-${g.id}`} positions={trail as any} pathOptions={{ color: '#4D6A57', weight: 3, opacity: 0.6 }} />
              {/* playback by either parent props or local playback controls */}
              {((typeof playbackTrigger !== 'undefined' && playbackGuardId === g.id && playbackTrigger) || (localPlaybackGuardId === g.id && localPlaybackTrigger)) && (
                <PlaybackController positions={trail} trigger={localPlaybackGuardId === g.id ? localPlaybackTrigger : playbackTrigger} />
              )}
            </>
          );
        })()}
        </MapContainer>

        {/* Send message dialog used by marker popups */}
        <SendMessageDialog open={dialogOpen} onOpenChange={setDialogOpen} guard={dialogGuard} onSend={(g, msg) => g ? messageGuard(g, msg) : undefined} />

      {/* Map legend */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-card/95 backdrop-blur-sm rounded-lg border border-border p-3">
        <h4 className="text-xs font-semibold text-foreground mb-2">Status Legend</h4>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="status-dot status-online" />
            <span className="text-xs text-muted-foreground">Online</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="status-dot status-idle" />
            <span className="text-xs text-muted-foreground">Idle</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="status-dot status-offline" />
            <span className="text-xs text-muted-foreground">Offline</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="status-dot status-alert" />
            <span className="text-xs text-muted-foreground">Alert</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="status-dot status-panic" />
            <span className="text-xs text-muted-foreground">Panic</span>
          </div>
        </div>
      </div>
    </div>
  );
}
