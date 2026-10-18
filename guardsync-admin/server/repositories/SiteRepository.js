import { BaseRepository } from './BaseRepository.js';
import { randomUUID } from 'crypto';

export class SiteRepository extends BaseRepository {
  constructor(db) {
    super(db, 'sites');
  }

  /**
   * Find all sites with denormalized data (guards, patrol points, geofence points)
   */
  findAllWithRelations() {
    const sites = this.findAll('createdAt DESC');
    return sites.map(site => this.attachRelations(site));
  }

  /**
   * Find site by ID with denormalized data
   */
  findByIdWithRelations(id) {
    const site = this.findById(id);
    if (!site) return null;
    return this.attachRelations(site);
  }

  /**
   * Find active sites only
   */
  findActive() {
    return this.query('SELECT * FROM sites WHERE isActive = 1 ORDER BY createdAt DESC');
  }

  /**
   * Attach related data (guards, patrol points, geofence points) to a site record
   */
  attachRelations(site) {
    // Fetch assigned guards from normalized table
    const assignedGuards = this.query(
      'SELECT guard_id FROM site_guards WHERE site_id = ? ORDER BY guard_id',
      [site.id]
    ).map(r => r.guard_id);
    
    // Fetch patrol route points
    const patrolRoute = this.query(
      'SELECT * FROM site_patrol_points WHERE site_id = ? ORDER BY point_order',
      [site.id]
    ).map(p => ({
      id: p.id,
      name: p.name,
      latitude: p.latitude,
      longitude: p.longitude,
      radiusMeters: p.radius_meters,
      order: p.point_order
    }));
    
    // Fetch geofence polygon points
    const geofencePolygon = this.query(
      'SELECT latitude, longitude FROM site_geofence_points WHERE site_id = ? ORDER BY point_order',
      [site.id]
    ).map(p => ({
      lat: p.latitude,
      lng: p.longitude
    }));

    // Fallback to JSON columns if normalized tables are empty (backwards compatibility)
    const finalAssignedGuards = assignedGuards.length > 0 
      ? assignedGuards 
      : (site.assignedGuards ? JSON.parse(site.assignedGuards) : []);
    
    const finalPatrolRoute = patrolRoute.length > 0 
      ? patrolRoute 
      : (site.patrolRoute ? JSON.parse(site.patrolRoute) : null);
    
    const finalGeofencePolygon = geofencePolygon.length > 0 
      ? geofencePolygon 
      : (site.geofencePolygon ? JSON.parse(site.geofencePolygon) : undefined);

    return {
      id: site.id,
      name: site.name,
      address: site.address,
      location: { lat: site.lat, lng: site.lng },
      geofenceRadius: Number(site.geofenceRadius),
      geofenceType: site.geofenceType,
      geofencePolygon: finalGeofencePolygon,
      assignedGuards: finalAssignedGuards,
      isActive: !!site.isActive,
      createdAt: site.createdAt,
      patrolRoute: finalPatrolRoute,
    };
  }

  /**
   * Create site with all relations (transaction-safe)
   */
  createWithRelations(siteData) {
    return this.transaction(() => {
      // Insert main site record
      const insert = this.db.prepare(
        'INSERT INTO sites (id,name,address,lat,lng,geofenceRadius,geofenceType,geofencePolygon,assignedGuards,isActive,createdAt,patrolRoute) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)'
      );
      insert.run(
        siteData.id,
        siteData.name,
        siteData.address,
        siteData.location.lat,
        siteData.location.lng,
        siteData.geofenceRadius || 0,
        siteData.geofenceType || 'radius',
        siteData.geofencePolygon ? JSON.stringify(siteData.geofencePolygon) : null,
        siteData.assignedGuards ? JSON.stringify(siteData.assignedGuards) : '[]',
        siteData.isActive ? 1 : 0,
        siteData.createdAt || new Date().toISOString(),
        siteData.patrolRoute ? JSON.stringify(siteData.patrolRoute) : null
      );

      // Insert assigned guards into site_guards table
      if (siteData.assignedGuards && Array.isArray(siteData.assignedGuards)) {
        const insertGuard = this.db.prepare('INSERT INTO site_guards (id, site_id, guard_id) VALUES (?, ?, ?)');
        for (const guardId of siteData.assignedGuards) {
          insertGuard.run(randomUUID(), siteData.id, guardId);
        }
      }

      // Insert patrol route points
      if (siteData.patrolRoute && Array.isArray(siteData.patrolRoute)) {
        const insertPoint = this.db.prepare(
          'INSERT INTO site_patrol_points (id, site_id, name, latitude, longitude, radius_meters, point_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        for (const point of siteData.patrolRoute) {
          insertPoint.run(
            point.id || randomUUID(),
            siteData.id,
            point.name,
            point.latitude,
            point.longitude,
            point.radiusMeters || 50,
            point.order || 0
          );
        }
      }

      // Insert geofence polygon points
      if (siteData.geofencePolygon && Array.isArray(siteData.geofencePolygon)) {
        const insertGeoPoint = this.db.prepare(
          'INSERT INTO site_geofence_points (id, site_id, latitude, longitude, point_order) VALUES (?, ?, ?, ?, ?)'
        );
        for (let i = 0; i < siteData.geofencePolygon.length; i++) {
          const point = siteData.geofencePolygon[i];
          insertGeoPoint.run(randomUUID(), siteData.id, point.lat, point.lng, i);
        }
      }
    });
  }

