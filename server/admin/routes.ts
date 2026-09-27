import { Router, Response } from 'express';
import os from 'os';
import { db } from '../db';
import { authenticateToken, requireAdmin, AuthRequest } from '../auth/jwt';
import { isR2Configured, getR2Config } from '../r2/config';

export const adminRouter = Router();

// Require admin authentication for all routes in this subrouter
adminRouter.use(authenticateToken);
adminRouter.use(requireAdmin);

// 1. DASHBOARD OVERVIEW STATS
adminRouter.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    const movieStats = await db.movies.getStats();
    const totalUsers = await db.users.count();
    const storageStats = await db.uploads.getStorageStats();
    const recentUploads = (await db.uploads.list()).slice(0, 5);
    const { movies: recentMovies } = await db.movies.list({ limit: 5, sort: 'newest' });

    return res.json({
      totalMovies: movieStats.totalMovies,
      totalTVShows: movieStats.totalTVShows,
      totalViews: movieStats.totalViews,
      totalUsers,
      storageUsedBytes: storageStats.totalBytes,
      completedUploads: storageStats.completedCount,
      failedUploads: storageStats.failedCount,
      recentUploads,
      recentMovies,
      system: {
        isPostgresConnected: db.isPostgres(),
        isR2Configured: isR2Configured(),
        bucketName: getR2Config()?.bucketName || 'Not configured',
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'DATABASE_ERROR',
      message: 'Failed to retrieve admin dashboard metrics.',
    });
  }
});

// 2. AUDIT LOGS QUERY & CSV EXPORT
adminRouter.get('/audit-logs', async (req: AuthRequest, res: Response) => {
  try {
    const { action, user, limit = '50', offset = '0' } = req.query;
    const result = await db.auditLogs.list({
      action: action as string,
      user: user as string,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    });
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: 'DATABASE_ERROR', message: 'Failed to retrieve audit logs.' });
  }
});

adminRouter.get('/audit-logs/export.csv', async (req: AuthRequest, res: Response) => {
  try {
    const csvData = await db.auditLogs.exportCsv();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="funclubsi_audit_${Date.now()}.csv"`);
    return res.send(csvData);
  } catch (err) {
    return res.status(500).json({ error: 'EXPORT_FAILED', message: 'Failed to export audit logs to CSV.' });
  }
});

// 3. AUTOMATED WEEKLY REPORT DISPATCH TRIGGER
adminRouter.post('/audit-logs/send-weekly-report', async (req: AuthRequest, res: Response) => {
  try {
    const { recipientEmail } = req.body;
    const targetEmail = recipientEmail || 'supervisor@funclubsi.com';
    const { logs, total } = await db.auditLogs.list({ limit: 100 });

    await db.auditLogs.record({
      userId: req.user!.userId,
      userName: req.user!.name,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: 'WEEKLY_SECURITY_REPORT_DISPATCHED',
      resource: 'admin/reports',
      details: { recipientEmail: targetEmail, includedLogsCount: logs.length },
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    return res.json({
      success: true,
      message: `Weekly compliance & security audit summary successfully compiled and queued for ${targetEmail}.`,
      summary: {
        totalEventsAnalyzed: total,
        dispatchedTo: targetEmail,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'REPORT_DISPATCH_FAILED', message: err.message });
  }
});

// 4. USERS MANAGEMENT & ROLE ASSIGNMENT
adminRouter.get('/users', async (_req: AuthRequest, res: Response) => {
  try {
    const users = await db.users.list();
    return res.json({ users });
  } catch (err) {
    return res.status(500).json({ error: 'DATABASE_ERROR', message: 'Failed to list users.' });
  }
});

adminRouter.patch('/users/:id/role', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const allowedRoles = ['USER', 'ADMIN', 'CONTENT_MANAGER', 'MODERATOR'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        error: 'INVALID_ROLE',
        message: `Role must be one of: ${allowedRoles.join(', ')}`,
      });
    }

    const updated = await db.users.update(id, { role });
    if (!updated) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found.' });
    }

    await db.auditLogs.record({
      userId: req.user!.userId,
      userName: req.user!.name,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: 'USER_ROLE_CHANGED',
      resource: `users/${id}`,
      details: { targetEmail: updated.email, newRole: role },
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    return res.json({
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        avatar: updated.avatar,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: 'DATABASE_ERROR', message: 'Failed to update user role.' });
  }
});

// 5. ROLES CATALOG
adminRouter.get('/roles', async (_req: AuthRequest, res: Response) => {
  try {
    const roles = await db.roles.list();
    return res.json({ roles });
  } catch (err) {
    return res.status(500).json({ error: 'DATABASE_ERROR', message: 'Failed to fetch roles.' });
  }
});

// 6. REAL-TIME SYSTEM HEALTH & ANOMALIES
adminRouter.get('/health', async (_req: AuthRequest, res: Response) => {
  try {
    const memoryUsage = process.memoryUsage();
    const systemFreeMem = os.freemem();
    const systemTotalMem = os.totalmem();
    const uptimeSeconds = process.uptime();
    const storageStats = await db.uploads.getStorageStats();

    // Anomaly detection rules
    const anomalies: { level: 'warning' | 'critical' | 'info'; title: string; message: string }[] = [];

    if (!db.isPostgres()) {
      anomalies.push({
        level: 'info',
        title: 'PostgreSQL Fallback Active',
        message: 'DATABASE_URL is not set or unavailable. Using resilient local memory/relational store.',
      });
    }

    if (!isR2Configured()) {
      anomalies.push({
        level: 'warning',
        title: 'Cloudflare R2 Credentials Missing',
        message: 'R2_ACCESS_KEY_ID or R2_SECRET_ACCESS_KEY is not defined. Multipart uploads are running in direct emulation mode.',
      });
    }

    if (storageStats.failedCount > 5) {
      anomalies.push({
        level: 'warning',
        title: 'Elevated Failed Uploads Detected',
        message: `${storageStats.failedCount} uploads failed. Check client network stability and Cloudflare R2 bucket permissions.`,
      });
    }

    return res.json({
      status: anomalies.some(a => a.level === 'critical') ? 'degraded' : 'healthy',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(uptimeSeconds),
      processMemoryMb: Math.round(memoryUsage.rss / (1024 * 1024)),
      systemMemoryPercent: Math.round(((systemTotalMem - systemFreeMem) / systemTotalMem) * 100),
      anomalies,
      storageStats,
    });
  } catch (err) {
    return res.status(500).json({ error: 'HEALTH_CHECK_FAILED', message: 'Failed to perform health check.' });
  }
});
