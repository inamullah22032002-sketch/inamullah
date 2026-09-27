import { Router, Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { db } from '../db';
import { authenticateToken, requireAdmin, optionalAuth, AuthRequest } from '../auth/jwt';
import { urlImportManager } from '../importers';
import { deleteR2Object } from '../r2/multipart';

export const moviesRouter = Router();

// Slug generator
function generateSlug(title: string, year?: number): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
  return year ? `${base}-${year}` : `${base}-${Date.now().toString().slice(-4)}`;
}

// 1. PUBLIC: LIST MOVIES WITH FILTERING & SEARCH
moviesRouter.get('/', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const {
      q,
      genre,
      type = 'all',
      status = 'published',
      sort = 'newest',
      limit = '50',
      offset = '0',
    } = req.query;

    const result = await db.movies.list({
      search: q as string,
      genre: genre as string,
      type: type as any,
      status: (status as any) || 'published',
      sort: sort as any,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    });

    return res.json(result);
  } catch (err: any) {
    console.error('List movies error:', err);
    return res.status(500).json({
      error: 'DATABASE_ERROR',
      message: 'Failed to retrieve movies catalog.',
    });
  }
});

// 2. PUBLIC: GET FEATURED HERO TITLES
moviesRouter.get('/featured', async (_req: Request, res: Response) => {
  try {
    const { movies } = await db.movies.list({ status: 'published', limit: 10 });
    const featured = movies.filter(m => m.featured);
    return res.json({
      featured: featured.length > 0 ? featured : movies.slice(0, 5),
    });
  } catch (err) {
    return res.status(500).json({ error: 'DATABASE_ERROR', message: 'Could not fetch featured titles.' });
  }
});

// 3. PUBLIC: GET GENRES LIST
moviesRouter.get('/genres', async (_req: Request, res: Response) => {
  const defaultGenres = [
    'Action', 'Sci-Fi', 'Horror', 'Comedy', 'Thriller',
    'Drama', 'Adventure', 'Animation', 'Documentary', 'Fantasy',
    'Crime', 'Mystery', 'Romance'
  ];
  return res.json({ genres: defaultGenres });
});

// 4. PUBLIC: GET MOVIE BY SLUG OR ID
moviesRouter.get('/:slugOrId', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { slugOrId } = req.params;
    let movie = await db.movies.findBySlug(slugOrId);
    if (!movie) {
      movie = await db.movies.findById(slugOrId);
    }

    if (!movie) {
      return res.status(404).json({
        error: 'MOVIE_NOT_FOUND',
        message: 'The requested title was not found.',
      });
    }

    // Increment view count asynchronously
    db.movies.incrementViews(movie.id).catch(() => {});

    // Check user watchlist/favorite state if logged in
    let isWatchlisted = false;
    let isFavorite = false;
    let userProgress = null;

    if (req.user) {
      [isWatchlisted, isFavorite, userProgress] = await Promise.all([
        db.watchlist.isWatchlisted(req.user.userId, movie.id),
        db.favorites.isFavorite(req.user.userId, movie.id),
        db.progress.getByMovieAndUser(req.user.userId, movie.id),
      ]);
    }

    return res.json({
      movie,
      userState: {
        isWatchlisted,
        isFavorite,
        currentTime: userProgress ? userProgress.currentTime : 0,
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'DATABASE_ERROR',
      message: 'Failed to retrieve movie details.',
    });
  }
});

// -------------------------------------------------------------
// USER SPECIFIC ENDPOINTS: Watchlist, Favorites, Progress
// -------------------------------------------------------------

moviesRouter.get('/user/watchlist', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const watchlist = await db.watchlist.getByUser(req.user!.userId);
    return res.json({ watchlist });
  } catch (err) {
    return res.status(500).json({ error: 'DATABASE_ERROR', message: 'Could not fetch watchlist.' });
  }
});

moviesRouter.post('/user/watchlist/:movieId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { movieId } = req.params;
    await db.watchlist.add(req.user!.userId, movieId);
    return res.json({ status: 'ADDED', movieId });
  } catch (err) {
    return res.status(500).json({ error: 'DATABASE_ERROR', message: 'Failed to add to watchlist.' });
  }
});

