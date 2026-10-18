// Checks the entries of an imported sites file before they are created on the server.

const toCoordinate = (value: unknown) =>
  typeof value === 'number' || (typeof value === 'string' && value.trim() !== '') ? Number(value) : NaN;

// Checks one entry of an imported file. Returns the site to create, or why it is skipped.
export function siteFromImport(entry: unknown, index: number): { site?: Record<string, unknown>; error?: string } {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return { error: `Entry ${index + 1} is not a site` };
  const e = entry as Record<string, unknown>;
  const name = typeof e.name === 'string' ? e.name.trim() : '';
  const label = name ? `"${name}"` : `Entry ${index + 1}`;
  const address = typeof e.address === 'string' ? e.address.trim() : '';
  const location = (e.location && typeof e.location === 'object' ? e.location : {}) as Record<string, unknown>;
  const lat = toCoordinate(location.lat);
  const lng = toCoordinate(location.lng);
  if (!name) return { error: `${label}: name is missing` };
  if (!address) return { error: `${label}: address is missing` };
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return { error: `${label}: location lat/lng is missing or invalid` };
  }
  const site: Record<string, unknown> = { name, address, location: { lat, lng }, isActive: e.isActive !== false };
  if (typeof e.id === 'string' && e.id.trim()) site.id = e.id.trim();
  const radius = toCoordinate(e.geofenceRadius);
  if (Number.isFinite(radius) && radius >= 10 && radius <= 5000) site.geofenceRadius = radius;
  return { site };
}
