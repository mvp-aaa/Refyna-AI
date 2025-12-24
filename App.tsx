
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Screen, DesignToken, ImageSize, Annotation, ChatMessage, ReviewSession, UserProfile, UserFeedback, QuizCategory, Question, LeaderboardEntry } from './types';
import { Sidebar } from './components/Sidebar';
import { ModernCard, Button, Input } from './components/UIComponents';
import { analyzeDesignToken, analyzeImage, createChatSession } from './services/geminiService';
import { Chat, GenerateContentResponse } from "@google/genai";

// Simple ID generator
const uuid = () => Math.random().toString(36).substring(2, 15);

// Sound Synthesizer for Quiz
const playSound = (type: 'correct' | 'incorrect' | 'complete' | 'tick') => {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return;
  const ctx = new AudioContextClass();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0, now);

  if (type === 'correct') {
    gain.gain.linearRampToValueAtTime(0.1, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.exponentialRampToValueAtTime(1046.50, now + 0.1); // C6
    osc.start(now);
    osc.stop(now + 0.4);
  } else if (type === 'incorrect') {
    gain.gain.linearRampToValueAtTime(0.1, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now); // A3
    osc.frequency.linearRampToValueAtTime(110, now + 0.2); // A2
    osc.start(now);
    osc.stop(now + 0.3);
  } else if (type === 'tick') {
    gain.gain.setValueAtTime(0.02, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.start(now);
    osc.stop(now + 0.05);
  } else {
    gain.gain.linearRampToValueAtTime(0.1, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
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

const FULL_QUESTION_POOL: Record<string, Question[]> = {
  fundamentals: Array.from({ length: 25 }, (_, i) => ({
    id: `fund-${i}`,
    type: 'multiple-choice',
    text: [
      "Which font weight is generally better for readability in long-form body text on screens?",
      "When creating a primary action button, what is the most important factor for accessibility?",
      "What is the recommended minimum contrast ratio for normal text according to WCAG 2.1 Level AA?",
      "In design hierarchy, what does 'Scale' primarily help establish?",
      "Which color combination is usually best for reading long text?",
      "What is 'negative space' in a layout?",
      "Why is '8pt grid' popular in modern UI design?",
      "Which of these font types is usually best for small captions?",
      "What does 'line-height' (leading) affect?",
      "In a 3-column layout, which column typically attracts the first glance in LTR languages?"
    ][i % 10],
    options: [
      ['Extra Light', 'Regular (400)', 'Bold', 'Black'],
      ['Color', 'Border radius', 'Contrast ratio', 'Shadow'],
      ['2:1', '3:1', '4.5:1', '7:1'],
      ['Complexity', 'Relative importance', 'File size', 'Saturation'],
      ['Red on Blue', 'Dark Grey on White', 'Yellow on Black', 'White on Light Pink'],
      ['A mistake', 'The space between elements', 'A dark background', 'Bottom margins'],
      ['It is divisible by 2 and 4', 'It matches screen resolutions', 'It looks better', 'It is standard for print'],
      ['Script', 'Sans-Serif', 'Serif', 'Display'],
      ['Character width', 'Vertical spacing between lines', 'Horizontal spacing', 'Paragraph padding'],
      ['Right', 'Middle', 'Left', 'Top']
    ][i % 10],
    correctAnswer: [1, 2, 2, 1, 1, 1, 0, 1, 1, 2][i % 10],
    explanation: "This principle ensures optimal clarity and user focus in digital interfaces."
  })),
  fintech: Array.from({ length: 20 }, (_, i) => ({
    id: `fin-${i}`,
    type: 'multiple-choice',
    text: [
      "Which color choice is most appropriate for a 'Risk: High' transaction alert?",
      "In a financial dashboard, what is the primary goal of 'Information Density'?",
      "Which currency formatting is clearest for global users?",
      "What is a 'Trust Signal' in fintech onboarding?",
      "How should negative balances usually be represented?"
    ][i % 5],
    options: [
      ['Blue', 'Red', 'Green', 'Grey'],
      ['Showing as much as possible', 'Clarity and quick scanning', 'Using small fonts', 'Hiding details'],
      ['$10.00', '10.00 USD', '10$', 'USD 10'],
      ['A fast app', 'Encryption badges/Security icons', 'Dark mode', 'Big buttons'],
      ['With a plus sign', 'In red or with a minus sign', 'In bold only', 'By hiding them']
    ][i % 5],
    correctAnswer: [1, 1, 1, 1, 1][i % 5],
    explanation: "Financial UX relies on established mental models for trust and security."
  }))
};

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
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Quiz Module State
  const [dojoMode, setDojoMode] = useState<'hub' | 'config' | 'active' | 'results'>('hub');
  const [selectedCategory, setSelectedCategory] = useState<QuizCategory | null>(null);
  const [isTimedMode, setIsTimedMode] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [quizLength, setQuizLength] = useState(5);
  const [activeQuestions, setActiveQuestions] = useState<Question[]>([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizStreak, setQuizStreak] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<(number | null)[]>([]);
  const [isShowingFeedback, setIsShowingFeedback] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  
  const [sessions, setSessions] = useState<ReviewSession[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatSessionRef = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatImageInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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

  // Quiz Timer Logic
  useEffect(() => {
    if (dojoMode === 'active' && isTimedMode && !isShowingFeedback) {
      if (timeRemaining > 0) {
        timerRef.current = setTimeout(() => {
          setTimeRemaining(t => t - 1);
          if (timeRemaining <= 5) playSound('tick');
        }, 1000);
      } else {
        handleAnswer(-1); // Auto-fail on timeout
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const sessionId = uuid();
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setScreen(Screen.REVIEW);
      setIsAnalyzing(true);
      const { text, annotations } = await analyzeImage(file);
      setAnnotations(annotations);
      chatSessionRef.current = createChatSession(text);
      setChatHistory([{ id: uuid(), role: 'model', text, timestamp: new Date() }]);
      setIsAnalyzing(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('aura_user_profile');
    setUserProfile(null);
    setScreen(Screen.ONBOARDING);
    setOnboardingStep(1);
  };

  // --- Quiz Logic ---
  const startQuiz = () => {
    const pool = FULL_QUESTION_POOL[selectedCategory?.id || 'fundamentals'] || [];
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, quizLength);
    
    setActiveQuestions(selected);
    setDojoMode('active');
    setCurrentQuestionIdx(0);
    setQuizScore(0);
    setQuizStreak(0);
    setQuizAnswers([]);
    setIsShowingFeedback(false);
    if (isTimedMode) setTimeRemaining(15);
  };

  const handleAnswer = (idx: number) => {
    if (isShowingFeedback) return;
    const q = activeQuestions[currentQuestionIdx];
    const isCorrect = idx === q.correctAnswer;
    
    if (isCorrect) {
      let points = 100;
      if (isTimedMode) points += Math.floor(timeRemaining * 10); // Bonus for speed
      points += (quizStreak * 25); // Bonus for streak
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
      if (isTimedMode) setTimeRemaining(15);
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
      timestamp: Date.now(),
      avatar: `https://i.pravatar.cc/150?u=${uuid()}`
    };
    const newLeaderboard = [newEntry, ...leaderboard].sort((a, b) => b.score - a.score).slice(0, 10);
    setLeaderboard(newLeaderboard);
    localStorage.setItem('aura_dojo_leaderboard', JSON.stringify(newLeaderboard));
    setDojoMode('results');
  };

  const renderOnboarding = () => (
    <div className="max-w-md mx-auto pt-32 px-8 text-center animate-fade-in relative z-10">
      <div className="w-20 h-20 rounded-[32px] aurora-vibrant mx-auto mb-12 flex items-center justify-center text-white shadow-glow">
        <span className="material-icons-round text-4xl">auto_awesome</span>
      </div>
      {onboardingStep === 1 ? (
        <div className="space-y-4">
          <h1 className="text-4xl font-medium mb-4">Welcome to Aura</h1>
          <Input placeholder="What's your name?" value={tempProfile.name} onChange={e => setTempProfile({...tempProfile, name: e.target.value})} />
          <Button className="w-full py-4" onClick={() => setOnboardingStep(2)} disabled={!tempProfile.name}>Get Started</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <h1 className="text-3xl font-medium mb-4">Your Goal?</h1>
          {['Improve UX Skills', 'Speed up Reviews', 'Accessibility Audits'].map(goal => (
            <button key={goal} onClick={() => setTempProfile({...tempProfile, goal})} className={`w-full p-5 rounded-2xl border-2 transition-all text-left flex justify-between ${tempProfile.goal === goal ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-100'}`}>{goal}</button>
          ))}
          <Button className="w-full py-4" onClick={() => { setUserProfile(tempProfile); localStorage.setItem('aura_user_profile', JSON.stringify(tempProfile)); setScreen(Screen.DASHBOARD); }}>Finish Setup</Button>
        </div>
      )}
    </div>
  );

  const renderDojo = () => (
    <div className="flex h-screen bg-[#F8F9FC] dark:bg-slate-950 overflow-hidden relative z-10 animate-fade-in">
      {/* Left Panel: Hub / Config / Active */}
      <div className="flex-1 overflow-y-auto pt-20 px-12 pb-12">
        {dojoMode === 'hub' && (
          <>
            <div className="mb-12">
               <h1 className="text-5xl font-medium text-slate-900 dark:text-white mb-2">Design Quizzes</h1>
               <p className="text-xl text-slate-500 font-light">Daily skill-sharpening exercises.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {QUIZ_CATEGORIES.map(cat => (
                <div key={cat.id} onClick={() => { setSelectedCategory(cat); setDojoMode('config'); }} className="bg-white dark:bg-slate-900 p-10 rounded-[40px] border border-slate-100 dark:border-slate-800 hover:shadow-2xl hover:-translate-y-1 transition-all cursor-pointer group flex flex-col h-[320px]">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-8 bg-slate-50 dark:bg-slate-800 text-${cat.color}-500`}>
                     <span className="material-icons-round text-3xl">{cat.icon}</span>
                  </div>
                  <h3 className="text-2xl font-medium mb-3">{cat.name}</h3>
                  <p className="text-slate-500 mb-6">{cat.description}</p>
                  <div className="mt-auto flex items-center gap-2">
                     <span className="text-[10px] font-bold uppercase tracking-widest bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-full text-slate-400">{cat.difficulty}</span>
                     <span className="ml-auto text-sm font-bold text-slate-900 dark:text-white group-hover:translate-x-1 transition-transform flex items-center gap-1">Practice <span className="material-icons-round text-base">arrow_forward</span></span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {dojoMode === 'config' && (
          <div className="max-w-xl mx-auto py-12 text-center h-full flex flex-col justify-center">
             <Button variant="ghost" onClick={() => setDojoMode('hub')} className="mb-12 self-center"><span className="material-icons-round">arrow_back</span> Hub</Button>
             <div className="w-24 h-24 bg-white dark:bg-slate-900 rounded-[32px] shadow-xl flex items-center justify-center mx-auto mb-8 border border-slate-50 dark:border-slate-800">
                <span className="material-icons-round text-4xl text-slate-400">{selectedCategory?.icon}</span>
             </div>
             <h2 className="text-4xl font-medium mb-2">{selectedCategory?.name}</h2>
             <p className="text-slate-500 mb-12">Configure your session length and pace.</p>
             
             <div className="bg-white dark:bg-slate-900 p-10 rounded-[48px] shadow-soft border border-slate-100 dark:border-slate-800 space-y-10 mb-12">
                <div className="flex gap-4">
                   <button onClick={() => setIsTimedMode(true)} className={`flex-1 p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-2 ${isTimedMode ? 'border-slate-900 bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'border-slate-100 text-slate-400'}`}>
                      <span className="material-icons-round">timer</span>
                      <span className="font-bold">Timed</span>
                   </button>
                   <button onClick={() => setIsTimedMode(false)} className={`flex-1 p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-2 ${!isTimedMode ? 'border-slate-900 bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'border-slate-100 text-slate-400'}`}>
                      <span className="material-icons-round">psychology</span>
                      <span className="font-bold">Relaxed</span>
                   </button>
                </div>
                <div>
                   <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6">Quiz Length</h4>
                   <div className="flex justify-center gap-4">
                      {[5, 10, 20].map(l => (
                        <button key={l} onClick={() => setQuizLength(l)} className={`w-20 h-16 rounded-2xl border-2 transition-all font-bold ${quizLength === l ? 'border-slate-900 bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'border-slate-100 text-slate-400'}`}>{l}</button>
                      ))}
                   </div>
                </div>
             </div>
             <Button onClick={startQuiz} className="w-full py-6 text-xl rounded-[32px]">Challenge Accepted</Button>
          </div>
        )}

        {dojoMode === 'active' && (
          <div className="max-w-3xl mx-auto h-full flex flex-col py-12">
             <div className="flex justify-between items-center mb-16">
                <div className="flex items-center gap-6">
                   <div className="text-4xl font-black text-slate-900 dark:text-white">{quizScore}</div>
                   <div className="flex items-center gap-1 text-orange-500">
                      <span className="material-icons-round">local_fire_department</span>
                      <span className="font-black text-xl">{quizStreak}</span>
                   </div>
                </div>
                {isTimedMode && (
                  <div className="flex-1 max-w-[200px] mx-12">
                     <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full transition-all duration-1000 ${timeRemaining <= 5 ? 'bg-red-500 animate-pulse' : 'bg-slate-900 dark:bg-white'}`} style={{ width: `${(timeRemaining / 15) * 100}%` }}></div>
                     </div>
                  </div>
                )}
                <div className="text-sm font-bold uppercase tracking-widest text-slate-400">
                   {currentQuestionIdx + 1} / {activeQuestions.length}
                </div>
             </div>

             <div className="flex-1 animate-fade-in flex flex-col">
                <h2 className="text-3xl font-medium mb-12 leading-snug">{activeQuestions[currentQuestionIdx]?.text}</h2>
                <div className="grid grid-cols-1 gap-4">
                   {activeQuestions[currentQuestionIdx]?.options.map((opt, i) => {
                      const isSelected = quizAnswers[currentQuestionIdx] === i;
                      const isCorrect = i === activeQuestions[currentQuestionIdx].correctAnswer;
                      let styles = "border-slate-100 dark:border-slate-800 hover:border-slate-200";
                      if (isShowingFeedback) {
                        if (isCorrect) styles = "border-green-500 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300";
                        else if (isSelected) styles = "border-red-500 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300";
                        else styles = "opacity-40 border-slate-100 dark:border-slate-800";
                      }
                      return (
                        <button key={i} onClick={() => handleAnswer(i)} className={`p-8 rounded-[32px] border-2 text-left transition-all font-medium text-lg flex items-center gap-6 ${styles}`}>
                           <span className={`w-10 h-10 rounded-xl border flex items-center justify-center font-black ${isSelected ? 'bg-current border-transparent text-white' : 'border-slate-200 text-slate-300'}`}>{String.fromCharCode(65+i)}</span>
                           {opt}
                        </button>
                      );
                   })}
                </div>
                {isShowingFeedback && (
                  <div className="mt-12 animate-fade-in">
                     <div className="bg-slate-50 dark:bg-slate-900/50 p-8 rounded-[40px] border border-slate-100 dark:border-slate-800 mb-8">
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">The Why</h4>
                        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{activeQuestions[currentQuestionIdx].explanation}</p>
                     </div>
                     <Button onClick={nextQuestion} className="w-full py-5 rounded-[24px]">Continue <span className="material-icons-round">arrow_forward</span></Button>
                  </div>
                )}
             </div>
          </div>
        )}

        {dojoMode === 'results' && (
          <div className="max-w-xl mx-auto py-12 text-center h-full flex flex-col justify-center">
             <div className="w-32 h-32 aurora-vibrant rounded-full flex items-center justify-center mx-auto mb-10 shadow-glow text-white">
                <span className="material-icons-round text-6xl">emoji_events</span>
             </div>
             <h2 className="text-4xl font-medium mb-3">Excellent Session!</h2>
             <p className="text-slate-500 mb-12">Your design fundamentals are getting stronger.</p>
             <div className="grid grid-cols-2 gap-6 mb-12">
                <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-100 dark:border-slate-800">
                   <div className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Final Score</div>
                   <div className="text-5xl font-black">{quizScore}</div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-100 dark:border-slate-800">
                   <div className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Accuracy</div>
                   <div className="text-5xl font-black">{Math.round((quizAnswers.filter((a,i) => a === activeQuestions[i].correctAnswer).length / activeQuestions.length) * 100)}%</div>
                </div>
             </div>
             <Button onClick={() => setDojoMode('hub')} className="w-full py-5 rounded-[24px]">Back to Hub</Button>
          </div>
        )}
      </div>

      {/* Right Panel: Daily Leaderboard (Inspiration Replicated) */}
      <div className="w-full lg:w-[450px] bg-white dark:bg-slate-900 border-l border-slate-100 dark:border-slate-800 p-12 overflow-y-auto flex flex-col">
          <div className="mb-12">
             <div className="text-6xl font-black text-slate-900 dark:text-white mb-2">598.2K</div>
             <div className="flex items-center justify-between text-slate-400 text-sm font-bold uppercase tracking-widest">
                <span>Contributions</span>
                <span>992 Designers</span>
             </div>
          </div>
          
          <div className="mb-12 p-8 rounded-[40px] bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
             <h4 className="text-[10px] font-black uppercase tracking-widest text-pink-500 mb-4 flex items-center gap-2">
                <span className="material-icons-round text-sm">auto_awesome</span> Recognizing the Best! 🚀
             </h4>
             <p className="text-sm text-slate-500 leading-relaxed">Here, we celebrate the dedication and impact of our users as they climb the ranks through skill and achievement.</p>
          </div>

          <div className="flex-1 space-y-12">
             {/* Top 3 Highlighting */}
             <div className="flex justify-between items-end gap-2 px-4">
                {leaderboard.slice(0, 3).map((entry, i) => {
                  const ranks = [
                    { h: 'h-40', color: 'from-amber-400 to-amber-600', label: 'Gold', icon: 'military_tech' },
                    { h: 'h-48', color: 'from-slate-300 to-slate-500', label: 'Silver', icon: 'workspace_premium' }, // Centering the #1
                    { h: 'h-36', color: 'from-orange-400 to-orange-600', label: 'Bronze', icon: 'stars' }
                  ];
                  // Adjusting index for visual order: 2, 1, 3
                  const displayIdx = i === 0 ? 1 : i === 1 ? 0 : 2;
                  const item = leaderboard[displayIdx];
                  if (!item) return null;
                  
                  return (
                    <div key={displayIdx} className="flex flex-col items-center flex-1">
                       <div className="relative mb-4 group">
                          <img src={item.avatar} className="w-16 h-16 rounded-full border-4 border-white dark:border-slate-800 shadow-xl" />
                          <div className={`absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-gradient-to-br ${ranks[displayIdx].color} text-white flex items-center justify-center shadow-lg`}>
                             <span className="material-icons-round text-lg">{ranks[displayIdx].icon}</span>
                          </div>
                       </div>
                       <span className="text-xs font-bold truncate w-full text-center">{item.name}</span>
                       <span className="text-[10px] text-slate-400 uppercase font-black">{item.score}</span>
                    </div>
                  );
                })}
             </div>

             {/* List View */}
             <div className="space-y-4">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400 px-4">
                   <div className="flex gap-12">
                      <span>Place</span>
                      <span>Designer</span>
                   </div>
                   <span>All Time</span>
                </div>
                <div className="space-y-2">
                   {leaderboard.map((entry, i) => (
                     <div key={i} className={`flex items-center justify-between p-4 rounded-3xl transition-all ${i < 3 ? 'bg-slate-50/50 dark:bg-slate-800/30' : ''}`}>
                        <div className="flex items-center gap-8">
                           <span className="text-xs font-black text-slate-300 w-4">#{i+1}</span>
                           <div className="flex items-center gap-3">
                              <img src={entry.avatar} className="w-8 h-8 rounded-full border border-slate-100 dark:border-slate-700" />
                              <span className="text-sm font-bold text-slate-900 dark:text-white truncate w-32">{entry.name}</span>
                           </div>
                        </div>
                        <div className="flex items-center gap-4">
                           <span className="text-sm font-black text-slate-900 dark:text-white">{(entry.score/1000).toFixed(1)}K</span>
                           <span className="material-icons-round text-pink-500 text-lg">workspace_premium</span>
                        </div>
                     </div>
                   ))}
                </div>
             </div>

             {/* Your Position (Static Example) */}
             <div className="mt-auto pt-12 border-t border-slate-100 dark:border-slate-800">
                <div className="text-center">
                   <h3 className="text-2xl font-bold mb-2">Join our community ;)</h3>
                   <p className="text-slate-500 text-sm mb-6">discover top designers!</p>
                   <Button className="w-full bg-slate-900 text-white rounded-2xl py-4">Get Started for free</Button>
                </div>
             </div>
          </div>
      </div>
    </div>
  );

  const renderReview = () => (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-slate-900 relative z-10 animate-fade-in">
      <div className="w-full lg:w-[400px] flex flex-col border-r border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 relative z-20 shadow-sm">
        <div className="p-6 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center">
           <h3 className="font-medium text-slate-900 dark:text-white flex items-center gap-3">
             <div className="w-8 h-8 rounded-full aurora-vibrant flex items-center justify-center text-white">
                <span className="material-icons-round text-sm">auto_awesome</span>
             </div>
             Aura
           </h3>
           <Button variant="ghost" className="p-2" onClick={() => setScreen(Screen.DASHBOARD)}><span className="material-icons-round">close</span></Button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
           {chatHistory.map((msg) => (
             <div key={msg.id} className={`flex flex-col gap-2 animate-fade-in ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
               <div className={`rounded-2xl p-4 max-w-[90%] text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${msg.role === 'model' ? 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-tl-none' : 'bg-slate-900 dark:bg-purple-600 text-white rounded-tr-none'}`}>
                  {msg.text}
               </div>
             </div>
           ))}
           {isAnalyzing && (
             <div className="flex items-center gap-3 mx-2 mb-4 p-3 rounded-2xl bg-white dark:bg-slate-800 border border-purple-100 dark:border-purple-900 shadow-sm w-fit animate-pulse">
                <span className="text-xs font-bold tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-pink-600">Aura is thinking...</span>
             </div>
           )}
           <div ref={messagesEndRef} />
        </div>
        <div className="p-6 border-t border-slate-50 dark:border-slate-800">
           <div className="relative flex gap-3 items-center">
              <button onClick={() => chatImageInputRef.current?.click()} className="w-14 h-14 rounded-2xl flex items-center justify-center bg-slate-50 dark:bg-slate-800 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all">
                 <span className="material-icons-round text-2xl">add_photo_alternate</span>
              </button>
              <div className="flex-1 relative">
                <input type="text" placeholder="Type message..." className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-purple-50 h-14" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} />
                <button className={`absolute right-2 top-2 w-10 h-10 rounded-xl flex items-center justify-center text-purple-500 ${chatInput.trim() ? 'opacity-100' : 'opacity-0'}`} onClick={handleSendMessage}><span className="material-icons-round text-xl">arrow_upward</span></button>
              </div>
           </div>
        </div>
      </div>

      <div className="flex-1 bg-[#FAFAFA] dark:bg-[#0B1120] relative flex overflow-hidden">
         <div className="flex items-center justify-center w-full h-full overflow-auto p-12">
             <div className="m-auto relative flex flex-col items-center justify-center">
                {(generatedImage || previewUrl) ? (
                   <div className="relative shadow-2xl rounded-2xl border-[6px] border-white dark:border-slate-700 bg-white dark:bg-slate-700">
                       <img src={generatedImage || previewUrl || ""} alt="Preview" className="max-w-[85vw] max-h-[80vh] block rounded-lg mx-auto object-contain" />
                       {annotations.map((ann, idx) => (
                         <div key={idx} className="absolute border-2 border-pink-500 rounded-lg group cursor-pointer" style={{ top: `${ann.box_2d[0]}%`, left: `${ann.box_2d[1]}%`, height: `${ann.box_2d[2] - ann.box_2d[0]}%`, width: `${ann.box_2d[3] - ann.box_2d[1]}%` }}>
                           <div className="absolute -top-3 -left-3 w-6 h-6 bg-pink-500 text-white rounded-full flex items-center justify-center text-xs font-bold">{idx + 1}</div>
                         </div>
                       ))}
                   </div>
                ) : (
                   <div className="text-center opacity-20"><span className="material-icons-round text-8xl mb-4">image</span><h3 className="text-2xl font-normal">No design active</h3></div>
                )}
             </div>
         </div>
         {isAnalyzing && (
            <div className="absolute bottom-6 right-6 z-30">
               <Button variant="danger" icon="stop" onClick={() => setIsAnalyzing(false)}>Stop Analysis</Button>
            </div>
         )}
      </div>
      <input type="file" ref={chatImageInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
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
            <div className="max-w-6xl mx-auto pt-24 px-8 relative animate-fade-in h-full overflow-y-auto">
              <header className="mb-20">
                <h1 className="text-[4.5rem] leading-[1.1] tracking-tight font-medium mb-4">
                  <span className="text-gradient-primary">Hello, {userProfile?.name || 'Designer'}</span>
                </h1>
                <p className="text-3xl text-slate-500 font-light">How can I assist you today?</p>
              </header>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-12">
                <ModernCard title="Design Quizzes" description="Master typography, accessibility and layout through fast quizzes." icon="school" color="pink" onClick={() => { setScreen(Screen.DOJO); setDojoMode('hub'); }} />
                <ModernCard title="Audit Design" description="Upload frames for instant visual suggestions and AI grounding." icon="image_search" color="purple" onClick={() => setScreen(Screen.TOKEN_INPUT)} />
                <ModernCard title="Token Review" description="Paste Figma tokens for a deep UX and accessibility audit." icon="code" color="blue" onClick={() => setScreen(Screen.TOKEN_INPUT)} />
              </div>
            </div>
         ) : screen === Screen.TOKEN_INPUT ? (
            <div className="max-w-4xl mx-auto pt-20 px-8 h-full flex flex-col justify-center animate-fade-in">
               <div className="bg-white dark:bg-slate-800 rounded-[40px] p-10 border border-slate-100 dark:border-slate-700 shadow-xl">
                  <h2 className="text-3xl font-medium mb-2">New Review Session</h2>
                  <p className="text-slate-500 mb-8">Paste your design code or upload a frame to get started.</p>
                  <textarea className="w-full h-48 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-2xl p-5 mb-6" placeholder='Paste design tokens or code here...' value={tokenInput} onChange={(e) => setTokenInput(e.target.value)}></textarea>
                  <div className="flex gap-4">
                     <Button className="flex-1 py-4 text-lg" onClick={async () => {
                        if (!tokenInput.trim()) return;
                        setIsAnalyzing(true);
                        setScreen(Screen.REVIEW);
                        const result = await analyzeDesignToken(tokenInput);
                        setChatHistory([{ id: uuid(), role: 'model', text: result, timestamp: new Date() }]);
                        setIsAnalyzing(false);
                      }}>Analyze Code</Button>
                     <input type="file" id="f-u-main" className="hidden" accept="image/*" onChange={handleFileUpload} />
                     <label htmlFor="f-u-main" className="w-16 h-14 border border-slate-200 dark:border-slate-700 rounded-2xl flex items-center justify-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"><span className="material-icons-round text-2xl">image</span></label>
                  </div>
               </div>
               <Button variant="ghost" className="mt-8 self-center" onClick={() => setScreen(Screen.DASHBOARD)}>Cancel</Button>
            </div>
         ) : screen === Screen.HISTORY ? (
            <div className="max-w-6xl mx-auto pt-20 px-8 pb-12 relative animate-fade-in h-full overflow-y-auto">
               <h1 className="text-4xl font-medium mb-12">Recent Audits</h1>
               {sessions.length === 0 ? (
                 <div className="text-center py-20 opacity-30"><span className="material-icons-round text-6xl mb-4">history_toggle_off</span><p>No history yet.</p></div>
               ) : (
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {sessions.map(s => (
                       <div key={s.id} onClick={() => { setScreen(Screen.REVIEW); setPreviewUrl(s.content); setChatHistory(s.chatHistory); setAnnotations(s.annotations); }} className="bg-white dark:bg-slate-800 rounded-[32px] border border-slate-100 dark:border-slate-700 overflow-hidden cursor-pointer hover:shadow-xl transition-all group">
                          <div className="h-40 bg-slate-50 dark:bg-slate-900 flex items-center justify-center overflow-hidden">
                             {s.thumbnail ? <img src={s.thumbnail} className="w-full h-full object-cover group-hover:scale-105" /> : <span className="material-icons-round text-4xl text-slate-200">code</span>}
                          </div>
                          <div className="p-6"><h3 className="font-medium truncate">{s.title}</h3><p className="text-xs text-slate-400 mt-2">{new Date(s.timestamp).toLocaleDateString()}</p></div>
                       </div>
                    ))}
                 </div>
               )}
            </div>
         ) : screen === Screen.SETTINGS ? (
           <div className="max-w-2xl mx-auto pt-20 px-8 text-center animate-fade-in">
              <h1 className="text-4xl font-medium mb-12">Settings</h1>
              <Button variant="danger" onClick={handleLogout} className="w-full">Log Out & Reset Profile</Button>
           </div>
         ) : null}
      </main>
    </div>
  );
};

export default App;
