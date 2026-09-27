import { Router, Response } from 'express';
import { authenticateToken, requireAdmin, AuthRequest } from '../auth/jwt';
import {
  createPresignedSingleUpload,
  createMultipartUpload,
  signUploadPart,
  completeMultipartUpload,
  abortMultipartUpload,
  deleteR2Object,
} from '../r2/multipart';
import { isR2Configured, getR2Config } from '../r2/config';
import { db } from '../db';

export const uploadsRouter = Router();

// Validate video MIME types
const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
  'video/x-matroska',
  'application/octet-stream',
];

// Helper to validate video metadata
function validateVideoInput(filename?: string, size?: number, mimeType?: string) {
  if (!filename || !size) {
    throw new Error('Filename and file size are required.');
  }

  const effectiveMime = mimeType || 'video/mp4';
  const hasValidExt = !!filename.match(/\.(mp4|webm|mkv|mov|avi|ts|m4v)$/i);
  const hasValidMime = ALLOWED_VIDEO_TYPES.includes(effectiveMime) || effectiveMime.startsWith('video/');

  if (!hasValidExt && !hasValidMime) {
    throw new Error(`File '${filename}' is not a recognized video format. Please upload MP4, WebM, MKV, or MOV.`);
  }

  // Maximum file size: 50 GB
  const MAX_SIZE = 50 * 1024 * 1024 * 1024;
  if (size > MAX_SIZE) {
    throw new Error('Maximum allowed file size is 50 GB.');
  }

  return { effectiveMime };
}

/**
 * 1. DIRECT SMALL-FILE PRESIGNED UPLOAD (POST /api/admin/uploads/presign)
 * Small JSON request only. Returns Cloudflare R2 Presigned PutObject URL.
 * Browser streams file directly to R2.
 */
uploadsRouter.post('/presign', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { filename, size, contentType, mimeType, movieId } = req.body;
    const effectiveType = contentType || mimeType || 'video/mp4';

    validateVideoInput(filename, size, effectiveType);

    const { presignedUrl, objectKey, publicUrl } = await createPresignedSingleUpload({
      filename,
      mimeType: effectiveType,
      size,
      movieId,
    });

    const uploadRecord = await db.uploads.create({
      uploadId: 'single_' + Date.now(),
      objectKey,
      filename,
      size,
      mimeType: effectiveType,
      status: 'UPLOADING',
      progress: 0,
      createdBy: req.user!.userId,
      movieId,
    });

    return res.status(200).json({
      url: presignedUrl,
      presignedUrl,
      objectKey,
      publicUrl,
      recordId: uploadRecord.id,
      isDirectR2: true,
      r2Configured: isR2Configured(),
    });
  } catch (err: any) {
    console.error('Presign single upload error:', err);
    const isUnconfigured = err.message?.startsWith('R2_NOT_CONFIGURED');
    return res.status(isUnconfigured ? 503 : 400).json({
      error: isUnconfigured ? 'R2_NOT_CONFIGURED' : 'R2_PRESIGN_FAILED',
      message: err.message || 'Could not generate direct Cloudflare R2 upload URL.',
    });
  }
});

/**
 * 2. COMPLETE SMALL-FILE UPLOAD (POST /api/admin/uploads/complete-single)
 * Notifies backend that direct Browser -> R2 PutObject succeeded.
 */
uploadsRouter.post('/complete-single', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { objectKey, filename, size, mimeType, movieId } = req.body;

    if (!objectKey) {
      return res.status(400).json({
        error: 'INVALID_METADATA',
        message: 'objectKey is required to complete upload.',
      });
    }

    const config = getR2Config();
    const publicUrl = config?.publicUrl
      ? `${config.publicUrl.replace(/\/$/, '')}/${objectKey}`
      : config?.endpoint
      ? `${config.endpoint}/${config.bucketName}/${objectKey}`
      : `/api/media/stream/${encodeURIComponent(objectKey)}`;

    await db.auditLogs.record({
      userId: req.user!.userId,
      userName: req.user!.name,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: 'SINGLE_UPLOAD_COMPLETED',
      resource: objectKey,
      details: { filename, size, publicUrl },
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    return res.status(200).json({
      status: 'COMPLETED',
      publicUrl,
      objectKey,
    });
  } catch (err: any) {
    console.error('Complete single upload error:', err);
    return res.status(500).json({
      error: 'COMPLETE_FAILED',
      message: err.message || 'Failed to register completed direct upload.',
    });
  }
});

/**
 * 3. INITIATE MULTIPART UPLOAD (POST /api/admin/uploads/multipart/initiate)
 * Small JSON request only. Initiates S3 multipart on Cloudflare R2.
 */
uploadsRouter.post('/multipart/initiate', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { filename, size, mimeType, contentType, movieId } = req.body;
    const effectiveType = contentType || mimeType || 'video/mp4';

    validateVideoInput(filename, size, effectiveType);

    const { uploadId, objectKey, isDirectR2 } = await createMultipartUpload({
      filename,
      mimeType: effectiveType,
      size,
      movieId,
    });

    const uploadRecord = await db.uploads.create({
      uploadId,
      objectKey,
      filename,
      size,
      mimeType: effectiveType,
      status: 'INITIALIZING',
      progress: 0,
      createdBy: req.user!.userId,
      movieId,
    });

    await db.auditLogs.record({
      userId: req.user!.userId,
      userName: req.user!.name,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: 'UPLOAD_INITIATED',
      resource: objectKey,
      details: { filename, size, mimeType: effectiveType, uploadId, isDirectR2 },
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    const PART_SIZE = 50 * 1024 * 1024; // 50 MiB parts for reliable direct R2 streaming

    return res.status(200).json({
      uploadId,
      objectKey,
      recordId: uploadRecord.id,
      isDirectR2,
      partSize: PART_SIZE,
      chunkSize: PART_SIZE,
      r2Configured: isR2Configured(),
    });
  } catch (err: any) {
    console.error('Initiate upload error:', err);
    const isUnconfigured = err.message?.startsWith('R2_NOT_CONFIGURED');
    return res.status(isUnconfigured ? 503 : 500).json({
      error: isUnconfigured ? 'R2_NOT_CONFIGURED' : 'R2_MULTIPART_INIT_FAILED',
      message: err.message || 'Failed to initialize multipart upload with Cloudflare R2.',
    });
  }
});

