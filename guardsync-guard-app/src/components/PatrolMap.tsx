import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { PatrolPoint } from '@/types/guard';

// Fix for default marker icons in React-Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface PatrolPointStatus extends PatrolPoint {
  isCompleted: boolean;
  completedAt?: string;
  distance?: number;
}

interface PatrolMapProps {
  patrolPoints: PatrolPointStatus[];
  currentPosition: { latitude: number; longitude: number } | null;
  nextPointId?: string;
}

// Custom marker icons
const createPatrolPointIcon = (
  order: number,
  isCompleted: boolean,
  isNext: boolean
) => {
  const bgColor = isCompleted 
    ? '#22c55e' // green for completed
    : isNext 
      ? '#22c55e' // green for next (will flash)
      : '#6b7280'; // gray for upcoming

  const pulseClass = isNext ? 'patrol-point-pulse' : '';

  return L.divIcon({
    className: 'custom-patrol-marker',
    html: `
      <div class="relative flex items-center justify-center">
        ${isNext ? `<div class="absolute inset-0 rounded-full ${pulseClass}" style="background: ${bgColor}; opacity: 0.4; animation: pulse-green 1.5s ease-in-out infinite;"></div>` : ''}
        <div class="relative w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white font-bold text-sm" style="background: ${bgColor};">
          ${isCompleted ? '✓' : order}
        </div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

// Current location marker
const currentLocationIcon = L.divIcon({
  className: 'current-location-marker',
  html: `
    <div class="relative">
      <div class="absolute -inset-3 rounded-full animate-ping" style="background: rgba(59, 130, 246, 0.4);"></div>
      <div class="relative w-4 h-4 rounded-full border-3 border-white shadow-lg" style="background: #3b82f6; border-width: 3px;"></div>
    </div>
  `,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

// Component to fit map bounds
function MapBoundsUpdater({ points, currentPosition }: { 
  points: PatrolPointStatus[]; 
  currentPosition: { latitude: number; longitude: number } | null;
}) {
  const map = useMap();

  useEffect(() => {
    const allPoints: [number, number][] = points.map(p => [p.latitude, p.longitude]);
    
    if (currentPosition) {
      allPoints.push([currentPosition.latitude, currentPosition.longitude]);
    }

    if (allPoints.length > 0) {
      const bounds = L.latLngBounds(allPoints);
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [map, points, currentPosition]);

  return null;
}

export default function PatrolMap({ patrolPoints, currentPosition, nextPointId }: PatrolMapProps) {
  // Create route polyline coordinates (ordered by patrol point order)
  const routeCoordinates = useMemo(() => {
    return [...patrolPoints]
      .sort((a, b) => a.order - b.order)
      .map(point => [point.latitude, point.longitude] as [number, number]);
  }, [patrolPoints]);

  // Determine the next point (first incomplete point by order)
  const nextPoint = useMemo(() => {
    if (nextPointId) {
      return patrolPoints.find(p => p.id === nextPointId);
    }
    return [...patrolPoints]
      .sort((a, b) => a.order - b.order)
      .find(p => !p.isCompleted);
  }, [patrolPoints, nextPointId]);

  // Default center (will be overridden by bounds)
  const defaultCenter: [number, number] = patrolPoints.length > 0 
    ? [patrolPoints[0].latitude, patrolPoints[0].longitude]
    : [12.9716, 77.5946]; // Bangalore default

  return (
    <div className="relative w-full h-64 rounded-xl overflow-hidden border border-border">
      {/* CSS for pulsing animation */}
      <style>{`
        @keyframes pulse-green {
          0%, 100% {
            transform: scale(1);
            opacity: 0.4;
          }
          50% {
            transform: scale(2);
            opacity: 0;
          }
        }
        .patrol-point-pulse {
          animation: pulse-green 1.5s ease-in-out infinite;
        }
        .leaflet-container {
          height: 100%;
          width: 100%;
          border-radius: 0.75rem;
        }
      `}</style>
      
      <MapContainer
        center={defaultCenter}
        zoom={15}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Route polyline */}
        <Polyline
          positions={routeCoordinates}
          pathOptions={{
            color: '#6366f1',
            weight: 3,
            opacity: 0.7,
            dashArray: '10, 10',
          }}
        />

        {/* Patrol points markers */}
        {patrolPoints.map((point) => (
          <React.Fragment key={point.id}>
            {/* Radius circle for each point */}
            <Circle
              center={[point.latitude, point.longitude]}
              radius={point.radiusMeters}
              pathOptions={{
                color: point.isCompleted ? '#22c55e' : 
                       point.id === nextPoint?.id ? '#22c55e' : '#6b7280',
                fillColor: point.isCompleted ? '#22c55e' : 
                           point.id === nextPoint?.id ? '#22c55e' : '#6b7280',
                fillOpacity: 0.1,
                weight: 1,
              }}
            />
            {/* Point marker */}
            <Marker
              position={[point.latitude, point.longitude]}
              icon={createPatrolPointIcon(
                point.order,
                point.isCompleted,
                point.id === nextPoint?.id
              )}
            />
          </React.Fragment>
        ))}

        {/* Current location marker */}
        {currentPosition && (
          <Marker
            position={[currentPosition.latitude, currentPosition.longitude]}
            icon={currentLocationIcon}
          />
        )}

        <MapBoundsUpdater points={patrolPoints} currentPosition={currentPosition} />
      </MapContainer>

      {/* Map legend */}
      <div className="absolute bottom-2 left-2 bg-background/90 backdrop-blur-sm rounded-lg p-2 text-xs space-y-1 z-[1000]">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span>Completed / Next</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gray-500"></div>
          <span>Upcoming</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          <span>Your Location</span>
        </div>
      </div>
    </div>
  );
}
