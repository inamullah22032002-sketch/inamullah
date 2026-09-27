import { Pool } from 'pg';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import {
  User,
  Movie,
  UploadRecord,
  WatchProgress,
  Favorite,
  WatchlistItem,
  AuditLog,
  ImportJob,
  CustomRole,
  UserRole
} from './types';

// Detect DATABASE_URL
const databaseUrl = process.env.DATABASE_URL;
let pool: Pool | null = null;
let isPostgresConnected = false;

// In-Memory / Structured fallback store for resilient local dev when PG is unconfigured
class InMemoryStore {
  users: Map<string, User> = new Map();
  movies: Map<string, Movie> = new Map();
  uploads: Map<string, UploadRecord> = new Map();
  watchlist: Map<string, WatchlistItem> = new Map();
  favorites: Map<string, Favorite> = new Map();
  progress: Map<string, WatchProgress> = new Map();
  auditLogs: AuditLog[] = [];
  importJobs: Map<string, ImportJob> = new Map();
  roles: Map<string, CustomRole> = new Map();

  constructor() {
    // Initial system roles
    const defaultRoles: CustomRole[] = [
      {
        id: 'ADMIN',
        name: 'Administrator',
        description: 'Full system control, content management, and user governance.',
        permissions: ['*'],
        isSystem: true,
      },
      {
        id: 'CONTENT_MANAGER',
        name: 'Content Manager',
        description: 'Can upload, import, and manage movies and TV shows.',
        permissions: ['movies.create', 'movies.edit', 'movies.delete', 'uploads.manage', 'importers.use'],
        isSystem: true,
      },
      {
        id: 'MODERATOR',
        name: 'Moderator',
        description: 'Can view audit logs and manage user comments.',
        permissions: ['audit.read', 'users.view'],
        isSystem: true,
      },
      {
        id: 'USER',
        name: 'Standard User',
        description: 'Can stream media, create watchlists, favorites, and view history.',
        permissions: ['content.stream', 'watchlist.manage', 'profile.manage'],
        isSystem: true,
      },
    ];

    for (const r of defaultRoles) {
      this.roles.set(r.id, r);
    }
  }
}

const memoryStore = new InMemoryStore();

