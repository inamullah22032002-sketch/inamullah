export type UserRole = 'USER' | 'ADMIN' | 'CONTENT_MANAGER' | 'MODERATOR';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  createdAt?: string;
}

export type ContentType = 'movie' | 'tv';
export type MovieStatus = 'draft' | 'published' | 'archived';

export interface SubtitleTrack {
  id: string;
  movieId: string;
  language: string;
  label: string;
  fileUrl: string;
  format: 'vtt' | 'srt';
}

export interface Movie {
  id: string;
  title: string;
  originalTitle?: string;
  slug: string;
  description: string;
  releaseYear: number;
  type: ContentType;
  genre: string[];
  language: string;
  country: string;
  runtime: number;
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

export interface SystemStats {
  totalMovies: number;
  totalTVShows: number;
  totalViews: number;
  totalUsers: number;
  storageUsedBytes: number;
  completedUploads: number;
  failedUploads: number;
  recentUploads: UploadRecord[];
  recentMovies: Movie[];
  system: {
    isPostgresConnected: boolean;
    isR2Configured: boolean;
    bucketName: string;
  };
}

export interface HealthReport {
  status: 'healthy' | 'degraded';
  timestamp: string;
  uptimeSeconds: number;
  processMemoryMb: number;
  systemMemoryPercent: number;
  anomalies: { level: 'warning' | 'critical' | 'info'; title: string; message: string }[];
  storageStats: { totalBytes: number; completedCount: number; failedCount: number };
}