moviesRouter.delete('/user/watchlist/:movieId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { movieId } = req.params;
    await db.watchlist.remove(req.user!.userId, movieId);
    return res.json({ status: 'REMOVED', movieId });
  } catch (err) {
    return res.status(500).json({ error: 'DATABASE_ERROR', message: 'Failed to remove from watchlist.' });
  }
});

moviesRouter.get('/user/favorites', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const favorites = await db.favorites.getByUser(req.user!.userId);
    return res.json({ favorites });
  } catch (err) {
    return res.status(500).json({ error: 'DATABASE_ERROR', message: 'Could not fetch favorites.' });
  }
});

moviesRouter.post('/user/favorites/:movieId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { movieId } = req.params;
    await db.favorites.add(req.user!.userId, movieId);
    return res.json({ status: 'ADDED', movieId });
  } catch (err) {
    return res.status(500).json({ error: 'DATABASE_ERROR', message: 'Failed to add to favorites.' });
  }
});

moviesRouter.delete('/user/favorites/:movieId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { movieId } = req.params;
    await db.favorites.remove(req.user!.userId, movieId);
    return res.json({ status: 'REMOVED', movieId });
  } catch (err) {
    return res.status(500).json({ error: 'DATABASE_ERROR', message: 'Failed to remove from favorites.' });
  }
});

moviesRouter.get('/user/progress', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const progressList = await db.progress.getByUser(req.user!.userId);
    return res.json({ continueWatching: progressList });
  } catch (err) {
    return res.status(500).json({ error: 'DATABASE_ERROR', message: 'Could not fetch watch progress.' });
  }
});

moviesRouter.post('/user/progress/:movieId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { movieId } = req.params;
    const { currentTime, duration } = req.body;
    if (currentTime !== undefined && duration !== undefined) {
      await db.progress.upsert(req.user!.userId, movieId, Number(currentTime), Number(duration));
    }
    return res.json({ status: 'SAVED' });
  } catch (err) {
    return res.status(500).json({ error: 'DATABASE_ERROR', message: 'Could not record watch progress.' });
  }
});

// -------------------------------------------------------------
// ADMIN SPECIFIC ENDPOINTS: Movie CRUD, Importer, AI Assist
// -------------------------------------------------------------

// CREATE MOVIE
moviesRouter.post('/admin', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const {
      title,
      originalTitle,
      description,
      releaseYear,
      type = 'movie',
      genre = [],
      language = 'English',
      country = 'USA',
      runtime = 0,
      ageRating,
      imdbRating,
      director,
      cast = [],
      tags = [],
      posterUrl,
      backdropUrl,
      trailerUrl,
      videoObjectKey,
      videoUrl,
      subtitles = [],
      status = 'published',
      featured = false,
    } = req.body;

    if (!title || !description || !releaseYear || !posterUrl) {
      return res.status(400).json({
        error: 'VALIDATION_FAILED',
        message: 'Title, description, release year, and poster URL are required.',
      });
    }

    const slug = generateSlug(title, releaseYear);

    const movie = await db.movies.create({
      title: title.trim(),
      originalTitle: originalTitle?.trim(),
      slug,
      description: description.trim(),
      releaseYear: parseInt(releaseYear, 10),
      type,
      genre: Array.isArray(genre) ? genre : [genre],
      language,
      country,
      runtime: parseInt(runtime || '0', 10),
      ageRating,
      imdbRating: imdbRating ? parseFloat(imdbRating) : undefined,
      director: director?.trim(),
      cast: Array.isArray(cast) ? cast : cast.split(',').map((s: string) => s.trim()),
      tags: Array.isArray(tags) ? tags : tags.split(',').map((s: string) => s.trim()),
      posterUrl,
      backdropUrl: backdropUrl || posterUrl,
      trailerUrl,
      videoObjectKey,
      videoUrl,
      subtitles,
      status,
      featured: Boolean(featured),
    });

    await db.auditLogs.record({
      userId: req.user!.userId,
      userName: req.user!.name,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: 'MOVIE_CREATED',
      resource: `movies/${movie.id}`,
      details: { title: movie.title, slug: movie.slug, status: movie.status },
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    return res.status(201).json({ movie });
  } catch (err: any) {
    console.error('Create movie error:', err);
    return res.status(500).json({
      error: 'DATABASE_ERROR',
      message: err.message || 'Failed to create movie record.',
    });
  }
});

