
export enum Screen {
  DASHBOARD = 'DASHBOARD',
  TOKEN_INPUT = 'TOKEN_INPUT',
  REVIEW = 'REVIEW',
  DOJO = 'DOJO',
  HISTORY = 'HISTORY',
  SETTINGS = 'SETTINGS',
  ONBOARDING = 'ONBOARDING'
}

export interface UserActivity {
  date: string; // ISO format YYYY-MM-DD
  count: number;
}

export interface UserProfile {
  name: string;
  role: string;
  goal: string;
  location?: string;
  bio?: string;
  joinedDate?: string;
  totalContributions: number;
  rating: number;
  projectsCount: number;
  currentStreak: number;
  longestStreak: number;
  activityLog: Record<string, number>; // date string -> count
}

export interface DesignToken {
  id: string;
  code: string;
  name: string;
  timestamp: Date;
  previewUrl?: string;
  tags: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export enum ImageSize {
  K1 = '1K',
  K2 = '2K',
  K4 = '4K'
}

export interface Annotation {
  label: string;
  suggestion: string;
  box_2d: number[]; // [ymin, xmin, ymax, xmax] in percentages (0-100)
  confidenceScore?: number; // 0-100
  rating?: 'good' | 'bad';
  userFeedback?: string;
}

export interface UserFeedback {
  id: string;
  annotationLabel: string;
  suggestion: string;
  rating: 'good' | 'bad';
  timestamp: number;
  userComment?: string;
}

export interface ReviewSession {
  id: string;
  type: 'token' | 'image';
  content: string; // Token code or Base64 image string
  thumbnail?: string; // Small preview for history card
  timestamp: number;
  title: string;
  chatHistory: ChatMessage[];
  annotations: Annotation[];
}

// --- Quiz Module Types ---

export interface Question {
  id: string;
  type: 'multiple-choice' | 'comparison' | 'spot-mistake';
  text: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  imageA?: string;
  imageB?: string;
}

export interface QuizCategory {
  id: string;
  name: string;
  description: string;
  skills: string[];
  difficulty: 'Beginner' | 'Intermediate' | 'Mixed';
  icon: string;
  color: 'blue' | 'purple' | 'pink' | 'orange' | 'green';
}

export interface LeaderboardEntry {
  name: string;
  score: number;
  category: string;
  timestamp: number;
}