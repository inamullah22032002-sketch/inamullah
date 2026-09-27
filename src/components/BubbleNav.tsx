import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

export interface CategoryBubble {
  id: string;
  label: string;
  type?: 'all' | 'movie' | 'tv';
  genre?: string;
  special?: 'trending' | 'new';
}

const CATEGORIES: CategoryBubble[] = [
  { id: 'all', label: 'All Titles' },
  { id: 'movies', label: 'Movies', type: 'movie' },
  { id: 'tv', label: 'TV Shows', type: 'tv' },
  { id: 'trending', label: 'Trending', special: 'trending' },
  { id: 'action', label: 'Action', genre: 'Action' },
  { id: 'scifi', label: 'Sci-Fi', genre: 'Sci-Fi' },
  { id: 'horror', label: 'Horror', genre: 'Horror' },
  { id: 'comedy', label: 'Comedy', genre: 'Comedy' },
  { id: 'thriller', label: 'Thriller', genre: 'Thriller' },
  { id: 'adventure', label: 'Adventure', genre: 'Adventure' },
  { id: 'animation', label: 'Animation', genre: 'Animation' },
  { id: 'documentary', label: 'Documentary', genre: 'Documentary' },
  { id: 'new', label: 'New Releases', special: 'new' },
];

interface BubbleNavProps {
  selectedId: string;
  onSelect: (category: CategoryBubble) => void;
}

export const BubbleNav: React.FC<BubbleNavProps> = ({ selectedId, onSelect }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const offset = direction === 'left' ? -250 : 250;
      scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  return (
    <div className="relative w-full my-6 group">
      {/* Scroll controls */}
      <button
        onClick={() => scroll('left')}
        className="hidden md:flex absolute -left-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-slate-900/90 border border-white/10 items-center justify-center text-slate-300 hover:text-cyan-400 hover:border-cyan-500/50 shadow-lg backdrop-blur-md transition-all opacity-0 group-hover:opacity-100"
        aria-label="Scroll left"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Bubble Pill Container */}
      <div
        ref={scrollRef}
        className="flex items-center gap-2.5 overflow-x-auto no-scrollbar py-2 px-1 scroll-smooth"
      >
        {CATEGORIES.map((cat) => {
          const isActive = selectedId === cat.id;

          return (
            <button
              key={cat.id}
              onClick={() => onSelect(cat)}
              className={`relative flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold tracking-wide transition-all duration-300 whitespace-nowrap focus:outline-none ${
                isActive
                  ? 'bg-gradient-to-r from-cyan-500/25 via-indigo-500/25 to-fuchsia-500/25 text-cyan-200 border border-cyan-400/80 shadow-[0_0_20px_-3px_rgba(6,182,212,0.6)] scale-105'
                  : 'bg-slate-900/60 text-slate-300 border border-white/[0.08] hover:border-cyan-500/40 hover:text-white hover:bg-slate-800/80 hover:shadow-[0_0_12px_-2px_rgba(6,182,212,0.3)] hover:scale-102 backdrop-blur-md'
              }`}
            >
              {cat.special === 'trending' && (
                <Sparkles className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400 animate-spin' : 'text-slate-400'}`} />
              )}
              <span>{cat.label}</span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_6px_#06b6d4]"></span>
              )}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => scroll('right')}
        className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-slate-900/90 border border-white/10 items-center justify-center text-slate-300 hover:text-cyan-400 hover:border-cyan-500/50 shadow-lg backdrop-blur-md transition-all opacity-0 group-hover:opacity-100"
        aria-label="Scroll right"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
};
