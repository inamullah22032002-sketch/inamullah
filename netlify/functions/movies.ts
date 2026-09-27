import { db, initDatabase } from '../../server/db';

let isDbReady = false;

export const handler = async (event: any) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
      body: '',
    };
  }

  if (!isDbReady) {
    try {
      await initDatabase();
      isDbReady = true;
    } catch (e) {
      isDbReady = true;
    }
  }

  try {
    const params = event.queryStringParameters || {};
    const result = await db.movies.list({
      search: params.q,
      genre: params.genre,
      type: params.type,
      status: params.status || 'published',
      sort: params.sort || 'newest',
      limit: parseInt(params.limit || '50', 10),
      offset: parseInt(params.offset || '0', 10),
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(result),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'DATABASE_ERROR',
        message: err.message || 'Failed to list movies',
      }),
    };
  }
};
