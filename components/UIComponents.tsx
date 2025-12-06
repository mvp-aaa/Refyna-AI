
import React, { ReactNode, useState } from 'react';

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

export const FeedbackButtons = ({ 
  onRate, 
  currentRating 
}: { 
  onRate: (rating: 'good' | 'bad', comment?: string) => void,
  currentRating?: 'good' | 'bad'
}) => {
  const [comment, setComment] = useState('');
  const [showComment, setShowComment] = useState(false);

  return (
    <div className="mt-3 border-t border-slate-100 dark:border-slate-600 pt-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Was this helpful?</span>
        <div className="flex gap-2">
          <button 
            onClick={() => { onRate('good', comment); setShowComment(false); }}
            className={`p-1.5 rounded-lg transition-colors ${currentRating === 'good' ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
          >
            <span className="material-icons-round text-base">thumb_up</span>
          </button>
          <button 
            onClick={() => setShowComment(true)}
            className={`p-1.5 rounded-lg transition-colors ${currentRating === 'bad' ? 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
          >
             <span className="material-icons-round text-base">thumb_down</span>
          </button>
        </div>
      </div>
      {showComment && (
        <div className="mt-2 animate-fade-in">
           <input 
             type="text" 
             placeholder="Why wasn't this helpful?"
             className="w-full text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg p-2 mb-2 focus:outline-none"
             value={comment}
             onChange={(e) => setComment(e.target.value)}
           />
           <Button 
             variant="danger" 
             className="w-full py-1 text-xs" 
             onClick={() => { onRate('bad', comment); setShowComment(false); }}
           >
             Submit Feedback
           </Button>
        </div>
      )}
    </div>
  );
};

export const ComparisonView = ({ 
  original, 
  generated 
}: { 
  original: string, 
  generated: string 
}) => {
  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-slate-900 shadow-2xl mt-8">
       <div className="absolute top-4 left-0 right-0 z-10 flex justify-center">
          <span className="bg-black/50 backdrop-blur text-white text-xs font-bold px-3 py-1 rounded-full border border-white/20 uppercase tracking-widest">
            Advanced Nano Brain Comparison
          </span>
       </div>
       <div className="grid grid-cols-2 h-[400px]">
          <div className="relative border-r border-white/10 group">
             <img src={original} alt="Original" className="w-full h-full object-contain bg-[#FAFAFA] dark:bg-[#0B1120]" />
             <div className="absolute bottom-4 left-4 bg-slate-900/80 text-white text-xs px-2 py-1 rounded">Original</div>
          </div>
          <div className="relative">
             <img src={generated} alt="AI Variant" className="w-full h-full object-contain bg-[#FAFAFA] dark:bg-[#0B1120]" />
             <div className="absolute bottom-4 right-4 bg-purple-600 text-white text-xs px-2 py-1 rounded shadow-glow">AI-Optimized</div>
             <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-purple-500/10 to-transparent"></div>
          </div>
       </div>
    </div>
  );
};
