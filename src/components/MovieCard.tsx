import React, { useState } from 'react';
import { Play, Star, Plus, Check } from 'lucide-react';
import { Movie } from '../types';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

interface MovieCardProps {
  movie: Movie;
  onPlay?: (movie: Movie) => void;
  onSelect?: (movie: Movie) => void;
  initialWatchlisted?: boolean;
}

export const MovieCard: React.FC<MovieCardProps> = ({
  movie,
  onPlay,
  onSelect,
  initialWatchlisted = false,
}) => {
  const { isAuthenticated } = useAuth();
  const [isWatchlisted, setIsWatchlisted] = useState(initialWatchlisted);
  const [loadingWatchlist, setLoadingWatchlist] = useState(false);

  const toggleWatchlist = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      alert('Please sign in to add titles to your personal watchlist.');
      return;
    }
    setLoadingWatchlist(true);
    try {
      if (isWatchlisted) {
        await api.movies.removeFromWatchlist(movie.id);
        setIsWatchlisted(false);
      } else {
        await api.movies.addToWatchlist(movie.id);
        setIsWatchlisted(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingWatchlist(false);
    }
  };

  return (
    <div
      onClick={() => onSelect?.(movie)}
      className="group relative cursor-pointer flex flex-col rounded-2xl overflow-hidden bg-slate-900/40 border border-white/[0.08] hover:border-cyan-500/50 hover:shadow-[0_0_25px_-5px_rgba(6,182,212,0.35)] transition-all duration-300 transform hover:-translate-y-1.5 focus:outline-none"
    >
      {/* Poster Aspect Container 2:3 */}
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-slate-950">
        <img
          src={movie.posterUrl}
          alt={movie.title}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Ambient Dark Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#07080d] via-transparent to-black/30 opacity-80 group-hover:opacity-60 transition-opacity"></div>

        {/* IMDb Rating Badge in top corner */}
        {movie.imdbRating && (
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md border border-white/10 text-[11px] font-semibold text-amber-300 shadow-md">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            <span>{movie.imdbRating.toFixed(1)}</span>
          </div>
        )}

        {/* Watchlist Quick Add Button */}
        <button
          onClick={toggleWatchlist}
          disabled={loadingWatchlist}
          title={isWatchlisted ? 'Remove from Watchlist' : 'Add to Watchlist'}
          className={`absolute top-2.5 left-2.5 w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-md transition-all ${
            isWatchlisted
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/50'
              : 'bg-black/60 text-white/80 hover:text-white hover:bg-black/90 border border-white/15'
          }`}
        >
          {isWatchlisted ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Plus className="w-3.5 h-3.5 stroke-[2.5]" />}
        </button>

        {/* Play Overlay Button on Hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-cyan-950/20 backdrop-blur-[2px]">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlay ? onPlay(movie) : onSelect?.(movie);
            }}
            className="w-12 h-12 rounded-full bg-gradient-to-r from-cyan-400 to-indigo-500 flex items-center justify-center text-slate-950 shadow-lg shadow-cyan-500/50 hover:scale-110 active:scale-95 transition-all"
            aria-label="Play video"
          >
            <Play className="w-5 h-5 fill-slate-950 translate-x-0.5" />
          </button>
        </div>
      </div>

      {/* Info Section */}
      <div className="p-3 sm:p-4 flex flex-col flex-1 justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors line-clamp-1 font-heading">
            {movie.title}
          </h3>

          {/* Clean unboxed metadata with bullet separators (Zero-Pill discipline) */}
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-1">
            <span>{movie.releaseYear}</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="capitalize">{movie.type === 'tv' ? 'TV Series' : 'Movie'}</span>
            {movie.runtime > 0 && (
              <>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span>{movie.runtime}m</span>
              </>
            )}
          </div>
        </div>

        {/* Genre text */}
        {movie.genre && movie.genre.length > 0 && (
          <p className="text-[11px] text-slate-400 truncate mt-2 font-medium">
            {movie.genre.slice(0, 2).join(' · ')}
          </p>
        )}
      </div>
    </div>
  );
};
