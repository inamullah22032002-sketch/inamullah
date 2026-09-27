import serverless from 'serverless-http';
import { app } from '../../server/app';
import { initDatabase } from '../../server/db';

let isDbReady = false;
let dbInitPromise: Promise<void> | null = null;

const serverlessHandler = serverless(app);

export const handler = async (event: any, context: any) => {
  // Lazily initialize database on first serverless invocation
  if (!isDbReady) {
    if (!dbInitPromise) {
      dbInitPromise = initDatabase()
        .then(() => {
          isDbReady = true;
        })
        .catch((err) => {
          console.warn('Serverless database init warning:', err?.message || err);
          isDbReady = true; // allow resilient in-memory fallback
        });
    }
    await dbInitPromise;
  }

  // Handle serverless request
  return serverlessHandler(event, context);
};
