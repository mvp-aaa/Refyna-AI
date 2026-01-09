
import React, { useState, useEffect, useRef } from 'react';
import { Screen, DesignToken, ImageSize, Annotation, ChatMessage, ReviewSession, UserProfile, UserFeedback, QuizCategory, Question, LeaderboardEntry } from './types';
import { Sidebar } from './components/Sidebar';
import { ModernCard, Button, Input, ContributionGraph, Logo } from './components/UIComponents';
import { analyzeDesignToken, analyzeImage, createChatSession } from './services/geminiService';
import { LiveSessionManager } from './services/liveAudio';
import { Chat, GenerateContentResponse, GoogleGenAI, Modality } from "@google/genai";

// Simple ID generator
const uuid = () => Math.random().toString(36).substring(2, 15);

// Get today's date string YYYY-MM-DD
const getTodayStr = () => new Date().toISOString().split('T')[0];

const playSound = (type: 'correct' | 'incorrect' | 'complete') => {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return;
  const ctx = new AudioContextClass();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.1, now + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

  if (type === 'correct') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.exponentialRampToValueAtTime(1046.50, now + 0.1); // C6
    osc.start(now);
    osc.stop(now + 0.4);
  } else if (type === 'incorrect') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now); // A3
    osc.frequency.linearRampToValueAtTime(110, now + 0.2); // A2
    osc.start(now);
    osc.stop(now + 0.3);
  } else {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.5);
  }
};

const QUIZ_CATEGORIES: QuizCategory[] = [
  { id: 'fundamentals', name: 'General Fundamentals', description: 'Typography, color theory, and whitespace.', skills: ['Visual hierarchy', 'Contrast'], difficulty: 'Beginner', icon: 'auto_awesome', color: 'blue' },
  { id: 'fintech', name: 'Fintech Products', description: 'Trust signals, data density, and risk states.', skills: ['Information design', 'Accessibility'], difficulty: 'Intermediate', icon: 'account_balance', color: 'green' },
  { id: 'dashboards', name: 'Data Visualization', description: 'Complex layouts and charting.', skills: ['Charts', 'Filtering'], difficulty: 'Mixed', icon: 'dashboard', color: 'purple' },
  { id: 'mobile', name: 'Mobile App Design', description: 'iOS and Android patterns.', skills: ['Touch targets', 'Navigation'], difficulty: 'Intermediate', icon: 'smartphone', color: 'pink' },
  { id: 'saas', name: 'SaaS Marketing', description: 'Conversion focused web design.', skills: ['Copywriting', 'Hierarchy'], difficulty: 'Mixed', icon: 'campaign', color: 'orange' },
];

const MOCK_QUESTIONS: Record<string, Question[]> = {
  fundamentals: [
    { id: 'q1', type: 'multiple-choice', text: 'Which font weight is generally better for readability in long-form body text on screens?', options: ['Extra Light (200)', 'Regular (400)', 'Bold (700)', 'Black (900)'], correctAnswer: 1, explanation: 'Regular weight (400) provides the best balance of stroke width for contrast and optical clarity at standard reading sizes.' },
    { id: 'q2', type: 'multiple-choice', text: 'When creating a primary action button, what is the most important factor for accessibility?', options: ['Using a bright color', 'Border radius', 'Contrast ratio with background', 'Button shadow'], correctAnswer: 2, explanation: 'Contrast ratio ensures the button text is readable for all users, including those with visual impairments. WCAG 2.1 requires at least 4.5:1.' },
  ],
  fintech: [
    { id: 'f1', type: 'multiple-choice', text: 'In a transaction risk indicator, which color is most appropriate for a "Warning" state?', options: ['Bright Red', 'Forest Green', 'Amber/Orange', 'Royal Blue'], correctAnswer: 2, explanation: 'Amber or Orange is the standard convention for warnings, while red is reserved for critical failures or errors.' },
  ]
};

const AuroraBackground = ({ show }: { show: boolean }) => {
  if (!show) return null;
  return (
    <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0 overflow-hidden opacity-40">
        <div className="absolute -top-24 -right-24 w-[600px] h-[600px] bg-blue-200/40 rounded-full mix-blend-multiply filter blur-3xl animate-blob dark:opacity-20 dark:mix-blend-screen"></div>
        <div className="absolute top-0 -right-4 w-[500px] h-[500px] bg-blue-100/40 rounded-full mix-blend-multiply filter blur-3xl animate-blob dark:opacity-20 dark:mix-blend-screen" style={{ animationDelay: '2s' }}></div>
        <div className="absolute -top-8 right-48 w-[500px] h-[500px] bg-indigo-100/40 rounded-full mix-blend-multiply filter blur-3xl animate-blob dark:opacity-20 dark:mix-blend-screen" style={{ animationDelay: '4s' }}></div>
    </div>
  );
};