  /**
   * Update site with all relations (transaction-safe).
   * Only the fields present in siteData change; everything else keeps its stored value.
   * The guards, patrol points and geofence points are replaced only when that list was sent.
   * Returns false when there is no such site.
   */
  updateWithRelations(id, siteData) {
    return this.transaction(() => {
      const current = this.findById(id);
      if (!current) return false;
      const sent = (key) => siteData[key] !== undefined;

      // Update main site record
      const update = this.db.prepare(
        'UPDATE sites SET name=?,address=?,lat=?,lng=?,geofenceRadius=?,geofenceType=?,geofencePolygon=?,assignedGuards=?,isActive=?,patrolRoute=? WHERE id=?'
      );
      update.run(
        sent('name') ? siteData.name : current.name,
        sent('address') ? siteData.address : current.address,
        sent('location') ? siteData.location.lat : current.lat,
        sent('location') ? siteData.location.lng : current.lng,
        sent('geofenceRadius') ? siteData.geofenceRadius : current.geofenceRadius,
        sent('geofenceType') ? siteData.geofenceType : current.geofenceType,
        sent('geofencePolygon') ? (siteData.geofencePolygon ? JSON.stringify(siteData.geofencePolygon) : null) : current.geofencePolygon,
        sent('assignedGuards') ? JSON.stringify(siteData.assignedGuards || []) : current.assignedGuards,
        sent('isActive') ? (siteData.isActive ? 1 : 0) : current.isActive,
        sent('patrolRoute') ? (siteData.patrolRoute ? JSON.stringify(siteData.patrolRoute) : null) : current.patrolRoute,
        id
      );

      // Replace assigned guards
      if (sent('assignedGuards')) {
        this.db.prepare('DELETE FROM site_guards WHERE site_id = ?').run(id);
        const insertGuard = this.db.prepare('INSERT OR IGNORE INTO site_guards (id, site_id, guard_id) VALUES (?, ?, ?)');
        for (const guardId of siteData.assignedGuards || []) {
          insertGuard.run(randomUUID(), id, guardId);
        }
      }

      // Replace patrol route points
      if (sent('patrolRoute')) {
        this.db.prepare('DELETE FROM site_patrol_points WHERE site_id = ?').run(id);
        const insertPoint = this.db.prepare(
          'INSERT INTO site_patrol_points (id, site_id, name, latitude, longitude, radius_meters, point_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        for (const point of siteData.patrolRoute || []) {
          insertPoint.run(
            point.id || randomUUID(),
            id,
            point.name,
            point.latitude,
            point.longitude,
            point.radiusMeters || 50,
            point.order || 0
          );
        }
      }

      // Replace geofence polygon points
      if (sent('geofencePolygon')) {
        this.db.prepare('DELETE FROM site_geofence_points WHERE site_id = ?').run(id);
        const insertGeoPoint = this.db.prepare(
          'INSERT INTO site_geofence_points (id, site_id, latitude, longitude, point_order) VALUES (?, ?, ?, ?, ?)'
        );
        const polygon = siteData.geofencePolygon || [];
        for (let i = 0; i < polygon.length; i++) {
          insertGeoPoint.run(randomUUID(), id, polygon[i].lat, polygon[i].lng, i);
        }
      }
      return true;
    });
  }

  /**
   * Delete a site and everything attached to it (transaction-safe).
   * Its guards are unassigned (an enrolment waiting for approval stays pending), so nobody is
   * left assigned to a site that no longer exists. Returns how many guards were unassigned,
   * or null when there is no such site.
   */
  deleteWithRelations(id) {
    return this.transaction(() => {
      if (!this.findById(id)) return null;
      const unassigned = this.db.prepare(
        "UPDATE guards SET siteId = NULL, status = CASE WHEN status = 'pending' THEN status ELSE 'unassigned' END WHERE siteId = ?"
      ).run(id).changes;
      this.db.prepare('DELETE FROM site_guards WHERE site_id = ?').run(id);
      this.db.prepare('DELETE FROM site_patrol_points WHERE site_id = ?').run(id);
      this.db.prepare('DELETE FROM site_geofence_points WHERE site_id = ?').run(id);
      this.db.prepare('DELETE FROM site_shifts WHERE site_id = ?').run(id);
      this.db.prepare('DELETE FROM sites WHERE id = ?').run(id);
      return unassigned;
    });
  }

  /**
   * Find guards assigned to a specific site
   */
  findAssignedGuards(siteId) {
    return this.query('SELECT guard_id FROM site_guards WHERE site_id = ?', [siteId]);
  }

  /**
   * Find patrol points for a site
   */
  findPatrolPoints(siteId) {
    return this.query('SELECT * FROM site_patrol_points WHERE site_id = ? ORDER BY point_order', [siteId]);
  }

  /**
   * Find geofence points for a site
   */
  findGeofencePoints(siteId) {
    return this.query('SELECT * FROM site_geofence_points WHERE site_id = ? ORDER BY point_order', [siteId]);
  }
}
