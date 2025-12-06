import React, { ReactNode } from 'react';

export const GradientCard = ({ children, className = "", onClick }: { children?: ReactNode, className?: string, onClick?: () => void }) => (
  <div 
    onClick={onClick}
    className={`bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-soft rounded-[32px] hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden relative ${className}`}
  >
    {children}
  </div>
);

export const ModernCard = ({ 
  title, 
  description, 
  icon, 
  onClick, 
  color = 'blue' 
}: { 
  title: string, 
  description: string, 
  icon: string, 
  onClick: () => void, 
  color?: 'blue' | 'purple' | 'pink' 
}) => {
  const colorStyles = {
    blue: {
      border: 'border-blue-500 dark:border-blue-600',
      hoverBorder: 'hover:border-blue-600',
      text: 'text-blue-600 dark:text-blue-400',
      title: 'text-slate-900 dark:text-white'
    },
    purple: {
      border: 'border-purple-500 dark:border-purple-600',
      hoverBorder: 'hover:border-purple-600',
      text: 'text-purple-600 dark:text-purple-400',
      title: 'text-slate-900 dark:text-white'
    },
    pink: {
      border: 'border-pink-500 dark:border-pink-600',
      hoverBorder: 'hover:border-pink-600',
      text: 'text-pink-600 dark:text-pink-400',
      title: 'text-slate-900 dark:text-white'
    }
  };
  
  const theme = colorStyles[color];

  return (
    <div 
      onClick={onClick}
      className={`bg-white dark:bg-slate-800 rounded-[32px] p-8 border ${theme.border} transition-all duration-300 cursor-pointer group hover:shadow-xl flex flex-col h-full min-h-[340px] relative overflow-hidden`}
    >
      <div className="mb-8">
        <div className={`w-10 h-10 rounded-full border border-current ${theme.text} flex items-center justify-center opacity-80`}>
           <span className="material-icons-round text-xl">{icon}</span>
        </div>
      </div>
      
      <h3 className={`text-2xl font-medium mb-4 tracking-tight ${theme.title}`}>{title}</h3>
      <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed flex-1 font-normal">{description}</p>
      
      <div className={`mt-8 flex items-center gap-2 text-sm font-semibold ${theme.text} group-hover:translate-x-1 transition-transform`}>
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
  const baseStyles = "flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-medium transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-sm";
  
  const variants = {
    primary: "bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 shadow-lg shadow-slate-200 dark:shadow-none",
    secondary: "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700",
    ghost: "text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800",
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
    className={`w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-4 text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-200 dark:focus:ring-blue-800 focus:border-blue-400 dark:focus:border-blue-500 transition-all font-normal ${props.className}`}
  />
);