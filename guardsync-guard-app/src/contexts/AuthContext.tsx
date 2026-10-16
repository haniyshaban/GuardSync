import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Guard, Shift } from '@/types/guard';
import api from '@/services/api';

// Site type from platform server
interface Site {
  id: string;
  name: string;
  address: string;
  location: { lat: number; lng: number };
  patrolRoute?: PatrolCheckpoint[];
  assignedGuards?: string[];
  isActive: boolean;
}

interface PatrolCheckpoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  order: number;
}

interface AuthContextType {
  guard: Guard | null;
  site: Site | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithFace: (guardId?: string) => Promise<boolean>;
  logout: () => void;
  updateGuard: (updates: Partial<Guard>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * OFFLINE DEMO FALLBACK
 * This mock guard is ONLY used when:
 * 1. The API server is not reachable (offline mode)
 * 2. Face recognition login is attempted without network
 * 
 * In production, this should be replaced with proper offline caching
 * of the last authenticated guard from the database.
 */
const DEMO_FALLBACK_GUARD: Guard = {
  id: 'demo-guard-1',
  name: 'Rajesh Kumar',
  email: 'rajesh.kumar@guardwise.com',
  employeeId: 'GW-2024-0147',
  phone: '+91 98765 43210',
  status: 'off-duty',
  isActive: true,
  onboardingStatus: 'active',
  dailyRate: 800,
  dateOfJoining: '2024-01-15',
  address: '123 Main Street, Bangalore',
  emergencyContact: '+91 98765 43211',
  documents: {
    aadharNumber: 'xxxx-xxxx-1234',
    panNumber: 'AAAAA1111A',
    photographUrl: undefined,
    relievingLetterUrl: undefined,
  },
  bankDetails: {
    accountNumber: '1234567890',
    ifsc: 'SBIN0000000',
    bankName: 'State Bank of India',
    accountHolderName: 'Rajesh Kumar',
  },
  uniformInstallments: {
    totalAmount: 3000,
    remainingAmount: 1500,
    monthlyDeduction: 500,
    startDate: '2024-01-15',
  },
  currentShift: {
    id: 's1',
    date: new Date().toISOString().split('T')[0],
    startTime: '08:00',
    endTime: '16:00',
    location: 'Cedar Grove Park',
    siteId: 'cedar-grove-park',
    status: 'scheduled',
    isNightShift: false,
  },
};

const STORAGE_KEY = 'guardwise_auth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [guard, setGuard] = useState<Guard | null>(null);
  const [site, setSite] = useState<Site | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const { guard: savedGuard, site: savedSite } = JSON.parse(stored);
        if (savedGuard) {
          // Sessions saved by older versions kept the face template on the phone. Drop it.
          const { faceDescriptor, ...rest } = savedGuard;
          setGuard({ ...rest, faceEnrolled: rest.faceEnrolled ?? !!faceDescriptor });
          setSite(savedSite || null);
        }
      } catch (e) {
        console.error('Failed to restore auth session:', e);
      }
    }
    setIsLoading(false);
  }, []);

  // Save session to localStorage when guard changes
  useEffect(() => {
    if (guard) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ guard, site }));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [guard, site]);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await api.post<{ success: boolean; guard: any; site: any; error?: string }>(
        '/auth/login',
        { email, password }
      );

      if (response.success && response.data?.guard) {
        // Store the JWT token
        if (response.data.token) {
          api.setToken(response.data.token);
        }

        // Map API response to Guard type
        const apiGuard = response.data.guard;
        const isNightShift = apiGuard.shiftType === 'night';
        const mappedGuard: Guard = {
          id: apiGuard.id,
          name: apiGuard.name,
          email: apiGuard.email || email,
          employeeId: apiGuard.employeeId,
          phone: apiGuard.phone,
          status: apiGuard.clockedIn ? 'active' : 'off-duty',
          isActive: true,
          onboardingStatus: 'active',
          // Personal details from API
          address: apiGuard.address || undefined,
          emergencyContact: apiGuard.emergencyContact || undefined,
          dailyRate: apiGuard.dailyRate || undefined,
          dateOfJoining: apiGuard.dateOfJoining || undefined,
          // Documents (masked from API for security)
          documents: {
            aadharNumber: apiGuard.aadharNumber || undefined,
            panNumber: apiGuard.panNumber || undefined,
            photographUrl: undefined,
            relievingLetterUrl: undefined,
          },
          // Bank details from API
          bankDetails: apiGuard.bankDetails || undefined,
          // Current shift based on guard's assigned shift type
          currentShift: apiGuard.siteId ? {
            id: `shift-${Date.now()}`,
            date: new Date().toISOString().split('T')[0],
            startTime: apiGuard.shiftStartTime || (isNightShift ? '20:00' : '08:00'),
            endTime: apiGuard.shiftEndTime || (isNightShift ? '08:00' : '20:00'),
            location: response.data.site?.name || 'Assigned Site',
            siteId: apiGuard.siteId,
            status: 'scheduled',
            isNightShift: isNightShift,
          } : undefined,
          faceEnrolled: !!apiGuard.faceEnrolled,
        };

        setGuard(mappedGuard);
        setSite(response.data.site || null);
        return { success: true };
      }

      // Extract error message properly from ApiResponse error object
      const errorMessage = response.error?.message || response.error || 'Login failed';
      return { success: false, error: errorMessage };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Network error. Please check your connection.' };
    }
  };

  const loginWithFace = async (guardId?: string): Promise<boolean> => {
    // If guardId provided, use the face-login endpoint
    if (guardId) {
      try {
        const response = await api.post<{ success: boolean; guard: any; site: any }>(
          '/auth/face-login',
          { guardId }
        );
        
        if (response.success && response.data?.guard) {
          // Store the JWT token
          if (response.data.token) {
            api.setToken(response.data.token);
          }

          const apiGuard = response.data.guard;
          const isNightShift = apiGuard.shiftType === 'night';
          const mappedGuard: Guard = {
            id: apiGuard.id,
            name: apiGuard.name,
            email: apiGuard.email,
            employeeId: apiGuard.employeeId,
            phone: apiGuard.phone,
            status: apiGuard.clockedIn ? 'active' : 'off-duty',
            isActive: true,
            onboardingStatus: 'active',
            address: apiGuard.address || undefined,
            emergencyContact: apiGuard.emergencyContact || undefined,
            dailyRate: apiGuard.dailyRate || undefined,
            dateOfJoining: apiGuard.dateOfJoining || undefined,
            documents: {
              aadharNumber: apiGuard.aadharNumber || undefined,
              panNumber: apiGuard.panNumber || undefined,
              photographUrl: undefined,
              relievingLetterUrl: undefined,
            },
            bankDetails: apiGuard.bankDetails || undefined,
            currentShift: apiGuard.siteId ? {
              id: `shift-${Date.now()}`,
              date: new Date().toISOString().split('T')[0],
              startTime: apiGuard.shiftStartTime || (isNightShift ? '20:00' : '08:00'),
              endTime: apiGuard.shiftEndTime || (isNightShift ? '08:00' : '20:00'),
              location: response.data.site?.name || 'Assigned Site',
              siteId: apiGuard.siteId,
              status: 'scheduled',
              isNightShift: isNightShift,
            } : undefined,
            faceEnrolled: !!apiGuard.faceEnrolled,
          };
          setGuard(mappedGuard);
          setSite(response.data.site || null);
          return true;
        }
      } catch (e) {
        console.error('Face login API error:', e);
        return false;
      }
      return false;
    }

    // No demo fallback - users must authenticate with valid credentials
    console.log('[AuthContext] Face recognition failed, no fallback available');
    return false;
  };

  const logout = () => {
    api.clearToken();
    setGuard(null);
    setSite(null);
  };

  const updateGuard = (updates: Partial<Guard>) => {
    // Functional update so several updates in a row do not overwrite each other
    setGuard((prev) => (prev ? { ...prev, ...updates } : prev));
  };

  return (
    <AuthContext.Provider
      value={{
        guard,
        site,
        isAuthenticated: !!guard,
        isLoading,
        login,
        loginWithFace,
        logout,
        updateGuard,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
