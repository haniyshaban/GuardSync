import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Staff, StaffAttendance } from '@/types';
import { API_BASE_URL } from '@/lib/utils';
import { api } from '@/services/api';

// API Configuration - points to the guardwise-platform server
const API_ENDPOINT = `${API_BASE_URL}/api`;

interface AuthContextType {
  staff: Staff | null;
  attendance: StaffAttendance | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  setAttendance: (attendance: StaffAttendance | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [staff, setStaff] = useState<Staff | null>(null);
  const [attendance, setAttendance] = useState<StaffAttendance | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for saved session
    const savedStaff = localStorage.getItem('guardwise_staff');
    const savedAttendance = localStorage.getItem('guardwise_staff_attendance');
    if (savedStaff) {
      setStaff(JSON.parse(savedStaff));
    }
    if (savedAttendance) {
      setAttendance(JSON.parse(savedAttendance));
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      // Call the platform server API for staff login
      const response = await api.post<{ success: boolean; token?: string; staff?: any; error?: string }>(
        '/staff/login',
        { email, password }
      );

      if (response.success && response.data?.staff) {
        // Store the JWT token
        if (response.data.token) {
          api.setToken(response.data.token);
        }

        const staffData: Staff = {
          id: response.data.staff.id,
          name: response.data.staff.name,
          email: response.data.staff.email,
          phone: response.data.staff.phone,
          employeeId: response.data.staff.employeeId,
          role: response.data.staff.role,
          assignedArea: response.data.staff.assignedArea,
          status: 'online',
        };
        setStaff(staffData);
        localStorage.setItem('guardwise_staff', JSON.stringify(staffData));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = () => {
    api.clearToken();
    setStaff(null);
    setAttendance(null);
    localStorage.removeItem('guardwise_staff');
    localStorage.removeItem('guardwise_staff_attendance');
  };

  const updateAttendance = (newAttendance: StaffAttendance | null) => {
    setAttendance(newAttendance);
    if (newAttendance) {
      localStorage.setItem('guardwise_staff_attendance', JSON.stringify(newAttendance));
    } else {
      localStorage.removeItem('guardwise_staff_attendance');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        staff,
        attendance,
        isLoading,
        login,
        logout,
        setAttendance: updateAttendance,
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