export async function initDatabase() {
  if (databaseUrl && !databaseUrl.includes('placeholder')) {
    try {
      pool = new Pool({
        connectionString: databaseUrl,
        ssl: databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000,
      });

      // Test connection
      const client = await pool.connect();
      console.log('✅ PostgreSQL connected successfully to database');
      isPostgresConnected = true;

      // Initialize PostgreSQL tables if they do not exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(64) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          role VARCHAR(64) NOT NULL DEFAULT 'USER',
          avatar TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS movies (
          id VARCHAR(64) PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          original_title VARCHAR(255),
          slug VARCHAR(255) UNIQUE NOT NULL,
          description TEXT NOT NULL,
          release_year INT NOT NULL,
          type VARCHAR(32) NOT NULL DEFAULT 'movie',
          genre TEXT[] NOT NULL DEFAULT '{}',
          language VARCHAR(64) NOT NULL DEFAULT 'English',
          country VARCHAR(64) NOT NULL DEFAULT 'USA',
          runtime INT NOT NULL DEFAULT 0,
          age_rating VARCHAR(32),
          imdb_rating NUMERIC(3, 1),
          director VARCHAR(255),
          cast_members TEXT[] NOT NULL DEFAULT '{}',
          tags TEXT[] NOT NULL DEFAULT '{}',
          poster_url TEXT NOT NULL,
          backdrop_url TEXT,
          trailer_url TEXT,
          video_object_key TEXT,
          video_url TEXT,
          subtitles JSONB NOT NULL DEFAULT '[]',
          status VARCHAR(32) NOT NULL DEFAULT 'published',
          views INT NOT NULL DEFAULT 0,
          featured BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS uploads (
          id VARCHAR(64) PRIMARY KEY,
          upload_id VARCHAR(255) NOT NULL,
          object_key TEXT NOT NULL,
          filename VARCHAR(255) NOT NULL,
          size BIGINT NOT NULL,
          mime_type VARCHAR(128) NOT NULL,
          status VARCHAR(32) NOT NULL,
          progress INT NOT NULL DEFAULT 0,
          created_by VARCHAR(64) NOT NULL,
          movie_id VARCHAR(64),
          error_message TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          completed_at TIMESTAMPTZ
        );

        CREATE TABLE IF NOT EXISTS watchlist (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          movie_id VARCHAR(64) NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(user_id, movie_id)
        );

        CREATE TABLE IF NOT EXISTS favorites (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          movie_id VARCHAR(64) NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(user_id, movie_id)
        );

        CREATE TABLE IF NOT EXISTS watch_progress (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          movie_id VARCHAR(64) NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
          playback_time NUMERIC(10, 2) NOT NULL DEFAULT 0,
          duration NUMERIC(10, 2) NOT NULL,
          completed BOOLEAN NOT NULL DEFAULT false,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(user_id, movie_id)
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64) NOT NULL,
          user_name VARCHAR(255) NOT NULL,
          user_email VARCHAR(255) NOT NULL,
          user_role VARCHAR(64) NOT NULL,
          action VARCHAR(128) NOT NULL,
          resource VARCHAR(255) NOT NULL,
          details JSONB,
          ip_address VARCHAR(128),
          user_agent TEXT,
          timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_movies_status ON movies(status);
        CREATE INDEX IF NOT EXISTS idx_movies_release_year ON movies(release_year);
        CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp DESC);
      `);

      client.release();
    } catch (err: any) {
      console.warn('⚠️ PostgreSQL connection failed, switching to resilient fallback store:', err.message);
      isPostgresConnected = false;
    }
  } else {
    console.log('ℹ️ No active DATABASE_URL provided. Operating with in-memory resilient storage.');
  }

  // Ensure an initial administrator exists in the system if no users exist.
  // Note: We DO NOT prefill this in the UI.
  const adminUser = await db.users.findByEmail('admin@funclubsi.com');
  if (!adminUser) {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('FunclubSI#2026!Admin', salt);
    await db.users.create({
      name: 'System Administrator',
      email: 'admin@funclubsi.com',
      passwordHash: hash,
      role: 'ADMIN',
    });
    console.log('🛡️ Bootstrap Administrator account initialized: admin@funclubsi.com');
  }
}

export const db = {
  isPostgres: () => isPostgresConnected,

  users: {
    async findByEmail(email: string): Promise<User | null> {
      const normalizedEmail = email.trim().toLowerCase();
      if (isPostgresConnected && pool) {
        const res = await pool.query('SELECT * FROM users WHERE LOWER(email) = $1', [normalizedEmail]);
        if (res.rows.length === 0) return null;
        const r = res.rows[0];
        return {
          id: r.id,
          name: r.name,
          email: r.email,
          passwordHash: r.password_hash,
          role: r.role as UserRole,
          avatar: r.avatar,
          createdAt: r.created_at.toISOString(),
          updatedAt: r.updated_at.toISOString(),
        };
      }
      for (const u of memoryStore.users.values()) {
        if (u.email.toLowerCase() === normalizedEmail) return u;
      }
      return null;
    },

    async findById(id: string): Promise<User | null> {
      if (isPostgresConnected && pool) {
        const res = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
        if (res.rows.length === 0) return null;
        const r = res.rows[0];
        return {
          id: r.id,
          name: r.name,
          email: r.email,
          passwordHash: r.password_hash,
          role: r.role as UserRole,
          avatar: r.avatar,
          createdAt: r.created_at.toISOString(),
          updatedAt: r.updated_at.toISOString(),
        };
      }
      return memoryStore.users.get(id) || null;
    },

    async create(data: { name: string; email: string; passwordHash: string; role?: UserRole; avatar?: string }): Promise<User> {
      const id = 'usr_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
      const now = new Date().toISOString();
      const user: User = {
        id,
        name: data.name,
        email: data.email.toLowerCase().trim(),
        passwordHash: data.passwordHash,
        role: data.role || 'USER',
        avatar: data.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(data.name)}`,
        createdAt: now,
        updatedAt: now,
      };

      if (isPostgresConnected && pool) {
        await pool.query(
          `INSERT INTO users (id, name, email, password_hash, role, avatar, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [user.id, user.name, user.email, user.passwordHash, user.role, user.avatar, user.createdAt, user.updatedAt]
        );
      } else {
        memoryStore.users.set(id, user);
      }
      return user;
    },

    async update(id: string, updates: Partial<Pick<User, 'name' | 'avatar' | 'role' | 'passwordHash'>>): Promise<User | null> {
      const existing = await db.users.findById(id);
      if (!existing) return null;

      const updated: User = {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      if (isPostgresConnected && pool) {
        await pool.query(
          `UPDATE users SET name = $1, avatar = $2, role = $3, password_hash = $4, updated_at = $5 WHERE id = $6`,
          [updated.name, updated.avatar, updated.role, updated.passwordHash, updated.updatedAt, id]
        );
      } else {
        memoryStore.users.set(id, updated);
      }
      return updated;
    },

    async list(): Promise<Omit<User, 'passwordHash'>[]> {
      if (isPostgresConnected && pool) {
        const res = await pool.query('SELECT id, name, email, role, avatar, created_at, updated_at FROM users ORDER BY created_at DESC');
        return res.rows.map(r => ({
          id: r.id,
          name: r.name,
          email: r.email,
          role: r.role as UserRole,
          avatar: r.avatar,
          createdAt: r.created_at.toISOString(),
          updatedAt: r.updated_at.toISOString(),
        }));
      }
      return Array.from(memoryStore.users.values()).map(u => {
        const { passwordHash, ...rest } = u;
        return rest;
      });
    },

    async count(): Promise<number> {
      if (isPostgresConnected && pool) {
        const res = await pool.query('SELECT COUNT(*) as cnt FROM users');
        return parseInt(res.rows[0].cnt, 10);
      }
      return memoryStore.users.size;
    }
  },

  movies: {
    async list(params: {
      search?: string;
      genre?: string;
      type?: 'movie' | 'tv' | 'all';
      status?: 'published' | 'draft' | 'all';
      sort?: 'newest' | 'rating' | 'popular' | 'year';
      limit?: number;
      offset?: number;
    } = {}): Promise<{ movies: Movie[]; total: number }> {
      const {
        search,
        genre,
        type = 'all',
        status = 'published',
        sort = 'newest',
        limit = 50,
        offset = 0,
      } = params;

      let all: Movie[] = [];

      if (isPostgresConnected && pool) {
        const conditions: string[] = [];
        const values: any[] = [];
        let pIndex = 1;

        if (status !== 'all') {
          conditions.push(`status = $${pIndex++}`);
          values.push(status);
        }

        if (type !== 'all') {
          conditions.push(`type = $${pIndex++}`);
          values.push(type);
        }

        if (genre && genre !== 'All') {
          conditions.push(`$${pIndex++} = ANY(genre)`);
          values.push(genre);
        }

        if (search) {
          conditions.push(`(title ILIKE $${pIndex} OR description ILIKE $${pIndex} OR director ILIKE $${pIndex})`);
          values.push(`%${search}%`);
          pIndex++;
        }

        const whereClause = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
        let orderClause = 'ORDER BY created_at DESC';
        if (sort === 'rating') orderClause = 'ORDER BY imdb_rating DESC NULLS LAST';
        if (sort === 'popular') orderClause = 'ORDER BY views DESC';
        if (sort === 'year') orderClause = 'ORDER BY release_year DESC';

        const totalRes = await pool.query(`SELECT COUNT(*) as count FROM movies ${whereClause}`, values);
        const total = parseInt(totalRes.rows[0].count, 10);

        const listRes = await pool.query(
          `SELECT * FROM movies ${whereClause} ${orderClause} LIMIT $${pIndex++} OFFSET $${pIndex++}`,
          [...values, limit, offset]
        );

        const movies: Movie[] = listRes.rows.map(r => ({
          id: r.id,
          title: r.title,
          originalTitle: r.original_title,
          slug: r.slug,
          description: r.description,
          releaseYear: r.release_year,
          type: r.type,
          genre: r.genre || [],
          language: r.language,
          country: r.country,
          runtime: r.runtime,
          ageRating: r.age_rating,
          imdbRating: r.imdb_rating ? parseFloat(r.imdb_rating) : undefined,
          director: r.director,
          cast: r.cast_members || [],
          tags: r.tags || [],
          posterUrl: r.poster_url,
          backdropUrl: r.backdrop_url,
          trailerUrl: r.trailer_url,
          videoObjectKey: r.video_object_key,
          videoUrl: r.video_url,
          subtitles: r.subtitles || [],
          status: r.status,
          views: r.views || 0,
          featured: r.featured,
          createdAt: r.created_at.toISOString(),
          updatedAt: r.updated_at.toISOString(),
        }));

        return { movies, total };
      }

      // Memory store query
      all = Array.from(memoryStore.movies.values());

      if (status !== 'all') {
        all = all.filter(m => m.status === status);
      }
      if (type !== 'all') {
        all = all.filter(m => m.type === type);
      }
      if (genre && genre !== 'All') {
        all = all.filter(m => m.genre && m.genre.some(g => g.toLowerCase() === genre.toLowerCase()));
      }
      if (search) {
        const q = search.toLowerCase();
        all = all.filter(m =>
          m.title.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q) ||
          (m.director && m.director.toLowerCase().includes(q)) ||
          m.cast.some(c => c.toLowerCase().includes(q)) ||
          m.tags.some(t => t.toLowerCase().includes(q))
        );
      }

      if (sort === 'rating') {
        all.sort((a, b) => (b.imdbRating || 0) - (a.imdbRating || 0));
      } else if (sort === 'popular') {
        all.sort((a, b) => b.views - a.views);
      } else if (sort === 'year') {
        all.sort((a, b) => b.releaseYear - a.releaseYear);
      } else {
        all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }

      const total = all.length;
      const paginated = all.slice(offset, offset + limit);
      return { movies: paginated, total };
    },

    async findById(id: string): Promise<Movie | null> {
      if (isPostgresConnected && pool) {
        const res = await pool.query('SELECT * FROM movies WHERE id = $1', [id]);
        if (res.rows.length === 0) return null;
        const r = res.rows[0];
        return {
          id: r.id,
          title: r.title,
          originalTitle: r.original_title,
          slug: r.slug,
          description: r.description,
          releaseYear: r.release_year,
          type: r.type,
          genre: r.genre || [],
          language: r.language,
          country: r.country,
          runtime: r.runtime,
          ageRating: r.age_rating,
          imdbRating: r.imdb_rating ? parseFloat(r.imdb_rating) : undefined,
          director: r.director,
          cast: r.cast_members || [],
          tags: r.tags || [],
          posterUrl: r.poster_url,
          backdropUrl: r.backdrop_url,
          trailerUrl: r.trailer_url,
          videoObjectKey: r.video_object_key,
          videoUrl: r.video_url,
          subtitles: r.subtitles || [],
          status: r.status,
          views: r.views || 0,
          featured: r.featured,
          createdAt: r.created_at.toISOString(),
          updatedAt: r.updated_at.toISOString(),
        };
      }
      return memoryStore.movies.get(id) || null;
    },

    async findBySlug(slug: string): Promise<Movie | null> {
      if (isPostgresConnected && pool) {
        const res = await pool.query('SELECT * FROM movies WHERE slug = $1', [slug]);
        if (res.rows.length === 0) return null;
        const r = res.rows[0];
        return {
          id: r.id,
          title: r.title,
          originalTitle: r.original_title,
          slug: r.slug,
          description: r.description,
          releaseYear: r.release_year,
          type: r.type,
          genre: r.genre || [],
          language: r.language,
          country: r.country,
          runtime: r.runtime,
          ageRating: r.age_rating,
          imdbRating: r.imdb_rating ? parseFloat(r.imdb_rating) : undefined,
          director: r.director,
          cast: r.cast_members || [],
          tags: r.tags || [],
          posterUrl: r.poster_url,
          backdropUrl: r.backdrop_url,
          trailerUrl: r.trailer_url,
          videoObjectKey: r.video_object_key,
          videoUrl: r.video_url,
          subtitles: r.subtitles || [],
          status: r.status,
          views: r.views || 0,
          featured: r.featured,
          createdAt: r.created_at.toISOString(),
          updatedAt: r.updated_at.toISOString(),
        };
      }
      for (const m of memoryStore.movies.values()) {
        if (m.slug === slug) return m;
      }
      return null;
    },

    async create(data: Omit<Movie, 'id' | 'createdAt' | 'updatedAt' | 'views'>): Promise<Movie> {
      const id = 'mov_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
      const now = new Date().toISOString();
      const movie: Movie = {
        ...data,
        id,
        views: 0,
        createdAt: now,
        updatedAt: now,
      };

      if (isPostgresConnected && pool) {
        await pool.query(
          `INSERT INTO movies (
            id, title, original_title, slug, description, release_year, type,
            genre, language, country, runtime, age_rating, imdb_rating,
            director, cast_members, tags, poster_url, backdrop_url, trailer_url,
            video_object_key, video_url, subtitles, status, views, featured,
            created_at, updated_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)`,
          [
            movie.id, movie.title, movie.originalTitle, movie.slug, movie.description,
            movie.releaseYear, movie.type, movie.genre, movie.language, movie.country,
            movie.runtime, movie.ageRating, movie.imdbRating, movie.director, movie.cast,
            movie.tags, movie.posterUrl, movie.backdropUrl, movie.trailerUrl,
            movie.videoObjectKey, movie.videoUrl, JSON.stringify(movie.subtitles || []),
            movie.status, movie.views, movie.featured || false, movie.createdAt, movie.updatedAt
          ]
        );
      } else {
        memoryStore.movies.set(id, movie);
      }
      return movie;
    },

    async update(id: string, updates: Partial<Movie>): Promise<Movie | null> {
      const existing = await db.movies.findById(id);
      if (!existing) return null;

      const updated: Movie = {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      if (isPostgresConnected && pool) {
        await pool.query(
          `UPDATE movies SET
            title=$1, original_title=$2, slug=$3, description=$4, release_year=$5,
            type=$6, genre=$7, language=$8, country=$9, runtime=$10,
            age_rating=$11, imdb_rating=$12, director=$13, cast_members=$14,
            tags=$15, poster_url=$16, backdrop_url=$17, trailer_url=$18,
            video_object_key=$19, video_url=$20, subtitles=$21, status=$22,
            featured=$23, updated_at=$24
          WHERE id=$25`,
          [
            updated.title, updated.originalTitle, updated.slug, updated.description, updated.releaseYear,
            updated.type, updated.genre, updated.language, updated.country, updated.runtime,
            updated.ageRating, updated.imdbRating, updated.director, updated.cast,
            updated.tags, updated.posterUrl, updated.backdropUrl, updated.trailerUrl,
            updated.videoObjectKey, updated.videoUrl, JSON.stringify(updated.subtitles || []),
            updated.status, updated.featured || false, updated.updatedAt, id
          ]
        );
      } else {
        memoryStore.movies.set(id, updated);
      }
      return updated;
    },

    async delete(id: string): Promise<boolean> {
      if (isPostgresConnected && pool) {
        const res = await pool.query('DELETE FROM movies WHERE id = $1', [id]);
        return (res.rowCount ?? 0) > 0;
      }
      return memoryStore.movies.delete(id);
    },

    async incrementViews(id: string): Promise<void> {
      if (isPostgresConnected && pool) {
        await pool.query('UPDATE movies SET views = views + 1 WHERE id = $1', [id]);
      } else {
        const m = memoryStore.movies.get(id);
        if (m) m.views += 1;
      }
    },

    async getStats(): Promise<{
      totalMovies: number;
      totalTVShows: number;
      totalViews: number;
    }> {
      if (isPostgresConnected && pool) {
        const mRes = await pool.query("SELECT COUNT(*) as count FROM movies WHERE type = 'movie'");
        const tvRes = await pool.query("SELECT COUNT(*) as count FROM movies WHERE type = 'tv'");
        const vRes = await pool.query('SELECT COALESCE(SUM(views), 0) as total_views FROM movies');
        return {
          totalMovies: parseInt(mRes.rows[0].count, 10),
          totalTVShows: parseInt(tvRes.rows[0].count, 10),
          totalViews: parseInt(vRes.rows[0].total_views, 10),
        };
      }
      let movies = 0;
      let tv = 0;
      let views = 0;
      for (const m of memoryStore.movies.values()) {
        if (m.type === 'movie') movies++;
        if (m.type === 'tv') tv++;
        views += m.views || 0;
      }
      return { totalMovies: movies, totalTVShows: tv, totalViews: views };
    }
  },

  uploads: {
    async create(data: Omit<UploadRecord, 'id' | 'createdAt'>): Promise<UploadRecord> {
      const id = 'upl_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
      const record: UploadRecord = {
        ...data,
        id,
        createdAt: new Date().toISOString(),
      };
      if (isPostgresConnected && pool) {
        await pool.query(
          `INSERT INTO uploads (id, upload_id, object_key, filename, size, mime_type, status, progress, created_by, movie_id, error_message, created_at, completed_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [record.id, record.uploadId, record.objectKey, record.filename, record.size, record.mimeType, record.status, record.progress, record.createdBy, record.movieId, record.errorMessage, record.createdAt, record.completedAt]
        );
      } else {
        memoryStore.uploads.set(id, record);
      }
      return record;
    },

    async findByUploadId(uploadId: string): Promise<UploadRecord | null> {
      if (isPostgresConnected && pool) {
        const res = await pool.query('SELECT * FROM uploads WHERE upload_id = $1', [uploadId]);
        if (res.rows.length === 0) return null;
        const r = res.rows[0];
        return {
          id: r.id,
          uploadId: r.upload_id,
          objectKey: r.object_key,
          filename: r.filename,
          size: parseInt(r.size, 10),
          mimeType: r.mime_type,
          status: r.status,
          progress: r.progress,
          createdBy: r.created_by,
          movieId: r.movie_id,
          errorMessage: r.error_message,
          createdAt: r.created_at.toISOString(),
          completedAt: r.completed_at ? r.completed_at.toISOString() : undefined,
        };
      }
      for (const u of memoryStore.uploads.values()) {
        if (u.uploadId === uploadId) return u;
      }
      return null;
    },

    async updateStatus(uploadId: string, status: UploadRecord['status'], progress?: number, errorMessage?: string): Promise<void> {
      const completedAt = status === 'COMPLETED' ? new Date().toISOString() : undefined;
      if (isPostgresConnected && pool) {
        await pool.query(
          `UPDATE uploads SET status = $1, progress = COALESCE($2, progress), error_message = $3, completed_at = COALESCE($4, completed_at)
           WHERE upload_id = $5`,
          [status, progress, errorMessage, completedAt, uploadId]
        );
      } else {
        for (const u of memoryStore.uploads.values()) {
          if (u.uploadId === uploadId) {
            u.status = status;
            if (progress !== undefined) u.progress = progress;
            if (errorMessage) u.errorMessage = errorMessage;
            if (completedAt) u.completedAt = completedAt;
            break;
          }
        }
      }
    },

    async list(): Promise<UploadRecord[]> {
      if (isPostgresConnected && pool) {
        const res = await pool.query('SELECT * FROM uploads ORDER BY created_at DESC LIMIT 100');
        return res.rows.map(r => ({
          id: r.id,
          uploadId: r.upload_id,
          objectKey: r.object_key,
          filename: r.filename,
          size: parseInt(r.size, 10),
          mimeType: r.mime_type,
          status: r.status,
          progress: r.progress,
          createdBy: r.created_by,
          movieId: r.movie_id,
          errorMessage: r.error_message,
          createdAt: r.created_at.toISOString(),
          completedAt: r.completed_at ? r.completed_at.toISOString() : undefined,
        }));
      }
      return Array.from(memoryStore.uploads.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    },

    async delete(id: string): Promise<boolean> {
      if (isPostgresConnected && pool) {
        const res = await pool.query('DELETE FROM uploads WHERE id = $1', [id]);
        return (res.rowCount ?? 0) > 0;
      }
      return memoryStore.uploads.delete(id);
    },

    async getStorageStats(): Promise<{ totalBytes: number; completedCount: number; failedCount: number }> {
      const list = await db.uploads.list();
      let totalBytes = 0;
      let completedCount = 0;
      let failedCount = 0;
      for (const item of list) {
        if (item.status === 'COMPLETED') {
          totalBytes += item.size;
          completedCount++;
        } else if (item.status === 'FAILED') {
          failedCount++;
        }
      }
      return { totalBytes, completedCount, failedCount };
    }
  },

  watchlist: {
    async getByUser(userId: string): Promise<Movie[]> {
      if (isPostgresConnected && pool) {
        const res = await pool.query(
          `SELECT m.* FROM movies m
           INNER JOIN watchlist w ON w.movie_id = m.id
           WHERE w.user_id = $1 ORDER BY w.created_at DESC`,
          [userId]
        );
        return res.rows.map(r => ({
          id: r.id,
          title: r.title,
          originalTitle: r.original_title,
          slug: r.slug,
          description: r.description,
          releaseYear: r.release_year,
          type: r.type,
          genre: r.genre || [],
          language: r.language,
          country: r.country,
          runtime: r.runtime,
          ageRating: r.age_rating,
          imdbRating: r.imdb_rating ? parseFloat(r.imdb_rating) : undefined,
          director: r.director,
          cast: r.cast_members || [],
          tags: r.tags || [],
          posterUrl: r.poster_url,
          backdropUrl: r.backdrop_url,
          trailerUrl: r.trailer_url,
          videoObjectKey: r.video_object_key,
          videoUrl: r.video_url,
          subtitles: r.subtitles || [],
          status: r.status,
          views: r.views || 0,
          featured: r.featured,
          createdAt: r.created_at.toISOString(),
          updatedAt: r.updated_at.toISOString(),
        }));
      }

      const movieIds = Array.from(memoryStore.watchlist.values())
        .filter(w => w.userId === userId)
        .map(w => w.movieId);
      return movieIds.map(id => memoryStore.movies.get(id)).filter(Boolean) as Movie[];
    },

    async isWatchlisted(userId: string, movieId: string): Promise<boolean> {
      if (isPostgresConnected && pool) {
        const res = await pool.query('SELECT 1 FROM watchlist WHERE user_id = $1 AND movie_id = $2', [userId, movieId]);
        return res.rows.length > 0;
      }
      return Array.from(memoryStore.watchlist.values()).some(w => w.userId === userId && w.movieId === movieId);
    },

    async add(userId: string, movieId: string): Promise<void> {
      if (isPostgresConnected && pool) {
        await pool.query(
          `INSERT INTO watchlist (id, user_id, movie_id, created_at)
           VALUES ($1, $2, $3, NOW()) ON CONFLICT (user_id, movie_id) DO NOTHING`,
          ['wl_' + crypto.randomUUID().slice(0, 12), userId, movieId]
        );
      } else {
        const key = `${userId}:${movieId}`;
        memoryStore.watchlist.set(key, {
          id: key,
          userId,
          movieId,
          createdAt: new Date().toISOString(),
        });
      }
    },

    async remove(userId: string, movieId: string): Promise<void> {
      if (isPostgresConnected && pool) {
        await pool.query('DELETE FROM watchlist WHERE user_id = $1 AND movie_id = $2', [userId, movieId]);
      } else {
        memoryStore.watchlist.delete(`${userId}:${movieId}`);
      }
    }
  },

  favorites: {
    async getByUser(userId: string): Promise<Movie[]> {
      if (isPostgresConnected && pool) {
        const res = await pool.query(
          `SELECT m.* FROM movies m
           INNER JOIN favorites f ON f.movie_id = m.id
           WHERE f.user_id = $1 ORDER BY f.created_at DESC`,
          [userId]
        );
        return res.rows.map(r => ({
          id: r.id,
          title: r.title,
          originalTitle: r.original_title,
          slug: r.slug,
          description: r.description,
          releaseYear: r.release_year,
          type: r.type,
          genre: r.genre || [],
          language: r.language,
          country: r.country,
          runtime: r.runtime,
          ageRating: r.age_rating,
          imdbRating: r.imdb_rating ? parseFloat(r.imdb_rating) : undefined,
          director: r.director,
          cast: r.cast_members || [],
          tags: r.tags || [],
          posterUrl: r.poster_url,
          backdropUrl: r.backdrop_url,
          trailerUrl: r.trailer_url,
          videoObjectKey: r.video_object_key,
          videoUrl: r.video_url,
          subtitles: r.subtitles || [],
          status: r.status,
          views: r.views || 0,
          featured: r.featured,
          createdAt: r.created_at.toISOString(),
          updatedAt: r.updated_at.toISOString(),
        }));
      }

      const movieIds = Array.from(memoryStore.favorites.values())
        .filter(f => f.userId === userId)
        .map(f => f.movieId);
      return movieIds.map(id => memoryStore.movies.get(id)).filter(Boolean) as Movie[];
    },

    async isFavorite(userId: string, movieId: string): Promise<boolean> {
      if (isPostgresConnected && pool) {
        const res = await pool.query('SELECT 1 FROM favorites WHERE user_id = $1 AND movie_id = $2', [userId, movieId]);
        return res.rows.length > 0;
      }
      return Array.from(memoryStore.favorites.values()).some(f => f.userId === userId && f.movieId === movieId);
    },

    async add(userId: string, movieId: string): Promise<void> {
      if (isPostgresConnected && pool) {
        await pool.query(
          `INSERT INTO favorites (id, user_id, movie_id, created_at)
           VALUES ($1, $2, $3, NOW()) ON CONFLICT (user_id, movie_id) DO NOTHING`,
          ['fav_' + crypto.randomUUID().slice(0, 12), userId, movieId]
        );
      } else {
        const key = `${userId}:${movieId}`;
        memoryStore.favorites.set(key, {
          id: key,
          userId,
          movieId,
          createdAt: new Date().toISOString(),
        });
      }
    },

    async remove(userId: string, movieId: string): Promise<void> {
      if (isPostgresConnected && pool) {
        await pool.query('DELETE FROM favorites WHERE user_id = $1 AND movie_id = $2', [userId, movieId]);
      } else {
        memoryStore.favorites.delete(`${userId}:${movieId}`);
      }
    }
  },

  progress: {
    async getByUser(userId: string): Promise<WatchProgress[]> {
      if (isPostgresConnected && pool) {
        const res = await pool.query(
          `SELECT p.*, m.title as m_title, m.slug as m_slug, m.poster_url as m_poster, m.backdrop_url as m_backdrop, m.release_year as m_year, m.type as m_type
           FROM watch_progress p
           INNER JOIN movies m ON m.id = p.movie_id
           WHERE p.user_id = $1 AND p.completed = false
           ORDER BY p.updated_at DESC LIMIT 20`,
          [userId]
        );
        return res.rows.map(r => ({
          id: r.id,
          userId: r.user_id,
          movieId: r.movie_id,
          currentTime: parseFloat(r.playback_time ?? r.current_time ?? 0),
          duration: parseFloat(r.duration),
          completed: r.completed,
          updatedAt: r.updated_at.toISOString(),
          movie: {
            id: r.movie_id,
            title: r.m_title,
            slug: r.m_slug,
            posterUrl: r.m_poster,
            backdropUrl: r.m_backdrop,
            releaseYear: r.m_year,
            type: r.m_type,
          } as Movie,
        }));
      }

      return Array.from(memoryStore.progress.values())
        .filter(p => p.userId === userId && !p.completed)
        .map(p => ({
          ...p,
          movie: memoryStore.movies.get(p.movieId),
        }))
        .filter(p => !!p.movie)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    },

    async upsert(userId: string, movieId: string, currentTime: number, duration: number): Promise<void> {
      const completed = duration > 0 && currentTime / duration > 0.92;
      const now = new Date().toISOString();
      const id = `${userId}:${movieId}`;

      if (isPostgresConnected && pool) {
        await pool.query(
          `INSERT INTO watch_progress (id, user_id, movie_id, playback_time, duration, completed, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (user_id, movie_id) DO UPDATE SET
            playback_time = EXCLUDED.playback_time,
            duration = EXCLUDED.duration,
            completed = EXCLUDED.completed,
            updated_at = EXCLUDED.updated_at`,
          [id, userId, movieId, currentTime, duration, completed, now]
        );
      } else {
        memoryStore.progress.set(id, {
          id,
          userId,
          movieId,
          currentTime,
          duration,
          completed,
          updatedAt: now,
        });
      }
    },

    async getByMovieAndUser(userId: string, movieId: string): Promise<WatchProgress | null> {
      if (isPostgresConnected && pool) {
        const res = await pool.query(
          'SELECT * FROM watch_progress WHERE user_id = $1 AND movie_id = $2',
          [userId, movieId]
        );
        if (res.rows.length === 0) return null;
        const r = res.rows[0];
        return {
          id: r.id,
          userId: r.user_id,
          movieId: r.movie_id,
          currentTime: parseFloat(r.playback_time ?? r.current_time ?? 0),
          duration: parseFloat(r.duration),
          completed: r.completed,
          updatedAt: r.updated_at.toISOString(),
        };
      }
      return memoryStore.progress.get(`${userId}:${movieId}`) || null;
    }
  },

  auditLogs: {
    async record(data: {
      userId: string;
      userName: string;
      userEmail: string;
      userRole: UserRole;
      action: string;
      resource: string;
      details?: Record<string, any>;
      ipAddress?: string;
      userAgent?: string;
    }): Promise<AuditLog> {
      const id = 'log_' + crypto.randomUUID().slice(0, 16);
      const timestamp = new Date().toISOString();
      const log: AuditLog = {
        id,
        ...data,
        timestamp,
      };

      if (isPostgresConnected && pool) {
        try {
          await pool.query(
            `INSERT INTO audit_logs (id, user_id, user_name, user_email, user_role, action, resource, details, ip_address, user_agent, timestamp)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              log.id, log.userId, log.userName, log.userEmail, log.userRole,
              log.action, log.resource, JSON.stringify(log.details || {}),
              log.ipAddress, log.userAgent, log.timestamp
            ]
          );
        } catch (e) {
          console.error('Failed to write audit log to PostgreSQL', e);
        }
      }
      memoryStore.auditLogs.unshift(log);
      if (memoryStore.auditLogs.length > 500) memoryStore.auditLogs.pop();
      return log;
    },

    async list(params: { action?: string; user?: string; limit?: number; offset?: number } = {}): Promise<{ logs: AuditLog[]; total: number }> {
      const limit = params.limit || 50;
      const offset = params.offset || 0;

      if (isPostgresConnected && pool) {
        const conditions: string[] = [];
        const values: any[] = [];
        let pIndex = 1;

        if (params.action) {
          conditions.push(`action ILIKE $${pIndex++}`);
          values.push(`%${params.action}%`);
        }
        if (params.user) {
          conditions.push(`(user_email ILIKE $${pIndex} OR user_name ILIKE $${pIndex})`);
          values.push(`%${params.user}%`);
          pIndex++;
        }

        const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
        const countRes = await pool.query(`SELECT COUNT(*) as count FROM audit_logs ${where}`, values);
        const total = parseInt(countRes.rows[0].count, 10);

        const listRes = await pool.query(
          `SELECT * FROM audit_logs ${where} ORDER BY timestamp DESC LIMIT $${pIndex++} OFFSET $${pIndex++}`,
          [...values, limit, offset]
        );

        const logs: AuditLog[] = listRes.rows.map(r => ({
          id: r.id,
          userId: r.user_id,
          userName: r.user_name,
          userEmail: r.user_email,
          userRole: r.user_role as UserRole,
          action: r.action,
          resource: r.resource,
          details: r.details,
          ipAddress: r.ip_address,
          userAgent: r.user_agent,
          timestamp: r.timestamp.toISOString(),
        }));

        return { logs, total };
      }

      let filtered = [...memoryStore.auditLogs];
      if (params.action) {
        filtered = filtered.filter(l => l.action.toLowerCase().includes(params.action!.toLowerCase()));
      }
      if (params.user) {
        const u = params.user.toLowerCase();
        filtered = filtered.filter(l => l.userName.toLowerCase().includes(u) || l.userEmail.toLowerCase().includes(u));
      }
      return {
        logs: filtered.slice(offset, offset + limit),
        total: filtered.length,
      };
    },

    async exportCsv(): Promise<string> {
      const { logs } = await db.auditLogs.list({ limit: 1000 });
      const headers = ['Timestamp', 'User Name', 'User Email', 'Role', 'Action', 'Resource', 'IP Address', 'Details'];
      const rows = logs.map(l => [
        `"${l.timestamp}"`,
        `"${l.userName.replace(/"/g, '""')}"`,
        `"${l.userEmail}"`,
        `"${l.userRole}"`,
        `"${l.action}"`,
        `"${l.resource.replace(/"/g, '""')}"`,
        `"${l.ipAddress || ''}"`,
        `"${JSON.stringify(l.details || {}).replace(/"/g, '""')}"`,
      ]);
      return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }
  },

  roles: {
    async list(): Promise<CustomRole[]> {
      return Array.from(memoryStore.roles.values());
    },
    async get(id: string): Promise<CustomRole | null> {
      return memoryStore.roles.get(id) || null;
    }
  }
};
