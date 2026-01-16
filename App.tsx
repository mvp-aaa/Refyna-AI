
import React, { useState, useEffect, useRef } from 'react';
import { Screen, Annotation, ChatMessage, ReviewSession, UserProfile, QuizCategory, Question, LeaderboardEntry, Resource } from './types';
import { Sidebar } from './components/Sidebar';
import { ModernCard, Button, Input } from './components/UIComponents';
import { analyzeDesignToken, analyzeImage, createChatSession, generateQuizQuestions } from './services/geminiService';
import { Chat, GenerateContentResponse } from "@google/genai";

const uuid = () => Math.random().toString(36).substring(2, 15);

const playSound = (type: 'correct' | 'incorrect' | 'complete' | 'tick') => {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return;
  const ctx = new AudioContextClass();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  const now = ctx.currentTime; gain.gain.setValueAtTime(0, now);
  if (type === 'correct') {
    gain.gain.linearRampToValueAtTime(0.1, now + 0.05); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
    osc.type = 'sine'; osc.frequency.setValueAtTime(523.25, now); osc.frequency.exponentialRampToValueAtTime(1046.50, now + 0.1);
    osc.start(now); osc.stop(now + 0.4);
  } else if (type === 'incorrect') {
    gain.gain.linearRampToValueAtTime(0.1, now + 0.05); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.type = 'triangle'; osc.frequency.setValueAtTime(220, now); osc.frequency.linearRampToValueAtTime(110, now + 0.2);
    osc.start(now); osc.stop(now + 0.3);
  } else if (type === 'tick') {
    gain.gain.setValueAtTime(0.02, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.type = 'sine'; osc.frequency.setValueAtTime(880, now); osc.start(now); osc.stop(now + 0.05);
  } else {
    gain.gain.linearRampToValueAtTime(0.1, now + 0.05); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    osc.type = 'sine'; osc.frequency.setValueAtTime(440, now); osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.2);
    osc.start(now); osc.stop(now + 0.5);
  }
};

const QUIZ_CATEGORIES: QuizCategory[] = [
  { 
    id: 'fundamentals', 
    name: 'Fundamentals', 
    description: 'Typography, color theory, and whitespace.', 
    skills: ['Visual hierarchy', 'Contrast'], 
    difficulty: 'Mixed', 
    icon: 'auto_awesome', 
    color: 'blue',
    resources: [
      { title: 'The 7 Principles of Design', type: 'Article', url: 'https://www.interaction-design.org/literature/article/the-7-principles-of-design', icon: 'menu_book' },
      { title: 'Typography for Designers', type: 'Video', url: 'https://www.youtube.com/watch?v=sByzHoiYFX0', icon: 'play_circle' }
    ]
  },
  { 
    id: 'graphic', 
    name: 'Graphic Design', 
    description: 'Composition, branding, and color storytelling.', 
    skills: ['Layout', 'Visual Identity'], 
    difficulty: 'Mixed', 
    icon: 'brush', 
    color: 'indigo',
    resources: [
      { title: 'Brand Identity Design Masterclass', type: 'Course', url: 'https://www.coursera.org/specializations/graphic-design', icon: 'school' },
      { title: 'Color Theory in Branding', type: 'Article', url: 'https://www.canva.com/learn/color-theory/', icon: 'palette' }
    ]
  },
  { 
    id: 'fintech', 
    name: 'Fintech Products', 
    description: 'Trust signals, data density, and risk states.', 
    skills: ['Security UX', 'Clarity'], 
    difficulty: 'Mixed', 
    icon: 'account_balance', 
    color: 'green',
    resources: [
      { title: 'Fintech UX Best Practices', type: 'Article', url: 'https://uxdesign.cc/ux-design-for-fintech-best-practices-and-examples-43a5327b7b15', icon: 'description' },
      { title: 'Building Trust in Finance UI', type: 'Video', url: 'https://www.youtube.com/watch?v=fS5_6mZOnc8', icon: 'play_circle' }
    ]
  },
  { 
    id: 'dashboards', 
    name: 'Data Visualization', 
    description: 'Complex layouts and charting.', 
    skills: ['Charts', 'Cognitive Load'], 
    difficulty: 'Mixed', 
    icon: 'dashboard', 
    color: 'purple',
    resources: [
      { title: 'Information Dashboard Design', type: 'Article', url: 'https://www.perceptualedge.com/articles/Whitepapers/Dashboard_Design.pdf', icon: 'auto_graph' },
      { title: 'Storytelling with Data', type: 'Video', url: 'https://www.youtube.com/watch?v=8EMW7io4rSI', icon: 'play_circle' }
    ]
  },
  { 
    id: 'mobile', 
    name: 'Mobile Design', 
    description: 'iOS and Android patterns.', 
    skills: ['Touch targets', 'Gestures'], 
    difficulty: 'Mixed', 
    icon: 'smartphone', 
    color: 'pink',
    resources: [
      { title: 'Apple Human Interface Guidelines', type: 'Article', url: 'https://developer.apple.com/design/human-interface-guidelines/', icon: 'apple' },
      { title: 'Material Design 3 for Mobile', type: 'Video', url: 'https://www.youtube.com/watch?v=D-Z5O7Y0x4U', icon: 'play_circle' }
    ]
  },
  { 
    id: 'saas', 
    name: 'SaaS Marketing', 
    description: 'Conversion focused web design.', 
    skills: ['Hierarchy', 'CTA strategy'], 
    difficulty: 'Mixed', 
    icon: 'campaign', 
    color: 'orange',
    resources: [
      { title: 'SaaS Landing Page Conversion', type: 'Article', url: 'https://unbounce.com/conversion-benchmark-report/saas/', icon: 'analytics' },
      { title: 'Marketing Design that Scales', type: 'Video', url: 'https://www.youtube.com/watch?v=6P6v6lO90pU', icon: 'play_circle' }
    ]
  },
];

