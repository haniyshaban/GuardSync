import { z } from 'zod';
import { commonSchemas } from './index.js';

// Site creation schema
export const createSiteSchema = z.object({
  name: z.string().min(1, 'Site name is required').max(200, 'Site name must be at most 200 characters'),
  address: z.string().min(1, 'Address is required').max(500),
  location: z.object({
    lat: commonSchemas.latitude,
    lng: commonSchemas.longitude,
  }),
  geofenceRadius: z.number().min(10, 'Geofence radius must be at least 10 meters').max(5000, 'Geofence radius must be at most 5000 meters').optional(),
  contactPerson: z.string().max(100).optional(),
  contactPhone: commonSchemas.phone.optional(),
  contactEmail: commonSchemas.email.optional(),
  clientName: z.string().max(200).optional(),
  siteType: z.enum(['residential', 'commercial', 'industrial', 'educational', 'healthcare', 'government', 'other']).optional(),
  status: z.enum(['active', 'inactive', 'maintenance']).optional(),
  remarks: z.string().max(1000).optional(),
  assignedGuards: z.array(z.string()).optional(),
  patrolPoints: z.array(z.object({
    id: z.string().optional(),
    name: z.string().min(1).max(100),
    location: z.object({
      lat: commonSchemas.latitude,
      lng: commonSchemas.longitude,
    }),
    checkpointRadius: z.number().min(5).max(100).optional(),
  })).optional(),
});

// Site update schema (partial)
export const updateSiteSchema = createSiteSchema.partial();
