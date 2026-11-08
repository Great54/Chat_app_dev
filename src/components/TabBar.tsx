import React from 'react';
import { Globe, Trophy, Gamepad2, User as UserIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export type TabType = 'rooms' | 'leaderboard' | 'gaming' | 'profile';

interface TabBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  isLight?: boolean;
}

export default function TabBar({ activeTab, onTabChange, isLight = false }: TabBarProps) {
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
      id: 'gaming',
      label: 'Gaming',
      icon: <Gamepad2 className="w-5 h-5" />,
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: user.photoUrl ? (
        <div className="w-6 h-6 rounded-md aspect-square overflow-hidden shadow-xs">
          <img src={user.photoUrl} alt="Me" className="w-full h-full object-cover aspect-square" />
        </div>
      ) : (
        <UserIcon className="w-5 h-5" />
      ),
    },
  ];

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-40 px-4 py-2 sm:py-2.5 transition-colors duration-300 ${
        isLight
          ? 'bg-white/95 backdrop-blur-lg shadow-lg text-slate-700'
          : 'bg-[#0c0c14]/95 backdrop-blur-lg shadow-2xl text-white'
      }`}
    >
      <div className="max-w-md mx-auto flex items-center justify-around">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all ${
                isActive
                  ? 'text-purple-600 font-black scale-105'
                  : isLight
                  ? 'text-slate-400 hover:text-slate-700 font-medium'
                  : 'text-zinc-400 hover:text-zinc-200 font-medium'
              }`}
            >
              <div
                className={`p-1.5 rounded-xl transition-colors ${
                  isActive ? (isLight ? 'bg-purple-100 text-purple-700' : 'bg-purple-500/20 text-purple-300') : ''
                }`}
              >
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
