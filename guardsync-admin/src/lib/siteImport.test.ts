import { describe, it, expect } from 'vitest';
import { siteFromImport } from './siteImport';

describe('siteFromImport', () => {
  it('keeps a complete entry with only the fields the server takes', () => {
    const { site, error } = siteFromImport({
      id: 'site-9', name: ' Cedar Grove ', address: '12 Park Rd', location: { lat: '12.97', lng: 77.59 },
      geofenceRadius: 150, assignedGuards: ['guard-1'], extra: 'x',
    }, 0);
    expect(error).toBeUndefined();
    expect(site).toEqual({
      id: 'site-9', name: 'Cedar Grove', address: '12 Park Rd', location: { lat: 12.97, lng: 77.59 },
      isActive: true, geofenceRadius: 150,
    });
  });

  it('skips entries without a name, address or location instead of crashing', () => {
    expect(siteFromImport({ name: 'No location site' }, 0).error).toMatch(/address is missing/);
    expect(siteFromImport({ name: 'A', address: 'B' }, 1).error).toMatch(/location lat\/lng/);
    expect(siteFromImport({ name: 'A', address: 'B', location: { lat: null, lng: 1 } }, 1).error).toMatch(/location lat\/lng/);
    expect(siteFromImport({ address: 'B', location: { lat: 1, lng: 1 } }, 2).error).toBe('Entry 3: name is missing');
    expect(siteFromImport(null, 3).error).toBe('Entry 4 is not a site');
    expect(siteFromImport('text', 4).error).toBe('Entry 5 is not a site');
  });

  it('leaves out an out-of-range geofence radius', () => {
    const { site } = siteFromImport({ name: 'A', address: 'B', location: { lat: 1, lng: 2 }, geofenceRadius: 0, isActive: false }, 0);
    expect(site).toEqual({ name: 'A', address: 'B', location: { lat: 1, lng: 2 }, isActive: false });
  });
});
