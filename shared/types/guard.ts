/**
 * Guard type definitions
 * Unified across admin and guard apps
 */

import type { GuardStatus, OnboardingStatus, Location, LocationWithTimestamp } from './common';
import type { Shift } from './shift';

export interface Guard {
  id: string;
  name: string;
  phone: string;
  employeeId: string;
  
  // Admin-specific fields
  siteId?: string | null;
  status: GuardStatus;
  lastSeen?: Date;
  location?: Location | null;
  avatar?: string;
  clockedIn?: boolean;
  clockInTime?: Date;
  currentShiftId?: string;
  shiftType?: 'day' | 'night';
  shiftStartTime?: string;
  shiftEndTime?: string;
  locationHistory?: LocationWithTimestamp[];
  lastPinged?: Date;
  
  // Guard app-specific fields
  email?: string;
  photoUrl?: string;
  isActive?: boolean;
  onboardingStatus?: OnboardingStatus;
  documents?: GuardDocuments;
  bankDetails?: BankDetails;
  uniformInstallments?: UniformInstallments;
  currentShift?: Shift;
  dailyRate?: number;
  dateOfJoining?: string;
  address?: string;
  emergencyContact?: string;
  faceDescriptor?: string; // JSON string of Float32Array for face recognition
}

export interface GuardDocuments {
  aadharNumber?: string;
  aadharUrl?: string;
  panNumber?: string;
  panUrl?: string;
  photographUrl?: string;
  relievingLetterUrl?: string;
}

export interface BankDetails {
  accountNumber?: string;
  ifsc?: string;
  bankName?: string;
  accountHolderName?: string;
}

export interface UniformInstallments {
  totalAmount: number;
  remainingAmount: number;
  monthlyDeduction: number;
  startDate?: string;
}

export interface CheckInRecord {
  id: string;
  guardId: string;
  timestamp: string;
  type: 'check-in' | 'check-out';
  location: string;
  verificationMethod: 'facial' | 'manual';
  photoUrl?: string;
}
