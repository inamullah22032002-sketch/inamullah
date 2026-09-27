import { Router, Response } from 'express';
import { authenticateToken, requireAdmin, AuthRequest } from '../auth/jwt';
import {
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
];

// 1. INITIATE MULTIPART UPLOAD
uploadsRouter.post('/multipart/initiate', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { filename, size, mimeType, movieId } = req.body;

    if (!filename || !size || !mimeType) {
      return res.status(400).json({
        error: 'INVALID_METADATA',
        message: 'Filename, size, and mimeType are required to initiate upload.',
      });
    }

    if (!ALLOWED_VIDEO_TYPES.includes(mimeType) && !filename.match(/\.(mp4|webm|mkv|mov)$/i)) {
      return res.status(400).json({
        error: 'INVALID_FILE',
        message: `File format '${mimeType}' is not supported. Please upload MP4, WebM, or MKV.`,
      });
    }

    // Maximum file size: 50 GB
    const MAX_SIZE = 50 * 1024 * 1024 * 1024;
    if (size > MAX_SIZE) {
      return res.status(400).json({
        error: 'FILE_TOO_LARGE',
        message: 'Maximum allowed file size is 50 GB.',
      });
    }

    const { uploadId, objectKey, isDirectR2 } = await createMultipartUpload({
      filename,
      mimeType,
      size,
      movieId,
    });

    const uploadRecord = await db.uploads.create({
      uploadId,
      objectKey,
      filename,
      size,
      mimeType,
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
      details: { filename, size, mimeType, uploadId, isDirectR2 },
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    return res.status(200).json({
      uploadId,
      objectKey,
      recordId: uploadRecord.id,
      isDirectR2,
      chunkSize: 20 * 1024 * 1024, // 20 MB chunks for fast concurrency
      r2Configured: isR2Configured(),
    });
  } catch (err: any) {
    console.error('Initiate upload error:', err);
    return res.status(500).json({
      error: 'UPLOAD_INITIALIZATION_FAILED',
      message: err.message || 'Failed to initialize multipart upload with Cloudflare R2.',
    });
  }
});

// 2. SIGN PART FOR DIRECT R2 UPLOAD
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
      presignedUrl,
      isDirectR2,
      partNumber,
    });
  } catch (err: any) {
    console.error('Sign part error:', err);
    return res.status(500).json({
      error: 'PART_UPLOAD_FAILED',
      message: err.message || 'Could not generate presigned signature for part.',
    });
  }
});

// 3. COMPLETE MULTIPART UPLOAD
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
          message: `Part ${p.PartNumber || 'unknown'} is missing required ETag.`,
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
    await db.uploads.updateStatus(req.body.uploadId, 'FAILED', undefined, err.message);
    return res.status(500).json({
      error: 'MULTIPART_COMPLETE_FAILED',
      message: err.message || 'Failed to complete multipart assembly on Cloudflare R2.',
    });
  }
});

// 4. ABORT MULTIPART UPLOAD
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

// 5. LOCAL DEV DIRECT-PART FALLBACK (Returns standard ETag header when running without live R2)
uploadsRouter.put('/direct-part', (req, res) => {
  // Generate valid ETag for chunk simulation
  const dummyETag = `"${Date.now()}-${Math.floor(Math.random() * 1000000)}"`;
  res.setHeader('ETag', dummyETag);
  res.setHeader('Access-Control-Expose-Headers', 'ETag');
  return res.status(200).send('Part received');
});

// 6. LIST ALL UPLOADS & STORAGE
uploadsRouter.get('/', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const uploads = await db.uploads.list();
    const stats = await db.uploads.getStorageStats();
    return res.json({
      uploads,
      stats,
      r2Configured: isR2Configured(),
      bucket: getR2Config()?.bucketName || 'Not configured',
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'DATABASE_ERROR',
      message: 'Failed to fetch storage records.',
    });
  }
});

// 7. DELETE STORAGE RECORD + R2 OBJECT
uploadsRouter.delete('/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const uploads = await db.uploads.list();
    const target = uploads.find(u => u.id === id);

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
