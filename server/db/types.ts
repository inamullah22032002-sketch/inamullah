export type UserRole = 'USER' | 'ADMIN' | 'CONTENT_MANAGER' | 'MODERATOR';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export type ContentType = 'movie' | 'tv';
export type MovieStatus = 'draft' | 'published' | 'archived';

export interface Movie {
  id: string;
  title: string;
  originalTitle?: string;
  slug: string;
  description: string;
  releaseYear: number;
  type: ContentType;
  genre: string[]; // e.g. ["Action", "Sci-Fi"]
  language: string;
  country: string;
  runtime: number; // in minutes
  ageRating?: string;
  imdbRating?: number;
  director?: string;
  cast: string[];
  tags: string[];
  posterUrl: string;
  backdropUrl?: string;
  trailerUrl?: string;
  videoObjectKey?: string;
  videoUrl?: string;
  subtitles?: SubtitleTrack[];
  status: MovieStatus;
  views: number;
  featured?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SubtitleTrack {
  id: string;
  movieId: string;
  language: string;
  label: string;
  fileUrl: string;
  format: 'vtt' | 'srt';
}

export interface Genre {
  id: string;
  name: string;
  slug: string;
  color?: string;
}

export interface WatchProgress {
  id: string;
  userId: string;
  movieId: string;
  currentTime: number;
  duration: number;
  completed: boolean;
  updatedAt: string;
  movie?: Movie;
}

export interface Favorite {
  id: string;
  userId: string;
  movieId: string;
  createdAt: string;
}

export interface WatchlistItem {
  id: string;
  userId: string;
  movieId: string;
  createdAt: string;
}

export type UploadStatus = 
  | 'IDLE' 
  | 'INITIALIZING' 
  | 'UPLOADING' 
  | 'PAUSED' 
  | 'RETRYING' 
  | 'COMPLETING' 
  | 'COMPLETED' 
  | 'FAILED' 
  | 'CANCELLED';

export interface UploadRecord {
  id: string;
  uploadId: string;
  objectKey: string;
  filename: string;
  size: number;
  mimeType: string;
  status: UploadStatus;
  progress: number;
  createdBy: string;
  movieId?: string;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

export interface ImportJob {
  id: string;
  sourceUrl: string;
  provider: string;
  status: 'PENDING' | 'ANALYZED' | 'IMPORTED' | 'FAILED';
  detectedMetadata: Partial<Movie>;
  createdBy: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: UserRole;
  action: string;
  resource: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

export interface CustomRole {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem?: boolean;
}
