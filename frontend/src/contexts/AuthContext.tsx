import React, { createContext, useContext, useState, useEffect } from 'react';
import { router } from 'expo-router';
import api from '../api/client';
import { storage } from '@/src/utils/storage';

interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  photoUrl?: string;
  bannerUrl?: string;
  bio?: string;
  coins: number;
  vipTier?: 'pro' | 'elite' | null;
  vouchers?: number;
  currentRoomId?: string;
  onlineStatus: boolean;
  // VIP Pro customizations
  vipBadgeId?: string | null;
  auraType?: 'glow' | 'sparkle' | 'frame' | 'smoke' | null;
  auraColor?: string | null;
  chatColor?: string | null;
  usernameColor?: string | null;
  pmBoxColor?: string | null;
  enlargedAvatar?: boolean;
  vipProMonthlyGrantAt?: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (email: string, password: string, username: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await storage.getItem('auth_token', '');
      if (token) {
        const response = await api.get('/auth/me');
        setUser(response.data);
      }
    } catch (error) {
      await storage.removeItem('auth_token');
    } finally {
      setLoading(false);
    }
  };

  const login = async (identifier: string, password: string) => {
    const response = await api.post('/auth/login', { identifier, password });
    await storage.setItem('auth_token', response.data.access_token);
    const userResponse = await api.get('/auth/me');
    setUser(userResponse.data);
    router.replace('/(tabs)');
  };

  const register = async (email: string, password: string, username: string, displayName: string) => {
    const response = await api.post('/auth/register', {
      email,
      password,
      username,
      displayName,
    });
    await storage.setItem('auth_token', response.data.access_token);
    const userResponse = await api.get('/auth/me');
    setUser(userResponse.data);
    router.replace('/(tabs)');
  };

  const logout = async () => {
    await storage.removeItem('auth_token');
    setUser(null);
    router.replace('/(auth)/login');
  };

  const refreshUser = async () => {
    try {
      const response = await api.get('/auth/me');
      setUser(response.data);
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
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