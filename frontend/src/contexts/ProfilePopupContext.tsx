import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import ProfilePopupModal from '@/src/components/ProfilePopupModal';

interface ProfilePopupContextValue {
  openProfile: (userId: string) => void;
  closeProfile: () => void;
}

const ProfilePopupContext = createContext<ProfilePopupContextValue | undefined>(undefined);

export function ProfilePopupProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  const openProfile = useCallback((id: string) => {
    if (!id) return;
    setUserId(id);
    setVisible(true);
  }, []);

  const closeProfile = useCallback(() => {
    setVisible(false);
    // Defer clearing to allow exit animation
    setTimeout(() => setUserId(null), 250);
  }, []);

  const value = useMemo(() => ({ openProfile, closeProfile }), [openProfile, closeProfile]);

  return (
    <ProfilePopupContext.Provider value={value}>
      {children}
      <ProfilePopupModal visible={visible} userId={userId} onClose={closeProfile} />
    </ProfilePopupContext.Provider>
  );
}

export function useProfilePopup() {
  const ctx = useContext(ProfilePopupContext);
  if (!ctx) {
    // Soft fail — avoids hard crash if used outside provider during dev
    return {
      openProfile: () => {},
      closeProfile: () => {},
    } as ProfilePopupContextValue;
  }
  return ctx;
}
