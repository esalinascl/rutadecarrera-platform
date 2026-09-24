/**
 * Tipos y interfaces compartidas de la plataforma
 * Importar desde @rcp/types en cualquier workspace
 */

// Usuario y autenticación
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Evaluación de competencias
export interface Assessment {
  id: string;
  userId: string;
  type: 'initial' | 'progress' | 'final';
  score: number;
  results: AssessmentResult[];
  completedAt: Date;
}

export interface AssessmentResult {
  competencyId: string;
  competencyName: string;
  score: number;
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  feedback: string;
}

// Carrera y recomendaciones
export interface CareerPath {
  id: string;
  userId: string;
  currentRole: string;
  targetRole: string;
  milestones: CareerMilestone[];
  recommendations: Recommendation[];
  updatedAt: Date;
}

export interface CareerMilestone {
  id: string;
  title: string;
  description: string;
  dueDate: Date;
  status: 'not_started' | 'in_progress' | 'completed';
  competenciesInvolved: string[];
}

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  type: 'course' | 'resource' | 'action' | 'mentoring';
  priority: 'high' | 'medium' | 'low';
  relatedCompetencies: string[];
  url?: string;
}

// Respuesta de API
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
  };
  timestamp: Date;
}

// Gemini Integration
export interface GeminiMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface GeminiContext {
  userId: string;
  conversationId: string;
  messages: GeminiMessage[];
  userProfile?: Partial<User>;
  assessment?: Assessment;
}

export type { User as UserType };
