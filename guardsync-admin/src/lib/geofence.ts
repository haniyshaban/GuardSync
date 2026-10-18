// Geofence checks shared by the dashboard's 'Not On Site' card and the guards list filter,
// so the count on the card and the filtered list always agree.
import { Guard, Site } from '@/types';
import { calculateDistance, isPointInPolygon } from './utils';

/** Whether a point lies inside a site's geofence: its polygon when it has one, else its radius. */
export function isInsideSiteGeofence(lat: number, lng: number, site: Site): boolean {
  if (site.geofenceType === 'polygon' && Array.isArray(site.geofencePolygon) && site.geofencePolygon.length > 0) {
    return isPointInPolygon({ lat, lng }, site.geofencePolygon);
  }
  if (!site.location) return false;
  return calculateDistance(lat, lng, site.location.lat, site.location.lng) <= (site.geofenceRadius || 0);
}

/** A guard assigned to an active site who has no known location or is outside its geofence. */
export function isNotOnSite(guard: Guard, sites: Site[]): boolean {
  if (!guard.siteId) return false;
  const site = sites.find(s => s.id === guard.siteId);
  if (!site || !site.isActive) return false;
  if (!guard.location) return true;
  return !isInsideSiteGeofence(guard.location.lat, guard.location.lng, site);
}