// UPDATE MOVIE
moviesRouter.put('/admin/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await db.movies.findById(id);
    if (!existing) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Movie not found.' });
    }

    const updated = await db.movies.update(id, req.body);

    await db.auditLogs.record({
      userId: req.user!.userId,
      userName: req.user!.name,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: 'MOVIE_UPDATED',
      resource: `movies/${id}`,
      details: { title: updated?.title },
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    return res.json({ movie: updated });
  } catch (err: any) {
    return res.status(500).json({
      error: 'DATABASE_ERROR',
      message: 'Failed to update movie.',
    });
  }
});

// DELETE MOVIE
moviesRouter.delete('/admin/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await db.movies.findById(id);
    if (!existing) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Movie not found.' });
    }

    // Clean up R2 video file if exists
    if (existing.videoObjectKey) {
      await deleteR2Object(existing.videoObjectKey).catch(() => {});
    }

    await db.movies.delete(id);

    await db.auditLogs.record({
      userId: req.user!.userId,
      userName: req.user!.name,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: 'MOVIE_DELETED',
      resource: `movies/${id}`,
      details: { title: existing.title },
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    return res.json({ message: 'Movie deleted successfully.' });
  } catch (err: any) {
    return res.status(500).json({
      error: 'DATABASE_ERROR',
      message: 'Failed to delete movie.',
    });
  }
});

// ANALYZE URL WITH SSRF-PROTECTED IMPORTER
moviesRouter.post('/admin/importers/analyze', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({
        error: 'INVALID_URL',
        message: 'A valid website URL is required for metadata import.',
      });
    }

    const metadata = await urlImportManager.analyzeUrl(url);

    await db.auditLogs.record({
      userId: req.user!.userId,
      userName: req.user!.name,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: 'URL_IMPORT_ANALYZED',
      resource: url,
      details: { title: metadata.title, provider: metadata.provider },
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    return res.json({ metadata });
  } catch (err: any) {
    const msg = err.message || 'Import failed';
    let code = 'IMPORT_FETCH_FAILED';
    if (msg.includes('SSRF_PROTECTION')) code = 'SECURITY_VIOLATION_SSRF';
    if (msg.includes('INVALID_URL')) code = 'INVALID_URL';
    if (msg.includes('IMPORT_PROVIDER_NOT_SUPPORTED')) code = 'IMPORT_PROVIDER_NOT_SUPPORTED';

    return res.status(400).json({
      error: code,
      message: msg,
    });
  }
});

// SERVER-SIDE GEMINI AI METADATA ASSISTANT
moviesRouter.post('/admin/ai/metadata-assist', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { title, context } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'TITLE_REQUIRED', message: 'Movie title is required.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        error: 'AI_SERVICE_UNAVAILABLE',
        message: 'Gemini API key is not configured in environment variables.',
      });
    }

    const ai = new GoogleGenAI();
    const prompt = `You are a film database cataloguer. Given the title "${title}" and optional context "${context || ''}", output a strictly formatted JSON object (no markdown, no backticks, no code blocks):
{
  "description": "Engaging, high quality 2-paragraph synopsis without spoilers.",
  "genres": ["Genre1", "Genre2", "Genre3"],
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "suggestedAgeRating": "PG-13 or R or TV-MA",
  "seoTitle": "SEO title under 60 chars",
  "seoDescription": "Meta description under 155 chars"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    const text = response.text || '';
    // Strip markdown code fences if model enclosed it
    const cleanJson = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    return res.json({ suggestions: parsed });
  } catch (err: any) {
    console.error('AI Metadata Assist error:', err);
    return res.status(500).json({
      error: 'AI_PROCESSING_ERROR',
      message: err.message || 'AI assistant encountered an error generating metadata.',
    });
  }
});
