import React, { useState } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import TabBar, { TabType } from './components/TabBar';
import RoomsView from './views/RoomsView';
import RoomDetailView from './views/RoomDetailView';
import LeaderboardView from './views/LeaderboardView';
import FriendsView from './views/FriendsView';
import ProfileView from './views/ProfileView';

import ProfilePopupModal from './components/ProfilePopupModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('rooms');
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [initialDmUser, setInitialDmUser] = useState<{ id: string; name: string } | null>(null);
  const [selectedUserModal, setSelectedUserModal] = useState<any>(null);

  const handleSelectRoom = (roomId: string) => {
    setActiveRoomId(roomId);
  };

  const handleLeaveRoom = () => {
    setActiveRoomId(null);
  };

  const handleOpenDm = (user: { id: string; name: string }) => {
    setActiveRoomId(null);
    setInitialDmUser(user);
    setActiveTab('friends');
  };

  const handleTabChange = (tab: TabType) => {
    setActiveRoomId(null);
    setActiveTab(tab);
  };

  return (
    <AuthProvider>
      <div className="min-h-screen bg-[#0c0c12] text-white flex flex-col font-sans selection:bg-purple-500 selection:text-white">
        <Navbar
          onSelectRoom={handleSelectRoom}
          onSelectUser={(u) => setSelectedUserModal(u)}
        />

        <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-4 sm:py-6 transition-all duration-300">
          {activeRoomId ? (
            <div key={`room-${activeRoomId}`} className="animate-room-enter">
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
              {activeTab === 'friends' && <FriendsView initialDmUser={initialDmUser} />}
              {activeTab === 'profile' && <ProfileView />}
            </div>
          )}
        </main>

        {!activeRoomId && (
          <TabBar activeTab={activeTab} onTabChange={handleTabChange} />
        )}

        <ProfilePopupModal
          isOpen={!!selectedUserModal}
          onClose={() => setSelectedUserModal(null)}
          targetUser={selectedUserModal}
          onOpenDm={handleOpenDm}
        />
      </div>
    </AuthProvider>
  );
}
