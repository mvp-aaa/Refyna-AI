
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Screen, DesignToken, ImageSize, Annotation, ChatMessage, ReviewSession, UserProfile, UserFeedback } from './types';
import { Sidebar } from './components/Sidebar';
import { ModernCard, Button, Input, FeedbackButtons, ComparisonView } from './components/UIComponents';
import { analyzeDesignToken, generateDesignVariant, analyzeImage, getQuickSuggestion, createChatSession, generateAdvancedVariant } from './services/geminiService';
import { LiveSessionManager } from './services/liveAudio';
import { Chat, GenerateContentResponse } from "@google/genai";

// Simple ID generator
const uuid = () => Math.random().toString(36).substring(2, 15);

// Helper to convert file to base64 for storage
const fileToBase64 = (file: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const AuroraBackground = ({ show }: { show: boolean }) => {
  if (!show) return null;
  return (
    <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0 overflow-hidden">
        {/* Top Right Aurora Blobs */}
        <div className="absolute -top-24 -right-24 w-[500px] h-[500px] bg-purple-300/40 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob dark:opacity-20 dark:mix-blend-screen"></div>
        <div className="absolute top-0 -right-4 w-[400px] h-[400px] bg-pink-300/40 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob dark:opacity-20 dark:mix-blend-screen" style={{ animationDelay: '2s' }}></div>
        <div className="absolute -top-8 right-48 w-[400px] h-[400px] bg-indigo-300/40 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob dark:opacity-20 dark:mix-blend-screen" style={{ animationDelay: '4s' }}></div>
    </div>
  );
};

const App = () => {
  // Initialize state based on local storage presence
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('aura_user_profile');
    return saved ? JSON.parse(saved) : null;
  });

  const [screen, setScreen] = useState<Screen>(() => {
    return localStorage.getItem('aura_user_profile') ? Screen.DASHBOARD : Screen.ONBOARDING;
  });

  // Onboarding State
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [tempProfile, setTempProfile] = useState<UserProfile>({ name: '', role: '', goal: '' });

  const [tokenInput, setTokenInput] = useState('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [voiceName, setVoiceName] = useState('Fenrir'); // Default voice
  
  // History & Memory State
  const [sessions, setSessions] = useState<ReviewSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [userFeedbackHistory, setUserFeedbackHistory] = useState<UserFeedback[]>(() => {
    const saved = localStorage.getItem('aura_user_feedback');
    return saved ? JSON.parse(saved) : [];
  });

  // Chat State
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatSessionRef = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  
  // Live API Manager Ref
  const liveManager = useRef<LiveSessionManager | null>(null);

  // Load history on mount
  useEffect(() => {
    const saved = localStorage.getItem('aura_history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Rehydrate dates
        const rehydrated = parsed.map((s: any) => ({
          ...s,
          chatHistory: s.chatHistory.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }))
        }));
        setSessions(rehydrated);
      } catch (e) {
        console.error("Failed to load history", e);
      }
    }
  }, []);

  // Apply dark mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Save history whenever sessions change
  useEffect(() => {
    localStorage.setItem('aura_history', JSON.stringify(sessions));
  }, [sessions]);

  // Save feedback history
  useEffect(() => {
    localStorage.setItem('aura_user_feedback', JSON.stringify(userFeedbackHistory));
  }, [userFeedbackHistory]);

  // Clean up live session on unmount
  useEffect(() => {
    return () => {
      if (liveManager.current) {
        liveManager.current.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isAnalyzing]);

  const handleNavigate = (s: Screen) => setScreen(s);

  // --- Onboarding Handlers ---
  const handleOnboardingNext = () => {
      if (onboardingStep < 3) {
          setOnboardingStep(prev => prev + 1);
      } else {
          // Finish Onboarding
          localStorage.setItem('aura_user_profile', JSON.stringify(tempProfile));
          setUserProfile(tempProfile);
          setScreen(Screen.DASHBOARD);
      }
  };

  const handleLogout = () => {
      // Reset all user state
      localStorage.removeItem('aura_user_profile');
      setUserProfile(null);
      setTempProfile({ name: '', role: '', goal: '' });
      setOnboardingStep(1);
      
      // Force navigation to onboarding
      setScreen(Screen.ONBOARDING);
  };

  // --- App Logic ---
  const startChat = (initialContext: string, initialAnalysis: string) => {
    // Initialize chat session
    chatSessionRef.current = createChatSession(initialContext);
    
    // Set initial history
    const history: ChatMessage[] = [
      {
        id: uuid(),
        role: 'model',
        text: initialAnalysis,
        timestamp: new Date()
      }
    ];
    setChatHistory(history);
    return history;
  };

  const saveCurrentSession = (
    id: string, 
    type: 'token' | 'image', 
    content: string, 
    history: ChatMessage[], 
    anns: Annotation[], 
    imgPreview?: string
  ) => {
    const title = type === 'token' 
      ? `Token Review ${new Date().toLocaleDateString()}` 
      : `Visual Audit ${new Date().toLocaleDateString()}`;

    const newSession: ReviewSession = {
      id,
      type,
      content,
      timestamp: Date.now(),
      title,
      thumbnail: imgPreview || undefined,
      chatHistory: history,
      annotations: anns
    };

    setSessions(prev => {
      const existing = prev.findIndex(s => s.id === id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], chatHistory: history, annotations: anns };
        return updated;
      }
      return [newSession, ...prev];
    });
    setCurrentSessionId(id);
  };

  // Update current session when chat updates
  useEffect(() => {
    if (currentSessionId && chatHistory.length > 0) {
      setSessions(prev => prev.map(s => {
        if (s.id === currentSessionId) {
          return { ...s, chatHistory };
        }
        return s;
      }));
    }
  }, [chatHistory, currentSessionId]);

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !chatSessionRef.current) return;

    const userMsg: ChatMessage = {
      id: uuid(),
      role: 'user',
      text: chatInput,
      timestamp: new Date()
    };

    setChatHistory(prev => [...prev, userMsg]);
    setChatInput('');
    setIsAnalyzing(true);

    try {
      const response: GenerateContentResponse = await chatSessionRef.current.sendMessage({ message: userMsg.text });
      const text = response.text || "I'm having trouble thinking right now.";
      
      setChatHistory(prev => [...prev, {
        id: uuid(),
        role: 'model',
        text: text,
        timestamp: new Date()
      }]);
    } catch (e) {
      console.error(e);
      setChatHistory(prev => [...prev, {
        id: uuid(),
        role: 'model',
        text: "Sorry, I encountered an error connecting to the server.",
        timestamp: new Date()
      }]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleQuickTip = async () => {
    const lastModelMsg = [...chatHistory].reverse().find(m => m.role === 'model');
    const context = lastModelMsg ? lastModelMsg.text : "General UI design";
    
    const tip = await getQuickSuggestion(context);
    setChatHistory(prev => [...prev, {
        id: uuid(),
        role: 'model',
        text: `💡 Quick Tip: ${tip}`,
        timestamp: new Date()
    }]);
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !chatSessionRef.current) return;

    setIsAnalyzing(true);
    try {
      const base64 = await fileToBase64(file);
      const cleanBase64 = base64.split(',')[1]; // Remove data URL prefix

      // Add a visual indicator to chat history
      setChatHistory(prev => [...prev, {
        id: uuid(),
        role: 'user',
        text: `📄 Uploaded context: ${file.name}`,
        timestamp: new Date()
      }]);

      // Send to Gemini
      const response = await chatSessionRef.current.sendMessage({ 
        message: [
            { text: `Here is a PDF document titled "${file.name}" containing project context. Please analyze it and use this information to provide more specific and relevant feedback on the design.` },
            { 
                inlineData: {
                    mimeType: file.type,
                    data: cleanBase64
                }
            }
        ]
      });
      
      const text = response.text || "Context received. I will use this for further reviews.";
      
      setChatHistory(prev => [...prev, {
        id: uuid(),
        role: 'model',
        text: text,
        timestamp: new Date()
      }]);

    } catch (error) {
      console.error("PDF upload failed", error);
      setChatHistory(prev => [...prev, {
        id: uuid(),
        role: 'model',
        text: "I had trouble processing that PDF. Please try again.",
        timestamp: new Date()
      }]);
    } finally {
      setIsAnalyzing(false);
      // Reset input
      if (pdfInputRef.current) pdfInputRef.current.value = '';
    }
  };

  const startImageAnalysis = async (file: File) => {
    const sessionId = uuid();
    const url = URL.createObjectURL(file);
    const base64 = await fileToBase64(file);

    setPreviewUrl(url);
    setGeneratedImage(null);
    setTokenInput('');
    setAnnotations([]);
    setScreen(Screen.REVIEW);
    setIsAnalyzing(true);
    setCurrentSessionId(sessionId);
    
    // Pass prior memory/feedback to analysis
    const { text, annotations } = await analyzeImage(file, userFeedbackHistory);
    setAnnotations(annotations);
    const initialHistory = startChat(text, text); 

    saveCurrentSession(sessionId, 'image', base64, initialHistory, annotations, base64);
    setIsAnalyzing(false);
  };

  // Keep a ref to the latest startImageAnalysis to avoid stale closures in the paste listener
  const startImageAnalysisRef = useRef(startImageAnalysis);
  useEffect(() => {
    startImageAnalysisRef.current = startImageAnalysis;
  });

  // Global Paste Handler
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Only allow pasting images if NOT on onboarding
      if (screen === Screen.ONBOARDING) return;

      if (e.clipboardData?.items) {
        for (let i = 0; i < e.clipboardData.items.length; i++) {
          const item = e.clipboardData.items[i];
          if (item.type.startsWith('image')) {
            const file = item.getAsFile();
            if (file) {
              e.preventDefault();
              startImageAnalysisRef.current(file);
              return;
            }
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [screen]); // Add screen as dependency

  const handleStartReview = async (code: string) => {
    if (!code) return;
    const sessionId = uuid();
    setTokenInput(code);
    setPreviewUrl(null);
    setGeneratedImage(null);
    setAnnotations([]);
    setScreen(Screen.REVIEW);
    setIsAnalyzing(true);
    setCurrentSessionId(sessionId);
    
    // Trigger Thinking Analysis
    const result = await analyzeDesignToken(code);
    const initialHistory = startChat(code, result);
    
    saveCurrentSession(sessionId, 'token', code, initialHistory, []);
    setIsAnalyzing(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        await startImageAnalysis(file);
    }
  };

  const loadSession = (session: ReviewSession) => {
    setCurrentSessionId(session.id);
    setChatHistory(session.chatHistory);
    setAnnotations(session.annotations);
    setScreen(Screen.REVIEW);

    if (session.type === 'image') {
      setPreviewUrl(session.content);
      setTokenInput('');
      chatSessionRef.current = createChatSession("Continuing previous session...");
    } else {
      setTokenInput(session.content);
      setPreviewUrl(null);
      chatSessionRef.current = createChatSession(session.content);
    }
  };

  const toggleLiveSession = async () => {
    if (isLiveConnected) {
      liveManager.current?.disconnect();
      liveManager.current = null;
      setIsLiveConnected(false);
    } else {
      if (!process.env.API_KEY) {
        alert("Please select an API key via the settings or project configuration.");
        return;
      }
      
      liveManager.current = new LiveSessionManager(process.env.API_KEY);
      await liveManager.current.connect(
        (text, isUser) => console.log(text), 
        (connected) => setIsLiveConnected(connected),
        voiceName
      );

      // Send current context to the live session
      const visualContext = generatedImage || previewUrl;
      if (visualContext && liveManager.current) {
          let base64Data = "";
          
          if (visualContext.startsWith('blob:')) {
             try {
               const response = await fetch(visualContext);
               const blob = await response.blob();
               base64Data = await fileToBase64(blob);
             } catch (e) {
               console.error("Failed to process blob for live session", e);
             }
          } else {
            base64Data = visualContext;
          }

          if (base64Data) {
             await liveManager.current.sendImage(base64Data);
          }
      }
    }
  };

  const handleGenerateVariant = async () => {
    setIsAnalyzing(true);
    const variant = await generateDesignVariant("Modern SaaS dashboard, clean typography, soft pink and blue gradients", ImageSize.K2);
    setGeneratedImage(variant);
    setAnnotations([]); 
    setIsAnalyzing(false);
  };

  const handleAdvancedVariant = async () => {
    if (!previewUrl) return;
    setIsAnalyzing(true);

    try {
        let base64Data = "";
        if (previewUrl.startsWith('blob:')) {
           const response = await fetch(previewUrl);
           const blob = await response.blob();
           base64Data = await fileToBase64(blob);
        } else {
           base64Data = previewUrl;
        }

        // Filter annotations that are NOT marked as 'bad' (so neutral + good)
        // This guides the "Nano Brain" to only apply trusted improvements
        const activeImprovements = annotations
            .filter(a => a.rating !== 'bad')
            .map(a => a.suggestion);

        const variant = await generateAdvancedVariant(base64Data, activeImprovements);
        
        if (variant) {
            setGeneratedImage(variant);
            // We don't clear annotations here so user can compare original issues
        }
    } catch (e) {
        console.error("Advanced generation failed", e);
    } finally {
        setIsAnalyzing(false);
    }
  };

  const handleFeedback = (index: number, rating: 'good' | 'bad', comment?: string) => {
    const updatedAnnotations = [...annotations];
    updatedAnnotations[index].rating = rating;
    updatedAnnotations[index].userFeedback = comment;
    setAnnotations(updatedAnnotations);

    // Persist to Memory Layer
    const newFeedback: UserFeedback = {
        id: uuid(),
        annotationLabel: updatedAnnotations[index].label,
        suggestion: updatedAnnotations[index].suggestion,
        rating: rating,
        userComment: comment,
        timestamp: Date.now()
    };
    setUserFeedbackHistory(prev => [...prev, newFeedback]);
  };

  const handleExportReport = async () => {
    let imageSource = generatedImage || previewUrl;
    
    if (imageSource && imageSource.startsWith('blob:')) {
      try {
        const response = await fetch(imageSource);
        const blob = await response.blob();
        imageSource = await fileToBase64(blob);
      } catch (e) {
        console.error("Failed to convert blob to base64 for export", e);
      }
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const content = `
      <html>
        <head>
          <title>Aura Design Report - ${new Date().toLocaleDateString()}</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 40px; max-width: 800px; mx-auto; color: #1e293b; }
            h1 { font-size: 24px; color: #0f172a; margin-bottom: 10px; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; }
            .meta { color: #64748b; font-size: 14px; margin-bottom: 40px; }
            .preview-container { margin-bottom: 40px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; text-align: center; }
            img { max-width: 100%; height: auto; display: block; margin: 0 auto; }
            .annotation-list { margin-bottom: 40px; }
            .annotation-item { margin-bottom: 12px; padding: 12px; background: #f8fafc; border-radius: 8px; border-left: 4px solid #ec4899; }
            .chat-log { border-top: 2px solid #f1f5f9; padding-top: 20px; }
            .message { margin-bottom: 16px; padding: 12px; border-radius: 8px; }
            .message.model { background: #fdf2f8; }
            .message.user { background: #f1f5f9; }
            .role { font-weight: bold; font-size: 12px; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
          </style>
        </head>
        <body>
          <h1>Aura Design Audit Report</h1>
          <div class="meta">Generated for ${userProfile?.name || 'User'} on ${new Date().toLocaleString()}</div>

          ${imageSource ? `
            <div class="preview-container">
              <img src="${imageSource}" alt="Design Preview" />
            </div>
          ` : '<p style="color: #94a3b8; font-style: italic;">No image preview available.</p>'}

          ${annotations.length > 0 ? `
            <h3>Identified Issues & Suggestions</h3>
            <div class="annotation-list">
              ${annotations.map((a, i) => `
                <div class="annotation-item">
                  <strong>${i + 1}. ${a.label}</strong><br/>
                  ${a.suggestion}
                </div>
              `).join('')}
            </div>
          ` : ''}

          <div class="chat-log">
            <h3>Detailed AI Analysis</h3>
            ${chatHistory.map(msg => `
              <div class="message ${msg.role}">
                <div class="role">${msg.role === 'model' ? 'Aura AI' : (userProfile?.name || 'Designer')}</div>
                <div>${msg.text.replace(/\n/g, '<br/>')}</div>
              </div>
            `).join('')}
          </div>

          <script>
            window.onload = () => { setTimeout(() => window.print(), 500); }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
  };

  // --- Sub-Render Functions ---

  const renderOnboarding = () => (
      <div className="flex items-center justify-center min-h-screen relative z-20 px-8">
          <div className="max-w-md w-full">
              {/* Progress Indicator */}
              <div className="flex gap-2 mb-8 justify-center">
                  {[1, 2, 3].map(step => (
                      <div key={step} className={`h-1 rounded-full transition-all duration-500 ${step <= onboardingStep ? 'w-8 bg-purple-500' : 'w-2 bg-slate-200 dark:bg-slate-700'}`}></div>
                  ))}
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-[40px] p-10 shadow-2xl shadow-purple-200/50 dark:shadow-none border border-slate-100 dark:border-slate-700 text-center relative overflow-hidden transition-all duration-500">
                  {/* Step 1: Name */}
                  {onboardingStep === 1 && (
                      <div className="animate-fade-in">
                          <span className="material-icons-round text-4xl text-purple-500 mb-4">waving_hand</span>
                          <h2 className="text-3xl font-medium text-slate-900 dark:text-white mb-2">Welcome to Aura</h2>
                          <p className="text-slate-500 dark:text-slate-400 mb-8">Let's get to know you. What should we call you?</p>
                          <Input 
                              placeholder="Your Name" 
                              value={tempProfile.name}
                              onChange={(e) => setTempProfile({...tempProfile, name: e.target.value})}
                              className="text-center text-lg mb-8"
                              autoFocus
                              onKeyDown={(e) => e.key === 'Enter' && tempProfile.name && handleOnboardingNext()}
                          />
                          <Button 
                              onClick={handleOnboardingNext} 
                              disabled={!tempProfile.name.trim()} 
                              className="w-full py-4 text-lg"
                          >
                              Next
                          </Button>
                      </div>
                  )}

                  {/* Step 2: Role */}
                  {onboardingStep === 2 && (
                      <div className="animate-fade-in">
                          <span className="material-icons-round text-4xl text-pink-500 mb-4">work_outline</span>
                          <h2 className="text-2xl font-medium text-slate-900 dark:text-white mb-2">What do you do?</h2>
                          <p className="text-slate-500 dark:text-slate-400 mb-8">This helps us tailor the feedback.</p>
                          <div className="grid grid-cols-1 gap-3 mb-8">
                              {['Product Designer', 'Frontend Developer', 'Product Manager', 'Founder', 'Student'].map(role => (
                                  <button
                                      key={role}
                                      onClick={() => {
                                          setTempProfile({...tempProfile, role});
                                          setTimeout(handleOnboardingNext, 200); 
                                      }}
                                      className={`p-4 rounded-2xl border transition-all font-medium text-sm ${tempProfile.role === role ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300' : 'border-slate-100 dark:border-slate-700 hover:border-purple-200 dark:hover:border-purple-800 text-slate-600 dark:text-slate-400'}`}
                                  >
                                      {role}
                                  </button>
                              ))}
                          </div>
                      </div>
                  )}

                  {/* Step 3: Goal */}
                  {onboardingStep === 3 && (
                      <div className="animate-fade-in">
                          <span className="material-icons-round text-4xl text-blue-500 mb-4">flag</span>
                          <h2 className="text-2xl font-medium text-slate-900 dark:text-white mb-2">Main Goal?</h2>
                          <p className="text-slate-500 dark:text-slate-400 mb-8">What are you looking to achieve?</p>
                          <div className="grid grid-cols-1 gap-3 mb-8">
                              {['Visual Inspiration', 'Design System Audit', 'Improve Accessibility', 'Speed up Workflow'].map(goal => (
                                  <button
                                      key={goal}
                                      onClick={() => setTempProfile({...tempProfile, goal})}
                                      className={`p-4 rounded-2xl border transition-all font-medium text-sm ${tempProfile.goal === goal ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'border-slate-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-800 text-slate-600 dark:text-slate-400'}`}
                                  >
                                      {goal}
                                  </button>
                              ))}
                          </div>
                          <Button 
                              onClick={handleOnboardingNext} 
                              disabled={!tempProfile.goal} 
                              className="w-full py-4 text-lg"
                              variant="primary"
                          >
                              Get Started
                          </Button>
                      </div>
                  )}
              </div>
          </div>
      </div>
  );

  const renderDashboard = () => (
    <div className="max-w-6xl mx-auto pt-24 px-8 relative animate-fade-in">
      <header className="mb-20">
        <h1 className="text-[4.5rem] leading-[1.1] tracking-tight font-medium mb-4 dark:text-white">
          <span className="text-gradient-primary">Hello, {userProfile?.name || 'Designer'}</span>
        </h1>
        <p className="text-3xl text-slate-500 dark:text-slate-400 font-light">How can I assist you today?</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <ModernCard 
          title="Token Analysis" 
          description="Paste your design system tokens for a deep UX and accessibility review by Gemini."
          icon="code"
          color="blue"
          onClick={() => setScreen(Screen.TOKEN_INPUT)}
        />
        
        <ModernCard 
          title="Design Audit" 
          description="Upload a screenshot of your interface for instant visual improvements and suggestions."
          icon="image_search"
          color="pink"
          onClick={() => {
            setScreen(Screen.TOKEN_INPUT); 
          }}
        />

        <ModernCard 
          title="Session History" 
          description="Browse your past brainstorming sessions, design audits, and generated reports."
          icon="history"
          color="purple"
          onClick={() => setScreen(Screen.HISTORY)}
        />
      </div>
    </div>
  );

  const renderHistory = () => (
    <div className="max-w-6xl mx-auto pt-20 px-8 pb-12 relative z-10 animate-fade-in">
      <header className="mb-16">
        <h1 className="text-4xl font-medium text-slate-900 dark:text-white mb-2">Design History</h1>
        <p className="text-slate-500 dark:text-slate-400 font-normal text-lg">Your past design reviews and audits.</p>
      </header>

      {sessions.length === 0 ? (
        <div className="text-center py-32 bg-white/50 dark:bg-slate-800/50 rounded-[40px] border border-dashed border-slate-200 dark:border-slate-700">
          <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300 dark:text-slate-600">
            <span className="material-icons-round text-3xl">history_toggle_off</span>
          </div>
          <h3 className="text-lg font-medium text-slate-900 dark:text-white">No history yet</h3>
          <p className="text-slate-500 dark:text-slate-400 mb-8 font-normal">Start a review to build your history.</p>
          <Button onClick={() => setScreen(Screen.TOKEN_INPUT)}>Start New Review</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {sessions.map(session => (
            <div key={session.id} onClick={() => loadSession(session)} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[32px] overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer group flex flex-col">
              <div className="h-48 bg-slate-50 dark:bg-slate-900 relative overflow-hidden flex items-center justify-center">
                {session.thumbnail ? (
                  <img src={session.thumbnail} alt="Preview" className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="text-slate-300 flex flex-col items-center">
                    <span className="material-icons-round text-5xl mb-3 text-slate-200 dark:text-slate-700">code</span>
                  </div>
                )}
                <div className="absolute top-4 right-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase text-slate-500 dark:text-slate-300 border border-slate-100 dark:border-slate-700 shadow-sm">
                  {session.type}
                </div>
              </div>
              <div className="p-8 flex-1 flex flex-col">
                <span className="text-xs text-slate-400 mb-2 block font-mono">{new Date(session.timestamp).toLocaleDateString()}</span>
                <h3 className="font-medium text-xl text-slate-900 dark:text-white mb-3 truncate">{session.title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-8 font-normal leading-relaxed flex-1">
                  {session.chatHistory.find(m => m.role === 'model')?.text || "No analysis details available."}
                </p>
                <div className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white group-hover:translate-x-2 transition-transform">
                   Reopen <span className="material-icons-round text-base">arrow_forward</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderTokenInput = () => (
    <div className="max-w-4xl mx-auto pt-20 px-8 h-[calc(100vh-4rem)] flex flex-col justify-center relative z-10 animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div className="order-2 lg:order-1">
           <div className="bg-white dark:bg-slate-800 rounded-[40px] p-10 shadow-xl shadow-purple-100/50 dark:shadow-none border border-slate-100 dark:border-slate-700 relative overflow-hidden">
             <div className="relative z-10">
               <h2 className="text-3xl font-medium text-slate-900 dark:text-white mb-2">New Session</h2>
               <p className="text-slate-500 dark:text-slate-400 mb-8 font-normal">Paste a token, upload a frame, or <span className="font-medium text-slate-700 dark:text-slate-200">Ctrl+V</span> to paste an image.</p>
               
               <textarea 
                 className="w-full h-48 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-2xl p-5 font-mono text-sm text-slate-600 dark:text-slate-300 focus:ring-1 focus:ring-purple-200 dark:focus:ring-purple-900 focus:outline-none resize-none mb-6 transition-all placeholder-slate-400"
                 placeholder='Paste Figma JSON token...'
                 value={tokenInput}
                 onChange={(e) => setTokenInput(e.target.value)}
               ></textarea>
               
               <div className="flex gap-4">
                 <Button 
                    onClick={() => handleStartReview(tokenInput)} 
                    className="flex-1" 
                    disabled={!tokenInput}
                  >
                    Analyze
                 </Button>
                 <div className="relative">
                     <input 
                        type="file" 
                        id="file-upload" 
                        className="hidden" 
                        accept="image/*"
                        onChange={handleFileUpload}
                    />
                     <label 
                        htmlFor="file-upload" 
                        className="flex items-center justify-center w-14 h-12 rounded-2xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
                     >
                        <span className="material-icons-round">image</span>
                     </label>
                 </div>
               </div>
             </div>
           </div>
        </div>
        <div className="order-1 lg:order-2 flex justify-center relative">
            <div className="w-80 h-96 bg-gradient-to-b from-white to-purple-50/30 dark:from-slate-800 dark:to-purple-900/20 rounded-[40px] border border-white dark:border-slate-700 shadow-soft flex items-center justify-center transform rotate-3 p-8">
               <div className="w-full h-full border border-dashed border-purple-200 dark:border-purple-800 rounded-3xl flex flex-col items-center justify-center text-purple-300 dark:text-purple-700">
                  <span className="material-icons-round text-6xl mb-4">view_quilt</span>
                  <span className="text-sm font-medium tracking-wider uppercase">Preview</span>
               </div>
            </div>
        </div>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="max-w-2xl mx-auto pt-20 px-8 pb-12 relative z-10 animate-fade-in">
      <header className="mb-12">
        <h1 className="text-4xl font-medium text-slate-900 dark:text-white mb-2">Settings</h1>
        <p className="text-slate-500 dark:text-slate-400 font-normal text-lg">Manage your preferences and account.</p>
      </header>

      <div className="flex flex-col gap-8">
        {/* Profile Section */}
        <div className="bg-white dark:bg-slate-800 rounded-[32px] p-8 border border-slate-100 dark:border-slate-700 flex items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-full border-4 border-purple-50 dark:border-slate-700 overflow-hidden bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
              {/* Generate avatar initial if no image */}
               <span className="text-4xl font-bold text-purple-500 dark:text-purple-300">
                  {userProfile?.name?.charAt(0) || 'A'}
               </span>
            </div>
            <div>
              <h2 className="text-2xl font-medium text-slate-900 dark:text-white">{userProfile?.name || 'Designer'}</h2>
              <p className="text-slate-500 dark:text-slate-400 mb-2">{userProfile?.role || 'User'}</p>
              <span className="bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                 {userProfile?.goal ? userProfile.goal.split(' ')[0] : 'Pro'} Member
              </span>
            </div>
          </div>
          <Button variant="secondary" onClick={handleLogout}>Sign Out</Button>
        </div>

        {/* Appearance */}
        <div className="bg-white dark:bg-slate-800 rounded-[32px] p-8 border border-slate-100 dark:border-slate-700">
          <h3 className="text-xl font-medium text-slate-900 dark:text-white mb-6">Appearance</h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-600 dark:text-slate-300">
                <span className="material-icons-round">{darkMode ? 'dark_mode' : 'light_mode'}</span>
              </div>
              <div>
                <p className="font-medium text-slate-900 dark:text-white">Dark Mode</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Switch between light and dark themes</p>
              </div>
            </div>
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className={`w-14 h-8 rounded-full transition-colors relative ${darkMode ? 'bg-purple-500' : 'bg-slate-200'}`}
            >
              <div className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-sm transition-transform duration-300 ${darkMode ? 'left-7' : 'left-1'}`}></div>
            </button>
          </div>
        </div>

        {/* AI Persona */}
        <div className="bg-white dark:bg-slate-800 rounded-[32px] p-8 border border-slate-100 dark:border-slate-700">
          <h3 className="text-xl font-medium text-slate-900 dark:text-white mb-6">AI Assistant Voice</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {['Fenrir', 'Puck', 'Kore', 'Charon', 'Aoede'].map((v) => (
              <button
                key={v}
                onClick={() => setVoiceName(v)}
                className={`p-4 rounded-2xl border transition-all text-left ${
                  voiceName === v 
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 dark:border-purple-500' 
                    : 'border-slate-100 dark:border-slate-700 hover:border-purple-200 dark:hover:border-purple-800'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                   <span className={`material-icons-round text-lg ${voiceName === v ? 'text-purple-500' : 'text-slate-300'}`}>
                     {voiceName === v ? 'radio_button_checked' : 'radio_button_unchecked'}
                   </span>
                   <span className={`font-medium ${voiceName === v ? 'text-purple-700 dark:text-purple-300' : 'text-slate-600 dark:text-slate-400'}`}>
                     {v}
                   </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Data */}
        <div className="bg-white dark:bg-slate-800 rounded-[32px] p-8 border border-slate-100 dark:border-slate-700">
           <h3 className="text-xl font-medium text-slate-900 dark:text-white mb-6">Data & Privacy</h3>
           <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900 dark:text-white">Clear Session History</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Permanently remove all your design reviews</p>
              </div>
              <Button 
                variant="danger" 
                onClick={() => {
                   if (confirm("Are you sure you want to clear all history?")) {
                      localStorage.removeItem('aura_history');
                      setSessions([]);
                      localStorage.removeItem('aura_user_feedback');
                      setUserFeedbackHistory([]);
                   }
                }}
              >
                Clear Data
              </Button>
           </div>
        </div>
      </div>
    </div>
  );

  const renderReview = () => (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-slate-900 relative z-10 animate-fade-in">
      {/* Left: AI Interaction */}
      <div className="w-full lg:w-[400px] flex flex-col border-r border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 relative z-20 shadow-sm">
        <div className="p-6 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center bg-white/80 dark:bg-slate-900/80 backdrop-blur z-10">
           <h3 className="font-medium text-slate-900 dark:text-white flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-100 to-purple-100 dark:from-purple-900 dark:to-pink-900 flex items-center justify-center text-purple-500 dark:text-purple-300">
                <span className="material-icons-round text-sm">auto_awesome</span>
             </div>
             Aura
           </h3>
           <div className="flex gap-1">
             <button 
               onClick={() => pdfInputRef.current?.click()} 
               className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors" 
               title="Upload Project Context (PDF)"
             >
                <span className="material-icons-round text-xl">description</span>
             </button>
             <button onClick={handleExportReport} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors" title="Export">
                <span className="material-icons-round text-xl">download</span>
             </button>
           </div>
        </div>
        
        {/* Chat History List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
           {chatHistory.length === 0 && !isAnalyzing && (
             <div className="text-center mt-10">
                <p className="text-slate-400 text-sm font-normal">No conversation yet.</p>
             </div>
           )}

           {chatHistory.map((msg) => (
             <div key={msg.id} className={`flex flex-col gap-2 animate-fade-in ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
               <div className={`
                  rounded-2xl p-4 max-w-[90%] text-sm leading-relaxed whitespace-pre-wrap shadow-sm
                  ${msg.role === 'model' 
                    ? 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-tl-none' 
                    : 'bg-slate-900 dark:bg-purple-600 text-white rounded-tr-none shadow-lg shadow-slate-200 dark:shadow-none'}
               `}>
                  {msg.text}
               </div>
               <span className="text-[10px] text-slate-400 px-1">
                  {msg.role === 'model' ? 'Aura AI' : (userProfile?.name || 'You')}
               </span>
             </div>
           ))}

           {/* Typing Indicator */}
           {isAnalyzing && (
             <div className="flex items-center gap-3 mx-2 mb-4 p-3 rounded-2xl bg-white dark:bg-slate-800 border border-purple-100 dark:border-purple-900 shadow-sm w-fit animate-pulse">
                <div className="relative w-5 h-5">
                   <div className="absolute inset-0 rounded-full aurora-vibrant animate-spin blur-[1px]"></div>
                   <div className="absolute inset-0.5 rounded-full bg-white dark:bg-slate-800"></div>
                </div>
                <span className="text-slate-700 dark:text-slate-300 text-xs font-bold tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400">
                   Thinking...
                </span>
             </div>
           )}
           <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-6 bg-white dark:bg-slate-900 border-t border-slate-50 dark:border-slate-800">
           <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
              <button 
                onClick={handleQuickTip} 
                className="flex items-center gap-2 px-4 py-2 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-xl text-xs font-medium hover:bg-orange-100 dark:hover:bg-orange-900/40 transition-colors whitespace-nowrap border border-orange-100 dark:border-orange-900/30"
              >
                 <span className="material-icons-round text-sm">lightbulb</span>
                 Quick Tip
              </button>
           </div>

           <div className="relative flex gap-3 items-center">
              {/* Voice Mode Button */}
              <button 
                onClick={toggleLiveSession} 
                className={`
                  w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500
                  ${isLiveConnected 
                    ? "bg-pink-50 dark:bg-pink-900/20 text-pink-500 border border-pink-200 dark:border-pink-800 shadow-glow" 
                    : "bg-slate-50 dark:bg-slate-800 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 border border-transparent"}
                `}
                title={isLiveConnected ? "Stop Voice Mode" : "Start Voice Mode"}
              >
                 <span className={`material-icons-round text-2xl ${isLiveConnected ? 'animate-pulse' : ''}`}>
                   {isLiveConnected ? 'graphic_eq' : 'mic'}
                 </span>
              </button>

              <div className="flex-1 relative">
                <input 
                  type="text" 
                  placeholder="Type your message..." 
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-4 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-purple-50 dark:focus:ring-purple-900 text-slate-700 dark:text-slate-200 placeholder-slate-400 h-14"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <button 
                  className={`absolute right-2 top-2 w-10 h-10 rounded-xl flex items-center justify-center text-purple-500 transition-all ${chatInput.trim() ? 'bg-white dark:bg-slate-700 shadow-sm text-purple-600 dark:text-purple-400' : 'opacity-0 pointer-events-none'}`}
                  onClick={handleSendMessage}
                >
                    <span className="material-icons-round text-xl">arrow_upward</span>
                </button>
              </div>
           </div>
           {isLiveConnected && (
             <div className="text-center mt-3 text-[10px] text-pink-500 font-bold tracking-wider uppercase animate-pulse">
               Live Interactive Mode Active
             </div>
           )}
        </div>
      </div>

      {/* Right: Design Preview */}
      <div className="flex-1 bg-[#FAFAFA] dark:bg-[#0B1120] relative flex flex-col overflow-hidden">
         
         {/* Vibrant Aurora Background Effect */}
         {isAnalyzing && (
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute inset-0 aurora-vibrant opacity-20 blur-3xl mix-blend-multiply dark:mix-blend-screen transform scale-110"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-white/50 via-transparent to-white/20 dark:from-slate-900/50 dark:to-slate-900/20"></div>
            </div>
         )}

         <div className="absolute top-6 right-6 z-20 flex gap-2 bg-white dark:bg-slate-800 p-1.5 rounded-xl shadow-soft border border-slate-100 dark:border-slate-700">
            <button className="w-8 h-8 flex items-center justify-center text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors"><span className="material-icons-round text-lg">remove</span></button>
            <span className="w-12 flex items-center justify-center text-xs font-medium text-slate-600 dark:text-slate-300">100%</span>
            <button className="w-8 h-8 flex items-center justify-center text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors"><span className="material-icons-round text-lg">add</span></button>
         </div>

         <div className="flex-1 flex items-center justify-center overflow-auto p-12 relative z-10">
            {(generatedImage || previewUrl) ? (
               <div className="w-full max-w-4xl">
                  {generatedImage && previewUrl ? (
                    <ComparisonView original={previewUrl} generated={generatedImage} />
                  ) : (
                    <div className="relative inline-block shadow-2xl shadow-slate-200/50 dark:shadow-none rounded-2xl border-[6px] border-white dark:border-slate-700 bg-white dark:bg-slate-700 transition-all duration-500 mx-auto block w-fit">
                       <img 
                         src={generatedImage || previewUrl || ""} 
                         alt="Design Preview" 
                         className="max-w-full max-h-[70vh] block rounded-lg" 
                       />
                       {generatedImage && (
                         <div className="absolute bottom-6 right-6 bg-white/80 text-slate-900 text-xs font-medium px-4 py-2 rounded-full backdrop-blur-md pointer-events-none shadow-sm border border-white">Generated</div>
                       )}
                       {/* Annotations Overlay */}
                       {annotations.map((ann, idx) => (
                         <div
                           key={idx}
                           className="absolute border-2 border-pink-500 rounded-lg group cursor-pointer hover:bg-pink-500/5 transition-all"
                           style={{
                             top: `${ann.box_2d[0]}%`,
                             left: `${ann.box_2d[1]}%`,
                             height: `${ann.box_2d[2] - ann.box_2d[0]}%`,
                             width: `${ann.box_2d[3] - ann.box_2d[1]}%`
                           }}
                         >
                           <div className="absolute -top-3 -left-3 w-6 h-6 bg-pink-500 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-lg scale-0 group-hover:scale-100 transition-transform duration-300">
                             {idx + 1}
                           </div>
                           <div className="absolute opacity-0 group-hover:opacity-100 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs p-4 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 -bottom-2 left-1/2 transform -translate-x-1/2 translate-y-full w-64 z-20 transition-all duration-300 pointer-events-auto">
                              <p className="font-bold mb-1 text-pink-500 uppercase tracking-wider text-[10px]">{ann.label} <span className="opacity-50 ml-1">{ann.confidenceScore ? `(${ann.confidenceScore}%)` : ''}</span></p>
                              <p className="leading-relaxed font-normal">{ann.suggestion}</p>
                              <FeedbackButtons 
                                onRate={(rating, comment) => handleFeedback(idx, rating, comment)}
                                currentRating={ann.rating} 
                              />
                           </div>
                         </div>
                       ))}
                   </div>
                  )}
               </div>
            ) : tokenInput ? (
              <div className="w-[600px] min-h-[400px] bg-white dark:bg-slate-800 rounded-[32px] shadow-soft border border-slate-100 dark:border-slate-700 p-10 relative">
                 <div className="border border-dashed border-slate-200 dark:border-slate-700 h-full rounded-2xl flex items-center justify-center text-slate-300 dark:text-slate-600 flex-col gap-4">
                    <span className="material-icons-round text-4xl opacity-50">code</span>
                    <p className="text-sm font-normal text-slate-400">Token Interpretation View</p>
                    <div className="max-w-xs text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 p-3 rounded-xl opacity-60">
                       {tokenInput.substring(0, 100)}...
                    </div>
                 </div>
              </div>
            ) : (
               <div className="text-center opacity-40">
                  <span className="material-icons-round text-6xl text-slate-300 dark:text-slate-600 mb-4">image</span>
                  <h3 className="text-slate-500 dark:text-slate-400 font-normal">No Preview</h3>
               </div>
            )}
         </div>
         
         <div className="bg-white dark:bg-slate-900 border-t border-slate-50 dark:border-slate-800 p-6 flex justify-between items-center relative z-10">
            <div className="flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-green-400"></div>
               <span className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Gemini 3 Pro Active</span>
            </div>
            <Button variant="primary" icon="auto_fix_high" onClick={handleAdvancedVariant} disabled={isAnalyzing || !previewUrl}>
               Generate Variant
            </Button>
         </div>
      </div>
      <input type="file" ref={pdfInputRef} className="hidden" accept="application/pdf" onChange={handlePdfUpload} />
    </div>
  );

  return (
    <div className="flex min-h-screen bg-white dark:bg-slate-900 text-slate-900 dark:text-white transition-colors duration-300">
      <AuroraBackground show={screen === Screen.DASHBOARD || screen === Screen.ONBOARDING || isAnalyzing} />
      
      {screen !== Screen.ONBOARDING && (
        <Sidebar 
          currentScreen={screen} 
          onNavigate={handleNavigate} 
          onProfileClick={() => setScreen(Screen.SETTINGS)} 
        />
      )}

      <main className="flex-1 relative z-10 h-screen overflow-hidden flex flex-col">
        {screen === Screen.REVIEW ? (
          renderReview() 
        ) : screen === Screen.ONBOARDING ? (
            renderOnboarding()
        ) : (
          <div className="flex-1 overflow-y-auto scrollbar-hide">
             {screen === Screen.DASHBOARD && renderDashboard()}
             {screen === Screen.TOKEN_INPUT && renderTokenInput()}
             {screen === Screen.HISTORY && renderHistory()}
             {screen === Screen.SETTINGS && renderSettings()}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
