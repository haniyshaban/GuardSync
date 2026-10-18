import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '@/lib/api';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  /** Admin-only actions (approve enrolments, delete guards or sites, settings) are hidden for staff. */
  isAdmin: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// The logged-in user is kept next to the token so a reload still shows who is logged in.
// Storage can be blocked (private windows, embedded views), so every access is guarded.
const USER_STORAGE_KEY = 'guardsync_admin_user';

function loadStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' && parsed.role ? parsed : null;
  } catch {
    return null;
  }
}

function storeUser(user: User | null) {
  try {
    if (user) localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_STORAGE_KEY);
  } catch {
    // Storage unavailable: the user is still known until the page is reloaded
  }
}

// Sessions saved before the user was stored only have the token. Its payload carries the
// account id and role, which is enough to decide what to show (the server checks every call).
function userFromToken(token: string): User | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload?.role ? { id: String(payload.id ?? ''), name: '', email: '', role: String(payload.role) } : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if there's a stored token on mount
    const storedToken = api.getToken();
    if (storedToken) {
      setToken(storedToken);
      // The server still checks the token on every call; this only restores who is shown
      setUser(loadStoredUser() ?? userFromToken(storedToken));
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      // api.post returns the reply's data when it has the usual {success, data} envelope
      const response = await api.post<{
        token?: string;
        role?: string;
        staff?: Partial<User>;
      }>('/staff/login', { email, password });

      if (!response?.token) {
        throw new Error('Login failed');
      }
      const loggedIn: User = {
        id: String(response.staff?.id ?? ''),
        name: response.staff?.name ?? '',
        email: response.staff?.email ?? email,
        role: response.staff?.role || response.role || 'staff',
      };
      api.setToken(response.token);
      setToken(response.token);
      setUser(loggedIn);
      storeUser(loggedIn);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = () => {
    api.clearToken();
    storeUser(null);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
        isAdmin: user?.role === 'admin',
        isLoading,
        login,
        logout,
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
