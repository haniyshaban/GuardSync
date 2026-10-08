import { z } from 'zod';
import { commonSchemas } from './index.js';

// Guard enrollment schema (uses snake_case after case converter middleware)
export const enrollGuardSchema = z.object({
  full_name: z.string().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
  email: commonSchemas.email,
  phone: commonSchemas.phone,
  address: z.string().max(500).optional().nullable(),
  emergency_contact: z.string().min(10).max(15).optional().nullable(),
  aadhar_number: z.string().length(12, 'Aadhar must be 12 digits').regex(/^\d+$/, 'Aadhar must contain only digits').optional().nullable(),
  pan_number: z.string().length(10, 'PAN must be 10 characters').regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format').optional().nullable(),
  bank_account_number: z.string().min(9).max(18).optional().nullable(),
  bank_ifsc: z.string().length(11, 'IFSC must be 11 characters').regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code').optional().nullable(),
  bank_name: z.string().max(100).optional().nullable(),
  account_holder_name: z.string().max(100).optional().nullable(),
  face_descriptor: z.any().optional().nullable(),
  password: z.string().min(8, 'Password must be at least 8 characters').optional().nullable(),
  photograph_url: z.string().url().optional().nullable(),
  aadhar_doc_url: z.string().url().optional().nullable(),
  pan_doc_url: z.string().url().optional().nullable(),
  relieving_letter_url: z.string().url().optional().nullable(),
});

// Update guard schema (partial update)
export const updateGuardSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: commonSchemas.phone.optional(),
  email: commonSchemas.email.optional(),
  employeeId: z.string().min(1).max(50).optional(),
  siteId: z.string().nullable().optional(),
  status: z.enum(['pending', 'active', 'idle', 'offline', 'online', 'unassigned', 'alert']).optional(),
  lastSeen: commonSchemas.datetimeISO.optional(),
  location: commonSchemas.location.nullable().optional(),
  locationHistory: z.array(z.object({
    lat: z.number(),
    lng: z.number(),
    timestamp: z.string(),
  })).optional(),
  clockedIn: z.boolean().optional(),
  clockInTime: z.string().nullable().optional(),
  currentShiftId: z.string().nullable().optional(),
  address: z.string().max(500).optional(),
  emergencyContact: z.string().min(10).max(15).optional(),
  dailyRate: z.number().min(0).optional(),
  shiftType: z.enum(['day', 'night', 'rotating']).optional(),
  shiftStartTime: commonSchemas.time.optional(),
  shiftEndTime: commonSchemas.time.optional(),
}).partial();

// Update guard location schema
export const updateGuardLocationSchema = z.object({
  lat: commonSchemas.latitude,
  lng: commonSchemas.longitude,
});

// Reject guard schema
export const rejectGuardSchema = z.object({
  reason: z.string().max(500).optional(),
});

// Update guard profile schema (PII fields)
export const updateGuardProfileSchema = z.object({
  address: z.string().max(500).optional(),
  emergencyContact: z.string().min(10).max(15).optional(),
  aadharNumber: z.string().length(12).regex(/^\d+$/).optional(),
  panNumber: z.string().length(10).regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).optional(),
  bankAccountNumber: z.string().min(9).max(18).optional(),
  bankIfsc: z.string().length(11).regex(/^[A-Z]{4}0[A-Z0-9]{6}$/).optional(),
  bankName: z.string().max(100).optional(),
  accountHolderName: z.string().max(100).optional(),
  faceDescriptor: z.any().optional(),
}).partial();