/**
 * 4. SIGN PART FOR DIRECT R2 UPLOAD (POST /api/admin/uploads/multipart/sign)
 * Generates genuine Cloudflare R2 Presigned UploadPart URL.
 */
uploadsRouter.post('/multipart/sign', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { uploadId, objectKey, partNumber } = req.body;

    if (!uploadId || !objectKey || !partNumber) {
      return res.status(400).json({
        error: 'INVALID_PARAMETERS',
        message: 'uploadId, objectKey, and partNumber are required.',
      });
    }

    const { presignedUrl, isDirectR2 } = await signUploadPart({
      uploadId,
      objectKey,
      partNumber: parseInt(partNumber, 10),
    });

    await db.uploads.updateStatus(uploadId, 'UPLOADING');

    return res.json({
      url: presignedUrl,
      presignedUrl,
      isDirectR2,
      partNumber,
    });
  } catch (err: any) {
    console.error('Sign part error:', err);
    const isUnconfigured = err.message?.startsWith('R2_NOT_CONFIGURED');
    return res.status(isUnconfigured ? 503 : 500).json({
      error: isUnconfigured ? 'R2_NOT_CONFIGURED' : 'R2_PART_SIGN_FAILED',
      message: err.message || 'Could not generate genuine Cloudflare R2 presigned URL for part.',
    });
  }
});

/**
 * 5. COMPLETE MULTIPART UPLOAD (POST /api/admin/uploads/multipart/complete)
 * Sends ETags array to complete assembly in Cloudflare R2.
 */
uploadsRouter.post('/multipart/complete', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { uploadId, objectKey, parts } = req.body;

    if (!uploadId || !objectKey || !Array.isArray(parts) || parts.length === 0) {
      return res.status(400).json({
        error: 'INVALID_COMPLETION_DATA',
        message: 'uploadId, objectKey, and non-empty parts list with ETags are required.',
      });
    }

    // Verify all parts have valid ETags and PartNumbers
    for (const p of parts) {
      if (!p.PartNumber || !p.ETag) {
        return res.status(400).json({
          error: 'INVALID_PART_SPECIFICATION',
          message: `Part ${p.PartNumber || 'unknown'} is missing required ETag from Cloudflare R2.`,
        });
      }
    }

    const { publicUrl } = await completeMultipartUpload({
      uploadId,
      objectKey,
      parts,
    });

    await db.uploads.updateStatus(uploadId, 'COMPLETED', 100);

    await db.auditLogs.record({
      userId: req.user!.userId,
      userName: req.user!.name,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: 'UPLOAD_COMPLETED',
      resource: objectKey,
      details: { uploadId, totalParts: parts.length, publicUrl },
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    return res.json({
      status: 'COMPLETED',
      publicUrl,
      objectKey,
    });
  } catch (err: any) {
    console.error('Complete multipart error:', err);
    if (req.body.uploadId) {
      await db.uploads.updateStatus(req.body.uploadId, 'FAILED', undefined, err.message);
    }
    return res.status(500).json({
      error: 'MULTIPART_COMPLETE_FAILED',
      message: err.message || 'Failed to complete multipart assembly on Cloudflare R2.',
    });
  }
});

/**
 * 6. ABORT MULTIPART UPLOAD (POST /api/admin/uploads/multipart/abort)
 */
uploadsRouter.post('/multipart/abort', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { uploadId, objectKey } = req.body;
    if (uploadId && objectKey) {
      await abortMultipartUpload({ uploadId, objectKey });
      await db.uploads.updateStatus(uploadId, 'CANCELLED');
    }
    return res.json({ status: 'CANCELLED' });
  } catch (err: any) {
    return res.status(500).json({
      error: 'ABORT_FAILED',
      message: err.message,
    });
  }
});

/**
 * 7. LIST ALL UPLOADS & STORAGE STATS (GET /api/admin/uploads)
 */
uploadsRouter.get('/', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const uploads = await db.uploads.list();
    const stats = await db.uploads.getStorageStats();
    return res.json({
      uploads,
      stats,
      r2Configured: isR2Configured(),
      bucket: getR2Config()?.bucketName || 'funclubsi',
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'DATABASE_ERROR',
      message: 'Failed to fetch storage records.',
    });
  }
});

/**
 * 8. DELETE STORAGE RECORD + R2 OBJECT (DELETE /api/admin/uploads/:id)
 */
uploadsRouter.delete('/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const uploads = await db.uploads.list();
    const target = uploads.find((u) => u.id === id);

    if (!target) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Storage object not found.' });
    }

    if (target.objectKey) {
      await deleteR2Object(target.objectKey);
    }

    await db.uploads.delete(id);

    await db.auditLogs.record({
      userId: req.user!.userId,
      userName: req.user!.name,
      userEmail: req.user!.email,
      userRole: req.user!.role,
      action: 'STORAGE_OBJECT_DELETED',
      resource: target.objectKey,
      details: { filename: target.filename, size: target.size },
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    return res.json({ message: 'Storage object successfully removed.' });
  } catch (err: any) {
    return res.status(500).json({
      error: 'DELETE_FAILED',
      message: err.message,
    });
  }
});
