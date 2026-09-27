import React, { useState, useEffect } from 'react';
import { Play, Plus, Check, Star, Info, Film, Sparkles, Filter, RefreshCw } from 'lucide-react';
import { Movie, WatchProgress } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { BubbleNav, CategoryBubble } from '../components/BubbleNav';
import { MovieCard } from '../components/MovieCard';
import { VideoPlayerModal } from '../components/VideoPlayerModal';

interface HomePageProps {
  onNavigate: (route: string) => void;
  searchQuery?: string;
  defaultType?: 'all' | 'movie' | 'tv';
}

export const HomePage: React.FC<HomePageProps> = ({
  onNavigate,
  searchQuery = '',
  defaultType = 'all',
}) => {
  const { isAuthenticated } = useAuth();

  const [movies, setMovies] = useState<Movie[]>([]);
  const [featuredMovies, setFeaturedMovies] = useState<Movie[]>([]);
  const [continueWatching, setContinueWatching] = useState<WatchProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active filters
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<'all' | 'movie' | 'tv'>(defaultType);
  const [selectedGenre, setSelectedGenre] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('newest');

  // Video player modal state
  const [playingMovie, setPlayingMovie] = useState<Movie | null>(null);
  const [playerStartTime, setPlayerStartTime] = useState(0);

  // Hero carousel active index
  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => {
    fetchCatalog();
    if (isAuthenticated) {
      fetchContinueWatching();
    }
  }, [searchQuery, selectedType, selectedGenre, sortBy, isAuthenticated]);

  const fetchCatalog = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.movies.list({
        q: searchQuery,
        type: selectedType === 'all' ? undefined : selectedType,
        genre: selectedGenre || undefined,
        sort: sortBy,
        limit: 60,
      });
      setMovies(res.movies);

      // Fetch featured if on main discover view
      if (!searchQuery && selectedType === 'all' && !selectedGenre) {
        const featRes = await api.movies.featured();
        setFeaturedMovies(featRes.featured);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load movie catalog.');
    } finally {
      setLoading(false);
    }
  };

  const fetchContinueWatching = async () => {
    try {
      const res = await api.movies.getProgress();
      setContinueWatching(res.continueWatching);
    } catch (err) {
      // Non-blocking
    }
  };

  const handleCategorySelect = (category: CategoryBubble) => {
    setActiveCategory(category.id);
    if (category.type) {
      setSelectedType(category.type);
      setSelectedGenre('');
    } else if (category.genre) {
      setSelectedGenre(category.genre);
      setSelectedType('all');
    } else {
      setSelectedType('all');
      setSelectedGenre('');
    }
  };

  const handlePlayHero = (movie: Movie) => {
    setPlayerStartTime(0);
    setPlayingMovie(movie);
  };

  const handlePlayContinue = (progress: WatchProgress) => {
    if (progress.movie) {
      setPlayerStartTime(progress.currentTime);
      setPlayingMovie(progress.movie);
    }
  };

  const heroMovie = featuredMovies.length > 0 ? featuredMovies[heroIndex % featuredMovies.length] : movies[0];

  return (
    <div className="min-w-0 flex flex-col gap-6">
      {/* 1. HERO SECTION (Shown when not searching and titles exist) */}
      {!searchQuery && heroMovie && (
        <section className="relative w-full h-[55vh] sm:h-[65vh] lg:h-[72vh] rounded-3xl overflow-hidden border border-white/[0.08] shadow-2xl bg-slate-950">
          {/* Backdrop Image */}
          <img
            src={heroMovie.backdropUrl || heroMovie.posterUrl}
            alt={heroMovie.title}
            className="w-full h-full object-cover object-top opacity-60 transition-opacity duration-700"
          />

          {/* Cinematic Vignettes */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#07080d] via-[#07080d]/60 to-transparent"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-[#07080d] via-[#07080d]/80 to-transparent"></div>

          {/* Hero Content */}
          <div className="absolute inset-0 p-6 sm:p-10 lg:p-14 flex flex-col justify-end max-w-3xl">
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold tracking-wider uppercase mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Featured Spotlight</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight font-heading leading-tight mb-3">
              {heroMovie.title}
            </h1>

            {/* Clean Metadata Line (Zero-Pill discipline) */}
            <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-300 mb-4">
              {heroMovie.imdbRating && (
                <span className="flex items-center gap-1 font-semibold text-amber-300">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  {heroMovie.imdbRating.toFixed(1)} IMDb
                </span>
              )}
              {heroMovie.imdbRating && <span aria-hidden="true" className="text-slate-600">·</span>}
              <span>{heroMovie.releaseYear}</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="capitalize">{heroMovie.type === 'tv' ? 'TV Series' : 'Movie'}</span>
              {heroMovie.runtime > 0 && (
                <>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span>{heroMovie.runtime} min</span>
                </>
              )}
            </div>

            <p className="text-slate-300 text-xs sm:text-sm line-clamp-3 mb-6 max-w-2xl leading-relaxed">
              {heroMovie.description}
            </p>

            {/* Hero Action Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => handlePlayHero(heroMovie)}
                className="px-6 py-2.5 rounded-full bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:scale-105 active:scale-95 transition-all"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                Watch Now
              </button>

              <button
                onClick={() => onNavigate(`/movie/${heroMovie.slug || heroMovie.id}`)}
                className="px-5 py-2.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white font-semibold text-xs sm:text-sm border border-white/10 flex items-center gap-2 backdrop-blur-md transition-all hover:border-cyan-500/30"
              >
                <Info className="w-4 h-4 text-cyan-400" />
                More Info
              </button>

              {/* Carousel Next Pill if multiple featured */}
              {featuredMovies.length > 1 && (
                <div className="flex items-center gap-1.5 ml-auto">
                  {featuredMovies.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setHeroIndex(idx)}
                      className={`h-1.5 rounded-full transition-all ${
                        idx === heroIndex % featuredMovies.length
                          ? 'w-6 bg-cyan-400 shadow-[0_0_8px_#06b6d4]'
                          : 'w-2 bg-white/20 hover:bg-white/40'
                      }`}
                      aria-label={`Slide ${idx + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 2. CONTINUE WATCHING SHELF (If logged-in and has in-progress titles) */}
      {continueWatching.length > 0 && !searchQuery && (
        <section className="my-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base sm:text-lg font-bold text-white font-heading flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
              Continue Watching
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {continueWatching.map((item) => {
              if (!item.movie) return null;
              const percent = Math.min(100, Math.round((item.currentTime / item.duration) * 100));

              return (
                <div
                  key={item.id}
                  onClick={() => handlePlayContinue(item)}
                  className="group relative cursor-pointer rounded-xl overflow-hidden bg-slate-900/60 border border-white/10 hover:border-cyan-500/50 transition-all hover:scale-102"
                >
                  <div className="aspect-video w-full bg-slate-950 relative overflow-hidden">
                    <img
                      src={item.movie.backdropUrl || item.movie.posterUrl}
                      alt={item.movie.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-9 h-9 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center shadow-lg">
                        <Play className="w-4 h-4 fill-slate-950 translate-x-0.5" />
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-1 bg-white/10">
                    <div className="h-full bg-cyan-400" style={{ width: `${percent}%` }}></div>
                  </div>

                  <div className="p-2">
                    <p className="text-xs font-semibold text-white truncate font-heading">{item.movie.title}</p>
                    <p className="text-[10px] text-slate-400">{percent}% watched</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 3. BUBBLE NAVIGATION BAR */}
      <BubbleNav selectedId={activeCategory} onSelect={handleCategorySelect} />

      {/* 4. CATALOG HEADER & FILTER BAR */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/[0.06] pb-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white font-heading">
            {searchQuery ? `Search Results for "${searchQuery}"` : selectedGenre ? `${selectedGenre} Titles` : selectedType === 'movie' ? 'Movies Catalog' : selectedType === 'tv' ? 'TV Series' : 'Explore All Titles'}
          </h2>
          <p className="text-xs text-slate-400">
            {movies.length} {movies.length === 1 ? 'title' : 'titles'} found
          </p>
        </div>

        {/* Sort Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900/80 border border-white/10 rounded-xl text-xs">
          <button
            onClick={() => setSortBy('newest')}
            className={`px-3 py-1 rounded-lg transition-colors ${
              sortBy === 'newest' ? 'bg-cyan-500/20 text-cyan-300 font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Newest
          </button>
          <button
            onClick={() => setSortBy('rating')}
            className={`px-3 py-1 rounded-lg transition-colors ${
              sortBy === 'rating' ? 'bg-cyan-500/20 text-cyan-300 font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Top Rated
          </button>
          <button
            onClick={() => setSortBy('popular')}
            className={`px-3 py-1 rounded-lg transition-colors ${
              sortBy === 'popular' ? 'bg-cyan-500/20 text-cyan-300 font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Popular
          </button>
        </div>
      </div>

      {/* 5. ERROR STATE */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={fetchCatalog}
            className="flex items-center gap-1 underline hover:text-rose-200"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      )}

      {/* 6. LOADING SKELETON */}
      {loading && movies.length === 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="animate-pulse flex flex-col gap-2 rounded-2xl bg-slate-900/30 border border-white/5 p-2">
              <div className="aspect-[2/3] w-full rounded-xl bg-slate-800/50"></div>
              <div className="h-4 bg-slate-800/60 rounded w-3/4"></div>
              <div className="h-3 bg-slate-800/40 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      )}

      {/* 7. EMPTY STATE (Prompt Section 11: "No titles have been added yet.") */}
      {!loading && movies.length === 0 && !error && (
        <div className="my-16 flex flex-col items-center justify-center text-center p-8 rounded-3xl bg-slate-900/30 border border-white/5 max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-cyan-950/40 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-4 shadow-lg shadow-cyan-950/50">
            <Film className="w-8 h-8 opacity-80" />
          </div>
          <h3 className="text-xl font-bold text-white font-heading mb-2">
            No titles have been added yet.
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed mb-6">
            The catalog is synced directly with the PostgreSQL database and Cloudflare R2 storage. Once an administrator uploads movies or imports metadata, they will appear here.
          </p>
          <button
            onClick={() => onNavigate('/admin/login')}
            className="px-5 py-2 text-xs font-semibold text-cyan-300 bg-cyan-950/60 border border-cyan-500/40 rounded-full hover:bg-cyan-900/50 transition-all shadow-md shadow-cyan-950/50"
          >
            Administrator Gateway
          </button>
        </div>
      )}

      {/* 8. MOVIES GRID */}
      {movies.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 lg:gap-5">
          {movies.map((movie) => (
            <MovieCard
              key={movie.id}
              movie={movie}
              onSelect={(m) => onNavigate(`/movie/${m.slug || m.id}`)}
              onPlay={(m) => {
                setPlayerStartTime(0);
                setPlayingMovie(m);
              }}
            />
          ))}
        </div>
      )}

      {/* Video Player Modal */}
      {playingMovie && (
        <VideoPlayerModal
          movie={playingMovie}
          initialTime={playerStartTime}
          onClose={() => setPlayingMovie(null)}
        />
      )}
    </div>
  );
};
