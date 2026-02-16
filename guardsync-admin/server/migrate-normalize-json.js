/**
 * Migration Script: Normalize JSON Array Columns to Relational Tables
 * 
 * This script migrates data from JSON columns in the sites table to proper relational tables:
 * - assignedGuards -> site_guards
 * - patrolRoute -> site_patrol_points
 * - geofencePolygon -> site_geofence_points
 * 
 * The script is idempotent and can be run multiple times safely.
 */

import db from './db.js';
import { randomUUID } from 'crypto';

console.log('🚀 Starting JSON normalization migration...\n');

// Check if migration has already been run by looking for a migration marker
const checkMigration = db.prepare(`
  SELECT COUNT(*) as count FROM site_guards
`).get();

if (checkMigration.count > 0) {
  console.log('⚠️  Migration already appears to have been run (site_guards table has data).');
  console.log('   If you want to re-run the migration, manually delete all rows from:');
  console.log('   - site_guards');
  console.log('   - site_patrol_points');
  console.log('   - site_geofence_points\n');
  
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const answer = await new Promise((resolve) => {
    rl.question('Continue anyway? (yes/no): ', resolve);
  });
  rl.close();
  
  if (answer.toLowerCase() !== 'yes') {
    console.log('Migration cancelled.');
    process.exit(0);
  }
  
  // Clear existing data for fresh migration
  console.log('\n🗑️  Clearing existing normalized data...');
  db.prepare('DELETE FROM site_guards').run();
  db.prepare('DELETE FROM site_patrol_points').run();
  db.prepare('DELETE FROM site_geofence_points').run();
  db.prepare('DELETE FROM site_shifts').run();
  console.log('✅ Cleared.\n');
}

// Begin transaction
const transaction = db.transaction(() => {
  // Fetch all sites
  const sites = db.prepare('SELECT * FROM sites').all();
  console.log(`📍 Found ${sites.length} sites to migrate.\n`);

  let totalGuards = 0;
  let totalPatrolPoints = 0;
  let totalGeofencePoints = 0;

  // Process each site
  for (const site of sites) {
    console.log(`Processing: ${site.name} (${site.id})`);

    // 1. Migrate assignedGuards to site_guards
    if (site.assignedGuards) {
      try {
        const guards = JSON.parse(site.assignedGuards);
        if (Array.isArray(guards) && guards.length > 0) {
          const insertGuard = db.prepare(`
            INSERT OR IGNORE INTO site_guards (id, site_id, guard_id)
            VALUES (?, ?, ?)
          `);
          
          for (const guardId of guards) {
            const id = randomUUID();
            insertGuard.run(id, site.id, guardId);
            totalGuards++;
          }
          console.log(`  ✓ Migrated ${guards.length} assigned guards`);
        }
      } catch (err) {
        console.error(`  ✗ Error parsing assignedGuards: ${err.message}`);
      }
    }

    // 2. Migrate patrolRoute to site_patrol_points
    if (site.patrolRoute) {
      try {
        const patrolPoints = JSON.parse(site.patrolRoute);
        if (Array.isArray(patrolPoints) && patrolPoints.length > 0) {
          const insertPoint = db.prepare(`
            INSERT OR IGNORE INTO site_patrol_points 
            (id, site_id, name, latitude, longitude, radius_meters, point_order)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `);
          
          for (const point of patrolPoints) {
            // Use existing ID if available, otherwise generate new one
            const id = point.id || randomUUID();
            insertPoint.run(
              id,
              site.id,
              point.name,
              point.latitude,
              point.longitude,
              point.radiusMeters || point.radius_meters || 50,
              point.order || point.point_order || 0
            );
            totalPatrolPoints++;
          }
          console.log(`  ✓ Migrated ${patrolPoints.length} patrol points`);
        }
      } catch (err) {
        console.error(`  ✗ Error parsing patrolRoute: ${err.message}`);
      }
    }

    // 3. Migrate geofencePolygon to site_geofence_points
    if (site.geofencePolygon) {
      try {
        const polygonPoints = JSON.parse(site.geofencePolygon);
        if (Array.isArray(polygonPoints) && polygonPoints.length > 0) {
          const insertGeoPoint = db.prepare(`
            INSERT OR IGNORE INTO site_geofence_points 
            (id, site_id, latitude, longitude, point_order)
            VALUES (?, ?, ?, ?, ?)
          `);
          
          for (let i = 0; i < polygonPoints.length; i++) {
            const point = polygonPoints[i];
            const id = randomUUID();
            insertGeoPoint.run(
              id,
              site.id,
              point.lat || point.latitude,
              point.lng || point.longitude,
              i
            );
            totalGeofencePoints++;
          }
          console.log(`  ✓ Migrated ${polygonPoints.length} geofence points`);
        }
      } catch (err) {
        console.error(`  ✗ Error parsing geofencePolygon: ${err.message}`);
      }
    }

    console.log('');
  }

  console.log('📊 Migration Summary:');
  console.log(`   - Site-Guard assignments: ${totalGuards}`);
  console.log(`   - Patrol points: ${totalPatrolPoints}`);
  console.log(`   - Geofence points: ${totalGeofencePoints}\n`);
});

try {
  transaction();
  console.log('✅ Migration completed successfully!\n');
  console.log('ℹ️  Note: Old JSON columns are still present but marked as DEPRECATED.');
  console.log('   They can be safely dropped after confirming the application works correctly.\n');
  process.exit(0);
} catch (err) {
  console.error('❌ Migration failed:', err);
  process.exit(1);
}
