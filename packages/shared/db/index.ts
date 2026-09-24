/**
 * Módulo de Base de Datos
 * Gestión centralizada de conexiones y esquemas
 *
 * Nota: Esta es una estructura inicial
 * Los esquemas y migraciones se agregarán en futuras fases
 */

import { User, Assessment, CareerPath } from '@rcp/types';

/**
 * Interfaz para el cliente de base de datos
 */
export interface DatabaseClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
}

/**
 * Interfaz para operaciones CRUD de Usuario
 */
export interface UserRepository {
  create(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  update(id: string, data: Partial<User>): Promise<User>;
  delete(id: string): Promise<boolean>;
}

/**
 * Interfaz para operaciones CRUD de Assessment
 */
export interface AssessmentRepository {
  create(assessment: Omit<Assessment, 'id'>): Promise<Assessment>;
  findById(id: string): Promise<Assessment | null>;
  findByUserId(userId: string): Promise<Assessment[]>;
  update(id: string, data: Partial<Assessment>): Promise<Assessment>;
  delete(id: string): Promise<boolean>;
}

/**
 * Interfaz para operaciones CRUD de CareerPath
 */
export interface CareerPathRepository {
  create(careerPath: Omit<CareerPath, 'id'>): Promise<CareerPath>;
  findById(id: string): Promise<CareerPath | null>;
  findByUserId(userId: string): Promise<CareerPath | null>;
  update(id: string, data: Partial<CareerPath>): Promise<CareerPath>;
  delete(id: string): Promise<boolean>;
}

/**
 * Inicializa la conexión a la base de datos
 * Se implementará con la BD elegida (PostgreSQL, Firestore, etc)
 */
export async function initializeDatabase(): Promise<DatabaseClient> {
  // TODO: Implementar conexión según BD elegida
  throw new Error('Database not configured yet');
}

/**
 * Estructura de esquema para referencia
 */
export const DATABASE_SCHEMA = {
  users: {
    tableName: 'users',
    columns: ['id', 'email', 'name', 'avatar', 'createdAt', 'updatedAt'],
  },
  assessments: {
    tableName: 'assessments',
    columns: ['id', 'userId', 'type', 'score', 'results', 'completedAt'],
  },
  careerPaths: {
    tableName: 'career_paths',
    columns: ['id', 'userId', 'currentRole', 'targetRole', 'milestones', 'recommendations', 'updatedAt'],
  },
} as const;

export type { User, Assessment, CareerPath };
export type { UserRepository, AssessmentRepository, CareerPathRepository };
