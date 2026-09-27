import React, { useState, useEffect } from 'react';
import {
  Play,
  Bookmark,
  Heart,
  Star,
  Clock,
  Globe,
  ArrowLeft,
  Share2,
  Film,
  Check,
  Plus,
} from 'lucide-react';
import { Movie } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { VideoPlayerModal } from '../components/VideoPlayerModal';
import { MovieCard } from '../components/MovieCard';

interface MovieDetailPageProps {
  slugOrId: string;
  onNavigate: (route: string) => void;
}

export const MovieDetailPage: React.FC<MovieDetailPageProps> = ({ slugOrId, onNavigate }) => {
  const { isAuthenticated } = useAuth();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [relatedMovies, setRelatedMovies] = useState<Movie[]>([]);
  const [isWatchlisted, setIsWatchlisted] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playingVideo, setPlayingVideo] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  useEffect(() => {
    fetchMovieDetails();
  }, [slugOrId]);

  const fetchMovieDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.movies.get(slugOrId);
      setMovie(res.movie);
      setIsWatchlisted(res.userState?.isWatchlisted || false);
      setIsFavorite(res.userState?.isFavorite || false);

      // Fetch related movies based on primary genre
      if (res.movie.genre && res.movie.genre.length > 0) {
        const relatedRes = await api.movies.list({
          genre: res.movie.genre[0],
          limit: 6,
        });
        setRelatedMovies(relatedRes.movies.filter((m) => m.id !== res.movie.id));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load movie information.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleWatchlist = async () => {
    if (!isAuthenticated || !movie) {
      alert('Please sign in to save titles to your watchlist.');
      return;
    }
    try {
      if (isWatchlisted) {
        await api.movies.removeFromWatchlist(movie.id);
        setIsWatchlisted(false);
      } else {
        await api.movies.addToWatchlist(movie.id);
        setIsWatchlisted(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleFavorite = async () => {
    if (!isAuthenticated || !movie) {
      alert('Please sign in to add titles to your favorites.');
      return;
    }
    try {
      if (isFavorite) {
        await api.movies.removeFromFavorites(movie.id);
        setIsFavorite(false);
      } else {
        await api.movies.addToFavorites(movie.id);
        setIsFavorite(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-slate-400">Loading cinematic experience...</p>
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div className="py-20 text-center max-w-md mx-auto">
        <h2 className="text-xl font-bold text-white mb-2">Movie Not Found</h2>
        <p className="text-xs text-slate-400 mb-6">{error || 'This title is unavailable.'}</p>
        <button
          onClick={() => onNavigate('/browse')}
          className="px-5 py-2 text-xs font-semibold bg-cyan-500 text-slate-950 rounded-full"
        >
          Return to Catalog
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      {/* Back button */}
      <div>
        <button
          onClick={() => onNavigate('/browse')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-cyan-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Browse
        </button>
      </div>

      {/* Hero Header with Backdrop */}
      <div className="relative rounded-3xl overflow-hidden border border-white/10 bg-slate-950 shadow-2xl">
        <div className="relative aspect-[21/9] sm:aspect-[24/9] w-full min-h-[350px]">
          <img
            src={movie.backdropUrl || movie.posterUrl}
            alt={movie.title}
            className="w-full h-full object-cover object-center opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#07080d] via-[#07080d]/60 to-transparent"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-[#07080d] via-transparent to-transparent"></div>
        </div>

        {/* Content Container overlapping the backdrop */}
        <div className="relative px-6 sm:px-10 pb-8 -mt-32 sm:-mt-48 flex flex-col md:flex-row gap-6 sm:gap-8 items-start">
          {/* Poster */}
          <div className="relative w-44 sm:w-56 shrink-0 aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl border border-white/15 bg-slate-900 group">
            <img
              src={movie.posterUrl}
              alt={movie.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => setPlayingVideo(true)}
                className="w-14 h-14 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center shadow-lg shadow-cyan-500/50 hover:scale-110 active:scale-95 transition-transform"
              >
                <Play className="w-6 h-6 fill-slate-950 translate-x-0.5" />
              </button>
            </div>
          </div>

          {/* Details */}
          <div className="flex-1 flex flex-col gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-mono tracking-widest uppercase px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/60 font-semibold">
                  {movie.type === 'tv' ? 'Television Series' : 'Feature Movie'}
                </span>
                {movie.ageRating && (
                  <span className="text-[10px] px-2 py-0.5 rounded border border-white/10 text-slate-300">
                    {movie.ageRating}
                  </span>
                )}
              </div>

              <h1 className="text-3xl sm:text-5xl font-black text-white font-heading tracking-tight leading-tight">
                {movie.title}
              </h1>

              {movie.originalTitle && movie.originalTitle !== movie.title && (
                <p className="text-sm text-slate-400 italic mt-0.5">{movie.originalTitle}</p>
              )}
            </div>

            {/* Quick Metadata Line (Zero-Pill discipline) */}
            <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-slate-300">
              {movie.imdbRating && (
                <span className="flex items-center gap-1 font-semibold text-amber-300">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  {movie.imdbRating.toFixed(1)} IMDb
                </span>
              )}
              {movie.imdbRating && <span aria-hidden="true" className="text-slate-600">·</span>}
              <span>{movie.releaseYear}</span>
              {movie.runtime > 0 && (
                <>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    {movie.runtime}m
                  </span>
                </>
              )}
              {movie.language && (
                <>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span className="flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5 text-slate-400" />
                    {movie.language}
                  </span>
                </>
              )}
            </div>

            {/* Genres */}
            {movie.genre && movie.genre.length > 0 && (
              <div className="flex flex-wrap gap-2 text-xs">
                {movie.genre.map((g) => (
                  <span
                    key={g}
                    className="px-3 py-1 rounded-full bg-slate-900 border border-white/10 text-slate-300 font-medium"
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}

            {/* Synopsis */}
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-3xl">
              {movie.description}
            </p>

            {/* Actions Bar */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={() => setPlayingVideo(true)}
                className="px-6 py-3 rounded-full bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-cyan-500/30 hover:scale-105 active:scale-95 transition-all"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                Stream Now
              </button>

              <button
                onClick={handleToggleWatchlist}
                className={`px-4 py-3 rounded-full text-xs font-semibold flex items-center gap-2 border transition-all ${
                  isWatchlisted
                    ? 'bg-cyan-950 text-cyan-300 border-cyan-500/50'
                    : 'bg-slate-900/80 hover:bg-slate-800 text-slate-200 border-white/10'
                }`}
              >
                {isWatchlisted ? <Check className="w-4 h-4 text-cyan-400" /> : <Plus className="w-4 h-4" />}
                {isWatchlisted ? 'In Watchlist' : 'Add to Watchlist'}
              </button>

              <button
                onClick={handleToggleFavorite}
                className={`p-3 rounded-full border transition-all ${
                  isFavorite
                    ? 'bg-rose-950 text-rose-400 border-rose-500/50'
                    : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-white/10'
                }`}
                title={isFavorite ? 'Remove Favorite' : 'Mark as Favorite'}
              >
                <Heart className={`w-4 h-4 ${isFavorite ? 'fill-rose-500 text-rose-500' : ''}`} />
              </button>

              <button
                onClick={handleShare}
                className="p-3 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-white/10 transition-all"
                title="Share Title"
              >
                <Share2 className="w-4 h-4" />
              </button>
              {copiedShare && (
                <span className="text-xs text-cyan-400 animate-in fade-in">Link copied!</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Cast, Crew & Specifications */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 p-6 rounded-2xl bg-slate-900/40 border border-white/10 space-y-4">
          <h3 className="text-base font-bold text-white font-heading">Production Information</h3>

          {movie.director && (
            <div>
              <span className="text-xs font-semibold text-slate-400 block mb-0.5">Director</span>
              <span className="text-xs text-slate-200">{movie.director}</span>
            </div>
          )}

          {movie.cast && movie.cast.length > 0 && (
            <div>
              <span className="text-xs font-semibold text-slate-400 block mb-1">Starring Cast</span>
              <div className="flex flex-wrap gap-1.5 text-xs text-slate-200">
                {movie.cast.map((actor, idx) => (
                  <span key={idx}>
                    {actor}
                    {idx < movie.cast.length - 1 && <span className="text-slate-500 mr-1.5">,</span>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {movie.tags && movie.tags.length > 0 && (
            <div>
              <span className="text-xs font-semibold text-slate-400 block mb-1">Tags & Keywords</span>
              <div className="flex flex-wrap gap-1.5">
                {movie.tags.map((tag) => (
                  <span key={tag} className="text-[11px] px-2 py-0.5 rounded bg-white/5 text-slate-400 border border-white/5">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Video Storage Spec Card */}
        <div className="p-6 rounded-2xl bg-slate-900/40 border border-white/10 space-y-3 text-xs">
          <h3 className="text-base font-bold text-white font-heading">Media Details</h3>
          <div className="flex justify-between py-1 border-b border-white/5">
            <span className="text-slate-400">Resolution</span>
            <span className="text-slate-200 font-mono">4K UHD / 1080p</span>
          </div>
          <div className="flex justify-between py-1 border-b border-white/5">
            <span className="text-slate-400">Audio Channels</span>
            <span className="text-slate-200 font-mono">Dolby Digital 5.1</span>
          </div>
          <div className="flex justify-between py-1 border-b border-white/5">
            <span className="text-slate-400">Storage Node</span>
            <span className="text-cyan-400 font-mono">Cloudflare R2 Direct</span>
          </div>
          <div className="flex justify-between py-1 border-b border-white/5">
            <span className="text-slate-400">Views</span>
            <span className="text-slate-200 font-mono">{movie.views.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Related Titles */}
      {relatedMovies.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white font-heading flex items-center gap-2">
            <Film className="w-5 h-5 text-cyan-400" />
            More Like This
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {relatedMovies.map((rel) => (
              <MovieCard
                key={rel.id}
                movie={rel}
                onSelect={(m) => onNavigate(`/movie/${m.slug || m.id}`)}
                onPlay={(m) => {
                  setPlayingVideo(true);
                  setMovie(m);
                }}
              />
            ))}
          </div>
        </section>
      )}

      {/* Video Player Modal */}
      {playingVideo && (
        <VideoPlayerModal
          movie={movie}
          onClose={() => setPlayingVideo(false)}
        />
      )}
    </div>
  );
};
