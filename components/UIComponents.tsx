
import React, { ReactNode, useState, useMemo } from 'react';

export const Logo = ({ className = "w-10 h-10" }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M25 5L75 45L75 95L25 55L25 5Z" fill="#0551BA" />
    <path d="M25 5L75 45L45 55L25 5Z" fill="white" fillOpacity="0.2" />
    <path d="M75 45L75 95L45 55L75 45Z" fill="black" fillOpacity="0.1" />
  </svg>
);

export const GradientCard = ({ children, className = "", onClick }: { children?: ReactNode, className?: string, onClick?: () => void }) => (
  <div 
    onClick={onClick}
    className={`bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-soft rounded-[32px] hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden relative ${className}`}
  >
    {children}
  </div>
);

export const ModernCard: React.FC<{ 
  title: string, 
  description: string, 
  icon: string, 
  onClick: () => void, 
  color?: 'blue' | 'purple' | 'pink' | 'orange' | 'green'
}> = ({ 
  title, 
  description, 
  icon, 
  onClick, 
  color = 'blue' 
}) => {
  const colorStyles = {
    blue: {
      border: 'border-blue-500/10 dark:border-blue-500/20',
      iconBg: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
      hover: 'hover:shadow-blue-500/10'
    },
    purple: {
      border: 'border-purple-500/10 dark:border-purple-500/20',
      iconBg: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
      hover: 'hover:shadow-purple-500/10'
    },
    pink: {
      border: 'border-pink-500/10 dark:border-pink-500/20',
      iconBg: 'bg-pink-50 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400',
      hover: 'hover:shadow-pink-500/10'
    },
    orange: {
      border: 'border-orange-500/10 dark:border-orange-500/20',
      iconBg: 'bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
      hover: 'hover:shadow-orange-500/10'
    },
    green: {
      border: 'border-green-500/10 dark:border-green-500/20',
      iconBg: 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400',
      hover: 'hover:shadow-green-500/10'
    }
  };
  
  const theme = colorStyles[color];

  return (
    <div 
      onClick={onClick}
      className={`bg-white dark:bg-slate-800 rounded-[32px] p-8 border ${theme.border} transition-all duration-300 cursor-pointer group hover:shadow-2xl flex flex-col h-full min-h-[280px] relative overflow-hidden ${theme.hover}`}
    >
      <div className="mb-6">
        <div className={`w-12 h-12 rounded-2xl ${theme.iconBg} flex items-center justify-center transition-transform group-hover:scale-110`}>
           <span className="material-icons-round text-2xl">{icon}</span>
        </div>
      </div>
      
      <h3 className="text-xl font-semibold mb-3 tracking-tight text-slate-900 dark:text-white">{title}</h3>
      <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed flex-1 font-normal">{description}</p>
      
      <div className="mt-8 flex items-center gap-2 text-sm font-semibold text-primary group-hover:gap-3 transition-all">
        Start <span className="material-icons-round text-base">arrow_forward</span>
      </div>
    </div>
  );
};

export const Button = ({ 
  children, 
  variant = 'primary', 
  icon,
  onClick,
  disabled = false,
  className = ""
}: { 
  children?: ReactNode, 
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger',
  icon?: string,
  onClick?: () => void,
  disabled?: boolean,
  className?: string
}) => {
  const baseStyles = "flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-semibold transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-sm whitespace-nowrap";
  
  const variants = {
    primary: "bg-primary text-white hover:bg-primary-600 shadow-md shadow-primary/20",
    secondary: "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700",
    ghost: "text-slate-600 hover:text-primary hover:bg-primary-50 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800",
    danger: "bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 dark:bg-red-900/20 dark:border-red-900 dark:text-red-400"
  };

  return (
    <button onClick={onClick} disabled={disabled} className={`${baseStyles} ${variants[variant]} ${className}`}>
      {icon && <span className="material-icons-round text-[18px]">{icon}</span>}
      {children}
    </button>
  );
};

export const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input 
    {...props}
    className={`w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-4 text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all font-normal ${props.className}`}
  />
);

export const ContributionGraph = ({ activity }: { activity: Record<string, number> }) => {
  const weeks = useMemo(() => {
    const result = [];
    const today = new Date();
    // Go back 52 weeks (approx 1 year)
    const startDate = new Date();
    startDate.setDate(today.getDate() - (52 * 7));
    // Normalize to the previous Sunday
    startDate.setDate(startDate.getDate() - startDate.getDay());

    let current = new Date(startDate);
    for (let w = 0; w < 53; w++) {
      const weekDays = [];
      for (let d = 0; d < 7; d++) {
        const dateStr = current.toISOString().split('T')[0];
        const count = activity[dateStr] || 0;
        weekDays.push({ date: dateStr, count });
        current.setDate(current.getDate() + 1);
      }
      result.push(weekDays);
    }
    return result;
  }, [activity]);

  const getColor = (count: number) => {
    if (count === 0) return 'bg-slate-100 dark:bg-slate-800';
    if (count < 2) return 'bg-blue-100 dark:bg-blue-900/40';
    if (count < 5) return 'bg-blue-300 dark:bg-blue-700/60';
    if (count < 10) return 'bg-blue-500 dark:bg-blue-600';
    return 'bg-blue-700 dark:bg-blue-500';
  };

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-100 dark:border-slate-700 shadow-soft">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Contribution Activity</h3>
        <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
          <span>2025</span>
          <span className="material-icons-round text-sm">unfold_more</span>
        </div>
      </div>

      <div className="flex flex-col gap-1 overflow-x-auto pb-2">
        <div className="flex gap-[3px] ml-6 mb-1">
          {months.map(m => <span key={m} className="text-[10px] text-slate-400 w-[42px]">{m}</span>)}
        </div>
        <div className="flex gap-2">
           <div className="flex flex-col justify-between text-[10px] text-slate-400 py-1 h-[84px]">
             <span>Mon</span>
             <span>Wed</span>
             <span>Fri</span>
           </div>
           <div className="contribution-grid flex-1">
             {weeks.map((week, wi) => (
               <div key={wi} className="flex flex-col gap-[3px]">
                 {week.map((day, di) => (
                   <div 
                    key={di}
                    className={`w-[10px] h-[10px] rounded-[2px] ${getColor(day.count)} transition-colors hover:ring-2 hover:ring-primary/20 cursor-help group relative`}
                   >
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                        {day.count} contributions on {day.date}
                      </div>
                   </div>
                 ))}
               </div>
             ))}
           </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-[10px] text-slate-400 font-medium">
        <div className="flex gap-4">
          <div className="flex items-center gap-1">
            <span className="material-icons-round text-sm text-primary">local_fire_department</span>
            <span>47 day current streak</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="material-icons-round text-sm text-primary">stars</span>
            <span>89 day longest streak</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span>Less</span>
          <div className="flex gap-[3px]">
             <div className="w-[10px] h-[10px] rounded-[2px] bg-slate-100 dark:bg-slate-800"></div>
             <div className="w-[10px] h-[10px] rounded-[2px] bg-blue-100 dark:bg-blue-900/40"></div>
             <div className="w-[10px] h-[10px] rounded-[2px] bg-blue-300 dark:bg-blue-700/60"></div>
             <div className="w-[10px] h-[10px] rounded-[2px] bg-blue-500 dark:bg-blue-600"></div>
             <div className="w-[10px] h-[10px] rounded-[2px] bg-blue-700 dark:bg-blue-500"></div>
          </div>
          <span>More</span>
        </div>
      </div>
    </div>
  );
};