const App = () => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('aura_user_profile');
    try {
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      // Ensure activityLog exists
      if (!parsed.activityLog) parsed.activityLog = {};
      return parsed;
    } catch (e) {
      return null;
    }
  });

  const [screen, setScreen] = useState<Screen>(() => {
    return localStorage.getItem('aura_user_profile') ? Screen.DASHBOARD : Screen.ONBOARDING;
  });

  const [onboardingStep, setOnboardingStep] = useState(1);
  const [tempProfile, setTempProfile] = useState<UserProfile>({ 
    name: '', role: '', goal: '', totalContributions: 0, rating: 5.0, projectsCount: 0, currentStreak: 0, longestStreak: 0, activityLog: {} 
  });

  const [tokenInput, setTokenInput] = useState('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Quiz Module State
  const [dojoMode, setDojoMode] = useState<'hub' | 'config' | 'active' | 'results'>('hub');
  const [selectedCategory, setSelectedCategory] = useState<QuizCategory | null>(null);
  const [quizTimer, setQuizTimer] = useState<number | null>(null);
  const [quizLength, setQuizLength] = useState(5);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizStreak, setQuizStreak] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<(number | null)[]>([]);
  const [isShowingFeedback, setIsShowingFeedback] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  
  const [sessions, setSessions] = useState<ReviewSession[]>([]);
  const [userFeedbackHistory, setUserFeedbackHistory] = useState<UserFeedback[]>(() => {
    const saved = localStorage.getItem('aura_user_feedback');
    try { return saved ? JSON.parse(saved) : []; } catch(e) { return []; }
  });

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatSessionRef = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatImageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('aura_history');
    if (saved) {
      try { setSessions(JSON.parse(saved)); } catch (e) { console.error(e); }
    }
    
    // Load Leaderboard
    const lastReset = localStorage.getItem('aura_dojo_reset');
    const todayStr = new Date().toDateString();
    if (lastReset !== todayStr) {
      localStorage.setItem('aura_dojo_reset', todayStr);
      localStorage.setItem('aura_dojo_leaderboard', JSON.stringify([]));
      setLeaderboard([]);
    } else {
      const savedL = localStorage.getItem('aura_dojo_leaderboard');
      if (savedL) setLeaderboard(JSON.parse(savedL));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('aura_history', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    if (userProfile) {
      localStorage.setItem('aura_user_profile', JSON.stringify(userProfile));
    }
  }, [userProfile]);

  const recordActivity = (points: number = 1) => {
    if (!userProfile) return;
    const today = getTodayStr();
    setUserProfile(prev => {
      if (!prev) return null;
      const newActivity = { ...prev.activityLog };
      newActivity[today] = (newActivity[today] || 0) + points;
      return {
        ...prev,
        activityLog: newActivity,
        totalContributions: prev.totalContributions + points,
        projectsCount: prev.projectsCount + (points > 5 ? 1 : 0) // Treat major reviews as projects
      };
    });
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !chatSessionRef.current) return;
    const userMsg: ChatMessage = { id: uuid(), role: 'user', text: chatInput, timestamp: new Date() };
    setChatHistory(prev => [...prev, userMsg]);
    setChatInput('');
    setIsAnalyzing(true);
    try {
      const response: GenerateContentResponse = await chatSessionRef.current.sendMessage({ message: userMsg.text });
      if (!isAnalyzing) return; // Stopped
      setChatHistory(prev => [...prev, { id: uuid(), role: 'model', text: response.text || "", timestamp: new Date() }]);
      recordActivity(1); // Small contribution for chatting/improving
    } catch (e) { console.error(e); } finally { setIsAnalyzing(false); }
  };

  const startImageAnalysis = async (file: File) => {
    if (!file || file.size === 0) return;
    const sessionId = uuid();
    const url = URL.createObjectURL(file);
    const base64 = await new Promise<string>((res) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.readAsDataURL(file);
    });
    setPreviewUrl(url);
    setGeneratedImage(null);
    setTokenInput('');
    setAnnotations([]);
    setScreen(Screen.REVIEW);
    setIsAnalyzing(true);
    
    try {
      const { text, annotations } = await analyzeImage(file, userFeedbackHistory);
      if (!isAnalyzing) return; // Stopped
      setAnnotations(annotations);
      chatSessionRef.current = createChatSession(text);
      const initialHistory: ChatMessage[] = [{ id: uuid(), role: 'model', text, timestamp: new Date() }];
      setChatHistory(initialHistory);
      setSessions(prev => [{ id: sessionId, type: 'image', content: base64, timestamp: Date.now(), title: `Visual Audit ${new Date().toLocaleDateString()}`, thumbnail: base64, chatHistory: initialHistory, annotations }, ...prev]);
      recordActivity(10); // Major design audit
    } catch (e) {
      console.error(e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await startImageAnalysis(file);
  };

  const handleLogout = () => {
    localStorage.removeItem('aura_user_profile');
    setUserProfile(null);
    setScreen(Screen.ONBOARDING);
    setOnboardingStep(1);
  };

  // --- Quiz Logic ---
  const startQuiz = () => {
    setDojoMode('active');
    setCurrentQuestionIdx(0);
    setQuizScore(0);
    setQuizStreak(0);
    setQuizAnswers([]);
    setIsShowingFeedback(false);
  };

  const handleAnswer = (idx: number) => {
    if (isShowingFeedback) return;
    const questions = MOCK_QUESTIONS[selectedCategory?.id || 'fundamentals'];
    const q = questions[currentQuestionIdx];
    const isCorrect = idx === q.correctAnswer;
    
    if (isCorrect) {
      setQuizScore(s => s + 100 + (quizStreak * 10));
      setQuizStreak(s => s + 1);
      playSound('correct');
    } else {
      setQuizStreak(0);
      playSound('incorrect');
    }
    
    setQuizAnswers(prev => [...prev, idx]);
    setIsShowingFeedback(true);
  };

  const nextQuestion = () => {
    const questions = MOCK_QUESTIONS[selectedCategory?.id || 'fundamentals'];
    if (currentQuestionIdx < questions.length - 1) {
      setCurrentQuestionIdx(i => i + 1);
      setIsShowingFeedback(false);
    } else {
      completeQuiz();
    }
  };

  const completeQuiz = () => {
    playSound('complete');
    const newEntry: LeaderboardEntry = {
      name: userProfile?.name || 'Designer',
      score: quizScore,
      category: selectedCategory?.name || 'Fundamentals',
      timestamp: Date.now()
    };
    const newLeaderboard = [newEntry, ...leaderboard].sort((a, b) => b.score - a.score).slice(0, 10);
    setLeaderboard(newLeaderboard);
    localStorage.setItem('aura_dojo_leaderboard', JSON.stringify(newLeaderboard));
    setDojoMode('results');
    recordActivity(5); // Completion of a quiz
  };

  const renderOnboarding = () => (
    <div className="max-w-md mx-auto pt-32 px-8 text-center animate-fade-in relative z-10">
      <div className="w-24 h-24 mx-auto mb-12 flex items-center justify-center transform hover:scale-110 transition-transform duration-500 shadow-glow rounded-[40px] p-6 bg-white/50 backdrop-blur-sm border border-white/50">
        <Logo className="w-full h-full drop-shadow-md" />
      </div>
      
      {onboardingStep === 1 ? (
        <>
          <h1 className="text-4xl font-bold mb-4 tracking-tight">Welcome to Refyna</h1>
          <p className="text-slate-500 mb-12">Your intelligent design companion for world-class interfaces.</p>
          <div className="space-y-4">
            <Input placeholder="What's your name?" value={tempProfile.name} onChange={e => setTempProfile({...tempProfile, name: e.target.value})} />
            <Button className="w-full py-4 text-lg" onClick={() => setOnboardingStep(2)} disabled={!tempProfile.name}>Get Started</Button>
          </div>
        </>
      ) : (
        <>
          <h1 className="text-3xl font-bold mb-4 tracking-tight">One last thing...</h1>
          <p className="text-slate-500 mb-12">What's your main goal with Refyna?</p>
          <div className="space-y-3 mb-12">
            {['Improve UX Skills', 'Speed up Reviews', 'Accessibility Audits'].map(goal => (
              <button 
                key={goal}
                onClick={() => setTempProfile({...tempProfile, goal})}
                className={`w-full p-5 rounded-2xl border-2 transition-all text-left flex justify-between items-center ${tempProfile.goal === goal ? 'border-primary bg-primary text-white shadow-lg' : 'border-slate-100 dark:border-slate-800 text-slate-500 hover:border-slate-200'}`}
              >
                {goal}
                {tempProfile.goal === goal && <span className="material-icons-round">check_circle</span>}
              </button>
            ))}
          </div>
          <Button className="w-full py-4 text-lg" onClick={() => {
            const p = {
              ...tempProfile, 
              role: 'Senior Product Designer', 
              location: 'San Francisco, CA', 
              bio: 'Passionate about creating beautiful, accessible design systems.',
              joinedDate: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
              totalContributions: 0,
              rating: 5.0,
              projectsCount: 0,
              currentStreak: 0,
              longestStreak: 0,
              activityLog: {}
            };
            setUserProfile(p);
            localStorage.setItem('aura_user_profile', JSON.stringify(p));
            setScreen(Screen.DASHBOARD);
          }} disabled={!tempProfile.goal}>Finish Setup</Button>
        </>
      )}
    </div>
  );

  const renderDojo = () => (
    <div className="max-w-6xl mx-auto pt-20 px-8 pb-12 relative z-10 animate-fade-in flex flex-col h-full overflow-y-auto">
      {dojoMode === 'hub' && (
        <>
          <header className="mb-12 flex justify-between items-end">
            <div>
              <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">Design Dojo</h1>
              <p className="text-slate-500 dark:text-slate-400 font-normal text-lg">Sharpen your design instincts through focused practice.</p>
            </div>
            <div className="hidden lg:block bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-soft w-64">
               <h4 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-3">Daily Leaderboard</h4>
               <div className="space-y-3">
                  {leaderboard.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No activity yet today.</p>
                  ) : leaderboard.map((l, i) => (
                    <div key={i} className="flex justify-between items-center text-sm">
                       <span className="text-slate-600 dark:text-slate-300 truncate w-32">#{i+1} {l.name}</span>
                       <span className="font-bold text-slate-900 dark:text-white">{l.score}</span>
                    </div>
                  ))}
               </div>
            </div>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {QUIZ_CATEGORIES.map(cat => (
              <ModernCard 
                key={cat.id}
                title={cat.name}
                description={cat.description}
                icon={cat.icon}
                color={cat.color || 'blue'}
                onClick={() => { setSelectedCategory(cat); setDojoMode('config'); }}
              />
            ))}
          </div>
        </>
      )}

      {dojoMode === 'config' && (
        <div className="max-w-md mx-auto w-full my-auto text-center">
           <Button variant="ghost" onClick={() => setDojoMode('hub')} className="mb-8"><span className="material-icons-round">arrow_back</span> Back to Hub</Button>
           <h2 className="text-3xl font-bold mb-2">{selectedCategory?.name}</h2>
           <p className="text-slate-500 dark:text-slate-400 mb-12">Configure your learning session.</p>
           
           <div className="bg-white dark:bg-slate-800 p-8 rounded-[40px] border border-slate-100 dark:border-slate-700 mb-8 shadow-soft">
              <div className="mb-8">
                 <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">Quiz Mode</h4>
                 <div className="flex gap-4">
                    <button 
                      onClick={() => setQuizTimer(30)}
                      className={`flex-1 p-4 rounded-2xl border-2 transition-all ${quizTimer ? 'border-primary bg-primary/5 text-primary' : 'border-slate-100 dark:border-slate-700 text-slate-400'}`}
                    >
                       <span className="material-icons-round block mb-1">timer</span>
                       Timed
                    </button>
                    <button 
                      onClick={() => setQuizTimer(null)}
                      className={`flex-1 p-4 rounded-2xl border-2 transition-all ${!quizTimer ? 'border-primary bg-primary/5 text-primary' : 'border-slate-100 dark:border-slate-700 text-slate-400'}`}
                    >
                       <span className="material-icons-round block mb-1">psychology</span>
                       Relaxed
                    </button>
                 </div>
              </div>
              <div>
                 <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">Quiz Length</h4>
                 <div className="flex justify-between">
                    {[5, 10, 20].map(l => (
                      <button 
                        key={l}
                        onClick={() => setQuizLength(l)}
                        className={`w-16 h-12 rounded-xl border-2 flex items-center justify-center transition-all font-bold ${quizLength === l ? 'border-primary bg-primary text-white' : 'border-slate-100 dark:border-slate-700 text-slate-400'}`}
                      >
                         {l}
                      </button>
                    ))}
                 </div>
              </div>
           </div>
           <Button onClick={startQuiz} className="w-full py-5 text-lg">Start Practicing</Button>
        </div>
      )}

      {dojoMode === 'active' && (
        <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col">
           <div className="flex justify-between items-center mb-12">
              <div className="flex items-center gap-4">
                 <div className="text-2xl font-bold text-slate-900 dark:text-white">{quizScore}</div>
                 <div className="h-4 w-px bg-slate-200 dark:border-slate-700"></div>
                 <div className="flex items-center gap-1 text-orange-500">
                    <span className="material-icons-round">local_fire_department</span>
                    <span className="font-bold">{quizStreak}</span>
                 </div>
              </div>
              <div className="text-sm font-medium text-slate-400 uppercase tracking-widest">
                 Question {currentQuestionIdx + 1} / {MOCK_QUESTIONS[selectedCategory?.id || 'fundamentals'].length}
              </div>
           </div>

           {(() => {
              const q = MOCK_QUESTIONS[selectedCategory?.id || 'fundamentals'][currentQuestionIdx];
              return (
                <div className="animate-fade-in flex-1 flex flex-col">
                   <h2 className="text-2xl font-semibold mb-10 text-slate-900 dark:text-white leading-snug">{q.text}</h2>
                   <div className="grid grid-cols-1 gap-4 mb-8">
                      {q.options.map((opt, i) => {
                        const isSelected = quizAnswers[currentQuestionIdx] === i;
                        const isCorrect = i === q.correctAnswer;
                        let stateStyles = "border-slate-100 dark:border-slate-700 hover:border-slate-200 hover:bg-slate-50";
                        if (isShowingFeedback) {
                           if (isCorrect) stateStyles = "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300";
                           else if (isSelected) stateStyles = "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300";
                           else stateStyles = "opacity-50 border-slate-100 dark:border-slate-700 pointer-events-none";
                        }
                        return (
                          <button 
                            key={i}
                            onClick={() => handleAnswer(i)}
                            className={`p-6 rounded-[24px] border-2 text-left transition-all relative overflow-hidden group ${stateStyles}`}
                          >
                             <div className="flex items-center gap-4">
                                <span className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-colors ${isSelected ? 'bg-current border-transparent text-white' : 'border-slate-200 text-slate-400'}`}>
                                   {String.fromCharCode(65 + i)}
                                </span>
                                <span className="font-medium">{opt}</span>
                             </div>
                          </button>
                        );
                      })}
                   </div>

                   {isShowingFeedback && (
                     <div className="animate-fade-in mt-auto pb-8">
                        <div className="bg-blue-50/50 dark:bg-slate-900/50 p-6 rounded-3xl border border-blue-100 dark:border-slate-700 mb-6">
                           <h4 className="text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-2 text-primary">
                             <span className="material-icons-round text-sm">info</span> Why this works
                           </h4>
                           <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{q.explanation}</p>
                        </div>
                        <Button onClick={nextQuestion} className="w-full h-14 text-lg">Continue <span className="material-icons-round">arrow_forward</span></Button>
                     </div>
                   )}
                </div>
              );
           })()}
        </div>
      )}

      {dojoMode === 'results' && (
        <div className="max-w-md mx-auto w-full my-auto text-center animate-fade-in">
           <div className="w-24 h-24 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-8 text-green-500">
              <span className="material-icons-round text-5xl">check_circle</span>
           </div>
           <h2 className="text-3xl font-bold mb-2 text-slate-900 dark:text-white">Practice Complete!</h2>
           <p className="text-slate-500 dark:text-slate-400 mb-8">Great job sharpening your skills today.</p>
           
           <div className="grid grid-cols-2 gap-4 mb-12">
              <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-soft">
                 <div className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Score</div>
                 <div className="text-3xl font-bold text-primary">{quizScore}</div>
              </div>
              <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-soft">
                 <div className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Best Streak</div>
                 <div className="text-3xl font-bold text-orange-500">{quizStreak}</div>
              </div>
           </div>

           <div className="space-y-3">
              <Button onClick={() => setDojoMode('hub')} className="w-full py-4">Back to Dojo Hub</Button>
              <Button variant="ghost" onClick={() => setScreen(Screen.DASHBOARD)} className="w-full">Return Home</Button>
           </div>
        </div>
      )}
    </div>
  );

  const renderReview = () => (
    <div className="flex h-screen overflow-hidden bg-[#f8fafc] dark:bg-slate-900 relative z-10 animate-fade-in">
      {/* Left Chat */}
      <div className="w-full lg:w-[400px] flex flex-col border-r border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 relative z-20 shadow-sm">
        <div className="p-6 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center bg-white/80 dark:bg-slate-900/80 backdrop-blur z-10">
           <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <span className="material-icons-round text-sm">auto_awesome</span>
             </div>
             Refyna
           </h3>
           <div className="flex gap-1">
             <Button variant="ghost" className="p-2" onClick={() => setScreen(Screen.DASHBOARD)}><span className="material-icons-round">close</span></Button>
           </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
           {chatHistory.map((msg) => (
             <div key={msg.id} className={`flex flex-col gap-2 animate-fade-in ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
               <div className={`rounded-2xl p-4 max-w-[90%] text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${msg.role === 'model' ? 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-tl-none' : 'bg-primary text-white rounded-tr-none font-medium'}`}>
                  {msg.text}
               </div>
             </div>
           ))}
           {isAnalyzing && (
             <div className="flex items-center gap-3 mx-2 mb-4 p-3 rounded-2xl bg-blue-50/30 dark:bg-slate-800 border border-blue-100/50 dark:border-blue-900/30 shadow-sm w-fit animate-pulse">
                <div className="relative w-5 h-5">
                   <div className="absolute inset-0 rounded-full aurora-vibrant animate-spin blur-[1px]"></div>
                   <div className="absolute inset-0.5 rounded-full bg-white dark:bg-slate-800"></div>
                </div>
                <span className="text-primary text-xs font-bold tracking-wide uppercase">AI Analyzing...</span>
             </div>
           )}
           <div ref={messagesEndRef} />
        </div>

        <div className="p-6 border-t border-slate-50 dark:border-slate-800 bg-white dark:bg-slate-900">
           <div className="relative flex gap-3 items-center">
              <button 
                onClick={() => chatImageInputRef.current?.click()} 
                className="w-14 h-14 rounded-2xl flex items-center justify-center bg-slate-50 dark:bg-slate-800 text-slate-400 hover:bg-blue-50 hover:text-primary transition-all border border-transparent"
              >
                 <span className="material-icons-round text-2xl">add_photo_alternate</span>
              </button>
              <div className="flex-1 relative">
                <input 
                  type="text" 
                  placeholder="Ask something about this design..." 
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-slate-700 dark:text-slate-200 h-14" 
                  value={chatInput} 
                  onChange={(e) => setChatInput(e.target.value)} 
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} 
                />
                <button 
                  className={`absolute right-2 top-2 w-10 h-10 rounded-xl flex items-center justify-center text-primary transition-all ${chatInput.trim() ? 'opacity-100 bg-primary/10' : 'opacity-0'}`} 
                  onClick={handleSendMessage}
                >
                  <span className="material-icons-round text-xl">arrow_upward</span>
                </button>
              </div>
           </div>
        </div>
      </div>

      {/* Right Preview */}
      <div className="flex-1 bg-[#f1f5f9] dark:bg-[#0B1120] relative flex overflow-hidden">
         <div className="flex items-center justify-center w-full h-full overflow-auto p-12">
             <div className="m-auto relative flex flex-col items-center justify-center">
                {(generatedImage || previewUrl) ? (
                   <div className="relative shadow-2xl rounded-2xl border-[8px] border-white dark:border-slate-700 bg-white dark:bg-slate-700 overflow-hidden">
                       <img 
                        src={generatedImage || previewUrl || ""} 
                        alt="Preview" 
                        className="max-w-[85vw] max-h-[80vh] block mx-auto object-contain" 
                       />
                       {annotations.map((ann, idx) => (
                         <div 
                          key={idx} 
                          className="absolute border-2 border-primary rounded-lg group cursor-pointer shadow-glow" 
                          style={{ top: `${ann.box_2d[0]}%`, left: `${ann.box_2d[1]}%`, height: `${ann.box_2d[2] - ann.box_2d[0]}%`, width: `${ann.box_2d[3] - ann.box_2d[1]}%` }}
                         >
                           <div className="absolute -top-3 -left-3 w-7 h-7 bg-primary text-white rounded-full flex items-center justify-center text-xs font-bold shadow-md">
                             {idx + 1}
                           </div>
                         </div>
                       ))}
                   </div>
                ) : (
                   <div className="text-center opacity-10">
                      <span className="material-icons-round text-9xl mb-4">image</span>
                      <h3 className="text-2xl font-bold">Waiting for input</h3>
                   </div>
                )}
             </div>
         </div>
         {isAnalyzing && (
            <div className="absolute bottom-6 right-6 z-30">
               <Button variant="danger" icon="stop" onClick={() => setIsAnalyzing(false)}>Stop Session</Button>
            </div>
         )}
      </div>
      <input type="file" ref={chatImageInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white transition-colors duration-300">
      <AuroraBackground show={screen === Screen.DASHBOARD || screen === Screen.ONBOARDING || isAnalyzing} />
      {screen !== Screen.ONBOARDING && (
        <Sidebar 
          currentScreen={screen} 
          onNavigate={setScreen} 
          onProfileClick={() => setScreen(Screen.SETTINGS)} 
        />
      )}
      <main className="flex-1 relative z-10 h-screen overflow-hidden flex flex-col">
        {screen === Screen.ONBOARDING ? renderOnboarding() :
         screen === Screen.DOJO ? renderDojo() : 
         screen === Screen.REVIEW ? renderReview() : 
         screen === Screen.DASHBOARD ? (
            <div className="max-w-6xl mx-auto pt-24 px-8 relative animate-fade-in h-full overflow-y-auto">
              <header className="mb-12">
                <h1 className="text-6xl font-bold tracking-tight mb-4 text-slate-900 dark:text-white">
                   Hello, <span className="text-primary">{userProfile?.name?.split(' ')[0] || 'Designer'}</span>
                </h1>
                <p className="text-2xl text-slate-500 font-medium">What's our focus for today's design?</p>
              </header>

              {/* Profile Overview moved to top */}
              <div className="mb-12 bg-white dark:bg-slate-800 rounded-[32px] p-8 border border-slate-100 dark:border-slate-700 shadow-soft flex items-center justify-between">
                 <div className="flex items-center gap-6">
                    <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center text-primary font-bold text-2xl">
                       {userProfile?.name?.[0] || 'D'}
                    </div>
                    <div>
                       <h3 className="text-lg font-bold">{userProfile?.name}</h3>
                       <p className="text-sm text-slate-400">Current Streak: <span className="text-primary font-bold">{userProfile?.currentStreak || 47} days</span></p>
                    </div>
                 </div>
                 <div className="flex gap-12 text-center">
                    <div>
                       <div className="text-2xl font-bold text-slate-900 dark:text-white">{userProfile?.totalContributions || '15.2K'}</div>
                       <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Contributions</div>
                    </div>
                    <div>
                       <div className="text-2xl font-bold text-slate-900 dark:text-white">{userProfile?.rating || '4.9'}</div>
                       <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Rating</div>
                    </div>
                 </div>
                 <Button variant="secondary" onClick={() => setScreen(Screen.SETTINGS)}>View Profile</Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-12">
                <ModernCard 
                  title="Design Dojo" 
                  description="Sharpen your intuition through expert-led interactive quizzes and streaks." 
                  icon="school" 
                  color="blue" 
                  onClick={() => { setScreen(Screen.DOJO); setDojoMode('hub'); }} 
                />
                <ModernCard 
                  title="Audit Design" 
                  description="Upload frames for instant visual suggestions and AI-powered grounding." 
                  icon="image_search" 
                  color="blue" 
                  onClick={() => setScreen(Screen.TOKEN_INPUT)} 
                />
                <ModernCard 
                  title="Token Review" 
                  description="Paste Figma variables or tokens for a deep accessibility and UX audit." 
                  icon="code" 
                  color="blue" 
                  onClick={() => setScreen(Screen.TOKEN_INPUT)} 
                />
              </div>
            </div>
         ) : screen === Screen.TOKEN_INPUT ? (
            <div className="max-w-4xl mx-auto pt-20 px-8 h-full flex flex-col justify-center animate-fade-in">
               <div className="bg-white dark:bg-slate-800 rounded-[40px] p-10 border border-slate-100 dark:border-slate-700 shadow-2xl">
                  <h2 className="text-3xl font-bold mb-2">Start Review</h2>
                  <p className="text-slate-500 mb-8">Paste your design code or upload a frame to get started.</p>
                  <textarea 
                    className="w-full h-48 bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 rounded-2xl p-6 mb-6 focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all" 
                    placeholder='Paste design tokens, JSON, or code snippet here...' 
                    value={tokenInput} 
                    onChange={(e) => setTokenInput(e.target.value)}
                  ></textarea>
                  <div className="flex gap-4">
                     <Button 
                      className="flex-1 h-14 text-lg" 
                      onClick={async () => {
                        if (!tokenInput.trim()) return;
                        setIsAnalyzing(true);
                        setScreen(Screen.REVIEW);
                        const result = await analyzeDesignToken(tokenInput);
                        setChatHistory([{ id: uuid(), role: 'model', text: result, timestamp: new Date() }]);
                        setIsAnalyzing(false);
                      }}
                     >
                       Analyze Code
                     </Button>
                     <input type="file" id="f-u-main" className="hidden" accept="image/*" onChange={handleFileUpload} />
                     <label htmlFor="f-u-main" className="w-16 h-14 border-2 border-slate-200 dark:border-slate-700 rounded-2xl flex items-center justify-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-primary text-slate-400 hover:text-primary transition-all">
                       <span className="material-icons-round text-2xl">image</span>
                     </label>
                  </div>
               </div>
               <Button variant="ghost" className="mt-8 self-center" onClick={() => setScreen(Screen.DASHBOARD)}>Cancel</Button>
            </div>
         ) : screen === Screen.HISTORY ? (
            <div className="max-w-6xl mx-auto pt-24 px-8 pb-12 relative animate-fade-in h-full overflow-y-auto">
               <h1 className="text-4xl font-bold mb-12">Session History</h1>
               {sessions.length === 0 ? (
                 <div className="text-center py-20 opacity-30">
                    <span className="material-icons-round text-8xl mb-4">history_toggle_off</span>
                    <p className="text-xl font-medium">No reviews recorded yet.</p>
                 </div>
               ) : (
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {sessions.map(s => (
                       <div key={s.id} onClick={() => { setScreen(Screen.REVIEW); setPreviewUrl(s.content); setChatHistory(s.chatHistory); setAnnotations(s.annotations); }} className="bg-white dark:bg-slate-800 rounded-[32px] border border-slate-100 dark:border-slate-700 overflow-hidden cursor-pointer hover:shadow-2xl hover:-translate-y-1 transition-all group">
                          <div className="h-48 bg-slate-50 dark:bg-slate-900 flex items-center justify-center overflow-hidden">
                             {s.thumbnail ? <img src={s.thumbnail} className="w-full h-full object-cover group-hover:scale-105 transition-transform" /> : <span className="material-icons-round text-5xl text-slate-200">code</span>}
                          </div>
                          <div className="p-8">
                             <div className="flex justify-between items-start mb-2">
                                <h3 className="font-bold truncate text-slate-900 dark:text-white flex-1">{s.title}</h3>
                                <span className="text-[10px] bg-blue-50 text-primary px-2 py-1 rounded-full font-bold uppercase tracking-wider">{s.type}</span>
                             </div>
                             <p className="text-xs text-slate-400 font-medium">{new Date(s.timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                          </div>
                       </div>
                    ))}
                 </div>
               )}
            </div>
         ) : screen === Screen.SETTINGS ? (
           <div className="max-w-6xl mx-auto pt-24 px-8 pb-20 animate-fade-in h-full overflow-y-auto">
              {/* Removed Profile Switcher Tabs */}

              {/* Main Profile Header */}
              <div className="bg-white dark:bg-slate-800 p-10 rounded-[40px] border border-slate-100 dark:border-slate-700 shadow-soft mb-8 flex flex-col md:flex-row gap-10 items-start">
                 <div className="relative">
                    <div className="w-28 h-28 rounded-3xl bg-primary flex items-center justify-center text-white text-4xl font-bold shadow-lg shadow-primary/20">
                       {userProfile?.name?.[0] || 'D'}
                    </div>
                    <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-white dark:bg-slate-800 border-4 border-slate-50 dark:border-slate-900 rounded-full flex items-center justify-center text-primary">
                       <span className="material-icons-round text-sm">verified</span>
                    </div>
                 </div>
                 
                 <div className="flex-1">
                    <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
                       <h2 className="text-3xl font-bold text-slate-900 dark:text-white">{userProfile?.name}</h2>
                       <span className="px-3 py-1 bg-blue-50 text-primary text-[10px] font-bold rounded-full uppercase tracking-widest border border-blue-100 flex items-center gap-1">
                          <span className="material-icons-round text-xs">workspace_premium</span> Top Contributor
                       </span>
                    </div>
                    <p className="text-slate-900 dark:text-white font-semibold mb-3">{userProfile?.role}</p>
                    <div className="flex flex-wrap gap-4 text-sm text-slate-400 font-medium mb-6">
                       <div className="flex items-center gap-1.5"><span className="material-icons-round text-base">location_on</span> {userProfile?.location}</div>
                       <div className="flex items-center gap-1.5 underline decoration-slate-200"><span className="material-icons-round text-base">link</span> design.portfolio</div>
                       <div className="flex items-center gap-1.5"><span className="material-icons-round text-base">calendar_month</span> Joined {userProfile?.joinedDate}</div>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed max-w-2xl">
                       {userProfile?.bio}
                    </p>
                    <div className="mt-8 flex gap-3">
                       <Button variant="secondary" className="px-8 border-2">Edit Profile</Button>
                       <Button variant="danger" icon="logout" onClick={handleLogout}>Reset Session</Button>
                    </div>
                 </div>
              </div>

              {/* Stats Grid - Adjusted to md:grid-cols-3 after removing 'Projects' card */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                 {[
                   { label: 'Contributions', value: userProfile?.totalContributions || '15.2K', icon: 'bookmark_border', color: 'text-blue-500' },
                   { label: 'Rating', value: userProfile?.rating || '4.9', icon: 'star_border', color: 'text-blue-500' },
                   { label: 'Day Streak', value: userProfile?.currentStreak || '47', icon: 'local_fire_department', color: 'text-orange-500' },
                 ].map((stat, i) => (
                    <div key={i} className="bg-white dark:bg-slate-800 p-8 rounded-[32px] border border-slate-100 dark:border-slate-700 shadow-soft text-center group">
                       <div className={`w-10 h-10 rounded-full border border-slate-100 mx-auto flex items-center justify-center mb-4 ${stat.color} transition-transform group-hover:scale-110`}>
                          <span className="material-icons-round text-xl">{stat.icon}</span>
                       </div>
                       <div className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{stat.value}</div>
                       <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">{stat.label}</div>
                    </div>
                 ))}
              </div>

              {/* Contribution Activity Map */}
              <div className="mb-8">
                 <ContributionGraph activity={userProfile?.activityLog || {}} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                 {/* Skills section */}
                 <div className="bg-white dark:bg-slate-800 p-10 rounded-[40px] border border-slate-100 dark:border-slate-700 shadow-soft">
                    <h3 className="text-xl font-bold mb-8">Skills & Expertise</h3>
                    <div className="flex flex-wrap gap-2">
                       {['UI Design', 'UX Design', 'Figma', 'Prototyping', 'Design Systems', 'Accessibility', 'User Research', 'Wireframing'].map(skill => (
                          <span key={skill} className="px-4 py-2 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 text-xs font-bold rounded-xl border border-slate-100 dark:border-slate-700">
                             {skill}
                          </span>
                       ))}
                    </div>
                 </div>

                 {/* Achievements section */}
                 <div className="bg-white dark:bg-slate-800 p-10 rounded-[40px] border border-slate-100 dark:border-slate-700 shadow-soft">
                    <h3 className="text-xl font-bold mb-8">Achievements</h3>
                    <div className="space-y-4">
                       {[
                         { label: 'Top 1% Designer', desc: 'Ranked in top 1% globally', icon: 'emoji_events', color: 'text-orange-400 bg-orange-50' },
                         { label: 'Expert Verified', desc: 'Platform verified expertise', icon: 'verified_user', color: 'text-blue-400 bg-blue-50' },
                         { label: 'Hot Streak', desc: '30+ days active', icon: 'local_fire_department', color: 'text-red-400 bg-red-50' },
                       ].map((ach, i) => (
                          <div key={i} className="flex items-center gap-4">
                             <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${ach.color}`}>
                                <span className="material-icons-round text-2xl">{ach.icon}</span>
                             </div>
                             <div>
                                <h4 className="font-bold text-sm text-slate-900 dark:text-white">{ach.label}</h4>
                                <p className="text-xs text-slate-400">{ach.desc}</p>
                             </div>
                          </div>
                       ))}
                    </div>
                 </div>
              </div>
           </div>
         ) : null}
      </main>
    </div>
  );
};

export default App;
