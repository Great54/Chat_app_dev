import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import TabBar, { TabType } from './components/TabBar';
import RoomsView from './views/RoomsView';
import RoomDetailView from './views/RoomDetailView';
import LeaderboardView from './views/LeaderboardView';
import GamingView from './views/GamingView';
import ProfileView from './views/ProfileView';
import AuthView from './views/AuthView';
import ProfilePopupModal from './components/ProfilePopupModal';

function AppInner() {
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('rooms');
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [initialDmUser, setInitialDmUser] = useState<{ id: string; name: string } | null>(null);
  const [selectedUserModal, setSelectedUserModal] = useState<any>(null);

  // If user is not logged in, show Login / Sign Up / Forgot Password page
  if (!isAuthenticated) {
    return <AuthView />;
  }

  const isLight = activeTab === 'rooms' || Boolean(activeRoomId);

  const handleSelectRoom = (roomId: string) => {
    setActiveRoomId(roomId);
  };

  const handleLeaveRoom = () => {
    setActiveRoomId(null);
  };

  const handleOpenDm = (user: { id: string; name: string }) => {
    setActiveRoomId(null);
    setInitialDmUser(user);
    setActiveTab('profile'); // Friends & DMs are housed in Profile section
  };

  const handleTabChange = (tab: TabType) => {
    setActiveRoomId(null);
    setActiveTab(tab);
  };

  return (
    <div
      className={`min-h-screen flex flex-col font-sans transition-colors duration-300 selection:bg-purple-500 selection:text-white ${
        isLight ? 'bg-[#f8fafc] text-slate-800' : 'bg-[#0c0c12] text-white'
      }`}
    >
      <Navbar
        onSelectRoom={handleSelectRoom}
        onSelectUser={(u) => setSelectedUserModal(u)}
        isLight={isLight}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-4 sm:py-6 transition-all duration-300">
        {activeRoomId ? (
          <div key={`room-${activeRoomId}`} className="animate-fadeIn">
            <RoomDetailView
              roomId={activeRoomId}
              onBack={handleLeaveRoom}
              onOpenDm={handleOpenDm}
            />
          </div>
        ) : (
          <div className="animate-fadeIn">
            {activeTab === 'rooms' && <RoomsView onSelectRoom={handleSelectRoom} />}
            {activeTab === 'leaderboard' && <LeaderboardView onOpenDm={handleOpenDm} />}
            {activeTab === 'gaming' && <GamingView onSelectRoom={handleSelectRoom} />}
            {activeTab === 'profile' && (
              <ProfileView
                initialDmUser={initialDmUser}
                onClearDm={() => setInitialDmUser(null)}
              />
            )}
          </div>
        )}
      </main>

      {!activeRoomId && (
        <TabBar activeTab={activeTab} onTabChange={handleTabChange} isLight={isLight} />
      )}

      <ProfilePopupModal
        isOpen={!!selectedUserModal}
        onClose={() => setSelectedUserModal(null)}
        targetUser={selectedUserModal}
        onOpenDm={handleOpenDm}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