const AuroraBackground = ({ show }: { show: boolean }) => {
  if (!show) return null;
  return (
    <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 w-[500px] h-[500px] bg-purple-300/40 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob dark:opacity-20 dark:mix-blend-screen"></div>
        <div className="absolute top-0 -right-4 w-[400px] h-[400px] bg-pink-300/40 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob dark:opacity-20 dark:mix-blend-screen" style={{ animationDelay: '2s' }}></div>
        <div className="absolute -top-8 right-48 w-[400px] h-[400px] bg-indigo-300/40 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob dark:opacity-20 dark:mix-blend-screen" style={{ animationDelay: '4s' }}></div>
    </div>
  );
};

const App = () => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('aura_user_profile');
    try { return saved ? JSON.parse(saved) : null; } catch (e) { return null; }
  });

  const [screen, setScreen] = useState<Screen>(() => {
    return localStorage.getItem('aura_user_profile') ? Screen.DASHBOARD : Screen.ONBOARDING;
  });

  const [onboardingStep, setOnboardingStep] = useState(1);
  const [tempProfile, setTempProfile] = useState<UserProfile>({ name: '', role: '', goal: '' });

  const [tokenInput, setTokenInput] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Quiz Module State
  const [dojoMode, setDojoMode] = useState<'hub' | 'config' | 'loading' | 'active' | 'results'>('hub');
  const [selectedCategory, setSelectedCategory] = useState<QuizCategory | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<'Beginner' | 'Intermediate' | 'Expert'>('Beginner');
  const [isTimedMode, setIsTimedMode] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [quizLength, setQuizLength] = useState(5);
  const [activeQuestions, setActiveQuestions] = useState<Question[]>([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizStreak, setQuizStreak] = useState(0);
  const [responseTimes, setResponseTimes] = useState<number[]>([]);
  const [questionStartTime, setQuestionStartTime] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<(number | null)[]>([]);
  const [isShowingFeedback, setIsShowingFeedback] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  
  const [sessions, setSessions] = useState<ReviewSession[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatSessionRef = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('aura_history');
    if (saved) { try { setSessions(JSON.parse(saved)); } catch (e) { console.error(e); } }
    const savedL = localStorage.getItem('aura_dojo_leaderboard');
    if (savedL) setLeaderboard(JSON.parse(savedL));
  }, []);

  useEffect(() => {
    if (dojoMode === 'active' && isTimedMode && !isShowingFeedback) {
      if (timeRemaining > 0) {
        timerRef.current = setTimeout(() => {
          setTimeRemaining(t => t - 1);
          if (timeRemaining <= 3) playSound('tick');
        }, 1000);
      } else {
        handleAnswer(-1); 
      }
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [dojoMode, isTimedMode, timeRemaining, isShowingFeedback]);

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !chatSessionRef.current) return;
    const userMsg: ChatMessage = { id: uuid(), role: 'user', text: chatInput, timestamp: new Date() };
    setChatHistory(prev => [...prev, userMsg]);
    setChatInput('');
    setIsAnalyzing(true);
    try {
      const response: GenerateContentResponse = await chatSessionRef.current.sendMessage({ message: userMsg.text });
      setChatHistory(prev => [...prev, { id: uuid(), role: 'model', text: response.text || "", timestamp: new Date() }]);
    } catch (e) { console.error(e); } finally { setIsAnalyzing(false); }
  };

  const startQuiz = async () => {
    setDojoMode('loading');
    const questions = await generateQuizQuestions(selectedCategory?.name || 'Fundamentals', selectedLevel, quizLength);
    if (questions.length === 0) {
      setDojoMode('hub');
      return;
    }
    setActiveQuestions(questions);
    setDojoMode('active');
    setCurrentQuestionIdx(0);
    setQuizScore(0);
    setQuizStreak(0);
    setQuizAnswers([]);
    setResponseTimes([]);
    setIsShowingFeedback(false);
    setQuestionStartTime(Date.now());
    if (isTimedMode) setTimeRemaining(selectedLevel === 'Expert' ? 10 : selectedLevel === 'Intermediate' ? 15 : 25);
  };

  const handleAnswer = (idx: number) => {
    if (isShowingFeedback) return;
    const duration = (Date.now() - questionStartTime) / 1000;
    setResponseTimes(prev => [...prev, duration]);

    const q = activeQuestions[currentQuestionIdx];
    const isCorrect = idx === q.correctAnswer;
    
    if (isCorrect) {
      let points = 100;
      if (isTimedMode) {
        const baseTime = selectedLevel === 'Expert' ? 10 : selectedLevel === 'Intermediate' ? 15 : 25;
        points += Math.max(0, Math.floor(((baseTime - duration) / baseTime) * 120));
      }
      points += (quizStreak * 30);
      setQuizScore(s => s + points);
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
    if (currentQuestionIdx < activeQuestions.length - 1) {
      setCurrentQuestionIdx(i => i + 1);
      setIsShowingFeedback(false);
      setQuestionStartTime(Date.now());
      if (isTimedMode) setTimeRemaining(selectedLevel === 'Expert' ? 10 : selectedLevel === 'Intermediate' ? 15 : 25);
    } else {
      completeQuiz();
    }
  };

  const completeQuiz = () => {
    playSound('complete');
    const avgTime = responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0;
    const newEntry: LeaderboardEntry = {
      name: userProfile?.name || 'Designer',
      score: quizScore,
      avgTime: parseFloat(avgTime.toFixed(2)),
      category: selectedCategory?.name || 'Fundamentals',
      timestamp: Date.now(),
      avatar: `https://i.pravatar.cc/150?u=${uuid()}`
    };
    const newLeaderboard = [newEntry, ...leaderboard].sort((a, b) => b.score - a.score).slice(0, 15);
    setLeaderboard(newLeaderboard);
    localStorage.setItem('aura_dojo_leaderboard', JSON.stringify(newLeaderboard));
    setDojoMode('results');
  };

  const handleLogout = () => {
    localStorage.clear();
    setUserProfile(null);
    setScreen(Screen.ONBOARDING);
    setOnboardingStep(1);
    setTempProfile({ name: '', role: '', goal: '' });
  };

  const renderOnboarding = () => (
    <div className="max-w-xl mx-auto h-screen flex flex-col justify-center px-8 animate-fade-in relative z-20">
      <div className="mb-12">
        <div className="w-16 h-16 aurora-vibrant rounded-2xl flex items-center justify-center text-white mb-6 shadow-glow">
          <span className="material-icons-round text-3xl">auto_awesome</span>
        </div>
        <h1 className="text-4xl font-black mb-2 tracking-tight">Welcome to Aura</h1>
        <p className="text-slate-400">Personalize your design intelligence companion.</p>
      </div>
      <div className="bg-white dark:bg-slate-800 p-10 rounded-[48px] border border-slate-100 dark:border-slate-800 shadow-2xl space-y-8">
        {onboardingStep === 1 ? (
          <div className="animate-fade-in">
            <label className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 block">Your name?</label>
            <Input autoFocus placeholder="Name" value={tempProfile.name} onChange={(e) => setTempProfile({...tempProfile, name: e.target.value})} onKeyDown={(e) => e.key === 'Enter' && tempProfile.name && setOnboardingStep(2)} />
            <Button disabled={!tempProfile.name} onClick={() => setOnboardingStep(2)} className="w-full mt-6 py-4 rounded-2xl">Continue</Button>
          </div>
        ) : onboardingStep === 2 ? (
          <div className="animate-fade-in">
            <label className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 block">Current Role?</label>
            <div className="grid grid-cols-1 gap-3">
              {['Product Designer', 'UI/UX Lead', 'Developer', 'Graphic Artist'].map(role => (
                <button key={role} onClick={() => setTempProfile({...tempProfile, role})} className={`p-5 rounded-2xl border-2 text-left transition-all font-bold ${tempProfile.role === role ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 shadow-md' : 'border-slate-50 dark:border-slate-700 text-slate-300 hover:border-slate-200'}`}>{role}</button>
              ))}
            </div>
            <Button disabled={!tempProfile.role} onClick={() => setOnboardingStep(3)} className="w-full mt-6 py-4 rounded-2xl">Continue</Button>
          </div>
        ) : (
          <div className="animate-fade-in">
            <label className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 block">Primary Goal?</label>
            <textarea className="w-full h-32 bg-slate-50 dark:bg-slate-900 border-2 border-slate-50 dark:border-slate-700 rounded-2xl p-4 mb-4 focus:outline-none" placeholder="e.g., Mastering typography and layout hierarchy..." value={tempProfile.goal} onChange={(e) => setTempProfile({...tempProfile, goal: e.target.value})} />
            <Button disabled={!tempProfile.goal} onClick={() => { localStorage.setItem('aura_user_profile', JSON.stringify(tempProfile)); setUserProfile(tempProfile); setScreen(Screen.DASHBOARD); }} className="w-full py-4 rounded-2xl aurora-vibrant text-white font-bold">Launch Aura</Button>
          </div>
        )}
      </div>
    </div>
  );

  const renderDojo = () => (
    <div className="flex h-screen bg-[#F8F9FC] dark:bg-slate-950 overflow-hidden relative z-10 animate-fade-in">
      {/* Left Area: Main Content */}
      <div className="flex-1 overflow-y-auto pt-20 px-12 pb-12">
        {dojoMode === 'hub' && (
          <>
            <div className="mb-12">
               <h1 className="text-5xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">Design Dojo</h1>
               <p className="text-xl text-slate-500 font-light">Dynamic challenges to sharpen your instincts.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {QUIZ_CATEGORIES.map(cat => (
                <div key={cat.id} onClick={() => { setSelectedCategory(cat); setDojoMode('config'); }} className="bg-white dark:bg-slate-900 p-8 rounded-[48px] border border-slate-100 dark:border-slate-800 hover:shadow-2xl hover:-translate-y-1 transition-all cursor-pointer group flex flex-col h-[280px] relative overflow-hidden shadow-sm">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 bg-slate-50 dark:bg-slate-800 text-${cat.color}-500 shadow-sm transition-transform group-hover:scale-110`}>
                     <span className="material-icons-round text-2xl">{cat.icon}</span>
                  </div>
                  <h3 className="text-xl font-bold mb-2 tracking-tight">{cat.name}</h3>
                  <p className="text-slate-400 text-xs leading-relaxed line-clamp-2">{cat.description}</p>
                  <div className="mt-auto flex items-center justify-between">
                     <span className="text-[9px] font-black uppercase tracking-[0.2em] bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-full text-slate-400">Dynamic</span>
                     <span className="text-xs font-bold text-slate-900 dark:text-white opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 transition-all flex items-center gap-1">Play <span className="material-icons-round text-sm">arrow_forward</span></span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {dojoMode === 'config' && (
          <div className="max-w-2xl mx-auto py-12 text-center h-full flex flex-col justify-center animate-fade-in">
             <Button variant="ghost" onClick={() => setDojoMode('hub')} className="mb-12 self-center border border-slate-100 px-6"><span className="material-icons-round">arrow_back</span> Hub</Button>
             <h2 className="text-5xl font-black mb-2 tracking-tight">{selectedCategory?.name}</h2>
             <p className="text-slate-500 mb-12">Personalize your training session.</p>
             <div className="bg-white dark:bg-slate-900 p-10 rounded-[48px] shadow-soft border border-slate-100 dark:border-slate-800 space-y-10 mb-12 text-left">
                <div>
                   <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">Mastery Level</h4>
                   <div className="grid grid-cols-3 gap-4">
                      {['Beginner', 'Intermediate', 'Expert'].map(l => (
                        <button key={l} onClick={() => setSelectedLevel(l as any)} className={`p-5 rounded-3xl border-2 transition-all font-bold text-sm ${selectedLevel === l ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 shadow-md' : 'border-slate-50 dark:border-slate-800 text-slate-300 hover:border-slate-200'}`}>{l}</button>
                      ))}
                   </div>
                </div>
                <div className="flex gap-10">
                   <div className="flex-1">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">Session Type</h4>
                      <div className="flex gap-4">
                         <button onClick={() => setIsTimedMode(true)} className={`flex-1 p-5 rounded-3xl border-2 transition-all flex items-center justify-center gap-2 ${isTimedMode ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-50 text-slate-300'}`}><span className="material-icons-round text-lg">timer</span> <b>Blitz</b></button>
                         <button onClick={() => setIsTimedMode(false)} className={`flex-1 p-5 rounded-3xl border-2 transition-all flex items-center justify-center gap-2 ${!isTimedMode ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-50 text-slate-300'}`}><span className="material-icons-round text-lg">psychology</span> <b>Zen</b></button>
                      </div>
                   </div>
                   <div>
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">Questions</h4>
                      <div className="flex gap-3">
                         {[5, 10, 20].map(l => (
                           <button key={l} onClick={() => setQuizLength(l)} className={`w-14 h-14 rounded-2xl border-2 transition-all font-bold ${quizLength === l ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-50 text-slate-300'}`}>{l}</button>
                         ))}
                      </div>
                   </div>
                </div>
             </div>
             <Button onClick={startQuiz} className="w-full py-6 text-xl rounded-[32px] aurora-vibrant text-white shadow-glow font-bold">Begin AI-Powered Session</Button>
          </div>
        )}

        {dojoMode === 'loading' && (
           <div className="h-full flex flex-col items-center justify-center text-center animate-pulse">
              <div className="w-24 h-24 aurora-vibrant rounded-[32px] flex items-center justify-center text-white mb-8 shadow-glow animate-spin">
                 <span className="material-icons-round text-5xl">auto_awesome</span>
              </div>
              <h2 className="text-4xl font-black mb-2 tracking-tight text-slate-900 dark:text-white">Analyzing Design Trends</h2>
              <p className="text-slate-500 font-light">Aura is generating dynamic, non-repetitive challenges for you...</p>
           </div>
        )}

        {dojoMode === 'active' && (
          <div className="max-w-3xl mx-auto h-full flex flex-col py-12">
             <div className="flex justify-between items-center mb-16">
                <div className="flex items-center gap-6">
                   <div className="text-5xl font-black text-slate-900 dark:text-white tabular-nums">{quizScore}</div>
                   <div className="flex items-center gap-1 text-orange-500 bg-orange-50 dark:bg-orange-900/20 px-4 py-2 rounded-2xl">
                      <span className="material-icons-round">local_fire_department</span>
                      <span className="font-black text-xl tabular-nums">{quizStreak}</span>
                   </div>
                </div>
                {isTimedMode && (
                  <div className="flex-1 max-w-[200px] mx-12">
                     <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                        <div className={`h-full transition-all duration-1000 ${timeRemaining <= 3 ? 'bg-red-500 animate-pulse' : 'bg-indigo-500'}`} style={{ width: `${(timeRemaining / (selectedLevel === 'Expert' ? 10 : selectedLevel === 'Intermediate' ? 15 : 25)) * 100}%` }}></div>
                     </div>
                  </div>
                )}
                <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-300">
                   {currentQuestionIdx + 1} / {activeQuestions.length}
                </div>
             </div>

             <div className="flex-1 animate-fade-in flex flex-col">
                <h2 className="text-3xl font-bold mb-12 leading-tight text-slate-900 dark:text-white">{activeQuestions[currentQuestionIdx]?.text}</h2>
                <div className="grid grid-cols-1 gap-4">
                   {activeQuestions[currentQuestionIdx]?.options.map((opt, i) => {
                      const isSelected = quizAnswers[currentQuestionIdx] === i;
                      const isCorrect = i === activeQuestions[currentQuestionIdx].correctAnswer;
                      let styles = "border-white dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-100 shadow-soft";
                      if (isShowingFeedback) {
                        if (isCorrect) styles = "border-green-500 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300";
                        else if (isSelected) styles = "border-red-500 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300";
                        else styles = "opacity-30 border-slate-100 dark:border-slate-800";
                      }
                      return (
                        <button key={i} onClick={() => handleAnswer(i)} className={`p-8 rounded-[36px] border-2 text-left transition-all font-medium text-lg flex items-center gap-6 ${styles}`}>
                           <span className={`w-12 h-12 rounded-2xl border flex items-center justify-center font-black text-xl ${isSelected ? 'bg-indigo-600 border-transparent text-white' : 'border-slate-100 text-slate-300'}`}>{String.fromCharCode(65+i)}</span>
                           {opt}
                        </button>
                      );
                   })}
                </div>
                {isShowingFeedback && (
                  <div className="mt-12 animate-fade-in">
                     <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-100 dark:border-slate-800 mb-8 shadow-sm">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-3 flex items-center gap-2"><span className="material-icons-round text-sm">tips_and_updates</span> Expert Analysis</h4>
                        <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm font-normal">{activeQuestions[currentQuestionIdx].explanation}</p>
                     </div>
                     <Button onClick={nextQuestion} className="w-full py-6 rounded-[32px] text-lg font-bold shadow-lg">Proceed <span className="material-icons-round">arrow_forward</span></Button>
                  </div>
                )}
             </div>
          </div>
        )}

        {dojoMode === 'results' && (
          <div className="max-w-4xl mx-auto py-12 h-full flex flex-col animate-fade-in overflow-y-auto">
             <div className="flex flex-col md:flex-row gap-10 items-start mb-16">
                <div className="flex-1 text-center md:text-left">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 aurora-vibrant rounded-[24px] flex items-center justify-center shadow-glow text-white">
                        <span className="material-icons-round text-3xl">emoji_events</span>
                    </div>
                    <div>
                      <h2 className="text-4xl font-black tracking-tight">Challenge Cleared!</h2>
                      <p className="text-slate-500">Session analysis for level: {selectedLevel}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-8">
                      <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-soft">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Final Score</div>
                        <div className="text-4xl font-black tabular-nums tracking-tighter">{quizScore}</div>
                      </div>
                      <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-soft">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Avg. Speed</div>
                        <div className="text-4xl font-black tabular-nums tracking-tighter">{(responseTimes.reduce((a,b)=>a+b,0)/responseTimes.length).toFixed(1)}s</div>
                      </div>
                  </div>

                  <div className="flex gap-4">
                      <Button onClick={() => setDojoMode('hub')} className="flex-1 py-4 rounded-[20px] font-bold">Dojo Hub</Button>
                      <Button variant="ghost" onClick={startQuiz} className="flex-1 py-4 rounded-[20px] border border-slate-200 font-bold">Try Again</Button>
                  </div>
                </div>

                {/* Achievements inspired summary card */}
                <div className="w-full md:w-80 bg-white dark:bg-slate-900 p-8 rounded-[48px] border border-slate-100 dark:border-slate-800 shadow-soft self-stretch flex flex-col">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6">Session Badge</h4>
                  <div className="flex-1 flex flex-col items-center justify-center py-6">
                      <div className="w-24 h-24 aurora-vibrant rounded-full flex items-center justify-center mb-6 shadow-glow relative">
                         <span className="material-icons-round text-5xl text-white">rocket</span>
                         <div className="absolute -bottom-2 bg-green-500 text-white text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-md">Get Started</div>
                      </div>
                      <span className="text-sm font-bold text-slate-900 dark:text-white text-center">Design Catalyst</span>
                      <p className="text-[10px] text-slate-400 text-center mt-2 leading-relaxed">Keep up this pace to unlock the senior-tier badges!</p>
                  </div>
                  <Button variant="ghost" className="w-full text-xs font-black uppercase tracking-widest border border-slate-50 mt-4">View All Badges</Button>
                </div>
             </div>

             {/* Deep Dive Section - Inspired by "Up next" & "Featured" from image */}
             <div className="border-t border-slate-100 dark:border-slate-800 pt-16">
                <div className="flex items-center justify-between mb-10">
                   <h3 className="text-3xl font-black tracking-tight">Deep Dive into {selectedCategory?.name}</h3>
                   <span className="text-xs font-black uppercase tracking-widest text-indigo-500">Recommended for you</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   {selectedCategory?.resources.map((res, i) => (
                      <div key={i} className="group bg-white dark:bg-slate-900 p-8 rounded-[48px] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all flex items-start gap-6 cursor-pointer" onClick={() => window.open(res.url, '_blank')}>
                         <div className="w-14 h-14 rounded-[20px] bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-indigo-500 transition-colors shadow-sm">
                            <span className="material-icons-round text-3xl">{res.icon}</span>
                         </div>
                         <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                               <span className="text-[9px] font-black uppercase tracking-[0.2em] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 px-2 py-1 rounded-md">{res.type}</span>
                            </div>
                            <h4 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors mb-2">{res.title}</h4>
                            <p className="text-xs text-slate-400 leading-relaxed font-normal">Expand your knowledge with curated industry materials handpicked by Aura.</p>
                         </div>
                         <div className="self-center w-10 h-10 rounded-full border border-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-slate-900 group-hover:text-white transition-all">
                            <span className="material-icons-round text-xl">arrow_forward</span>
                         </div>
                      </div>
                   ))}
                </div>
                
                {/* Extra Section: Streaks/Progress inspired placeholder */}
                <div className="mt-12 p-8 rounded-[48px] bg-[#F9FAFF] dark:bg-slate-800/50 border border-slate-50 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-8">
                   <div className="flex items-center gap-6">
                      <div className="text-center">
                         <span className="text-6xl font-black text-slate-900 dark:text-white tabular-nums">0</span>
                         <div className="flex items-center gap-1 text-orange-500 text-[10px] font-black uppercase tracking-widest">
                            <span className="material-icons-round text-sm">local_fire_department</span> Current Streak
                         </div>
                      </div>
                      <div className="w-px h-12 bg-slate-200 dark:bg-slate-700 mx-4 hidden md:block"></div>
                      <div className="flex gap-2">
                         {['Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed'].map((day, i) => (
                           <div key={day} className="flex flex-col items-center gap-2">
                              <div className={`w-4 h-4 rounded-full border-2 ${i === 6 ? 'border-slate-900 dark:border-white' : 'border-slate-200 dark:border-slate-700'}`}></div>
                              <span className="text-[9px] font-black text-slate-300 uppercase">{day}</span>
                           </div>
                         ))}
                      </div>
                   </div>
                   <div className="text-center md:text-right">
                      <p className="text-xs text-slate-400 font-normal leading-relaxed max-w-xs">Complete a challenge every day to build your streak and reach Senior Designer status!</p>
                   </div>
                </div>
             </div>
          </div>
        )}
      </div>

      {/* Right Area: Dynamic Leaderboard (Sixelf Inspiration) */}
      <div className="w-full lg:w-[480px] bg-white dark:bg-slate-900 border-l border-slate-100 dark:border-slate-800 p-12 overflow-y-auto flex flex-col shadow-xl z-20">
          <div className="mb-12">
             <div className="text-7xl font-black text-slate-900 dark:text-white mb-2 tabular-nums tracking-tighter">
                {(leaderboard.reduce((a,b)=>a+b.score,0)/1000).toFixed(1)}K
             </div>
             <div className="flex items-center justify-between text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                <span>Global Impact Score</span>
                <span>{leaderboard.length + 842} Users Active</span>
             </div>
          </div>
          
          <div className="mb-16 p-8 rounded-[48px] bg-slate-50 dark:bg-slate-800/50 border border-slate-50 dark:border-slate-800 relative overflow-hidden group">
             <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -mr-12 -mt-12 transition-all group-hover:bg-indigo-500/10"></div>
             <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-pink-500 mb-4 flex items-center gap-2">
                <span className="material-icons-round text-sm">rocket_launch</span> mastering design fundamentals
             </h4>
             <p className="text-xs text-slate-400 leading-relaxed font-normal">Our daily board celebrates the designers who master the dynamic challenges with high-speed precision.</p>
          </div>

          <div className="flex-1 space-y-16">
             {/* Podium Display for Top 3 */}
             <div className="flex justify-between items-end gap-2 px-4 relative h-72">
                {/* 2nd Place */}
                {(() => {
                  const item = leaderboard[1];
                  if (!item) return <div className="flex-1" />;
                  return (
                    <div className="flex flex-col items-center flex-1 animate-fade-in translate-y-6">
                       <div className="relative mb-4">
                          <img src={item.avatar} className="w-16 h-16 rounded-full border-4 border-white dark:border-slate-800 shadow-xl object-cover" />
                          <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-slate-200 text-white flex items-center justify-center shadow-lg border-2 border-white"><span className="material-icons-round text-base">military_tech</span></div>
                       </div>
                       <span className="text-xs font-black truncate w-full text-center mb-1">{item.name}</span>
                       <span className="text-[10px] text-slate-400 uppercase font-black tabular-nums">{item.score}</span>
                       <div className="w-full h-24 bg-slate-50 dark:bg-slate-800/80 rounded-t-3xl mt-4 border-x border-t border-slate-100 flex items-end justify-center pb-2 text-2xl font-black text-slate-100 dark:text-slate-700">2</div>
                    </div>
                  );
                })()}
                {/* 1st Place */}
                {(() => {
                  const item = leaderboard[0];
                  if (!item) return <div className="flex-1" />;
                  return (
                    <div className="flex flex-col items-center flex-1 animate-fade-in z-10">
                       <div className="relative mb-4 scale-125">
                          <img src={item.avatar} className="w-20 h-20 rounded-full border-4 border-amber-400 shadow-2xl object-cover" />
                          <div className="absolute -bottom-3 -right-3 w-10 h-10 rounded-full bg-gradient-to-br from-amber-300 to-amber-600 text-white flex items-center justify-center shadow-xl border-4 border-white"><span className="material-icons-round text-xl">workspace_premium</span></div>
                       </div>
                       <span className="text-sm font-black truncate w-full text-center mb-1 mt-4">{item.name}</span>
                       <span className="text-[10px] text-slate-400 font-black tabular-nums">{item.score}</span>
                       <div className="w-full h-44 bg-slate-900 dark:bg-white rounded-t-3xl mt-4 shadow-2xl flex items-end justify-center pb-4 text-4xl font-black italic text-white/20 dark:text-slate-200">1</div>
                    </div>
                  );
                })()}
                {/* 3rd Place */}
                {(() => {
                  const item = leaderboard[2];
                  if (!item) return <div className="flex-1" />;
                  return (
                    <div className="flex flex-col items-center flex-1 animate-fade-in translate-y-12">
                       <div className="relative mb-4">
                          <img src={item.avatar} className="w-14 h-14 rounded-full border-4 border-white dark:border-slate-800 shadow-xl object-cover" />
                          <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-orange-400 text-white flex items-center justify-center shadow-lg border-2 border-white"><span className="material-icons-round text-base">stars</span></div>
                       </div>
                       <span className="text-xs font-black truncate w-full text-center mb-1">{item.name}</span>
                       <span className="text-[10px] text-slate-400 uppercase font-black tabular-nums">{item.score}</span>
                       <div className="w-full h-16 bg-slate-50 dark:bg-slate-800/80 rounded-t-3xl mt-4 border-x border-t border-slate-100 flex items-end justify-center pb-2 text-2xl font-black text-slate-100 dark:text-slate-700">3</div>
                    </div>
                  );
                })()}
             </div>

             <div className="space-y-6 pt-12">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 px-6">
                   <div className="flex gap-14"><span>Rank</span><span>Designer</span></div>
                   <span>Daily Score</span>
                </div>
                <div className="space-y-3">
                   {leaderboard.map((entry, i) => (
                     <div key={i} className={`flex items-center justify-between p-5 rounded-[36px] transition-all group hover:bg-slate-50 dark:hover:bg-slate-800/30 ${i < 3 ? 'bg-[#F9FAFF] dark:bg-slate-800/20 shadow-sm border border-slate-50/50' : ''}`}>
                        <div className="flex items-center gap-10">
                           <span className="text-xs font-black text-slate-200 w-4 tabular-nums">#{i+1}</span>
                           <div className="flex items-center gap-4">
                              <img src={entry.avatar} className="w-10 h-10 rounded-2xl border border-white shadow-sm object-cover" />
                              <div className="flex flex-col">
                                 <span className="text-sm font-bold text-slate-900 dark:text-white truncate w-32">{entry.name}</span>
                                 <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{entry.avgTime}s speed</span>
                              </div>
                           </div>
                        </div>
                        <div className="flex items-center gap-5">
                           <span className="text-sm font-black text-slate-900 dark:text-white tabular-nums">{entry.score}</span>
                           <div className={`w-8 h-8 rounded-full flex items-center justify-center ${i < 3 ? 'text-pink-500' : 'text-slate-100'}`}><span className="material-icons-round text-xl">workspace_premium</span></div>
                        </div>
                     </div>
                   ))}
                </div>
             </div>
          </div>
      </div>
    </div>
  );

  const renderReview = () => (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-slate-900 relative z-10 animate-fade-in">
      <div className="w-full lg:w-[420px] flex flex-col border-r border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 relative z-20 shadow-xl">
        <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center">
           <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-3">
             <div className="w-10 h-10 rounded-2xl aurora-vibrant flex items-center justify-center text-white shadow-glow"><span className="material-icons-round text-xl">auto_awesome</span></div>
             Aura
           </h3>
           <Button variant="ghost" className="p-2 border border-slate-50" onClick={() => setScreen(Screen.DASHBOARD)}><span className="material-icons-round">close</span></Button>
        </div>
        <div className="flex-1 overflow-y-auto p-8 space-y-8 scroll-smooth">
           {chatHistory.map((msg) => (
             <div key={msg.id} className={`flex flex-col gap-2 animate-fade-in ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
               <div className={`rounded-3xl p-5 max-w-[95%] text-sm leading-relaxed whitespace-pre-wrap shadow-sm border ${msg.role === 'model' ? 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-tl-none' : 'bg-slate-900 dark:bg-indigo-600 text-white border-transparent rounded-tr-none'}`}>
                  {msg.text}
               </div>
             </div>
           ))}
           {isAnalyzing && (
             <div className="flex items-center gap-4 mx-2 mb-4 p-4 rounded-3xl bg-white dark:bg-slate-800 border border-indigo-100 dark:border-indigo-900 shadow-sm w-fit animate-pulse">
                <div className="w-5 h-5 aurora-vibrant rounded-full animate-spin"></div>
                <span className="text-xs font-black tracking-widest text-indigo-500 uppercase">Analyzing Context...</span>
             </div>
           )}
           <div ref={messagesEndRef} />
        </div>
        <div className="p-8 border-t border-slate-50 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30">
           <div className="relative flex gap-3 items-center">
              <div className="flex-1 relative">
                <input type="text" placeholder="Ask Aura about the design..." className="w-full bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-3xl px-6 py-4 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-900/20 h-16 transition-all" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} />
                <button className={`absolute right-3 top-3 w-10 h-10 rounded-2xl flex items-center justify-center bg-indigo-600 text-white transition-all shadow-glow ${chatInput.trim() ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`} onClick={handleSendMessage}><span className="material-icons-round text-xl">arrow_upward</span></button>
              </div>
           </div>
        </div>
      </div>

      <div className="flex-1 bg-[#FAFAFA] dark:bg-[#0B1120] relative flex overflow-hidden">
         <div className="flex items-center justify-center w-full h-full overflow-auto p-12">
             <div className="m-auto relative flex flex-col items-center justify-center">
                {previewUrl ? (
                   <div className="relative shadow-2xl rounded-[48px] border-[12px] border-white dark:border-slate-700 bg-white dark:border-slate-700 p-2 overflow-hidden">
                       <img src={previewUrl} alt="Preview" className="max-w-[80vw] max-h-[75vh] block rounded-[32px] mx-auto object-contain" />
                       {annotations.map((ann, idx) => (
                         <div key={idx} className="absolute border-4 border-pink-500 rounded-2xl group cursor-pointer shadow-glow" style={{ top: `${ann.box_2d[0]}%`, left: `${ann.box_2d[1]}%`, height: `${ann.box_2d[2] - ann.box_2d[0]}%`, width: `${ann.box_2d[3] - ann.box_2d[1]}%` }}>
                           <div className="absolute -top-4 -left-4 w-10 h-10 bg-pink-500 text-white rounded-full flex items-center justify-center text-sm font-black border-4 border-white shadow-xl">{idx + 1}</div>
                         </div>
                       ))}
                   </div>
                ) : (
                   <div className="text-center opacity-5 flex flex-col items-center"><span className="material-icons-round text-[140px] mb-8">design_services</span><h3 className="text-4xl font-black uppercase tracking-widest">Active Studio</h3></div>
                )}
             </div>
         </div>
         {isAnalyzing && (
            <div className="absolute bottom-10 right-10 z-30">
               <Button variant="danger" icon="stop" className="rounded-full px-8 py-5 shadow-2xl font-bold" onClick={() => setIsAnalyzing(false)}>Stop Session</Button>
            </div>
         )}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-white dark:bg-slate-900 text-slate-900 dark:text-white transition-colors duration-300">
      <AuroraBackground show={screen === Screen.DASHBOARD || screen === Screen.ONBOARDING || isAnalyzing} />
      {screen !== Screen.ONBOARDING && (
        <Sidebar currentScreen={screen} onNavigate={setScreen} onProfileClick={() => setScreen(Screen.SETTINGS)} />
      )}
      <main className="flex-1 relative z-10 h-screen overflow-hidden flex flex-col">
        {screen === Screen.ONBOARDING ? renderOnboarding() :
         screen === Screen.DOJO ? renderDojo() : 
         screen === Screen.REVIEW ? renderReview() : 
         screen === Screen.DASHBOARD ? (
            <div className="max-w-7xl mx-auto pt-32 px-12 relative animate-fade-in h-full overflow-y-auto w-full">
              <header className="mb-24">
                <h1 className="text-[6.5rem] leading-[0.9] tracking-tighter font-black mb-8">
                  <span className="text-gradient-primary">Aura_{userProfile?.name?.split(' ')[0]}</span>
                </h1>
                <p className="text-4xl text-slate-400 font-light max-w-2xl leading-tight">Your designer co-pilot for high-fidelity product outcomes.</p>
              </header>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-10 pb-20">
                <ModernCard title="Design Dojo" description="Master visual balance and speed through AI-shuffled daily challenges." icon="school" color="pink" onClick={() => { setScreen(Screen.DOJO); setDojoMode('hub'); }} />
                <ModernCard title="Visual Audit" description="Upload a frame for a comprehensive critique and trend mapping." icon="image_search" color="purple" onClick={() => setScreen(Screen.TOKEN_INPUT)} />
                <ModernCard title="Engine Review" description="Paste token JSONs for detailed consistency and accessibility verification." icon="code" color="blue" onClick={() => setScreen(Screen.TOKEN_INPUT)} />
              </div>
            </div>
         ) : screen === Screen.TOKEN_INPUT ? (
            <div className="max-w-4xl mx-auto pt-20 px-8 h-full flex flex-col justify-center animate-fade-in">
               <div className="bg-white dark:bg-slate-800 rounded-[64px] p-12 border border-slate-100 dark:border-slate-800 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-2 aurora-vibrant"></div>
                  <h2 className="text-5xl font-black mb-3 tracking-tight">Launch Audit</h2>
                  <p className="text-slate-500 mb-10 text-lg">Input your design data or drop a frame below.</p>
                  <textarea className="w-full h-56 bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-[40px] p-10 mb-8 focus:outline-none focus:border-indigo-500 transition-all text-sm font-mono" placeholder='Paste code snippet or Figma JSON tokens...' value={tokenInput} onChange={(e) => setTokenInput(e.target.value)}></textarea>
                  <div className="flex gap-4">
                     <Button className="flex-1 py-6 text-xl rounded-[32px] font-bold" onClick={async () => {
                        if (!tokenInput.trim()) return;
                        setIsAnalyzing(true); setScreen(Screen.REVIEW);
                        const result = await analyzeDesignToken(tokenInput);
                        chatSessionRef.current = createChatSession(tokenInput);
                        setChatHistory([{ id: uuid(), role: 'model', text: result, timestamp: new Date() }]);
                        setIsAnalyzing(false);
                      }}>Audit Source</Button>
                     <input type="file" id="f-u-main" className="hidden" accept="image/*" onChange={async (e) => {
                       const file = e.target.files?.[0];
                       if (file) {
                         const url = URL.createObjectURL(file);
                         setPreviewUrl(url); setScreen(Screen.REVIEW); setIsAnalyzing(true);
                         const { text, annotations } = await analyzeImage(file);
                         chatSessionRef.current = createChatSession("Visual Audit Context: " + text);
                         setAnnotations(annotations); setChatHistory([{ id: uuid(), role: 'model', text, timestamp: new Date() }]);
                         setIsAnalyzing(false);
                       }
                     }} />
                     <label htmlFor="f-u-main" className="w-24 h-20 border-2 border-slate-100 dark:border-slate-800 rounded-[32px] flex items-center justify-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm"><span className="material-icons-round text-4xl text-slate-400">add_photo_alternate</span></label>
                  </div>
               </div>
               <Button variant="ghost" className="mt-12 self-center border border-slate-100 px-10" onClick={() => setScreen(Screen.DASHBOARD)}>Cancel Session</Button>
            </div>
         ) : screen === Screen.SETTINGS ? (
           <div className="max-w-2xl mx-auto pt-24 px-8 text-center animate-fade-in flex flex-col h-full justify-center">
              <h1 className="text-6xl font-black mb-16 tracking-tighter">System Profile</h1>
              <div className="bg-white dark:bg-slate-800 p-12 rounded-[64px] border border-slate-100 dark:border-slate-800 shadow-2xl mb-12">
                 <div className="w-28 h-28 aurora-vibrant rounded-[40px] flex items-center justify-center mx-auto mb-8 text-white shadow-glow"><span className="material-icons-round text-5xl">person</span></div>
                 <h2 className="text-4xl font-black mb-2 tracking-tight">{userProfile?.name}</h2>
                 <p className="text-slate-400 mb-10 text-xs font-black uppercase tracking-[0.2em]">{userProfile?.goal}</p>
                 <Button variant="danger" onClick={handleLogout} className="w-full py-6 rounded-[32px] font-bold">Full Reset</Button>
              </div>
              <Button variant="ghost" className="self-center border border-slate-100 px-10" onClick={() => setScreen(Screen.DASHBOARD)}>Back to Studio</Button>
           </div>
         ) : null}
      </main>
    </div>
  );
};

export default App;
