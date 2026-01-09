
import React from 'react';
import { Screen } from '../types';
import { Logo } from './UIComponents';

interface SidebarProps {
  currentScreen: Screen;
  onNavigate: (screen: Screen) => void;
  onProfileClick: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentScreen, onNavigate, onProfileClick }) => {
  const navItems = [
    { id: Screen.DASHBOARD, icon: 'dashboard', label: 'Home' },
    { id: Screen.REVIEW, icon: 'rate_review', label: 'Review' },
    { id: Screen.DOJO, icon: 'school', label: 'Design Dojo' },
    { id: Screen.HISTORY, icon: 'history', label: 'History' },
    { id: Screen.SETTINGS, icon: 'settings', label: 'Settings' },
  ];

  return (
    <div className="w-20 lg:w-24 h-screen bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 flex flex-col sticky top-0 z-50 items-center py-8 transition-colors duration-300">
      <div className="mb-12 flex flex-col items-center gap-2">
        <div 
          onClick={() => onNavigate(Screen.DASHBOARD)}
          className="w-14 h-14 flex items-center justify-center cursor-pointer group hover:scale-110 transition-transform duration-300"
        >
          <Logo className="w-10 h-10 drop-shadow-sm" />
        </div>
        <span className="text-[10px] font-black tracking-[0.2em] text-primary dark:text-primary-400 uppercase">Refyna</span>
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
                  ? 'text-white bg-primary shadow-lg shadow-primary/20' 
                  : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
              title={item.label}
            >
              <span className="material-icons-round text-xl">
                {item.icon}
              </span>
              {isActive && (
                 <div className="absolute -right-1 top-1 w-2 h-2 bg-pink-500 rounded-full border-2 border-white dark:border-slate-900 shadow-sm"></div>
              )}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col items-center gap-4">
        <div 
          onClick={onProfileClick}
          className="w-11 h-11 rounded-full border border-slate-200 dark:border-slate-700 p-0.5 cursor-pointer hover:border-primary dark:hover:border-primary transition-colors relative group"
        >
             <img 
            src="https://picsum.photos/40/40" 
            alt="User" 
            className="w-full h-full rounded-full object-cover"
          />
          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-white dark:border-slate-900 rounded-full shadow-sm"></div>
        </div>
      </div>
    </div>
  );
};
