export enum Screen {
  DASHBOARD = 'DASHBOARD',
  TOKEN_INPUT = 'TOKEN_INPUT',
  REVIEW = 'REVIEW',
  HISTORY = 'HISTORY',
  SETTINGS = 'SETTINGS',
  ONBOARDING = 'ONBOARDING'
}

export interface UserProfile {
  name: string;
  role: string;
  goal: string;
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