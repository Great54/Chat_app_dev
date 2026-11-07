import React from 'react';
import { Globe, Trophy, Users, User as UserIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export type TabType = 'rooms' | 'leaderboard' | 'friends' | 'profile';

interface TabBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export default function TabBar({ activeTab, onTabChange }: TabBarProps) {
  const { user } = useAuth();

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    {
      id: 'rooms',
      label: 'Rooms',
      icon: <Globe className="w-5 h-5" />,
    },
    {
      id: 'leaderboard',
      label: 'Leaderboard',
      icon: <Trophy className="w-5 h-5" />,
    },
    {
      id: 'friends',
      label: 'Friends',
      icon: <Users className="w-5 h-5" />,
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: user.photoUrl ? (
        <div className={`w-6 h-6 rounded-full overflow-hidden border ${activeTab === 'profile' ? 'border-purple-400' : 'border-zinc-600'}`}>
          <img src={user.photoUrl} alt="Me" className="w-full h-full object-cover" />
        </div>
      ) : (
        <UserIcon className="w-5 h-5" />
      ),
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0c0c14]/95 backdrop-blur-lg border-t border-white/10 px-4 py-2 sm:py-2.5">
      <div className="max-w-md mx-auto flex items-center justify-around">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
                isActive
                  ? 'text-purple-400 font-bold scale-105'
                  : 'text-zinc-400 hover:text-zinc-200 font-medium'
              }`}
            >
              <div className={`p-1 rounded-lg transition-colors ${isActive ? 'bg-purple-500/20 text-purple-300' : ''}`}>
                {tab.icon}
              </div>
              <span className="text-[11px] tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
