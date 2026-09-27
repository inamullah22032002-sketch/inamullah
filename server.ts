import path from 'path';
import dotenv from 'dotenv';
import { app } from './server/app';
import { initDatabase } from './server/db';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3000', 10);
const isDev = process.env.NODE_ENV !== 'production';

async function startServer() {
  try {
    // Initialize Database
    await initDatabase();

    if (isDev) {
      // Mount Vite middlewares in development
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      // In production, serve dist folder
      const distPath = path.resolve(__dirname, 'dist');
      app.use(path.posix.join('/', '*'), (_req, res, next) => {
        // Only serve index.html if it's not an API or functions path
        if (_req.path.startsWith('/api') || _req.path.startsWith('/.netlify')) {
          return next();
        }
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 FunclubSI Server running on http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
