import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { router } from 'expo-router';
import api from '../api/client';
import { storage } from '@/src/utils/storage';
import { playNotificationSound, playMessageSound } from '@/src/utils/sound';

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
  autoJoin: () => Promise<{ roomId: string; roomName: string; wasResumed: boolean } | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  // Global notification poll: as soon as we have a logged-in user, poll
  // /notifications every 8s. When a new notification id appears (i.e. one
  // that wasn't in the previous snapshot), play the notification sound.
  // The very first poll just seeds the dedup set — silent — so history
  // doesn't replay sounds on app launch.
  //
  // We also poll the global direct-messages unread counter every 6s and
  // play the message sound when it strictly increases, so DMs that arrive
  // while the user is anywhere in the app (not just inside a room) still
  // produce an audible cue.
  const seenNotificationIdsRef = useRef<Set<string> | null>(null);
  const lastDmUnreadRef = useRef<number | null>(null);
  useEffect(() => {
    if (!user) {
      seenNotificationIdsRef.current = null;
      lastDmUnreadRef.current = null;
      return;
    }
    let cancelled = false;
    const pollNotifications = async () => {
      try {
        const res = await api.get('/notifications');
        if (cancelled) return;
        const list: { id: string }[] = Array.isArray(res.data) ? res.data : [];
        const ids = new Set(list.map((n) => n.id));
        if (seenNotificationIdsRef.current === null) {
          seenNotificationIdsRef.current = ids;
          return;
        }
        const prev = seenNotificationIdsRef.current;
        let fresh = 0;
        for (const n of list) if (!prev.has(n.id)) fresh++;
        seenNotificationIdsRef.current = ids;
        if (fresh > 0) playNotificationSound();
      } catch {
        /* swallow */
      }
    };
    const pollDmUnread = async () => {
      try {
        const res = await api.get('/messages/direct/unread/total');
        if (cancelled) return;
        const n = res.data?.unreadCount || 0;
        if (lastDmUnreadRef.current !== null && n > lastDmUnreadRef.current) {
          playMessageSound();
        }
        lastDmUnreadRef.current = n;
      } catch {
        /* swallow */
      }
    };
    pollNotifications();
    pollDmUnread();
    const i1 = setInterval(pollNotifications, 8000);
    const i2 = setInterval(pollDmUnread, 6000);
    return () => {
      cancelled = true;
      clearInterval(i1);
      clearInterval(i2);
    };
  }, [user?.id]);

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
    // Redirect to landing screen (Rooms tab); the landing screen handles the auto-join indicator
    router.replace('/(tabs)?autojoin=1');
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
    router.replace('/(tabs)?autojoin=1');
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

  const autoJoin = async () => {
    try {
      const response = await api.post('/rooms/auto-join');
      return response.data as { roomId: string; roomName: string; wasResumed: boolean };
    } catch (error) {
      console.error('Auto-join failed:', error);
      return null;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser, autoJoin }}>
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