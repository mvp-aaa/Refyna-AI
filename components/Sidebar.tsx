import React from 'react';
import { Screen } from '../types';

interface SidebarProps {
  currentScreen: Screen;
  onNavigate: (screen: Screen) => void;
  onProfileClick: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentScreen, onNavigate, onProfileClick }) => {
  const navItems = [
    { id: Screen.DASHBOARD, icon: 'dashboard', label: 'Home' },
    { id: Screen.REVIEW, icon: 'rate_review', label: 'Review' },
    { id: Screen.HISTORY, icon: 'history', label: 'History' },
    { id: Screen.SETTINGS, icon: 'settings', label: 'Settings' },
  ];

  return (
    <div className="w-20 lg:w-24 h-screen bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 flex flex-col sticky top-0 z-50 items-center py-8 transition-colors duration-300">
      <div className="mb-12 flex flex-col items-center gap-2">
        <div 
          onClick={() => onNavigate(Screen.DASHBOARD)}
          className="w-10 h-10 rounded-full border border-purple-300 dark:border-purple-700 flex items-center justify-center text-purple-500 dark:text-purple-400 relative overflow-hidden group cursor-pointer"
        >
          <div className="absolute inset-0 bg-purple-50 dark:bg-purple-900/30 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <span className="material-icons-round text-xl relative z-10">auto_awesome</span>
        </div>
        <span className="text-[10px] font-bold tracking-widest text-slate-500 dark:text-slate-400 uppercase">Aura</span>
      </div>

      <nav className="flex-1 flex flex-col gap-4 w-full px-4">
        {navItems.map((item) => {
          const isActive = currentScreen === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-12 h-12 mx-auto flex items-center justify-center rounded-xl transition-all duration-300 group relative ${
                isActive 
                  ? 'text-white bg-slate-900 dark:bg-white dark:text-slate-900 shadow-md' 
                  : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
              title={item.label}
            >
              <span className="material-icons-round text-xl">
                {item.icon}
              </span>
              {isActive && (
                 <div className="absolute -right-1 top-1 w-2 h-2 bg-pink-500 rounded-full border-2 border-white dark:border-slate-900"></div>
              )}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col items-center gap-4">
        <div 
          onClick={onProfileClick}
          className="w-10 h-10 rounded-full border border-slate-200 dark:border-slate-700 p-0.5 cursor-pointer hover:border-slate-300 dark:hover:border-slate-500 transition-colors relative group"
        >
             <img 
            src="https://picsum.photos/40/40" 
            alt="User" 
            className="w-full h-full rounded-full object-cover"
          />
          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-white dark:border-slate-900 rounded-full"></div>
        </div>
      </div>
    </div>
  );
};