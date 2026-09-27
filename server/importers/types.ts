import { Movie } from '../db/types';

export interface ExtractedMetadata {
  title: string;
  originalTitle?: string;
  description: string;
  releaseYear?: number;
  type: 'movie' | 'tv';
  genre?: string[];
  language?: string;
  country?: string;
  runtime?: number;
  ageRating?: string;
  imdbRating?: number;
  director?: string;
  cast?: string[];
  tags?: string[];
  posterUrl?: string;
  backdropUrl?: string;
  trailerUrl?: string;
  sourceUrl: string;
  provider: string;
}

export interface ImportProvider {
  name: string;
  canHandle(url: URL): boolean;
  fetchMetadata(url: URL, html: string): Promise<ExtractedMetadata | null>;
}
