import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useRef } from 'react';
import { Guard, BankDetails } from '@/types/guard';
import api from '@/services/api';
import { errorMessage } from '@/lib/apiError';
import { toast } from '@/hooks/use-toast';

// Site type from platform server
interface Site {
  id: string;
  name: string;
  address: string;
  location: { lat: number; lng: number };
  geofenceRadius?: number;
  patrolRoute?: PatrolCheckpoint[];
  assignedGuards?: string[];
  isActive: boolean;
}

// The guard record as the server sends it (guardRowToObj on the server, seen by the guard)
interface ApiGuard {
  id: string;
  name: string;
  email?: string | null;
  employeeId: string;
  phone: string;
  siteId?: string | null;
  clockedIn?: boolean;
  address?: string | null;
  emergencyContact?: string | null;
  dailyRate?: number | null;
  dateOfJoining?: string | null;
  aadharNumber?: string | null;
  panNumber?: string | null;
  bankDetails?: BankDetails | null;
  shiftType?: string | null;
  shiftStartTime?: string | null;
  shiftEndTime?: string | null;
  faceEnrolled?: boolean;
}

// What login and face login answer with
interface LoginResponse {
  token?: string;
  guard: ApiGuard;
  site: Site | null;
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

// Browser storage can be blocked (private mode, site data turned off), and then every access
// throws. The app must still work; the session just isn't remembered across reloads.
function readStoredSession(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredSession(value: string | null) {
  try {
    if (value === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, value);
  } catch (e) {
    console.warn('Could not save the session in browser storage:', e);
  }
}

/**
 * Turns the server's guard record into the app's Guard. Used at login and whenever the guard is
 * reloaded from the server. `previous` is the guard the app already had, if any.
 */
function mapApiGuard(apiGuard: ApiGuard, site: Site | null, previous?: Guard | null): Guard {
  const isNightShift = apiGuard.shiftType === 'night';
  // Keep the shift id while the guard stays on the same site, so one shift's logs stay together
  const sameSite = !!previous?.currentShift && previous.currentShift.siteId === apiGuard.siteId;
  return {
    id: apiGuard.id,
    name: apiGuard.name,
    email: apiGuard.email || previous?.email,
    employeeId: apiGuard.employeeId,
    phone: apiGuard.phone,
    siteId: apiGuard.siteId || null,
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
    // Bank details from API (the account number comes masked)
    bankDetails: apiGuard.bankDetails || undefined,
    // Current shift based on guard's assigned shift type
    currentShift: apiGuard.siteId ? {
      id: sameSite ? previous!.currentShift!.id : `shift-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      startTime: apiGuard.shiftStartTime || (isNightShift ? '20:00' : '08:00'),
      endTime: apiGuard.shiftEndTime || (isNightShift ? '08:00' : '20:00'),
      location: site?.name || 'Assigned Site',
      siteId: apiGuard.siteId,
      status: 'scheduled',
      isNightShift: isNightShift,
    } : undefined,
    faceEnrolled: !!apiGuard.faceEnrolled,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [guard, setGuard] = useState<Guard | null>(null);
  const [site, setSite] = useState<Site | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Which guard is logged in right now, for replies that arrive after a logout
  const guardIdRef = useRef<string | null>(null);

  useEffect(() => {
    guardIdRef.current = guard?.id ?? null;
  }, [guard?.id]);

  // Reload the guard (and their site) from the server, so changes made in the admin dashboard,
  // such as a new name, phone or site, reach the phone. If the server refuses the session
  // (expired, or the account was removed), the API client reports it and the guard is logged out.
  const refreshSession = useCallback(async (guardId: string) => {
    const response = await api.get<ApiGuard>(`/guards/${guardId}`);
    if (!response.success || !response.data) return;
    const apiGuard = response.data;
    let freshSite: Site | null = null;
    if (apiGuard.siteId) {
      const siteResponse = await api.get<Site>(`/sites/${apiGuard.siteId}`);
      // Keep what the app has rather than drop the site on a failed request
      if (!siteResponse.success) return;
      freshSite = siteResponse.data ?? null;
    }
    if (guardIdRef.current !== apiGuard.id) return;
    setGuard((prev) => (prev && prev.id === apiGuard.id ? mapApiGuard(apiGuard, freshSite, prev) : prev));
    setSite(freshSite);
  }, []);

  // Restore session from localStorage on mount
  useEffect(() => {
    const stored = readStoredSession();
    // A saved guard is only a session if the login token is still there too
    if (stored && api.getToken()) {
      try {
        const { guard: savedGuard, site: savedSite } = JSON.parse(stored);
        if (savedGuard) {
          // Sessions saved by older versions kept the face template on the phone. Drop it.
          const { faceDescriptor, ...rest } = savedGuard;
          setGuard({ ...rest, faceEnrolled: rest.faceEnrolled ?? !!faceDescriptor });
          setSite(savedSite || null);
          guardIdRef.current = savedGuard.id;
          refreshSession(savedGuard.id);
        }
      } catch (e) {
        console.error('Failed to restore auth session:', e);
      }
    }
    setIsLoading(false);
  }, [refreshSession]);

  // Reload the guard when the app comes back to the foreground
  useEffect(() => {
    const guardId = guard?.id;
    if (!guardId) return;
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshSession(guardId);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [guard?.id, refreshSession]);

  // The server no longer accepts this session: log out and say why
  useEffect(() => {
    api.onSessionEnded((error) => {
      api.clearToken();
      guardIdRef.current = null;
      setGuard(null);
      setSite(null);
      toast({
        title: 'Signed out',
        description: error.code === 'ACCOUNT_INACTIVE'
          ? 'This account is no longer active. Please contact your supervisor.'
          : 'Your session has ended. Please log in again.',
        variant: 'destructive',
      });
    });
    return () => api.onSessionEnded(null);
  }, []);

  // Save session to localStorage when guard changes
  useEffect(() => {
    writeStoredSession(guard ? JSON.stringify({ guard, site }) : null);
  }, [guard, site]);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await api.post<LoginResponse>('/auth/login', { email, password });

      if (response.success && response.data?.guard) {
        // Store the JWT token
        if (response.data.token) {
          api.setToken(response.data.token);
        }

        const loggedInSite = response.data.site || null;
        const mappedGuard = mapApiGuard(response.data.guard, loggedInSite);
        guardIdRef.current = mappedGuard.id;
        setGuard({ ...mappedGuard, email: mappedGuard.email || email });
        setSite(loggedInSite);
        return { success: true };
      }

      return { success: false, error: errorMessage(response.error, 'Login failed') };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Network error. Please check your connection.' };
    }
  };

  const loginWithFace = async (guardId?: string): Promise<boolean> => {
    // If guardId provided, use the face-login endpoint
    if (guardId) {
      try {
        const response = await api.post<LoginResponse>('/auth/face-login', { guardId });

        if (response.success && response.data?.guard) {
          // Store the JWT token
          if (response.data.token) {
            api.setToken(response.data.token);
          }

          const loggedInSite = response.data.site || null;
          const mappedGuard = mapApiGuard(response.data.guard, loggedInSite);
          guardIdRef.current = mappedGuard.id;
          setGuard(mappedGuard);
          setSite(loggedInSite);
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
    guardIdRef.current = null;
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
